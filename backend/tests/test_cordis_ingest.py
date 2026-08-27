from dataclasses import replace
from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from orion.core.db import engine
from orion.ingest.cordis.config import FRAMEWORKS
from orion.ingest.cordis.load import load_framework
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats
from orion.models import (
    Call,
    Funder,
    Organisation,
    OrganisationIdentifier,
    Participation,
    Programme,
    Project,
    ProjectTopic,
    Topic,
)

FIXTURES = Path(__file__).parent / "fixtures" / "cordis"

# Test-scoped source keys and fake PICs: assertions stay valid even when the
# dev database already holds real CORDIS data (everything rolls back anyway).
HE = replace(FRAMEWORKS["cordis-horizon"], source="test-cordis-he")
H2020 = replace(FRAMEWORKS["cordis-h2020"], source="test-cordis-h2020")
SHIFTED = replace(FRAMEWORKS["cordis-horizon"], source="test-cordis-shifted")
CEA_FAKE_PIC = "123456780001"


@pytest.fixture
def db_session():
    """Session wrapped in an outer transaction: commits become savepoints, all rolled back."""
    with engine.connect() as conn:
        outer = conn.begin()
        session = Session(bind=conn, join_transaction_mode="create_savepoint")
        try:
            yield session
        finally:
            session.close()
            outer.rollback()


def _files(subdir: str) -> dict[str, Path]:
    base = FIXTURES / subdir
    return {path.name: path for path in base.iterdir()}


def _load(session: Session, fw, subdir: str) -> RunStats:
    stats = RunStats()
    load_framework(session, fw, _files(subdir), stats)
    return stats


def _count(session: Session, model, *where) -> int:
    return session.scalar(select(func.count()).select_from(model).where(*where)) or 0


def test_loading_twice_is_idempotent(db_session):
    seed_reference(db_session, RunStats())
    first = _load(db_session, HE, "he")
    second = _load(db_session, HE, "he")

    assert first.counts["projects"] == second.counts["projects"] == 2
    assert first.counts["invalid_projects"] == second.counts["invalid_projects"] == 1
    assert first.counts["participations"] == second.counts["participations"] == 4
    assert first.counts["organisations_created"] == 3
    assert second.counts.get("organisations_created") is None
    assert _count(db_session, Project, Project.source == HE.source) == 2
    assert _count(db_session, Participation, Participation.source == HE.source) == 4


def test_pic_identifier_merges_organisations_across_frameworks(db_session):
    seed_reference(db_session, RunStats())
    he_stats = _load(db_session, HE, "he")
    h2020_stats = _load(db_session, H2020, "h2020")

    assert he_stats.counts["organisations_created"] == 3
    # Only Strathclyde is new: the shared PIC reuses the organisation created for HE.
    assert h2020_stats.counts["organisations_created"] == 1

    cea_orgs = db_session.scalars(
        select(OrganisationIdentifier.organisation_id).where(
            OrganisationIdentifier.scheme == "pic",
            OrganisationIdentifier.value == CEA_FAKE_PIC,
        )
    ).all()
    assert len(cea_orgs) == 1
    cea_participations = _count(
        db_session,
        Participation,
        Participation.organisation_id == cea_orgs[0],
        Participation.source.in_([HE.source, H2020.source]),
    )
    assert cea_participations == 3


def test_country_codes_are_normalised_to_iso(db_session):
    seed_reference(db_session, RunStats())
    _load(db_session, HE, "he")
    _load(db_session, H2020, "h2020")

    greek = db_session.scalar(
        select(Organisation).where(Organisation.name == "SMALL GREEK STARTUP TESTFIX")
    )
    assert greek is not None and greek.country_code == "GR"
    strath = db_session.scalar(
        select(Organisation).where(Organisation.name == "UNIVERSITY OF STRATHCLYDE TESTFIX")
    )
    assert strath is not None and strath.country_code == "GB"


def test_amounts_programmes_and_calls_are_mapped(db_session):
    seed_reference(db_session, RunStats())
    _load(db_session, HE, "he")

    hydrox = db_session.scalar(
        select(Project).where(Project.source == HE.source, Project.source_id == "101000001")
    )
    assert hydrox is not None
    assert hydrox.funding_amount == Decimal("2500000.25")
    assert hydrox.funding_currency == "EUR"
    assert hydrox.funding_amount_eur == Decimal("2500000.25")
    assert hydrox.abstract_lang == "en"

    programme = db_session.get(Programme, hydrox.programme_id)
    assert programme is not None
    assert programme.code == "HORIZON.2.5"
    assert programme.name == "Climate, Energy and Mobility"
    parent = db_session.get(Programme, programme.parent_id)
    assert parent is not None and parent.code == "HORIZON"

    call = db_session.get(Call, hydrox.call_id)
    assert call is not None and call.code == "HORIZON-CL5-2021-D3-01"

    greensteel = db_session.scalar(
        select(Project).where(Project.source == HE.source, Project.source_id == "101000002")
    )
    fallback_call = db_session.get(Call, greensteel.call_id)
    assert fallback_call is not None and fallback_call.code == "HORIZON-CL4-2022"


def _project(session: Session, source_id: str) -> Project:
    project = session.scalar(
        select(Project).where(Project.source == SHIFTED.source, Project.source_id == source_id)
    )
    assert project is not None
    return project


def test_parasite_legal_basis_is_recovered_from_legal_basis_csv(db_session):
    """B0.1-A: a shifted row's junk legalBasis never becomes a programme."""
    seed_reference(db_session, RunStats())
    stats = _load(db_session, SHIFTED, "shifted")

    assert stats.counts["projects"] == 5
    assert stats.counts["legal_basis_recovered"] == 3
    assert stats.counts["suspect_legal_basis"] == 1
    # No programme row for any junk code, ever.
    for junk in ("false", "true", "250106", "10.3030/200000004"):
        assert _count(db_session, Programme, Programme.code == junk) == 0

    # 'false' in project.csv, single flagged code in legalBasis.csv.
    tailbrk = _project(db_session, "200000002")
    programme = db_session.get(Programme, tailbrk.programme_id)
    assert programme is not None and programme.code == "HORIZON.2.6"
    # The break happened after the money columns: amounts survive.
    assert tailbrk.funding_amount == Decimal("1500000")

    # Several flagged codes sharing an ancestor: the finest certain attachment.
    multi = _project(db_session, "200000005")
    assert db_session.get(Programme, multi.programme_id).code == "HORIZON.3."

    # Junk with no legalBasis.csv row: framework root, counted, never invented.
    junklb = _project(db_session, "200000004")
    assert db_session.get(Programme, junklb.programme_id).code == "HORIZON"


def test_shifted_project_row_keeps_no_scalar_past_the_break(db_session):
    """B0.1-A: dates, amounts and call of a shifted row are unknown, not wrong."""
    seed_reference(db_session, RunStats())
    stats = _load(db_session, SHIFTED, "shifted")

    assert stats.counts["shifted_projects"] == 1
    headbrk = _project(db_session, "200000003")
    assert headbrk.start_date is None
    assert headbrk.end_date is None
    assert headbrk.total_cost is None
    assert headbrk.funding_amount is None
    assert headbrk.funding_amount_eur is None
    assert headbrk.call_id is None
    # The programme still comes from legalBasis.csv — the one honest source left.
    assert db_session.get(Programme, headbrk.programme_id).code == "HORIZON.1.1"
    # The shifted subCall value never became a call.
    assert _count(db_session, Call, Call.code == "RIA") == 0


def test_money_in_role_column_realigns_only_on_full_signature(db_session):
    """B0.1-B: a monetary role is a shifted row; realign or discard, never keep."""
    seed_reference(db_session, RunStats())
    stats = _load(db_session, SHIFTED, "shifted")

    assert stats.counts["participations"] == 4
    assert stats.counts["participations_realigned"] == 1
    assert stats.counts["suspect_role"] == 2

    rows = {
        p.order_index: p
        for p in db_session.scalars(
            select(Participation).where(Participation.source == SHIFTED.source)
        )
    }
    realigned = rows[4]
    assert realigned.role == "participant"
    assert realigned.amount == Decimal("23893.85")
    assert realigned.amount_eur == Decimal("23893.85")

    # Decimal role without the full signature: everything trailing is unknown.
    discarded = next(p for p in rows.values() if p.role is None and p.amount is None)
    assert discarded is not None
    # A letterless role is dropped; its amount column is intact and kept.
    letterless = rows[2]
    assert letterless.role is None
    assert letterless.amount == Decimal("888")


def test_prune_removes_unreferenced_programmes_and_calls(db_session):
    """B0.1-A: parasites minted by older permissive runs die on the next run."""
    seed_reference(db_session, RunStats())
    _load(db_session, SHIFTED, "shifted")

    funder_id = db_session.scalar(select(Funder.id).where(Funder.code == "ec"))
    root_id = db_session.scalar(
        select(Programme.id).where(Programme.funder_id == funder_id, Programme.code == "HORIZON")
    )
    db_session.add(Programme(funder_id=funder_id, code="false", parent_id=root_id))
    db_session.add(Call(funder_id=funder_id, code="FP7"))
    db_session.commit()

    stats = _load(db_session, SHIFTED, "shifted")
    assert stats.counts["programmes_pruned"] == 1
    assert stats.counts["calls_pruned"] == 1
    assert _count(db_session, Programme, Programme.code == "false") == 0
    assert _count(db_session, Call, Call.code == "FP7") == 0
    # Referenced rows survive the prune.
    assert _count(db_session, Programme, Programme.code == "HORIZON.2.6") == 1
    assert _count(db_session, Call, Call.code == "HORIZON-CALL-2") == 1


def test_euroscivoc_topics_are_linked(db_session):
    seed_reference(db_session, RunStats())
    _load(db_session, HE, "he")

    links = db_session.scalar(
        select(func.count())
        .select_from(ProjectTopic)
        .join(Project, Project.id == ProjectTopic.project_id)
        .where(Project.source == HE.source)
    )
    assert links == 3
    chemistry = db_session.scalar(
        select(Topic).where(Topic.scheme == "euroscivoc", Topic.code == "/23/59")
    )
    assert chemistry is not None and chemistry.label

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

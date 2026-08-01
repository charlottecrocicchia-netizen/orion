from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from orion.core.db import engine
from orion.ingest.anr.config import DATASETS, SOURCE
from orion.ingest.anr.load import load_dataset
from orion.ingest.anr.parse import PERSONAL_DATA_COLUMNS, iter_rows
from orion.ingest.reference import resolve_country, seed_reference
from orion.ingest.runlog import RunStats
from orion.models import (
    Call,
    Organisation,
    OrganisationIdentifier,
    Participation,
    Programme,
    Project,
)

FIXTURES = Path(__file__).parent / "fixtures" / "anr"
FILES = {"projects": FIXTURES / "projects.csv", "partners": FIXTURES / "partners.csv"}

# Fixture ids carry an impossible year (99) so assertions stay scoped to them
# even when the dev database already holds the real ANR data.
TEST_PREFIX = "ANR-99-TEST-"


@pytest.fixture
def db_session():
    with engine.connect() as conn:
        outer = conn.begin()
        session = Session(bind=conn, join_transaction_mode="create_savepoint")
        try:
            yield session
        finally:
            session.close()
            outer.rollback()


def _load(session: Session) -> RunStats:
    stats = RunStats()
    load_dataset(session, DATASETS[0], FILES, stats)
    return stats


def _count(session: Session, model, *where) -> int:
    return session.scalar(select(func.count()).select_from(model).where(*where)) or 0


def test_personal_data_columns_never_reach_the_pipeline():
    rows = list(iter_rows(FILES["partners"]))

    assert rows, "fixture should yield rows"
    for row in rows:
        assert not PERSONAL_DATA_COLUMNS & set(row)
    assert "DUPONT" not in str(rows)


def test_loading_twice_is_idempotent(db_session):
    seed_reference(db_session, RunStats())
    first = _load(db_session)
    second = _load(db_session)

    assert first.counts["projects"] == second.counts["projects"] == 2
    assert first.counts["invalid_projects"] == 1
    assert first.counts["participations"] == second.counts["participations"] == 5
    assert first.counts["orphan_participations"] == 1
    assert first.counts["organisations_created"] == 3
    assert second.counts.get("organisations_created") is None
    assert (
        _count(
            db_session,
            Project,
            Project.source == SOURCE,
            Project.source_id.startswith(TEST_PREFIX),
        )
        == 2
    )
    assert (
        _count(
            db_session,
            Participation,
            Participation.source == SOURCE,
            Participation.source_uid.startswith(TEST_PREFIX),
        )
        == 5
    )


def test_french_country_names_resolve_to_iso_codes():
    assert resolve_country("France") == "FR"
    assert resolve_country("Allemagne") == "DE"
    assert resolve_country("Espagne") == "ES"
    assert resolve_country("États-Unis") == "US"
    assert resolve_country("Royaume-Uni") == "GB"
    assert resolve_country("FR") == "FR"
    assert resolve_country("Pays imaginaire") is None


def test_long_and_parenthesised_country_forms_resolve():
    """The forms ANR actually publishes, which the first implementation missed."""
    assert resolve_country("États-Unis d'Amérique") == "US"
    assert resolve_country("Royaume-Uni de Grande-Bretagne et d'Irlande du Nord") == "GB"
    assert resolve_country("Russie") == "RU"
    assert resolve_country("Corée (République de)") == "KR"
    assert resolve_country("Congo (République démocratique du)") == "CD"
    assert resolve_country("Bolivie") == "BO"
    assert resolve_country("Tanzanie") == "TZ"
    assert resolve_country("Moldavie") == "MD"
    assert resolve_country("Réunion") == "RE"
    assert resolve_country("Palestine") == "PS"
    assert resolve_country("Cook (Îles)") == "CK"
    assert resolve_country("Saint-Kitts-et-Nevis") == "KN"


def test_country_is_backfilled_when_a_later_row_supplies_it(db_session):
    seed_reference(db_session, RunStats())
    stats = _load(db_session)

    late = db_session.scalar(
        select(Organisation).where(Organisation.name == "Laboratoire sans pays au premier passage")
    )
    assert late is not None
    # First sighting had an empty country; a later row says France.
    assert late.country_code == "FR"
    assert stats.counts["country_backfilled"] == 1


def test_partner_countries_and_rnsr_identity(db_session):
    seed_reference(db_session, RunStats())
    _load(db_session)

    german = db_session.scalar(
        select(Organisation).where(Organisation.name == "Institut partenaire allemand de test")
    )
    assert german is not None and german.country_code == "DE"

    rnsr_orgs = db_session.scalars(
        select(OrganisationIdentifier.organisation_id).where(
            OrganisationIdentifier.scheme == "rnsr", OrganisationIdentifier.value == "999999999T"
        )
    ).all()
    assert len(rnsr_orgs) == 1
    # The same lab funded on both projects must be one organisation, not two.
    assert (
        _count(
            db_session,
            Participation,
            Participation.organisation_id == rnsr_orgs[0],
            Participation.source_uid.startswith(TEST_PREFIX),
        )
        == 2
    )


def test_project_fields_languages_amounts_and_call(db_session):
    seed_reference(db_session, RunStats())
    _load(db_session)

    hydro = db_session.scalar(
        select(Project).where(Project.source == SOURCE, Project.source_id == "ANR-99-TEST-0001")
    )
    assert hydro is not None
    assert hydro.title_lang == "fr" and hydro.title.startswith("Catalyseurs")
    assert hydro.abstract_lang == "fr"
    assert hydro.funding_amount == Decimal("450000.5")
    assert hydro.funding_currency == "EUR" and hydro.funding_amount_eur == Decimal("450000.5")
    assert hydro.url == "https://anr.fr/Projet-ANR-99-TEST-0001"
    assert str(hydro.start_date) == "2024-03-01"

    programme = db_session.get(Programme, hydro.programme_id)
    assert programme is not None and programme.code == "AAPG"
    call = db_session.get(Call, hydro.call_id)
    assert call is not None and call.code == "AAPG-2024"

    # English-only project keeps its language tag honest.
    bio = db_session.scalar(
        select(Project).where(Project.source == SOURCE, Project.source_id == "ANR-99-TEST-0002")
    )
    assert bio is not None and bio.title_lang == "en" and bio.abstract_lang == "en"

    coordinator = db_session.scalar(
        select(Participation).where(
            Participation.source == SOURCE, Participation.source_uid == "ANR-99-TEST-0001-01"
        )
    )
    assert coordinator is not None
    assert coordinator.role == "coordinator"
    assert coordinator.amount == Decimal("250000.5")


def test_programme_codes_are_canonicalized(db_session):
    """Blanc/BLANC merge into one programme; a year-as-code row folds into the
    programme named aside; the readable spelling survives as the label."""
    from orion.ingest.anr.load import _funder, _programme_id

    seed_reference(db_session, RunStats())
    funder = _funder(db_session)
    cache: dict[str, int] = {}

    blanc = _programme_id(db_session, cache, funder.id, "Blanc", None)
    assert _programme_id(db_session, {}, funder.id, "BLANC", None) == blanc

    satt = _programme_id(db_session, {}, funder.id, "2010", "SATT")
    assert _programme_id(db_session, {}, funder.id, "SATT", None) == satt
    assert _programme_id(db_session, {}, funder.id, "2025", "SATT") == satt

    from orion.models import Programme

    stored = db_session.get(Programme, blanc)
    assert stored.code == "BLANC"
    assert stored.name == "Blanc"  # the mixed-case spelling survives as label

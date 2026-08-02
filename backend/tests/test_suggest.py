import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from orion.core.db import engine
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats
from orion.models import Funder, Organisation, Project
from orion.search.service import suggest

MARK = "ZZSUG"


@pytest.fixture
def db_session(test_database):
    with engine.connect() as conn:
        outer = conn.begin()
        session = Session(bind=conn, join_transaction_mode="create_savepoint")
        seed_reference(session, RunStats())
        session.flush()
        try:
            yield session
        finally:
            session.close()
            outer.rollback()


@pytest.fixture
def seeded(db_session):
    funder = db_session.scalar(select(Funder).where(Funder.code == "ec"))
    org = Organisation(name=f"{MARK} Fraunhofer Institut", country_code="DE", org_type="REC")
    db_session.add(org)
    project = Project(
        source=f"test-{MARK.lower()}",
        source_id=f"{MARK}-1",
        title=f"{MARK} hydrogen generator",
        acronym=f"{MARK}H2",
        funder_id=funder.id,
        funding_amount_eur=1_000_000,
    )
    db_session.add(project)
    db_session.flush()
    return {"org": org.id, "project": project.id}


def test_suggest_matches_organisations_including_typos(db_session, seeded):
    by_prefix = suggest(db_session, f"{MARK} Fraun")
    assert any(o["id"] == seeded["org"] for o in by_prefix["organisations"]), by_prefix

    # Trigram tolerance: a misspelling must still surface the organisation.
    by_typo = suggest(db_session, f"{MARK} Fraunhoffer")
    assert any(o["id"] == seeded["org"] for o in by_typo["organisations"]), by_typo


def test_suggest_matches_projects_by_acronym_prefix(db_session, seeded):
    result = suggest(db_session, f"{MARK}H")
    assert any(p["acronym"] == f"{MARK}H2" for p in result["projects"]), result


def test_suggest_needs_two_characters(db_session):
    assert suggest(db_session, "a") == {"organisations": [], "projects": []}

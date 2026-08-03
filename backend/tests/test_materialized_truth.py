"""A materialised aggregate must never lie (chantier performance, O2).

The founder's condition for accepting pre-computed aggregates: prove
they say the same thing as the live computation. This test recomputes
every materialised view from the raw tables and compares, row by row.
A drift — a forgotten REFRESH in the chain, a view whose definition
diverged from the query it replaced — fails the build instead of
reaching a reader.
"""

import pytest
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from orion.core.db import engine
from orion.ingest.dedup.merge import MATERIALIZED_VIEWS
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats
from orion.models import Funder, Organisation, Participation, Programme, Project

MARK = "ZZMAT"


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


def test_every_materialized_view_is_refreshed_by_the_chain():
    """The list the chain refreshes must cover every materialised view in
    the schema — a view added without wiring would silently go stale."""
    with engine.connect() as conn:
        existing = {
            row[0]
            for row in conn.execute(
                text("SELECT matviewname FROM pg_matviews WHERE schemaname = 'public'")
            )
        }
    assert existing <= set(MATERIALIZED_VIEWS), (
        f"materialised views nobody refreshes: {existing - set(MATERIALIZED_VIEWS)}"
    )


def test_country_stats_says_exactly_what_the_live_query_says(db_session):
    """Seed a country's worth of data, refresh, and compare the view to
    the aggregate it replaced — same projects, same euros."""
    funder = db_session.scalar(select(Funder).where(Funder.code == "ec"))
    programme = Programme(funder_id=funder.id, code=f"{MARK}-P")
    db_session.add(programme)
    db_session.flush()
    organisation = Organisation(name=f"{MARK} Lab", country_code="PT")
    db_session.add(organisation)
    db_session.flush()
    for index, amount in enumerate((120_000, 80_000)):
        project = Project(
            source=f"test-{MARK}",
            source_id=f"{MARK}-{index}",
            title=f"{MARK} project {index}",
            funder_id=funder.id,
            programme_id=programme.id,
            start_date="2022-01-01",
        )
        db_session.add(project)
        db_session.flush()
        db_session.add(
            Participation(
                project_id=project.id,
                organisation_id=organisation.id,
                role="coordinator",
                country_code="PT",
                amount_eur=amount,
                source=f"test-{MARK}",
                source_uid=f"{MARK}-{index}",
            )
        )
    db_session.flush()
    # The savepoint session cannot REFRESH CONCURRENTLY (it needs its own
    # transaction), so the comparison runs against a non-concurrent
    # refresh of the same definition — what matters is the CONTENT.
    db_session.execute(text("REFRESH MATERIALIZED VIEW country_stats"))

    materialised = db_session.execute(
        text("SELECT projects_count, funding_eur FROM country_stats WHERE code = 'PT'")
    ).one()
    live = db_session.execute(
        text("""
        SELECT count(DISTINCT pa.project_id) AS projects_count,
               coalesce(sum(pa.amount_eur), 0) AS funding_eur
        FROM participations pa JOIN countries c ON c.code = pa.country_code
        WHERE pa.country_code = 'PT'
        """)
    ).one()
    assert materialised.projects_count == live.projects_count
    assert float(materialised.funding_eur) == pytest.approx(float(live.funding_eur))
    assert materialised.projects_count == 2
    assert float(materialised.funding_eur) == pytest.approx(200_000)


def test_country_stats_matches_the_live_query_on_every_country(db_session):
    """Not just the seeded country: the whole view is compared to the
    live aggregate, so a definition drift anywhere is caught."""
    db_session.execute(text("REFRESH MATERIALIZED VIEW country_stats"))
    drift = db_session.execute(
        text("""
        WITH live AS (
            SELECT pa.country_code AS code,
                   count(DISTINCT pa.project_id) AS projects_count,
                   coalesce(sum(pa.amount_eur), 0) AS funding_eur
            FROM participations pa JOIN countries c ON c.code = pa.country_code
            GROUP BY pa.country_code
        )
        SELECT count(*) FROM country_stats m
        FULL OUTER JOIN live l ON l.code = m.code
        WHERE m.code IS NULL
           OR l.code IS NULL
           OR m.projects_count <> l.projects_count
           OR round(m.funding_eur, 2) <> round(l.funding_eur, 2)
        """)
    ).scalar_one()
    assert drift == 0


def test_identity_runs_do_not_invalidate_the_project_caches(db_session):
    """O4: the weekly identity chain (GLEIF, Wikidata, groups) touches no
    project — its runs must leave the project caches standing, or every
    Monday morning the first visitor pays for a refresh that changed
    nothing."""
    from orion.search.service import _data_stamp

    before = _data_stamp(db_session)
    db_session.execute(
        text("""
        INSERT INTO ingestion_runs (source, status, started_at, finished_at)
        VALUES ('gleif', 'succeeded', now(), now())
        """)
    )
    db_session.flush()
    assert _data_stamp(db_session) == before, "an identity run invalidated the corpus caches"

    db_session.execute(
        text("""
        INSERT INTO ingestion_runs (source, status, started_at, finished_at)
        VALUES ('nih', 'succeeded', now(), now())
        """)
    )
    db_session.flush()
    assert _data_stamp(db_session) != before, "a corpus run failed to invalidate the caches"

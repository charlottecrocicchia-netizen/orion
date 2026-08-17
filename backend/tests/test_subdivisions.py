"""La maille sous le pays (lot D, 2026-08-17) : le référentiel est
complet et l'index sort TOUTE maille référencée — financée ou non (le
gris dira l'absence, jamais une maille manquante). L'Explorateur sait
distribuer par subdivision, et le pays cadre la vue."""

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.core.db import engine
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats
from orion.ingest.subdivisions import (
    US_STATES,
    US_TERRITORIES,
    seed_subdivisions,
    subdivision_index,
)


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


def _seed_participations(session: Session) -> None:
    funder = session.execute(text("SELECT id FROM funders WHERE code = 'ec'")).scalar_one()
    session.execute(
        text(
            "INSERT INTO projects (source, source_id, title, funder_id, start_date) VALUES "
            "('test-sd', 'sd-1', 'zz un', :f, '2023-01-01'), "
            "('test-sd', 'sd-2', 'zz deux', :f, '2023-01-01')"
        ),
        {"f": funder},
    )
    session.execute(
        text(
            "INSERT INTO organisations (name, name_normalized, country_code) VALUES "
            "('ZZ MIT', 'zz mit', 'US'), ('ZZ CALTECH', 'zz caltech', 'US')"
        )
    )
    ids = {
        r.name: r.id
        for r in session.execute(text("SELECT id, name FROM organisations WHERE name LIKE 'ZZ %'"))
    }
    projects = {
        r.source_id: r.id
        for r in session.execute(
            text("SELECT id, source_id FROM projects WHERE source = 'test-sd'")
        )
    }
    rows = [
        ("sd-1", "ZZ MIT", "US-MA", 3_000_000, "u1"),
        ("sd-2", "ZZ MIT", "US-MA", 1_000_000, "u2"),
        ("sd-1", "ZZ CALTECH", "US-CA", 5_000_000, "u3"),
    ]
    for sid, org, subdivision, amount, uid in rows:
        session.execute(
            text(
                "INSERT INTO participations (project_id, organisation_id, role, country_code, "
                "subdivision_code, amount_eur, source, source_uid) "
                "VALUES (:p, :o, 'participant', 'US', :sd, :a, 'test-sd', :u)"
            ),
            {"p": projects[sid], "o": ids[org], "sd": subdivision, "a": amount, "u": uid},
        )
    session.flush()


def test_the_reference_is_complete_and_written_once(db_session):
    seed_subdivisions(db_session, RunStats())
    codes = {
        r[0]
        for r in db_session.execute(text("SELECT code FROM subdivisions WHERE country_code = 'US'"))
    }
    assert len(codes) == len(US_STATES) + len(US_TERRITORIES) == 56
    assert "US-CA" in codes and "US-DC" in codes and "US-PR" in codes
    # Rejouable : le référentiel est remplacé, jamais dupliqué.
    seed_subdivisions(db_session, RunStats())
    assert (
        db_session.execute(
            text("SELECT count(*) FROM subdivisions WHERE country_code = 'US'")
        ).scalar()
        == 56
    )


def test_the_index_lists_every_mesh_funded_or_not(db_session):
    seed_subdivisions(db_session, RunStats())
    _seed_participations(db_session)
    index = subdivision_index(db_session, "US")

    assert len(index) == 56, "toute maille référencée sort — le gris dit l'absence"
    by_code = {row["code"]: row for row in index}
    assert by_code["US-CA"]["funding_eur"] == pytest.approx(5_000_000)
    assert by_code["US-CA"]["projects_count"] == 1
    # Deux participations, deux projets DISTINCTS.
    assert by_code["US-MA"]["funding_eur"] == pytest.approx(4_000_000)
    assert by_code["US-MA"]["projects_count"] == 2
    assert by_code["US-WY"]["funding_eur"] == 0
    assert by_code["US-WY"]["projects_count"] == 0
    # Classé par financement : la Californie mène.
    assert index[0]["code"] == "US-CA"
    assert index[0]["name"] == "California"


def test_explore_distributes_by_subdivision(db_session):
    from orion.search.explore import aggregate

    seed_subdivisions(db_session, RunStats())
    _seed_participations(db_session)

    result = aggregate(db_session, metric="funding", by="subdivision", country="US")
    assert result is not None
    series = {s["key"]: s for s in result["series"]}
    assert series["US-CA"]["value"] == pytest.approx(5_000_000)
    assert series["US-CA"]["label"] == "California"
    # Seules les participations TAGUÉES entrent : pas de maille fantôme.
    assert set(series) == {"US-CA", "US-MA"}

    # La maille se compare comme une dimension de plein droit.
    compared = aggregate(
        db_session,
        metric="funding",
        by="subdivision",
        split=True,
        compare=["US-CA", "US-MA"],
    )
    assert compared is not None
    assert {s["key"] for s in compared["series"]} == {"US-CA", "US-MA"}

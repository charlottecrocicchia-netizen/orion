"""La couverture (lot E, 2026-08-17). Règle fondatrice : plus jamais un
écran où l'absence de données se fait passer pour un zéro.

Le registre est DÉRIVÉ de ce qui est chargé — pas une prose à tenir à
jour : un bailleur qui n'a aucun projet ne couvre rien, un pays vu par
ses seules participations est « participations » (son budget domestique
est invisible, PAS nul), un pays sans rien est « none »."""

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.core.db import engine
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats
from orion.search import coverage
from orion.search.explore import aggregate
from orion.search.service import _CACHE


@pytest.fixture
def db_session(test_database):
    with engine.connect() as conn:
        outer = conn.begin()
        session = Session(bind=conn, join_transaction_mode="create_savepoint")
        seed_reference(session, RunStats())
        session.flush()
        _CACHE.clear()
        try:
            yield session
        finally:
            _CACHE.clear()
            session.close()
            outer.rollback()


def _seed(session: Session) -> None:
    """Un projet de la Commission (FR + JP), un projet NIH (US)."""
    ec = session.execute(text("SELECT id FROM funders WHERE code = 'ec'")).scalar_one()
    nih = session.execute(text("SELECT id FROM funders WHERE code = 'nih'")).scalar_one()
    for source, source_id, funder in (("cordis-h", "cov-1", ec), ("nih", "cov-2", nih)):
        session.execute(
            text(
                "INSERT INTO projects (source, source_id, title, funder_id, start_date) "
                "VALUES (:s, :sid, 'zz', :f, '2023-01-01')"
            ),
            {"s": source, "sid": source_id, "f": funder},
        )
    session.execute(
        text(
            "INSERT INTO organisations (name, name_normalized, country_code) VALUES "
            "('ZZ FR', 'zz fr', 'FR'), ('ZZ JP', 'zz jp', 'JP'), ('ZZ US', 'zz us', 'US')"
        )
    )
    orgs = {
        r.name: r.id
        for r in session.execute(text("SELECT id, name FROM organisations WHERE name LIKE 'ZZ %'"))
    }
    projects = {
        r.source_id: r.id
        for r in session.execute(
            text("SELECT id, source_id FROM projects WHERE source_id LIKE 'cov-%'")
        )
    }
    rows = [
        ("cov-1", "ZZ FR", "FR", 5_000_000, "c1", "cordis-h"),
        ("cov-1", "ZZ JP", "JP", 1_000_000, "c2", "cordis-h"),
        ("cov-2", "ZZ US", "US", 9_000_000, "c3", "nih"),
    ]
    for sid, org, country, amount, uid, source in rows:
        session.execute(
            text(
                "INSERT INTO participations (project_id, organisation_id, role, country_code, "
                "amount_eur, source, source_uid) "
                "VALUES (:p, :o, 'participant', :c, :a, :s, :u)"
            ),
            {"p": projects[sid], "o": orgs[org], "c": country, "a": amount, "s": source, "u": uid},
        )
    session.flush()


def test_the_classes_derive_from_what_is_actually_loaded(db_session):
    _seed(db_session)
    classes = coverage.coverage_map(db_session)

    assert classes["FR"] == "funders"
    assert classes["US"] == "funders"
    # Le Japon : vu SEULEMENT par sa participation — son budget
    # domestique est invisible chez nous, ce n'est pas un zéro.
    assert classes["JP"] == "participations"
    # Un pays sans rien : « none », jamais confondu avec un zéro.
    assert classes["BR"] == "none"


def test_an_unloaded_funder_covers_nothing(db_session):
    """La classe suit le RÉEL : le référentiel connaît l'ADEME, mais
    aucun projet ADEME n'est chargé — elle ne couvre donc rien."""
    _seed(db_session)
    assert "ademe" in coverage.FUNDER_COVERAGE
    funders = coverage.funders_by_country(db_session)
    assert "ADEME" not in funders.get("FR", [])
    assert any("Commission" in name for name in funders["FR"])


def test_a_mixed_view_confesses_and_a_homogeneous_one_stays_quiet(db_session):
    _seed(db_session)

    mixed = aggregate(db_session, metric="funding", by="country")
    assert mixed is not None
    note = mixed["meta"]["coverage"]
    assert note is not None, "FR+JP+US mélange les couvertures : la vue doit le dire"
    assert set(note["classes"]) == {"funders", "participations"}
    assert "JP" in note["uncovered"]
    assert any("Commission" in name for name in note["funders"])

    # Une vue homogène n'a rien à confesser : cadrée sur l'Europe, elle
    # ne montre que des pays couverts par un bailleur chargé.
    homogeneous = aggregate(db_session, metric="funding", by="country", scope="europe")
    assert homogeneous is not None
    assert homogeneous["meta"]["coverage"] is None

    # Une vue non géographique ne parle pas de couverture.
    themes = aggregate(db_session, metric="funding", by="theme")
    assert themes is not None
    assert themes["meta"]["coverage"] is None


def test_the_country_index_carries_the_class_to_every_surface(db_session):
    from orion.search.aggregates import countries_index

    _seed(db_session)
    db_session.execute(text("REFRESH MATERIALIZED VIEW country_stats"))
    index = {row["code"]: row for row in countries_index(db_session)}
    assert index["JP"]["coverage"] == "participations"
    assert index["FR"]["coverage"] == "funders"
    assert index["FR"]["coverage_funders"]

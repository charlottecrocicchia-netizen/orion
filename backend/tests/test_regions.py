"""Les régions manager (chantier régions, validé le 2026-08-04).

La règle gravée avec le référentiel : AUCUN PAYS À DONNÉES SANS RÉGION —
la liste des pays vivants dérive du corpus, jamais d'une liste en dur
(la leçon Vega du « nom en dur », appliquée à la géographie)."""

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.core.db import engine
from orion.ingest.reference import REGIONS, _known_codes, region_of, seed_reference
from orion.ingest.runlog import RunStats

EXPECTED_REGIONS = {
    "europe",
    "north-america",
    "latin-america",
    "asia-pacific",
    "middle-east-africa",
}


def test_every_known_country_has_a_manager_region():
    """Complétude du référentiel : chaque code ISO connu appartient à une
    région — sauf l'Antarctique, l'exception écrite (aucun financeur)."""
    assert set(REGIONS) == EXPECTED_REGIONS
    unassigned = {code for code in _known_codes() if region_of(code) is None}
    assert unassigned == {"AQ"}, f"codes sans région: {sorted(unassigned)}"


def test_no_code_lives_in_two_regions():
    seen: dict[str, str] = {}
    for name, codes in REGIONS.items():
        for code in codes:
            assert code not in seen, f"{code} est dans {seen[code]} ET {name}"
            seen[code] = name


def test_the_validated_borders_hold():
    """Les frontières validées par la fondatrice (verdict ③) : la
    géographie est la seule règle défendable."""
    assert region_of("IL") == "middle-east-africa"  # 3,2 Md€ — le choix pèse
    assert region_of("RU") == "europe"
    assert region_of("TR") == "europe"
    assert region_of("GF") == "latin-america"  # l'outre-mer au référentiel…
    assert region_of("GL") == "north-america"  # …sauf les trois validés
    assert region_of("HT") == "latin-america"  # 349 M€, orphelin avant ce lot
    assert region_of("MO") == "asia-pacific"


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


def test_no_funded_country_without_a_region(db_session):
    """L'invariant en base : tout pays porteur d'une participation a une
    région. Un chargeur qui introduirait un pays hors référentiel
    casserait ce test, pas la carte."""
    orphans = (
        db_session.execute(
            text("""
        SELECT DISTINCT pa.country_code
        FROM participations pa
        JOIN countries c ON c.code = pa.country_code
        WHERE c.region IS NULL
        """)
        )
        .scalars()
        .all()
    )
    assert orphans == [], f"pays à données sans région: {orphans}"


def test_regions_index_says_exactly_what_country_stats_says(db_session):
    """L'agrégat par région et l'index des pays lisent la même vue : la
    somme des régions doit égaler la somme des pays, au centime."""
    from orion.search.aggregates import countries_index, regions_index

    db_session.execute(text("REFRESH MATERIALIZED VIEW country_stats"))
    countries = countries_index(db_session)
    regions = regions_index(db_session)

    assert {r["region"] for r in regions} <= EXPECTED_REGIONS
    total_countries = sum(c["funding_eur"] for c in countries)
    total_regions = sum(r["funding_eur"] for r in regions)
    assert total_regions == pytest.approx(total_countries)
    assert sum(r["projects_count"] for r in regions) == sum(c["projects_count"] for c in countries)
    # Chaque pays de l'index porte sa région — le front n'a jamais à
    # deviner la géographie.
    assert all(c["region"] in EXPECTED_REGIONS for c in countries)


def test_explore_groups_and_frames_by_region(db_session):
    """La dimension « région » et le cadrage `scope=` de l'Explorateur :
    la somme des régions égale la somme des pays, et un scope réduit la
    vue à ses membres — le référentiel décide, jamais le client."""
    from sqlalchemy import text as sql

    from orion.search.explore import aggregate

    funder = db_session.execute(sql("SELECT id FROM funders WHERE code = 'ec'")).scalar_one()
    rows = [
        ("FR", "europe", 4_000_000),
        ("DE", "europe", 3_000_000),
        ("US", "north-america", 9_000_000),
        ("IL", "middle-east-africa", 1_000_000),
    ]
    for index, (code, _, amount) in enumerate(rows):
        db_session.execute(
            sql("""
            INSERT INTO projects (source, source_id, title, funder_id, start_date,
                                  funding_amount_eur)
            VALUES ('test-zzreg', :sid, :title, :funder, '2022-01-01', :amount)
            """),
            {"sid": f"zzreg-{index}", "title": f"zzreg {index}", "funder": funder,
             "amount": amount},
        )
        project = db_session.execute(
            sql("SELECT id FROM projects WHERE source_id = :sid"), {"sid": f"zzreg-{index}"}
        ).scalar_one()
        db_session.execute(
            sql("""
            INSERT INTO organisations (name, name_normalized, country_code)
            VALUES (:name, :name, :code)
            """),
            {"name": f"zzreg org {index}", "code": code},
        )
        organisation = db_session.execute(
            sql("SELECT id FROM organisations WHERE name = :n"), {"n": f"zzreg org {index}"}
        ).scalar_one()
        db_session.execute(
            sql("""
            INSERT INTO participations (project_id, organisation_id, role, country_code,
                                        amount_eur, source, source_uid)
            VALUES (:p, :o, 'coordinator', :code, :amount, 'test-zzreg', :sid)
            """),
            {"p": project, "o": organisation, "code": code,
             "amount": dict((r[0], r[2]) for r in rows)[code], "sid": f"zzreg-{index}"},
        )
    db_session.flush()

    by_region = aggregate(db_session, metric="funding", by="region", limit=10)
    values = {row["key"]: row["value"] for row in by_region["series"]}
    assert values["europe"] >= 7_000_000
    assert values["north-america"] >= 9_000_000
    assert values["middle-east-africa"] >= 1_000_000

    # Le scope cadre : l'Europe seule, et jamais un slug inventé.
    scoped = aggregate(db_session, metric="funding", by="country", scope="europe", limit=50)
    keys = {row["key"] for row in scoped["series"]}
    assert "FR" in keys and "DE" in keys
    assert "US" not in keys and "IL" not in keys
    assert aggregate(db_session, metric="funding", by="country", scope="atlantide") is None
    # Cadrer une région en groupant par région = un donut à une part : refusé.
    assert aggregate(db_session, metric="funding", by="region", scope="europe") is None

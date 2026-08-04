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

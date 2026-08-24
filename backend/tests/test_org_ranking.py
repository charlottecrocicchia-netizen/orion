"""Non-régression du classement organisations — le cas CNRS (recette
E3, 2026-08-22) : sur une requête exacte d'un sigle, l'entité canonique
DOMINANTE remonte en premier même quand le mot est en QUEUE de son nom,
et les entités liées (préfixées du sigle) restent accessibles derrière.
Le palier « mot entier » (0.95) met tout le monde à égalité de
correspondance ; le financement départage."""

import pytest
from sqlalchemy import text

from orion.core.db import SessionLocal

SRC = "rkg"


@pytest.fixture(scope="module")
def corpus(test_database):
    session = SessionLocal()
    ids: dict[str, int] = {}

    def one(sql: str, **params) -> int:
        return session.execute(text(sql), params).scalar_one()

    try:
        session.execute(
            text(
                "INSERT INTO countries (code, name_en, region, eu_member) "
                "VALUES ('FR', 'France', 'Europe', true) ON CONFLICT (code) DO NOTHING"
            )
        )
        ids["funder"] = one(
            "INSERT INTO funders (code, name, jurisdiction, default_currency) "
            "VALUES ('rkg', 'Fonds ranking', 'EU', 'EUR') RETURNING id"
        )
        # Le sigle en QUEUE du nom canonique — exactement le motif CNRS.
        orgs = {
            "canonical": ("CENTRE NATIONAL DE LA RECHERCHE ZORGATEST", 5_000_000, 5),
            "innovation": ("ZORGATEST INNOVATION", 200_000, 2),
            "delegation": ("ZORGATEST Délégation Essai", 10_000, 1),
        }
        for key, (name, amount, n_projects) in orgs.items():
            org_id = one(
                "INSERT INTO organisations (name, name_normalized, country_code) "
                "VALUES (:n, lower(:n), 'FR') RETURNING id",
                n=name,
            )
            ids[key] = org_id
            for i in range(n_projects):
                pid = one(
                    "INSERT INTO projects (source, source_id, title, funder_id, start_date, "
                    "funding_amount_eur) VALUES (:s, :sid, :t, :f, make_date(2022, 1, 1), :a) "
                    "RETURNING id",
                    s=SRC,
                    sid=f"{key}-{i}",
                    t=f"P {key} {i}",
                    f=ids["funder"],
                    a=amount / n_projects,
                )
                session.execute(
                    text(
                        "INSERT INTO participations (project_id, organisation_id, role, "
                        "country_code, amount, currency, amount_eur, source, source_uid) "
                        "VALUES (:p, :o, 'coordinator', 'FR', :a, 'EUR', :a, :s, :u)"
                    ),
                    {"p": pid, "o": org_id, "a": amount / n_projects, "s": SRC, "u": f"{key}-{i}"},
                )
        session.commit()
        # Le tiebreak lit organisation_stats : rafraîchie comme après un dedup.
        session.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY organisation_stats"))
        session.commit()
        yield ids
    finally:
        for table, clause in (
            ("participations", f"source = '{SRC}'"),
            ("projects", f"source = '{SRC}'"),
            ("organisations", "name ILIKE '%ZORGATEST%'"),
            ("funders", "code = 'rkg'"),
            ("countries", "code = 'FR'"),
        ):
            session.execute(text(f"DELETE FROM {table} WHERE {clause}"))
        session.commit()
        session.execute(text("REFRESH MATERIALIZED VIEW CONCURRENTLY organisation_stats"))
        session.commit()
        session.close()


def test_exact_acronym_puts_the_dominant_canonical_first(corpus, client):
    payload = client.get("/api/search/organisations", params={"q": "zorgatest"}).json()
    names = [row["name"] for row in payload["results"]]
    # La canonique d'abord (mot en queue de nom, financement dominant)…
    assert names[0] == "CENTRE NATIONAL DE LA RECHERCHE ZORGATEST"
    # …et les entités liées restent accessibles, dans l'ordre du poids.
    assert "ZORGATEST INNOVATION" in names
    assert "ZORGATEST Délégation Essai" in names
    assert names.index("ZORGATEST INNOVATION") < names.index("ZORGATEST Délégation Essai")


def test_prefix_boost_no_longer_outranks_the_tail_word_match(corpus, client):
    """Le bug d'origine : le boost préfixe (0.9) seul mettait les
    petites entités devant la canonique. Le palier mot entier (0.95)
    les met à égalité — le financement tranche."""
    payload = client.get("/api/search/organisations", params={"q": "ZORGATEST"}).json()
    assert payload["results"][0]["name"] == "CENTRE NATIONAL DE LA RECHERCHE ZORGATEST"

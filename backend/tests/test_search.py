import pytest
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from orion.core.db import engine
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats
from orion.models import Funder, Organisation, Participation, Programme, Project, ProjectText
from orion.search.service import (
    OrganisationFilters,
    ProjectFilters,
    search_organisations,
    search_projects,
)

MARK = "ZZSEARCH"


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
    """Two bilingual projects and one English-only, with participations."""
    funder = db_session.scalar(select(Funder).where(Funder.code == "ec"))
    root = Programme(funder_id=funder.id, code=f"{MARK}-HORIZON", name="Horizon Europe")
    db_session.add(root)
    db_session.flush()
    cluster = Programme(
        funder_id=funder.id, parent_id=root.id, code=f"{MARK}-CL5", name="Climate and Energy"
    )
    db_session.add(cluster)
    db_session.flush()

    def project(source_id, title, amount, year, programme_id):
        p = Project(
            source=f"test-{MARK}",
            source_id=source_id,
            title=title,
            funder_id=funder.id,
            programme_id=programme_id,
            funding_amount_eur=amount,
            start_date=f"{year}-01-01",
        )
        db_session.add(p)
        db_session.flush()
        return p

    hydro = project(f"{MARK}-1", "Green hydrogen catalysts", 5_000_000, 2023, cluster.id)
    db_session.add_all(
        [
            ProjectText(
                project_id=hydro.id,
                lang="en",
                title="Green hydrogen catalysts",
                abstract="Novel catalysts for hydrogen production at industrial scale.",
            ),
            ProjectText(
                project_id=hydro.id,
                lang="fr",
                title="Catalyseurs pour l'hydrogène vert",
                abstract="Nouveaux catalyseurs pour la production d'hydrogène.",
            ),
        ]
    )

    wind = project(f"{MARK}-2", "Offshore wind blades", 3_000_000, 2020, root.id)
    db_session.add(
        ProjectText(
            project_id=wind.id,
            lang="en",
            title="Offshore wind blades",
            abstract="Recyclable blade materials for offshore wind turbines.",
        )
    )

    org_fr = Organisation(name=f"{MARK} Institut Hydrogène", country_code="FR")
    org_de = Organisation(name=f"{MARK} Wind Institut", country_code="DE")
    db_session.add_all([org_fr, org_de])
    db_session.flush()
    db_session.add_all(
        [
            Participation(
                project_id=hydro.id,
                organisation_id=org_fr.id,
                role="coordinator",
                country_code="FR",
                amount_eur=5_000_000,
                source=f"test-{MARK}",
                source_uid=f"{MARK}-p1",
            ),
            Participation(
                project_id=wind.id,
                organisation_id=org_de.id,
                role="coordinator",
                country_code="DE",
                amount_eur=3_000_000,
                source=f"test-{MARK}",
                source_uid=f"{MARK}-p2",
            ),
        ]
    )
    db_session.flush()
    # The country facet of a lone-country filter reads the materialised
    # pairs (chantier performance, O2): a fixture that inserts data must
    # refresh them, exactly as the ingestion chain does in production.
    db_session.execute(text("REFRESH MATERIALIZED VIEW country_stats"))
    db_session.execute(text("REFRESH MATERIALIZED VIEW country_pair_stats"))
    # Une lentille PUBLIÉE qui ne tague QUE le projet hydrogène : elle
    # permet de prouver qu'une liste cadrée ne montre que son monde.
    db_session.execute(
        text(
            "INSERT INTO lenses (slug, family_key, rank, status) "
            "VALUES (:s, 'zz_test_family', 98, 'published') ON CONFLICT (slug) DO NOTHING"
        ),
        {"s": f"zz{MARK}"},
    )
    db_session.execute(
        text(
            "INSERT INTO project_lens_tags (project_id, lens, tag) VALUES (:p, :s, 'core') "
            "ON CONFLICT (project_id, lens) DO NOTHING"
        ),
        {"p": hydro.id, "s": f"zz{MARK}"},
    )
    db_session.flush()
    return {
        "hydro": hydro.id,
        "wind": wind.id,
        "org_fr": org_fr.id,
        "org_de": org_de.id,
        "lens": f"zz{MARK}",
    }


def _ids(result):
    return [r["id"] for r in result["results"]]


def test_english_query_finds_english_and_french_texts(db_session, seeded):
    result = search_projects(db_session, ProjectFilters(q="hydrogen catalysts"))
    assert seeded["hydro"] in _ids(result)
    assert seeded["wind"] not in _ids(result)


def test_french_query_with_stemming_and_accents(db_session, seeded):
    # "catalyseur" (singular) must match "catalyseurs" via French stemming.
    result = search_projects(db_session, ProjectFilters(q="catalyseur hydrogène"))
    assert seeded["hydro"] in _ids(result)


def test_cognate_crosses_languages(db_session, seeded):
    # unaccent + stemming makes "hydrogène" and "hydrogen" meet on one lexeme.
    result = search_projects(db_session, ProjectFilters(q="hydrogène"))
    assert seeded["hydro"] in _ids(result)


def test_snippet_highlights_the_match(db_session, seeded):
    result = search_projects(db_session, ProjectFilters(q="hydrogen"))
    hit = next(r for r in result["results"] if r["id"] == seeded["hydro"])
    assert hit["snippet"] and "<b>" in hit["snippet"]


def test_display_language_follows_ui_lang(db_session, seeded):
    fr = search_projects(db_session, ProjectFilters(q="hydrogen", lang="fr"))
    hit = next(r for r in fr["results"] if r["id"] == seeded["hydro"])
    assert hit["title"].startswith("Catalyseurs")
    en = search_projects(db_session, ProjectFilters(q="hydrogen", lang="en"))
    hit = next(r for r in en["results"] if r["id"] == seeded["hydro"])
    assert hit["title"].startswith("Green hydrogen")


def test_filters_and_facets(db_session, seeded):
    unfiltered = search_projects(db_session, ProjectFilters())
    assert unfiltered["total"] >= 2
    years = {f["year"] for f in unfiltered["facets"]["years"]}
    assert {2020, 2023} <= years

    by_country = search_projects(db_session, ProjectFilters(countries=["FR"]))
    assert seeded["hydro"] in _ids(by_country)
    assert seeded["wind"] not in _ids(by_country)

    by_year = search_projects(db_session, ProjectFilters(year_from=2022))
    assert seeded["wind"] not in _ids(by_year)

    country_codes = {c["code"] for c in by_country["facets"]["countries"]}
    assert "FR" in country_codes


def test_sort_by_amount(db_session, seeded):
    result = search_projects(db_session, ProjectFilters(sort="amount", size=50))
    ids = _ids(result)
    assert ids.index(seeded["hydro"]) < ids.index(seeded["wind"])


def test_organisation_search_with_typo_tolerance(db_session, seeded):
    exact = search_organisations(db_session, OrganisationFilters(q=f"{MARK} Institut Hydrogène"))
    assert seeded["org_fr"] in _ids(exact)
    fuzzy = search_organisations(db_session, OrganisationFilters(q=f"{MARK} institut hydrogene"))
    assert seeded["org_fr"] in _ids(fuzzy)


def test_organisation_aggregates(db_session, seeded):
    result = search_organisations(db_session, OrganisationFilters(q=f"{MARK} Institut Hydrogène"))
    hit = next(r for r in result["results"] if r["id"] == seeded["org_fr"])
    assert hit["projects_count"] == 1
    assert hit["total_funding_eur"] == 5_000_000.0


def test_a_framed_organisation_list_shows_only_the_lens_world(db_session, seeded):
    """Bug de doctrine du 2026-08-19 : la page portait le cadrage sans
    l'appliquer — l'URL disait aviation, la liste montrait le corpus.
    Une URL qui ment sur son périmètre est l'interdit d'U2."""
    framed = search_organisations(
        db_session, OrganisationFilters(sector=seeded["lens"], sort="funding", size=50)
    )
    ids = _ids(framed)
    # L'organisation du projet tagué est là ; celle du projet hors
    # lentille ne l'est pas.
    assert seeded["org_fr"] in ids
    assert seeded["org_de"] not in ids
    # Et le total dit le monde de la LENTILLE, jamais le corpus.
    assert framed["total"] < 50


def test_a_framed_list_shows_the_lens_figures_not_the_world_figures(db_session, seeded):
    """Le compte de projets et le financement d'une organisation, sous
    cadrage, sont ses chiffres DE LA LENTILLE."""
    # Hors cadrage, l'organisation porte ses deux mondes.
    db_session.execute(
        text(
            "INSERT INTO participations (project_id, organisation_id, role, country_code, "
            "amount_eur, source, source_uid) VALUES (:p, :o, 'partner', 'FR', 2000000, "
            ":src, :uid) ON CONFLICT DO NOTHING"
        ),
        {"p": seeded["wind"], "o": seeded["org_fr"], "src": f"test-{MARK}", "uid": f"{MARK}-p3"},
    )
    db_session.flush()

    monde = search_organisations(db_session, OrganisationFilters(q=f"{MARK} Institut Hydrogène"))
    hit_monde = next(r for r in monde["results"] if r["id"] == seeded["org_fr"])
    assert hit_monde["projects_count"] == 2
    assert hit_monde["total_funding_eur"] == 7_000_000.0

    cadre = search_organisations(
        db_session,
        OrganisationFilters(q=f"{MARK} Institut Hydrogène", sector=seeded["lens"]),
    )
    hit_cadre = next(r for r in cadre["results"] if r["id"] == seeded["org_fr"])
    # Le projet éolien n'est pas de la lentille : il sort des chiffres.
    assert hit_cadre["projects_count"] == 1
    assert hit_cadre["total_funding_eur"] == 5_000_000.0
    # La trajectoire aussi est cadrée : la seule année du projet tagué.
    assert [y["year"] for y in hit_cadre["funding_by_year"]] == [2023]

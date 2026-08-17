import pytest
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from orion.core.db import engine
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats
from orion.models import Funder, Organisation, Participation, Programme, Project
from orion.search import aggregates

MARK = "ZZAGG"


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
    root = Programme(funder_id=funder.id, code=f"{MARK}-ROOT", name="Agg Root")
    db_session.add(root)
    db_session.flush()
    child = Programme(funder_id=funder.id, parent_id=root.id, code=f"{MARK}-CHILD")
    db_session.add(child)
    db_session.flush()

    project = Project(
        source=f"test-{MARK}",
        source_id=f"{MARK}-1",
        title=f"{MARK} project",
        funder_id=funder.id,
        programme_id=child.id,
        funding_amount_eur=7_000_000,
        start_date="2022-05-01",
    )
    org = Organisation(name=f"{MARK} Organisation", country_code="FR")
    db_session.add_all([project, org])
    db_session.flush()
    db_session.add(
        Participation(
            project_id=project.id,
            organisation_id=org.id,
            role="coordinator",
            country_code="FR",
            amount_eur=7_000_000,
            source=f"test-{MARK}",
            source_uid=f"{MARK}-p1",
        )
    )
    db_session.flush()
    db_session.execute(text("REFRESH MATERIALIZED VIEW organisation_stats"))
    return {"project": project.id, "org": org.id, "root": root.id, "child": child.id}


def test_global_stats_shape_and_curve(db_session, seeded):
    stats = aggregates.global_stats(db_session)

    assert stats["totals"]["projects"] >= 1
    assert stats["totals"]["funding_eur"] >= 7_000_000
    years = {row["year"] for row in stats["funding_by_year"]}
    assert 2022 in years


def test_global_stats_space_counters_follow_the_lens(db_session, seeded):
    """Le hero spatial (lot 2, validé 2026-08-17) : ses compteurs suivent
    la lentille — le grand chiffre est « direct + habilitant » (cœur +
    enabling), les organisations et les groupes se comptent sur les
    projets tagués, la courbe se dessine sur les années du SPATIAL."""
    db_session.execute(
        text("INSERT INTO project_lens_tags (project_id, lens, tag) VALUES (:p, 'space', 'core')"),
        {"p": seeded["project"]},
    )
    db_session.flush()
    stats = aggregates.global_stats(db_session)

    assert stats["space"]["core"] == 1
    assert stats["space"]["funding_eur"] == pytest.approx(7_000_000)
    assert stats["space"]["organisations"] >= 1
    assert stats["space"]["groups"] == 0  # la graine n'a pas de groupe
    assert [row["year"] for row in stats["space"]["by_year"]] == [2022]


def test_country_hub_aggregates_and_404(db_session, seeded):
    hub = aggregates.country_hub(db_session, "fr")
    assert hub is not None and hub["code"] == "FR"
    assert hub["kpis"]["projects_count"] >= 1
    assert any(o["id"] == seeded["org"] for o in hub["top_organisations"])
    assert aggregates.country_hub(db_session, "ZZ") is None


def test_programme_hub_rolls_children_into_root(db_session, seeded):
    # Asking for the child must resolve to the root hub, children included.
    hub = aggregates.programme_hub(db_session, seeded["child"])
    assert hub is not None and hub["id"] == seeded["root"]
    assert hub["kpis"]["projects_count"] == 1
    assert hub["kpis"]["funding_eur"] == 7_000_000.0
    assert any(p["id"] == seeded["project"] for p in hub["top_projects"])


def test_programmes_index_contains_seeded_root(db_session, seeded):
    index = aggregates.programmes_index(db_session)
    entry = next(e for e in index if e["id"] == seeded["root"])
    assert entry["projects_count"] == 1
    assert entry["funder_code"] == "ec"

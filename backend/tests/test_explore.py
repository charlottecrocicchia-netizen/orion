import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from orion.core.db import engine
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats
from orion.models import (
    Funder,
    Organisation,
    Participation,
    Programme,
    Project,
    ProjectTopic,
    Topic,
)
from orion.search import explore

MARK = "ZZEXP"


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
    """Two projects (2021, 2023) under one root; FR coordinates, DE participates."""
    funder = db_session.scalar(select(Funder).where(Funder.code == "ec"))
    root = Programme(funder_id=funder.id, code=f"{MARK}-ROOT", name="Explore Root")
    db_session.add(root)
    db_session.flush()
    child = Programme(funder_id=funder.id, parent_id=root.id, code=f"{MARK}-CHILD")
    db_session.add(child)
    db_session.flush()

    org_fr = Organisation(name=f"{MARK} Labo", country_code="FR", org_type="Université")
    org_de = Organisation(name=f"{MARK} Institut", country_code="DE", org_type="REC")
    db_session.add_all([org_fr, org_de])
    db_session.flush()

    for index, (year, amount) in enumerate([(2021, 4_000_000), (2023, 6_000_000)]):
        project = Project(
            source=f"test-{MARK}",
            source_id=f"{MARK}-{index}",
            title=f"{MARK} project {index}",
            funder_id=funder.id,
            programme_id=child.id,
            funding_amount_eur=amount,
            start_date=f"{year}-03-01",
        )
        db_session.add(project)
        db_session.flush()
        db_session.add_all(
            [
                Participation(
                    project_id=project.id,
                    organisation_id=org_fr.id,
                    role="coordinator",
                    country_code="FR",
                    amount_eur=amount * 0.6,
                    source=f"test-{MARK}",
                    source_uid=f"{MARK}-p{index}-fr",
                ),
                Participation(
                    project_id=project.id,
                    organisation_id=org_de.id,
                    role="participant",
                    country_code="DE",
                    amount_eur=amount * 0.4,
                    source=f"test-{MARK}",
                    source_uid=f"{MARK}-p{index}-de",
                ),
            ]
        )
    db_session.flush()

    # Theme fixtures: one level-2 node and two leaves under it, both attached
    # to the FIRST project — the theme dimension must count that project once.
    level2 = Topic(scheme="euroscivoc", code="/23/47", label="computer and information sciences")
    leaf_a = Topic(scheme="euroscivoc", code="/23/47/305", label="internet")
    leaf_b = Topic(scheme="euroscivoc", code="/23/47/307", label="software")
    db_session.add_all([level2, leaf_a, leaf_b])
    db_session.flush()
    first_project = db_session.scalar(select(Project).where(Project.source_id == f"{MARK}-0"))
    db_session.add_all(
        [
            ProjectTopic(project_id=first_project.id, topic_id=leaf_a.id),
            ProjectTopic(project_id=first_project.id, topic_id=leaf_b.id),
        ]
    )
    db_session.flush()
    return {"root": root.id, "fr": org_fr.id, "de": org_de.id, "project0": first_project.id}


def _serie(result, key):
    return next(s for s in result["series"] if s["key"] == key)


def test_funding_by_country_uses_participant_shares(db_session, seeded):
    result = explore.aggregate(db_session, metric="funding", by="country", limit=25)
    assert result["basis"] == "participants"
    assert _serie(result, "FR")["value"] >= 6_000_000  # 60 % of 10 M
    assert _serie(result, "FR")["label"] == "France"


def test_split_year_returns_per_series_points(db_session, seeded):
    result = explore.aggregate(
        db_session, metric="funding", by="country", split=True, compare=["FR", "DE"]
    )
    fr_points = {p["year"]: p["value"] for p in _serie(result, "FR")["points"]}
    assert fr_points[2021] == pytest.approx(2_400_000)
    assert fr_points[2023] == pytest.approx(3_600_000)


def test_programme_dimension_folds_children_into_roots(db_session, seeded):
    result = explore.aggregate(
        db_session, metric="funding", by="programme", compare=[str(seeded["root"])]
    )
    serie = _serie(result, seeded["root"])
    assert serie["value"] == pytest.approx(10_000_000)
    assert serie["label"] == "Explore Root"
    assert result["basis"] == "projects"


def test_orgtype_folds_both_taxonomies(db_session, seeded):
    result = explore.aggregate(
        db_session, metric="projects", by="orgtype", compare=["university", "research"]
    )
    # Université (ANR label) and REC (CORDIS code) each map to a canonical key.
    assert _serie(result, "university")["value"] == 2
    assert _serie(result, "research")["value"] == 2


def test_coordination_ratio_and_year_bounds(db_session, seeded):
    result = explore.aggregate(
        db_session, metric="coordination", by="country", compare=["FR", "DE"], year_from=2022
    )
    assert _serie(result, "FR")["value"] == 100.0
    assert _serie(result, "DE")["value"] == 0.0


def test_avg_is_funding_over_projects(db_session, seeded):
    result = explore.aggregate(
        db_session, metric="avg", by="programme", compare=[str(seeded["root"])]
    )
    assert _serie(result, seeded["root"])["value"] == pytest.approx(5_000_000)


def test_theme_dimension_counts_each_project_once(db_session, seeded):
    """Two leaves under one level-2 theme on the same project → one project,
    its funding counted once, the level-2 label attached."""
    result = explore.aggregate(db_session, metric="projects", by="theme", compare=["/23/47"])
    serie = _serie(result, "/23/47")
    assert serie["value"] == 1
    assert serie["label"] == "computer and information sciences"

    funding = explore.aggregate(db_session, metric="funding", by="theme", compare=["/23/47"])
    assert _serie(funding, "/23/47")["value"] == pytest.approx(4_000_000)


def test_invalid_combinations_return_none(db_session):
    assert explore.aggregate(db_session, metric="organisations", by="programme") is None
    assert explore.aggregate(db_session, metric="funding", by="year", split=True) is None
    assert explore.aggregate(db_session, metric="nope", by="country") is None

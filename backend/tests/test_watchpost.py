import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from orion.core.db import engine
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats
from orion.models import (
    Funder,
    Organisation,
    OrganisationAlias,
    Participation,
    Project,
    ProjectTopic,
    Topic,
)
from orion.search.aggregates import organisation_watchpost

MARK = "ZZWP"


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


def _project(db, funder_id, index, year, amount):
    project = Project(
        source=f"test-{MARK.lower()}",
        source_id=f"{MARK}-{index}",
        title=f"{MARK} project {index}",
        funder_id=funder_id,
        funding_amount_eur=amount,
        start_date=f"{year}-06-01",
    )
    db.add(project)
    db.flush()
    return project


def _participate(db, project, org, amount, index):
    db.add(
        Participation(
            project_id=project.id,
            organisation_id=org.id,
            role="participant",
            country_code=org.country_code,
            amount_eur=amount,
            source=f"test-{MARK.lower()}",
            source_uid=f"{MARK}-{project.source_id}-{org.id}-{index}",
        )
    )


@pytest.fixture
def seeded(db_session):
    """One org with a hot theme (3×300k in 2019-21, 3×500k in 2022-24 — six
    projects, both windows above the euro floor), one poor theme (a single
    10k project), a partner first shared in 2026 and one from 2019, and two
    source aliases."""
    funder = db_session.scalar(select(Funder).where(Funder.code == "ec"))
    org = Organisation(name=f"{MARK} Watch Labs", country_code="FR", org_type="REC")
    fresh = Organisation(name=f"{MARK} New Partner", country_code="DE", org_type="REC")
    old = Organisation(name=f"{MARK} Old Partner", country_code="IT", org_type="REC")
    db_session.add_all([org, fresh, old])
    db_session.flush()

    hot = Topic(scheme="euroscivoc", code="/23/47", label="computer sciences")
    hot_leaf = Topic(scheme="euroscivoc", code="/23/47/305", label="internet")
    poor = Topic(scheme="euroscivoc", code="/29/71", label="niche field")
    db_session.add_all([hot, hot_leaf, poor])
    db_session.flush()

    index = 0
    for year in (2019, 2020, 2021):
        project = _project(db_session, funder.id, index, year, 300_000)
        _participate(db_session, project, org, 300_000, index)
        # Level-2 node AND a leaf under it: the theme must count once.
        db_session.add(ProjectTopic(project_id=project.id, topic_id=hot.id))
        db_session.add(ProjectTopic(project_id=project.id, topic_id=hot_leaf.id))
        index += 1
    for year in (2022, 2023, 2024):
        project = _project(db_session, funder.id, index, year, 500_000)
        _participate(db_session, project, org, 500_000, index)
        db_session.add(ProjectTopic(project_id=project.id, topic_id=hot.id))
        index += 1

    puny = _project(db_session, funder.id, index, 2023, 10_000)
    _participate(db_session, puny, org, 10_000, index)
    db_session.add(ProjectTopic(project_id=puny.id, topic_id=poor.id))
    index += 1

    recent = _project(db_session, funder.id, index, 2026, 800_000)
    _participate(db_session, recent, org, 400_000, index)
    _participate(db_session, recent, fresh, 400_000, index + 100)
    index += 1
    ancient = _project(db_session, funder.id, index, 2019, 200_000)
    _participate(db_session, ancient, org, 100_000, index)
    _participate(db_session, ancient, old, 100_000, index + 100)

    db_session.add_all(
        [
            OrganisationAlias(
                organisation_id=org.id,
                source="cordis",
                name_raw=f"{MARK} WATCH LABS",
                country_raw="FR",
            ),
            OrganisationAlias(
                organisation_id=org.id,
                source="nih",
                name_raw=f"{MARK} WATCH LABS INC",
                country_raw="UNITED STATES",
            ),
        ]
    )
    db_session.flush()
    return {"org": org.id, "fresh": fresh.id}


def test_thematic_profile_counts_a_project_once_per_theme(db_session, seeded):
    result = organisation_watchpost(db_session, seeded["org"], "2024-08-01")
    themes = {t["key"]: t for t in result["top_themes"]}
    # 6 hot projects (node + leaf never double-count), own amounts summed.
    assert themes["/23/47"]["projects"] == 6
    assert themes["/23/47"]["amount_eur"] == pytest.approx(2_400_000)
    assert result["top_themes"][0]["key"] == "/23/47"


def test_accelerating_theme_respects_thresholds(db_session, seeded):
    result = organisation_watchpost(db_session, seeded["org"], "2024-08-01")
    signal = result["signals"]["accelerating_theme"]
    # 900k → 1.5M across six projects: +67 %, above every floor.
    assert signal is not None and signal["key"] == "/23/47"
    assert signal["growth_pct"] == 67
    # The poor theme (one 10k project) must never be the signal.
    assert signal["key"] != "/29/71"


def test_new_partners_respect_the_cutoff(db_session, seeded):
    result = organisation_watchpost(db_session, seeded["org"], "2024-08-01")
    partners = result["signals"]["new_partners"]
    assert partners is not None and partners["count"] == 1
    assert partners["names"] == [f"{MARK} New Partner"]

    ancient_included = organisation_watchpost(db_session, seeded["org"], "2000-01-01")
    assert ancient_included["signals"]["new_partners"]["count"] == 2


def test_sources_count_comes_from_aliases(db_session, seeded):
    result = organisation_watchpost(db_session, seeded["org"], "2024-08-01")
    assert result["sources_count"] == 2

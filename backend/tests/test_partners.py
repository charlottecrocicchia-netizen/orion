import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from orion.core.db import engine
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats
from orion.models import Funder, Organisation, Participation, Programme, Project
from orion.search import aggregates

MARK = "ZZPART"


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
    """Alpha shares two projects with Beta (FR-DE) and one with Gamma (FR-FR)."""
    funder = db_session.scalar(select(Funder).where(Funder.code == "ec"))
    programme = Programme(funder_id=funder.id, code=f"{MARK}-P")
    db_session.add(programme)
    db_session.flush()

    alpha = Organisation(name=f"{MARK} Alpha", country_code="FR")
    beta = Organisation(name=f"{MARK} Beta", country_code="DE")
    gamma = Organisation(name=f"{MARK} Gamma", country_code="FR")
    db_session.add_all([alpha, beta, gamma])
    db_session.flush()

    plans = [
        ("p0", [(alpha, 1_000_000), (beta, 2_000_000)]),
        ("p1", [(alpha, 1_500_000), (beta, 500_000)]),
        ("p2", [(alpha, 800_000), (gamma, 700_000)]),
    ]
    for source_id, members in plans:
        project = Project(
            source=f"test-{MARK}",
            source_id=f"{MARK}-{source_id}",
            title=f"{MARK} {source_id}",
            funder_id=funder.id,
            programme_id=programme.id,
            funding_amount_eur=sum(amount for _, amount in members),
            start_date="2022-02-01",
        )
        db_session.add(project)
        db_session.flush()
        for index, (organisation, amount) in enumerate(members):
            db_session.add(
                Participation(
                    project_id=project.id,
                    organisation_id=organisation.id,
                    role="coordinator" if index == 0 else "participant",
                    country_code=organisation.country_code,
                    amount_eur=amount,
                    source=f"test-{MARK}",
                    source_uid=f"{MARK}-{source_id}-{organisation.id}",
                )
            )
    db_session.flush()
    return {"alpha": alpha.id, "beta": beta.id, "gamma": gamma.id}


def test_partners_ranked_by_shared_projects_then_amount(db_session, seeded):
    partners = aggregates.organisation_partners(db_session, seeded["alpha"])
    assert [p["id"] for p in partners[:2]] == [seeded["beta"], seeded["gamma"]]
    beta = partners[0]
    assert beta["shared_projects"] == 2
    assert beta["partner_amount_eur"] == pytest.approx(2_500_000)
    assert beta["country"] == "DE"


def test_partners_exclude_self(db_session, seeded):
    partners = aggregates.organisation_partners(db_session, seeded["alpha"])
    assert seeded["alpha"] not in [p["id"] for p in partners]


def test_country_flows_pair_projects_and_amounts(db_session, seeded):
    flows = aggregates.country_flows(db_session, limit=200)
    pair = next(f for f in flows if f["a"] == "DE" and f["b"] == "FR")
    assert pair["projects"] == 2
    # both sides' shares on the two shared projects: (2M+0.5M) + (1M+1.5M)
    assert pair["amount_eur"] == pytest.approx(5_000_000)

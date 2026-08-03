"""The organisation file's data (lot 4 bis): the yearly timeline carries
the coordinated/participated split and the project counts, and the
collaborators map knows every partner country."""

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from orion.api.organisations import organisation_detail, organisation_partner_countries
from orion.core.db import engine
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats
from orion.models import Funder, Organisation, Participation, Programme, Project

MARK = "ZZDETAIL"


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
    """Alpha coordinates one 2021 project (1M) and participates in one
    2022 project (2M) beside Beta (DE) and Gamma (IT)."""
    funder = db_session.scalar(select(Funder).where(Funder.code == "ec"))
    programme = Programme(funder_id=funder.id, code=f"{MARK}-P")
    db_session.add(programme)
    db_session.flush()

    alpha = Organisation(name=f"{MARK} Alpha", country_code="FR")
    beta = Organisation(name=f"{MARK} Beta", country_code="DE")
    gamma = Organisation(name=f"{MARK} Gamma", country_code="IT")
    db_session.add_all([alpha, beta, gamma])
    db_session.flush()

    plans = [
        ("p0", "2021-03-01", [(alpha, "coordinator", 1_000_000), (beta, "participant", 400_000)]),
        (
            "p1",
            "2022-05-01",
            [
                (beta, "coordinator", 300_000),
                (alpha, "participant", 2_000_000),
                (gamma, "participant", 100_000),
            ],
        ),
    ]
    for source_id, start, members in plans:
        project = Project(
            source=f"test-{MARK}",
            source_id=f"{MARK}-{source_id}",
            title=f"{MARK} {source_id}",
            funder_id=funder.id,
            programme_id=programme.id,
            funding_amount_eur=sum(amount for _, _, amount in members),
            start_date=start,
        )
        db_session.add(project)
        db_session.flush()
        for organisation, role, amount in members:
            db_session.add(
                Participation(
                    project_id=project.id,
                    organisation_id=organisation.id,
                    role=role,
                    country_code=organisation.country_code,
                    amount_eur=amount,
                    source=f"test-{MARK}",
                    source_uid=f"{MARK}-{source_id}-{organisation.id}",
                )
            )
    db_session.flush()
    return {"alpha": alpha.id, "beta": beta.id, "gamma": gamma.id}


def test_funding_by_year_carries_role_split_and_project_counts(db_session, seeded):
    detail = organisation_detail(seeded["alpha"], db_session)
    by_year = {row["year"]: row for row in detail["funding_by_year"]}
    assert by_year[2021]["amount_eur"] == pytest.approx(1_000_000)
    assert by_year[2021]["coordinated_eur"] == pytest.approx(1_000_000)
    assert by_year[2021]["projects"] == 1
    assert by_year[2022]["amount_eur"] == pytest.approx(2_000_000)
    # Participated year: the coordinated share is an honest zero.
    assert by_year[2022]["coordinated_eur"] == pytest.approx(0)
    assert by_year[2022]["projects"] == 1


def test_partner_countries_aggregate_partners_and_shared_projects(db_session, seeded):
    rows = organisation_partner_countries(seeded["alpha"], db_session)
    by_country = {row["country"]: row for row in rows}
    # Beta (DE) shares both projects; Gamma (IT) shares one.
    assert by_country["DE"] == {"country": "DE", "partners": 1, "shared_projects": 2}
    assert by_country["IT"] == {"country": "IT", "partners": 1, "shared_projects": 1}
    assert rows[0]["country"] == "DE"

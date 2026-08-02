"""The programme drill-down: inside one programme, grouped by its direct
children — projects on the parent itself keep the parent as their bucket."""

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from orion.core.db import engine
from orion.ingest.reference import seed_reference
from orion.ingest.runlog import RunStats
from orion.models import Funder, Programme, Project
from orion.search.explore import aggregate

MARK = "ZZDR"


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
def tree(db_session):
    funder = db_session.scalar(select(Funder).where(Funder.code == "ec"))
    root = Programme(funder_id=funder.id, code=f"{MARK}-ROOT", name=f"{MARK} framework")
    db_session.add(root)
    db_session.flush()
    child_a = Programme(
        funder_id=funder.id, parent_id=root.id, code=f"{MARK}-A", name=f"{MARK} cluster A"
    )
    child_b = Programme(
        funder_id=funder.id, parent_id=root.id, code=f"{MARK}-B", name=f"{MARK} cluster B"
    )
    db_session.add_all([child_a, child_b])
    db_session.flush()
    grandchild = Programme(
        funder_id=funder.id, parent_id=child_a.id, code=f"{MARK}-A1", name=f"{MARK} call A1"
    )
    db_session.add(grandchild)
    db_session.flush()

    amounts = [
        (child_a.id, 100.0),
        (grandchild.id, 50.0),  # rolls up to child A in the drill
        (child_b.id, 30.0),
        (root.id, 20.0),  # attached directly to the parent
    ]
    for index, (programme_id, amount) in enumerate(amounts):
        db_session.add(
            Project(
                source=f"test-{MARK.lower()}",
                source_id=f"{MARK}-{index}",
                title=f"{MARK} project {index}",
                funder_id=funder.id,
                programme_id=programme_id,
                funding_amount_eur=amount,
                start_date="2023-06-01",
            )
        )
    db_session.flush()
    return {"root": root.id, "a": child_a.id, "b": child_b.id}


def test_drill_groups_by_direct_children(db_session, tree):
    result = aggregate(db_session, metric="funding", by="programme", programme=tree["root"])
    values = {serie["key"]: serie["value"] for serie in result["series"]}
    # Grandchild folds into child A; the root's own project stays on the root.
    assert values[tree["a"]] == 150.0
    assert values[tree["b"]] == 30.0
    assert values[tree["root"]] == 20.0
    assert result["total"] == 200.0
    assert result["meta"]["programme"] == tree["root"]
    assert result["meta"]["programme_label"] == f"{MARK} framework"


def test_drill_into_a_leaf_yields_only_the_leaf(db_session, tree):
    result = aggregate(db_session, metric="funding", by="programme", programme=tree["b"])
    assert [serie["key"] for serie in result["series"]] == [tree["b"]]
    assert result["series"][0]["value"] == 30.0


def test_drill_rejects_non_additive_and_foreign_dimensions(db_session, tree):
    assert (
        aggregate(db_session, metric="organisations", by="programme", programme=tree["root"])
        is None
    )
    assert aggregate(db_session, metric="funding", by="country", programme=tree["root"]) is None

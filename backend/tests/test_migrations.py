from sqlalchemy import inspect

from orion.core.db import engine


def test_alembic_baseline_created_ingestion_runs():
    assert inspect(engine).has_table("ingestion_runs")

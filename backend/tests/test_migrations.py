from sqlalchemy import inspect, text

from orion.core.db import engine


def test_alembic_baseline_created_ingestion_runs():
    assert inspect(engine).has_table("ingestion_runs")


def test_chain_country_covering_index_definition():
    """0035 (B1.1) : l'index couvrant du nœud pays, à la définition près."""
    with engine.connect() as conn:
        definition = conn.execute(
            text(
                "SELECT indexdef FROM pg_indexes WHERE tablename = 'participations' "
                "AND indexname = 'ix_participations_country_source_project'"
            )
        ).scalar_one()
    assert "(country_code, source, project_id)" in definition
    assert "INCLUDE (amount, amount_eur, organisation_id)" in definition

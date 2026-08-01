"""Materialized organisation aggregates, refreshed after each dedup pass.

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-31

"""

from collections.abc import Sequence

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        CREATE MATERIALIZED VIEW organisation_stats AS
        SELECT pa.organisation_id,
               count(DISTINCT pa.project_id) AS projects_count,
               sum(pa.amount_eur) AS total_funding_eur,
               count(*) FILTER (WHERE pa.role = 'coordinator') AS coordinator_count,
               min(extract(year FROM p.start_date))::int AS first_year,
               max(extract(year FROM p.start_date))::int AS last_year
        FROM participations pa
        JOIN projects p ON p.id = pa.project_id
        GROUP BY pa.organisation_id
        WITH DATA
    """)
    op.execute(
        "CREATE UNIQUE INDEX ix_organisation_stats_org ON organisation_stats (organisation_id)"
    )
    op.execute(
        "CREATE INDEX ix_organisation_stats_funding ON organisation_stats "
        "(total_funding_eur DESC NULLS LAST)"
    )


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW organisation_stats")

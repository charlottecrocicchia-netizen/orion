"""country_stats: the map's data, materialised (chantier performance, O2).

The countries index aggregates the 842 493 participations on every call
— cheap when the process cache is warm (~4 ms), but its worst case was
measured at 3,2 s and it is the first thing the map asks for. It is the
exact shape `organisation_stats` already solves elsewhere: a view
rebuilt by the ingestion chain, read in constant time by the product.

The unique index is what allows REFRESH … CONCURRENTLY, so the map never
blocks while the view rebuilds.

Revision ID: 0013
Revises: 0012
Create Date: 2026-08-03

"""

from collections.abc import Sequence

from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        CREATE MATERIALIZED VIEW country_stats AS
        SELECT pa.country_code AS code,
               c.name_en,
               c.eu_member,
               count(DISTINCT pa.project_id) AS projects_count,
               coalesce(sum(pa.amount_eur), 0) AS funding_eur
        FROM participations pa
        JOIN countries c ON c.code = pa.country_code
        GROUP BY pa.country_code, c.name_en, c.eu_member
    """)
    op.execute("CREATE UNIQUE INDEX ix_country_stats_code ON country_stats (code)")


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS country_stats")

"""country_pair_stats: the country facet of a country filter, in O(1).

Filtering on one country is one of the four key journeys, and its
country facet is what still cost 226 ms — it re-derives, for every other
country, how many of the filtered projects it also takes part in. That
answer is a fixed property of the corpus: 15 176 pairs in all (measured
2026-08-03), rebuilt in ~2 s by the ingestion chain instead of by the
visitor.

The same table also serves the globe's collaboration flows, which used
to compute the pairs live on every cold call.

Revision ID: 0014
Revises: 0013
Create Date: 2026-08-03

"""

from collections.abc import Sequence

from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        CREATE MATERIALIZED VIEW country_pair_stats AS
        WITH pc AS (
            SELECT project_id, country_code, sum(amount_eur) AS amount
            FROM participations
            WHERE country_code IS NOT NULL
            GROUP BY project_id, country_code
        )
        SELECT a.country_code AS a,
               b.country_code AS b,
               count(*) AS projects,
               coalesce(sum(coalesce(a.amount, 0) + coalesce(b.amount, 0)), 0) AS amount_eur
        FROM pc a
        JOIN pc b ON b.project_id = a.project_id AND a.country_code <> b.country_code
        GROUP BY a.country_code, b.country_code
    """)
    op.execute("CREATE UNIQUE INDEX ix_country_pair_stats_ab ON country_pair_stats (a, b)")
    op.execute("CREATE INDEX ix_country_pair_stats_a ON country_pair_stats (a, projects DESC)")


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS country_pair_stats")

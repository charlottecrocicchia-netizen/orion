"""A covering index for the country facet (chantier performance, O1).

The country facet reads every participation of every project in scope —
~200 000 rows for a France filter. With (project_id, country_code) the
scan never touches the table heap: measured 519 ms → 226 ms on the
2026-08-03 corpus, and the gap grows with the corpus.

IF NOT EXISTS because the index was first created by hand while
measuring; the migration must be idempotent on a database that already
carries it.

Revision ID: 0012
Revises: 0011
Create Date: 2026-08-03

"""

from collections.abc import Sequence

from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_part_project_country "
        "ON participations (project_id, country_code)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_part_project_country")

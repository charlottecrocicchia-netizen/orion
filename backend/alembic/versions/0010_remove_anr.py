"""Remove the ANR corpus — permanently.

Founder decision, 2026-08-03: the ANR is published under ODbL 1.0, whose
share-alike clause puts a legal risk on a commercial SaaS. The target
market is international; the French differentiator does not justify the
risk. The rule that follows is written in docs/data-sources.md: NO
source with a share-alike licence or a legal grey zone ever enters
Orion again.

This is a data deletion, deliberately irreversible: the loader, its
tests and its fixtures leave the repository in the same commit. The
downgrade cannot bring the corpus back — only a re-ingestion could, and
that is precisely what the decision forbids.

Revision ID: 0010
Revises: 0009
Create Date: 2026-08-03

"""

from collections.abc import Sequence

from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Participations and project_texts cascade from projects; programmes
    # and the funder go once no project points at them. Organisations
    # left without a single participation are removed last — an
    # organisation with no project describes nothing (the dedup rule).
    op.execute("DELETE FROM participations WHERE source = 'anr'")
    op.execute("""
        DELETE FROM projects WHERE source = 'anr'
    """)
    op.execute("""
        DELETE FROM programmes WHERE funder_id IN (SELECT id FROM funders WHERE code = 'anr')
    """)
    # Calls point at their funder too — the ANR ones go with it.
    op.execute("""
        DELETE FROM calls WHERE funder_id IN (SELECT id FROM funders WHERE code = 'anr')
    """)
    op.execute("DELETE FROM funders WHERE code = 'anr'")
    op.execute("""
        DELETE FROM organisation_aliases WHERE source = 'anr'
    """)
    op.execute("""
        DELETE FROM organisations o
        WHERE NOT EXISTS (SELECT 1 FROM participations pa WHERE pa.organisation_id = o.id)
    """)
    # The ingestion journal keeps its ANR history: it is the record of
    # what happened, not corpus data.
    op.execute("REFRESH MATERIALIZED VIEW organisation_stats")


def downgrade() -> None:
    # Nothing to restore: the decision is a removal, not a toggle.
    pass

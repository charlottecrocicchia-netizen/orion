"""Withdraw project_search — the spike passed, the system did not (O3a).

Measured in isolation, the condensed matter met the founder's adoption
criterion: ×3.2 to ×10.7 per term (median ×6.1), 98.4 % recall, half the
size of the full texts. Measured IN THE SYSTEM, it made the product
slower: the search's median went from 203 ms to 913 ms.

The reason is structural, and the spike could not show it. The condensed
view does not REPLACE project_texts — snippets still read the real text,
so both must live. It adds 1 341 MB of matter competing for the same
cache. The corpus was already inside its budget without it (203 ms
against a 300 ms target), so the product would have paid 1.6 % of recall
and a third of its cache for a regression.

Kept from the spike: the measurement, written in docs/chantier-performance.md.
Should the corpus outgrow RAM at wave-1's tripling, the answer is not
this view but retiring the full-text GIN index once snippets are served
another way — a chantier of its own, instructed then, not improvised.

Revision ID: 0016
Revises: 0015
Create Date: 2026-08-03

"""

from collections.abc import Sequence

from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS project_search")


def downgrade() -> None:
    # 0015 holds the definition; re-running it is the way back.
    pass

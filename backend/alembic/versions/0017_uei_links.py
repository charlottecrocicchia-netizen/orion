"""uei_links — the American consolidation bridge (vague 1, étape 2).

NSF publishes, for each awardee, its UEI and its PARENT UEI: 24 % of
FY2024 awards carry a parent different from the entity itself. That is a
consolidation link the groups layer has no other way to see for US
academia, where GLEIF's coverage is thin.

Captured raw, the day the data passes through — the ANR lesson (the
SIREN we could not capture because the source published none). The
groups wave turns these pairs into memberships; until then they sit
here, honest and unused.

Not `organisation_identifiers`: that table is unique on (scheme, value),
and a parent UEI is shared by all its children by definition.

Revision ID: 0017
Revises: 0016
Create Date: 2026-08-03

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: str | None = "0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "uei_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("child_uei", sa.String(length=12), nullable=False),
        sa.Column("parent_uei", sa.String(length=12), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.UniqueConstraint("child_uei", "parent_uei", name="uq_uei_links_child_parent"),
    )
    op.create_index("ix_uei_links_parent", "uei_links", ["parent_uei"])


def downgrade() -> None:
    op.drop_index("ix_uei_links_parent", table_name="uei_links")
    op.drop_table("uei_links")

"""Add organisations.name_normalized, the key deduplication matches on.

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-31

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("organisations", sa.Column("name_normalized", sa.Text(), nullable=True))
    op.create_index(
        "ix_organisations_name_normalized",
        "organisations",
        ["country_code", "name_normalized"],
    )
    op.execute(
        "CREATE INDEX ix_organisations_name_normalized_trgm ON organisations "
        "USING gin (name_normalized gin_trgm_ops)"
    )


def downgrade() -> None:
    op.drop_index("ix_organisations_name_normalized_trgm", table_name="organisations")
    op.drop_index("ix_organisations_name_normalized", table_name="organisations")
    op.drop_column("organisations", "name_normalized")

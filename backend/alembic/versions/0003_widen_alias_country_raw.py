"""Widen organisation_aliases.country_raw for sources that publish country names.

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-31

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "organisation_aliases",
        "country_raw",
        existing_type=sa.String(length=10),
        type_=sa.String(length=100),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.execute("UPDATE organisation_aliases SET country_raw = left(country_raw, 10)")
    op.alter_column(
        "organisation_aliases",
        "country_raw",
        existing_type=sa.String(length=100),
        type_=sa.String(length=10),
        existing_nullable=True,
    )

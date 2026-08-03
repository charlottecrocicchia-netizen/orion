"""Widen lei_records.ra_id to Text.

Real-run finding (2026-08-03): registration-authority entity ids are
free text in some jurisdictions — «Province of British Columbia
Registrar of Companies BC0374193» overflows VARCHAR(60). The field is a
verbatim registry value; it gets no length opinion from us.

Revision ID: 0009
Revises: 0008
Create Date: 2026-08-03

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("lei_records", "ra_id", type_=sa.Text())


def downgrade() -> None:
    op.alter_column("lei_records", "ra_id", type_=sa.String(length=60))

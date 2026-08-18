"""lenses.version + lens_changelog — la méthodologie d'une lentille se date.

S1 (décision S-C, validée 2026-08-18) : la règle parent « aerospace
engineering » quitte la lentille spatiale — 99 % de sa récolte était
aéronautique. Un tel changement déplace des chiffres publics : il ne
peut pas être silencieux. La méthodologie d'une lentille porte donc une
VERSION, et chaque version dit sa date et son avant/après — comptes et
montants — que la page À-propos montre.

Revision ID: 0027
Revises: 0026
Create Date: 2026-08-18

"""

import sqlalchemy as sa
from alembic import op

revision = "0027"
down_revision = "0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("lenses", sa.Column("version", sa.Integer, nullable=False, server_default="1"))
    op.create_table(
        "lens_changelog",
        sa.Column("lens", sa.String(30), sa.ForeignKey("lenses.slug"), primary_key=True),
        sa.Column("version", sa.Integer, primary_key=True),
        sa.Column("changed_on", sa.Date, nullable=False),
        sa.Column("core_before", sa.Integer, nullable=False),
        sa.Column("core_after", sa.Integer, nullable=False),
        sa.Column("enabling_before", sa.Integer, nullable=False),
        sa.Column("enabling_after", sa.Integer, nullable=False),
        sa.Column("funding_before_eur", sa.Numeric(18, 2), nullable=False),
        sa.Column("funding_after_eur", sa.Numeric(18, 2), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("lens_changelog")
    op.drop_column("lenses", "version")

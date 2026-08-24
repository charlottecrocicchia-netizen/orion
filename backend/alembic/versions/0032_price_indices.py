"""Les indices de prix annuels, versionnés par vintage (lot A, GO du 2026-08-22).

Une seule table neuve — `price_indices` — et RIEN d'autre : la
migration ne touche ni `projects` ni `participations`, conformément à
l'invariant du chantier (« les nominaux ne bougent jamais », aucune
colonne constante matérialisée, docs/conception-a-euros-constants.md
§ 2.10). EUR → HICP Eurostat `prc_hicp_aind` (CC-BY 4.0) ; USD →
CPI-U BLS `CUUR0000SA0` (domaine public). Une révision officielle
d'un indice AJOUTE une vintage ; l'application lit la dernière
vintage par devise.

Revision ID: 0032
Revises: 0031
Create Date: 2026-08-22

"""

import sqlalchemy as sa
from alembic import op

revision = "0032"
down_revision = "0031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "price_indices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("value", sa.Numeric(10, 4), nullable=False),
        sa.Column("series_source", sa.String(length=20), nullable=False),
        sa.Column("series_code", sa.String(length=40), nullable=False),
        sa.Column("vintage_date", sa.Date(), nullable=False),
        sa.Column(
            "imported_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("currency", "year", "vintage_date", name="uq_price_indices_vintage"),
    )
    op.create_index(
        "ix_price_indices_currency_vintage", "price_indices", ["currency", "vintage_date"]
    )


def downgrade() -> None:
    op.drop_index("ix_price_indices_currency_vintage", table_name="price_indices")
    op.drop_table("price_indices")

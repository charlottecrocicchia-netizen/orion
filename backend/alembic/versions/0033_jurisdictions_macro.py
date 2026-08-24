"""Les juridictions de financement et leurs séries macro (lot R3, GO du 2026-08-24).

Deux tables neuves — `jurisdictions` et `macro_series` — et RIEN
d'autre : la migration ne touche ni `projects`, ni `participations`,
ni `funders` (dont la colonne `jurisdiction` existante devient la clé
de rattachement, validée au seed — pas de contrainte FK tant que le
seed n'a pas peuplé la table, refus propre à l'exécution sinon,
doctrine R0 § D13).

`macro_series` suit EXACTEMENT la discipline de `price_indices`
(R0 § D2) : append-only, une révision officielle AJOUTE une vintage,
l'application lit la dernière vintage par (juridiction, concept).
Concepts R3 : `gdp_current_usd` (WDI NY.GDP.MKTP.CD, CC BY-4.0 vérifié
par indicateur le 2026-08-24) et `population` (WDI SP.POP.TOTL, idem).
Aucun agrégat maison : l'agrégat UE est la série publiée par la source
(WDI, iso2 `EU`).

Revision ID: 0033
Revises: 0032
Create Date: 2026-08-24

"""

import sqlalchemy as sa
from alembic import op

revision = "0033"
down_revision = "0032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "jurisdictions",
        sa.Column("code", sa.String(length=10), primary_key=True),
        sa.Column("kind", sa.String(length=10), nullable=False),
        sa.Column("name_key", sa.String(length=40), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=True),
    )
    op.create_table(
        "macro_series",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "jurisdiction_code",
            sa.String(length=10),
            sa.ForeignKey("jurisdictions.code"),
            nullable=False,
        ),
        sa.Column("concept", sa.String(length=30), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("value", sa.Numeric(20, 4), nullable=False),
        sa.Column("series_source", sa.String(length=20), nullable=False),
        sa.Column("series_code", sa.String(length=40), nullable=False),
        sa.Column("vintage_date", sa.Date(), nullable=False),
        sa.Column(
            "imported_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "jurisdiction_code", "concept", "year", "vintage_date", name="uq_macro_series_vintage"
        ),
    )
    op.create_index(
        "ix_macro_series_concept_jur_year",
        "macro_series",
        ["concept", "jurisdiction_code", "year"],
    )


def downgrade() -> None:
    op.drop_index("ix_macro_series_concept_jur_year", table_name="macro_series")
    op.drop_table("macro_series")
    op.drop_table("jurisdictions")

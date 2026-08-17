"""subdivisions — la maille sous le pays (lot D, 2026-08-17).

Le drill-down par État américain, et la même mécanique pour toute
fédération dont la source publie sa subdivision. Deux colonnes sur la
participation, parce que deux vérités distinctes cohabitent :

- `subdivision_code` : ISO 3166-2 normalisé (« US-NV »), la maille que
  le produit affiche et compare ;
- `nuts_code` : le code NUTS BRUT de CORDIS, conservé tel que la source
  l'écrit (NUTS3 le plus souvent) — on ne le traduit pas, on le garde
  pour que la maille européenne se construise dessus sans redemander la
  donnée (leçon ANR : capter le jour où ça passe).

Le référentiel `subdivisions` est complet par pays couvert, comme les
régions manager : la liste des mailles cliquables dérive de LUI, jamais
d'une liste côté client.

Revision ID: 0021
Revises: 0020
Create Date: 2026-08-17

"""

import sqlalchemy as sa
from alembic import op

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "subdivisions",
        sa.Column("code", sa.String(6), primary_key=True),
        sa.Column(
            "country_code",
            sa.String(2),
            sa.ForeignKey("countries.code"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.Text, nullable=False),
        # « state » aux États-Unis, « nuts1/2/3 » en Europe : la maille
        # dit son niveau, les vues ne les mélangent jamais.
        sa.Column("level", sa.String(12), nullable=False),
    )
    op.add_column("participations", sa.Column("subdivision_code", sa.String(6), nullable=True))
    op.add_column("participations", sa.Column("nuts_code", sa.String(8), nullable=True))
    op.create_index(
        "ix_participations_subdivision",
        "participations",
        ["subdivision_code"],
        postgresql_where=sa.text("subdivision_code IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_participations_subdivision", table_name="participations")
    op.drop_column("participations", "nuts_code")
    op.drop_column("participations", "subdivision_code")
    op.drop_table("subdivisions")

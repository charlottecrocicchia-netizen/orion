"""nuts_nomenclature — les noms officiels des régions européennes (lot F).

Le backfill du 2026-08-17 a posé le code NUTS brut sur 431 798
participations CORDIS ; cette table lui donne ses NOMS. Elle vient de la
nomenclature statistique Eurostat (codelist SDMX GEO, CC BY 4.0 —
vérifiée à la source le jour du chargement, registre des sources), PAS
de GISCO : la géométrie est exclue définitivement, les codes et noms
passent. C'est toute la ligne de crête du lot F : des régions nommées,
jamais dessinées.

Trois colonnes suffisent : le code est la clé naturelle, le niveau se
lit dans sa longueur mais on le matérialise pour filtrer sans fonction,
et le nom est le libellé officiel Eurostat, verbatim.

Revision ID: 0022
Revises: 0021
Create Date: 2026-08-17

"""

import sqlalchemy as sa
from alembic import op

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "nuts_nomenclature",
        sa.Column("code", sa.String(5), primary_key=True),
        sa.Column("level", sa.SmallInteger, nullable=False),
        sa.Column("name", sa.Text, nullable=False),
    )
    # La vue par régions filtrera « les NUTS2 de FR » : préfixe + niveau.
    op.create_index("ix_nuts_nomenclature_level", "nuts_nomenclature", ["level"])


def downgrade() -> None:
    op.drop_table("nuts_nomenclature")

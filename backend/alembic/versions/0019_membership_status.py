"""entity_group_map.status — le temps entre dans la couche identité.

Le pivot spatial (décision fondatrice, 2026-08-04) impose de dire les
opérations capitalistiques SANS les anticiper : l'opération
Airbus-Leonardo-Thales est ANNONCÉE, pas faite — la consolider serait un
mensonge, l'ignorer en serait un autre. Trois statuts :

- `active`     : l'adhésion vaut aujourd'hui (défaut, tout l'existant) ;
- `announced`  : opération publique non finalisée — listée sur la fiche,
                 JAMAIS comptée dans les consolidés ;
- `historical` : adhésion passée (cession datée) — l'histoire reste
                 lisible, le présent ne ment pas.

Revision ID: 0019
Revises: 0018
Create Date: 2026-08-04

"""

import sqlalchemy as sa
from alembic import op

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "entity_group_map",
        sa.Column("status", sa.String(12), nullable=False, server_default="active"),
    )
    op.create_check_constraint(
        "ck_entity_group_map_status",
        "entity_group_map",
        "status IN ('active', 'announced', 'historical')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_entity_group_map_status", "entity_group_map")
    op.drop_column("entity_group_map", "status")

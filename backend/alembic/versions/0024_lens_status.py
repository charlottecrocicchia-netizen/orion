"""lenses.status — une lentille naît draft, s'expose published (I2).

Invariant post-M0 (fondatrice, 2026-08-18) : seule une lentille PUBLIÉE
existe pour le produit — validation d'URL, bloc `lenses` des stats, un
jour la Lens Room. `draft` se charge et se vérifie en base sans être
exposée (le chemin d'A1) ; `retired` n'est plus rechargée ni exposée,
ses tags restent gelés. La lentille spatiale, en prod depuis la V1,
est `published` par définition.

Revision ID: 0024
Revises: 0023
Create Date: 2026-08-18

"""

import sqlalchemy as sa
from alembic import op

revision = "0024"
down_revision = "0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "lenses",
        sa.Column("status", sa.String(12), nullable=False, server_default="published"),
    )
    op.create_check_constraint(
        "ck_lenses_status", "lenses", "status IN ('draft', 'published', 'retired')"
    )


def downgrade() -> None:
    op.drop_constraint("ck_lenses_status", "lenses")
    op.drop_column("lenses", "status")

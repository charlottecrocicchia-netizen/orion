"""lenses : le compte des règles, par famille — l'À-propos ne l'invente plus.

M1.3 : la page À-propos décrit chaque lentille par blocs génériques
(périmètre, méthode, dernier run, règles). Le nombre de règles y était
écrit EN DUR (« 23 règles, 4 de programme… ») : il devient DÉRIVÉ, posé
par le chargeur au moment où il lit le fichier versionné. Une promesse
affichée reste vraie le jour où la curation change.

Revision ID: 0026
Revises: 0025
Create Date: 2026-08-18

"""

import sqlalchemy as sa
from alembic import op

revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None

_COLUMNS = ("rules_total", "rules_programme", "rules_theme", "rules_text")


def upgrade() -> None:
    for name in _COLUMNS:
        op.add_column("lenses", sa.Column(name, sa.Integer, nullable=False, server_default="0"))


def downgrade() -> None:
    for name in _COLUMNS:
        op.drop_column("lenses", name)

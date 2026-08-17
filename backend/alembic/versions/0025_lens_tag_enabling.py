"""project_lens_tags.tag : adjacent → enabling — UNE paire, deux registres.

I3 (validé fondatrice, 2026-08-18) : le vocabulaire d'Orion est une paire
unique à deux registres — technique `core` / `enabling`, utilisateur
« X direct » / « X + habilitant » (en i18n, libellés Space natif
verbatim). `adjacent` était le troisième terme : il disparaît.

Le renommage est UN SEUL GESTE (base + fichiers de règles + payload +
front) : renommer la base sans le payload créerait exactement l'état
que l'invariant interdit. Aucune ligne n'est ajoutée ni supprimée —
seul le nom du tag change.

Revision ID: 0025
Revises: 0024
Create Date: 2026-08-18

"""

from alembic import op

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_project_lens_tags_tag", "project_lens_tags")
    op.execute("UPDATE project_lens_tags SET tag = 'enabling' WHERE tag = 'adjacent'")
    op.create_check_constraint(
        "ck_project_lens_tags_tag", "project_lens_tags", "tag IN ('core', 'enabling')"
    )


def downgrade() -> None:
    op.drop_constraint("ck_project_lens_tags_tag", "project_lens_tags")
    op.execute("UPDATE project_lens_tags SET tag = 'adjacent' WHERE tag = 'enabling'")
    op.create_check_constraint(
        "ck_project_lens_tags_tag", "project_lens_tags", "tag IN ('core', 'adjacent')"
    )

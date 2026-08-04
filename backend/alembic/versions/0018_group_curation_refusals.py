"""group_curation_refusals — les faux positifs arbitrés se taisent.

Le radar des homonymes (recette fondatrice, 2026-08-04) liste toute
organisation qui porte le nom d'un groupe sans y être rattachée. Certaines
ne DOIVENT jamais l'être — Dana-Farber Cancer Institute n'est pas Dana
Incorporated, l'Orange County n'est pas Orange SA. Un refus de curation
est un fait au même titre qu'un rattachement : versionné dans le fichier
de curation avec son évidence, chargé ici pour que la note d'honnêteté et
le diagnostic cessent de compter ce qui a été arbitré.

Revision ID: 0018
Revises: 0017
Create Date: 2026-08-04

"""

import sqlalchemy as sa
from alembic import op

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "group_curation_refusals",
        sa.Column(
            "group_id",
            sa.Integer,
            sa.ForeignKey("groups.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "organisation_id",
            sa.Integer,
            sa.ForeignKey("organisations.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )


def downgrade() -> None:
    op.drop_table("group_curation_refusals")

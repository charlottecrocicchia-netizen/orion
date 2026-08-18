"""project_lens_tags.proof — l'ORIGINE de chaque classification.

A1 : l'audit doit pouvoir dire QUELLE famille de règles corriger. Chaque
tag garde donc la preuve qui l'a posé, selon la hiérarchie I6 :

- `structural` — un fait de la source (appel, concept exact, programme) ;
- `taxonomic`  — un sous-arbre de nomenclature (thème) ;
- `textual`    — un motif interprété.

Un veto textuel ne peut annuler qu'un tag `taxonomic` ou `textual` :
une interprétation ne renverse jamais un fait de la source.

Revision ID: 0028
Revises: 0027
Create Date: 2026-08-18

"""

import sqlalchemy as sa
from alembic import op

revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "project_lens_tags",
        sa.Column("proof", sa.String(12), nullable=False, server_default="taxonomic"),
    )
    op.create_check_constraint(
        "ck_project_lens_tags_proof",
        "project_lens_tags",
        "proof IN ('structural', 'taxonomic', 'textual')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_project_lens_tags_proof", "project_lens_tags")
    op.drop_column("project_lens_tags", "proof")

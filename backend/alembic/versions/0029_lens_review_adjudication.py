"""La preuve `review` — l'adjudication de revue par projet nommé.

Lot 2 du chantier Capacités annoncées : la revue V2-A a jugé le DEGRÉ
de deux projets (core → enabling) que la preuve structurelle ne sait
pas dire — ses erreurs mesurées étaient « toutes de degré et non de
domaine ». L'adjudication de revue est la vérité de référence : elle
requalifie un tag structurel sans le contester (le projet reste dans
la lentille), et rien ne la renverse — ni règle, ni veto.

- `review` s'ajoute aux origines admises d'un tag ;
- `lenses.rules_review` compte les adjudications du fichier de règles,
  pour que la somme des classes dise toujours le total (S1 ①).

Revision ID: 0029
Revises: 0028
Create Date: 2026-08-20

"""

import sqlalchemy as sa
from alembic import op

revision = "0029"
down_revision = "0028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_project_lens_tags_proof", "project_lens_tags")
    op.create_check_constraint(
        "ck_project_lens_tags_proof",
        "project_lens_tags",
        "proof IN ('structural', 'taxonomic', 'textual', 'review')",
    )
    op.add_column(
        "lenses",
        sa.Column("rules_review", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("lenses", "rules_review")
    op.drop_constraint("ck_project_lens_tags_proof", "project_lens_tags")
    op.create_check_constraint(
        "ck_project_lens_tags_proof",
        "project_lens_tags",
        "proof IN ('structural', 'taxonomic', 'textual')",
    )

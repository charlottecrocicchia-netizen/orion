"""projects.space_tag — la lentille spatiale tague le corpus.

Lot 1 de la lentille V1 (plan validé, docs/lecons-pivot-spatial.md) :
chaque projet peut porter `core` (spatial au cœur) ou `adjacent`
(technologie habilitante — la relecture NSF/NIH du rapport). NULL = hors
lentille. Le tag est DÉRIVÉ du fichier versionné
backend/curation/space-lens.csv — jamais posé à la main en base, jamais
une suppression : le corpus mondial reste entier (invariant fondatrice).

Revision ID: 0020
Revises: 0019
Create Date: 2026-08-05

"""

import sqlalchemy as sa
from alembic import op

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("space_tag", sa.String(8), nullable=True))
    op.create_check_constraint(
        "ck_projects_space_tag", "projects", "space_tag IN ('core', 'adjacent')"
    )
    op.create_index(
        "ix_projects_space_tag",
        "projects",
        ["space_tag"],
        postgresql_where=sa.text("space_tag IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_projects_space_tag", table_name="projects")
    op.drop_constraint("ck_projects_space_tag", "projects")
    op.drop_column("projects", "space_tag")

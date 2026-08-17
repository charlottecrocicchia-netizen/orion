"""lenses + project_lens_tags — le tag de lentille quitte sa colonne (M0).

D1 de la conception multi-lentilles (validée 2026-08-17) : une colonne ne
sait porter qu'une lentille — un projet ne pouvait pas être spatial ET
aéro. La table `project_lens_tags` permet le chevauchement par
construction (une ligne par projet × lentille), et `lenses` mire le
registre versionné backend/curation/lenses/registry.csv (famille →
lentille — amendement M0 n°1 : la clé de famille est technique, les mots
vivent en i18n).

`projects.space_tag` est migré dans la table puis SUPPRIMÉ : une seule
vérité. Le tag reste dérivé des fichiers de règles, jamais posé à la
main, jamais une suppression du corpus (invariant fondatrice).

Revision ID: 0023
Revises: 0022
Create Date: 2026-08-17

"""

import sqlalchemy as sa
from alembic import op

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "lenses",
        sa.Column("slug", sa.String(30), primary_key=True),
        sa.Column("family_key", sa.String(40), nullable=False),
        sa.Column("rank", sa.Integer, nullable=False),
    )
    # L'état du registre au jour de la migration — le chargeur le remire
    # à chaque run, le fichier reste la seule vérité éditable.
    op.execute(
        "INSERT INTO lenses (slug, family_key, rank) VALUES ('space', 'aerospace_mobility', 1)"
    )

    op.create_table(
        "project_lens_tags",
        sa.Column(
            "project_id",
            sa.Integer,
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("lens", sa.String(30), sa.ForeignKey("lenses.slug"), primary_key=True),
        sa.Column("tag", sa.String(8), nullable=False),
        sa.CheckConstraint("tag IN ('core', 'adjacent')", name="ck_project_lens_tags_tag"),
    )
    op.create_index(
        "ix_project_lens_tags_lens_project", "project_lens_tags", ["lens", "project_id"]
    )

    # La lentille spatiale existante voyage telle quelle — mêmes projets,
    # mêmes tags, rien de supprimé, rien d'inventé.
    op.execute(
        "INSERT INTO project_lens_tags (project_id, lens, tag) "
        "SELECT id, 'space', space_tag FROM projects WHERE space_tag IS NOT NULL"
    )

    op.drop_index("ix_projects_space_tag", table_name="projects")
    op.drop_constraint("ck_projects_space_tag", "projects")
    op.drop_column("projects", "space_tag")


def downgrade() -> None:
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
    op.execute(
        "UPDATE projects SET space_tag = plt.tag "
        "FROM project_lens_tags plt "
        "WHERE plt.project_id = projects.id AND plt.lens = 'space'"
    )
    op.drop_table("project_lens_tags")
    op.drop_table("lenses")

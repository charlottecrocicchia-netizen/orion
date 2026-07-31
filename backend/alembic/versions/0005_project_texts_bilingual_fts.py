"""Bilingual full-text search: per-language texts and FTS configurations.

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-31

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SEARCH_VECTOR_SQL = (
    "setweight(to_tsvector("
    "CASE WHEN lang = 'fr' THEN 'orion_fr'::regconfig ELSE 'orion_en'::regconfig END, "
    "coalesce(title, '')), 'A') || "
    "setweight(to_tsvector("
    "CASE WHEN lang = 'fr' THEN 'orion_fr'::regconfig ELSE 'orion_en'::regconfig END, "
    "coalesce(abstract, '')), 'B')"
)

TOKEN_TYPES = "asciiword, asciihword, hword_asciipart, word, hword, hword_part"


def upgrade() -> None:
    op.execute("CREATE TEXT SEARCH CONFIGURATION orion_en (COPY = english)")
    op.execute(
        "ALTER TEXT SEARCH CONFIGURATION orion_en "
        f"ALTER MAPPING FOR {TOKEN_TYPES} WITH unaccent, english_stem"
    )
    op.execute("CREATE TEXT SEARCH CONFIGURATION orion_fr (COPY = french)")
    op.execute(
        "ALTER TEXT SEARCH CONFIGURATION orion_fr "
        f"ALTER MAPPING FOR {TOKEN_TYPES} WITH unaccent, french_stem"
    )

    op.create_table(
        "project_texts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("lang", sa.String(length=2), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("abstract", sa.Text(), nullable=True),
        sa.Column(
            "search_vector",
            postgresql.TSVECTOR(),
            sa.Computed(SEARCH_VECTOR_SQL, persisted=True),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", "lang", name="uq_project_texts_project_lang"),
    )
    op.create_index("ix_project_texts_project_id", "project_texts", ["project_id"])
    op.execute("CREATE INDEX ix_project_texts_search ON project_texts USING gin (search_vector)")


def downgrade() -> None:
    op.drop_table("project_texts")
    op.execute("DROP TEXT SEARCH CONFIGURATION orion_fr")
    op.execute("DROP TEXT SEARCH CONFIGURATION orion_en")

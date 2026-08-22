"""Les appels à venir (E1, GO fondatrice du 2026-08-22).

Deux tables, la doctrine dans le schéma : `call_topics` est le FAIT
source (portail EU Funding & Tenders, CC BY 4.0 — licence relue sur
pièce le jour du chantier, conception-e1-appels.md § 0) ;
`call_topic_lens_tags` est la LECTURE Orion (lentille, preuve, règle).
Le pont vers l'historique passe par `calls` (colonne `call_id`), que
CORDIS remplit déjà avec les mêmes codes d'appel.

Revision ID: 0031
Revises: 0030
Create Date: 2026-08-22

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0031"
down_revision = "0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "call_topics",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source", sa.String(length=30), nullable=False),
        sa.Column("source_id", sa.String(length=200), nullable=False),
        sa.Column("reference", sa.Text(), nullable=True),
        sa.Column("identifier", sa.String(length=200), nullable=False),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("call_code", sa.String(length=200), nullable=True),
        sa.Column("call_id", sa.Integer(), sa.ForeignKey("calls.id"), nullable=True),
        sa.Column("framework_programme_code", sa.String(length=30), nullable=True),
        sa.Column("framework_programme_label", sa.Text(), nullable=True),
        sa.Column("status_code", sa.String(length=30), nullable=True),
        sa.Column("status_label", sa.String(length=50), nullable=True),
        sa.Column("opening_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deadline_dates", JSONB(), nullable=True),
        sa.Column("deadline_model", sa.String(length=50), nullable=True),
        sa.Column("types_of_action", JSONB(), nullable=True),
        sa.Column("keywords", JSONB(), nullable=True),
        sa.Column("tags", JSONB(), nullable=True),
        sa.Column("cross_cutting", JSONB(), nullable=True),
        sa.Column("budget_min_eur", sa.Numeric(16, 2), nullable=True),
        sa.Column("budget_max_eur", sa.Numeric(16, 2), nullable=True),
        sa.Column("expected_grants", sa.Integer(), nullable=True),
        sa.Column("budget_overview", JSONB(), nullable=True),
        sa.Column("description_html", sa.Text(), nullable=True),
        sa.Column("conditions_html", sa.Text(), nullable=True),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("raw", JSONB(), nullable=True),
        sa.Column(
            "first_imported_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("source", "source_id", name="uq_call_topics_source"),
    )
    op.create_index("ix_call_topics_identifier", "call_topics", ["identifier"])
    op.create_index("ix_call_topics_call_code", "call_topics", ["call_code"])
    op.create_index(
        "ix_call_topics_framework_programme_code", "call_topics", ["framework_programme_code"]
    )
    op.create_index("ix_call_topics_status_code", "call_topics", ["status_code"])

    op.create_table(
        "call_topic_lens_tags",
        sa.Column(
            "call_topic_id",
            sa.Integer(),
            sa.ForeignKey("call_topics.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "lens",
            sa.String(length=30),
            sa.ForeignKey("lenses.slug", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("tag", sa.String(length=10), nullable=False),
        sa.Column("proof", sa.String(length=12), nullable=False, server_default="structural"),
        sa.Column("rule", sa.Text(), nullable=True),
        sa.CheckConstraint("tag IN ('core', 'enabling')", name="ck_call_topic_lens_tag"),
    )


def downgrade() -> None:
    op.drop_table("call_topic_lens_tags")
    op.drop_index("ix_call_topics_status_code", table_name="call_topics")
    op.drop_index("ix_call_topics_framework_programme_code", table_name="call_topics")
    op.drop_index("ix_call_topics_call_code", table_name="call_topics")
    op.drop_index("ix_call_topics_identifier", table_name="call_topics")
    op.drop_table("call_topics")

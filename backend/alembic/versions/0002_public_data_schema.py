"""public data schema

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-31 09:19:00.095418+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.create_table(
        "countries",
        sa.Column("code", sa.String(length=2), nullable=False),
        sa.Column("name_en", sa.String(length=120), nullable=False),
        sa.Column("region", sa.String(length=30), nullable=True),
        sa.Column("eu_member", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("code"),
    )
    op.create_table(
        "exchange_rates",
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("rate_to_eur", sa.Numeric(precision=14, scale=6), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint("currency", "year"),
    )
    op.create_table(
        "topics",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("scheme", sa.String(length=30), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("path", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("scheme", "code", name="uq_topics_scheme_code"),
    )
    op.create_table(
        "funders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=30), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("jurisdiction", sa.String(length=10), nullable=False),
        sa.Column("country_code", sa.String(length=2), nullable=True),
        sa.Column("default_currency", sa.String(length=3), nullable=False),
        sa.ForeignKeyConstraint(
            ["country_code"],
            ["countries.code"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_table(
        "organisations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("country_code", sa.String(length=2), nullable=True),
        sa.Column("city", sa.String(length=200), nullable=True),
        sa.Column("org_type", sa.String(length=50), nullable=True),
        sa.Column("website", sa.Text(), nullable=True),
        sa.Column("lat", sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column("lon", sa.Numeric(precision=9, scale=6), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["country_code"],
            ["countries.code"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "calls",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("funder_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=200), nullable=False),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["funder_id"],
            ["funders.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("funder_id", "code", name="uq_calls_funder_code"),
    )
    op.create_index(op.f("ix_calls_funder_id"), "calls", ["funder_id"], unique=False)
    op.create_table(
        "organisation_aliases",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organisation_id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("name_raw", sa.Text(), nullable=False),
        sa.Column("country_raw", sa.String(length=10), nullable=True),
        sa.ForeignKeyConstraint(["organisation_id"], ["organisations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source", "name_raw", "country_raw", name="uq_org_aliases_source_raw"),
    )
    op.create_index(
        op.f("ix_organisation_aliases_organisation_id"),
        "organisation_aliases",
        ["organisation_id"],
        unique=False,
    )
    op.create_table(
        "organisation_identifiers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organisation_id", sa.Integer(), nullable=False),
        sa.Column("scheme", sa.String(length=20), nullable=False),
        sa.Column("value", sa.String(length=100), nullable=False),
        sa.ForeignKeyConstraint(["organisation_id"], ["organisations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("scheme", "value", name="uq_org_identifiers_scheme_value"),
    )
    op.create_index(
        op.f("ix_organisation_identifiers_organisation_id"),
        "organisation_identifiers",
        ["organisation_id"],
        unique=False,
    )
    op.create_table(
        "programmes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("funder_id", sa.Integer(), nullable=False),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["funder_id"],
            ["funders.id"],
        ),
        sa.ForeignKeyConstraint(
            ["parent_id"],
            ["programmes.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("funder_id", "code", name="uq_programmes_funder_code"),
    )
    op.create_index(op.f("ix_programmes_funder_id"), "programmes", ["funder_id"], unique=False)
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("source_id", sa.String(length=100), nullable=False),
        sa.Column("acronym", sa.String(length=100), nullable=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("title_lang", sa.String(length=2), nullable=True),
        sa.Column("abstract", sa.Text(), nullable=True),
        sa.Column("abstract_lang", sa.String(length=2), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("total_cost", sa.Numeric(precision=16, scale=2), nullable=True),
        sa.Column("total_cost_currency", sa.String(length=3), nullable=True),
        sa.Column("funding_amount", sa.Numeric(precision=16, scale=2), nullable=True),
        sa.Column("funding_currency", sa.String(length=3), nullable=True),
        sa.Column("funding_amount_eur", sa.Numeric(precision=16, scale=2), nullable=True),
        sa.Column("funder_id", sa.Integer(), nullable=False),
        sa.Column("programme_id", sa.Integer(), nullable=True),
        sa.Column("call_id", sa.Integer(), nullable=True),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("content_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("raw", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "first_imported_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["call_id"],
            ["calls.id"],
        ),
        sa.ForeignKeyConstraint(
            ["funder_id"],
            ["funders.id"],
        ),
        sa.ForeignKeyConstraint(
            ["programme_id"],
            ["programmes.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source", "source_id", name="uq_projects_source_id"),
    )
    op.create_index(op.f("ix_projects_call_id"), "projects", ["call_id"], unique=False)
    op.create_index(op.f("ix_projects_funder_id"), "projects", ["funder_id"], unique=False)
    op.create_index(op.f("ix_projects_programme_id"), "projects", ["programme_id"], unique=False)
    op.create_index(op.f("ix_projects_start_date"), "projects", ["start_date"], unique=False)
    op.create_table(
        "participations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("organisation_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=30), nullable=True),
        sa.Column("country_code", sa.String(length=2), nullable=True),
        sa.Column("amount", sa.Numeric(precision=16, scale=2), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=True),
        sa.Column("amount_eur", sa.Numeric(precision=16, scale=2), nullable=True),
        sa.Column("order_index", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("source_uid", sa.String(length=200), nullable=False),
        sa.Column(
            "first_imported_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["country_code"],
            ["countries.code"],
        ),
        sa.ForeignKeyConstraint(["organisation_id"], ["organisations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source", "source_uid", name="uq_participations_source_uid"),
    )
    op.create_index(
        op.f("ix_participations_organisation_id"),
        "participations",
        ["organisation_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_participations_project_id"), "participations", ["project_id"], unique=False
    )
    op.create_table(
        "project_topics",
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("topic_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["topic_id"], ["topics.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("project_id", "topic_id"),
    )
    op.create_index(
        op.f("ix_project_topics_topic_id"), "project_topics", ["topic_id"], unique=False
    )
    op.add_column(
        "ingestion_runs",
        sa.Column("detail", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.execute(
        "CREATE INDEX ix_organisations_name_trgm ON organisations USING gin (name gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX ix_org_aliases_name_raw_trgm ON organisation_aliases "
        "USING gin (name_raw gin_trgm_ops)"
    )


def downgrade() -> None:
    op.drop_column("ingestion_runs", "detail")
    op.drop_index(op.f("ix_project_topics_topic_id"), table_name="project_topics")
    op.drop_table("project_topics")
    op.drop_index(op.f("ix_participations_project_id"), table_name="participations")
    op.drop_index(op.f("ix_participations_organisation_id"), table_name="participations")
    op.drop_table("participations")
    op.drop_index(op.f("ix_projects_start_date"), table_name="projects")
    op.drop_index(op.f("ix_projects_programme_id"), table_name="projects")
    op.drop_index(op.f("ix_projects_funder_id"), table_name="projects")
    op.drop_index(op.f("ix_projects_call_id"), table_name="projects")
    op.drop_table("projects")
    op.drop_index(op.f("ix_programmes_funder_id"), table_name="programmes")
    op.drop_table("programmes")
    op.drop_index(
        op.f("ix_organisation_identifiers_organisation_id"), table_name="organisation_identifiers"
    )
    op.drop_table("organisation_identifiers")
    op.drop_index(
        op.f("ix_organisation_aliases_organisation_id"), table_name="organisation_aliases"
    )
    op.drop_table("organisation_aliases")
    op.drop_index(op.f("ix_calls_funder_id"), table_name="calls")
    op.drop_table("calls")
    op.drop_table("organisations")
    op.drop_table("funders")
    op.drop_table("topics")
    op.drop_table("exchange_rates")
    op.drop_table("countries")

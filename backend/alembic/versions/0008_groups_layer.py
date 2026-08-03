"""The groups layer (vague 1, socle identité).

Canonical layering per docs/groupes-couche.md: legal entities stay
untouched, a `groups` table and a dated, weighted `entity_group_map`
lay the group reading OVER them. The GLEIF mirror tables (Level 1
records with the registration-authority id — the SIREN for France —,
Level 2 relationships, reporting exceptions for bridged LEIs) feed the
first memberships and the identifier bridges.

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-03

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "groups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("country_code", sa.String(length=2), nullable=True),
        sa.Column("lei", sa.String(length=20), nullable=True),
        sa.Column("source", sa.String(length=50), nullable=False),
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
        sa.ForeignKeyConstraint(["country_code"], ["countries.code"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("lei", name="uq_groups_lei"),
    )

    op.create_table(
        "entity_group_map",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organisation_id", sa.Integer(), nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("method", sa.String(length=30), nullable=False),
        sa.Column("confidence", sa.Numeric(3, 2), nullable=False),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("share", sa.Numeric(5, 2), nullable=True),
        sa.Column("is_jv", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("valid_from", sa.Date(), nullable=True),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["organisation_id"], ["organisations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organisation_id", "group_id", "method", name="uq_entity_group_method"),
    )
    op.create_index(
        op.f("ix_entity_group_map_organisation_id"),
        "entity_group_map",
        ["organisation_id"],
    )
    op.create_index("ix_entity_group_map_group", "entity_group_map", ["group_id"])

    op.create_table(
        "lei_records",
        sa.Column("lei", sa.String(length=20), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("name_normalized", sa.Text(), nullable=True),
        sa.Column("country_code", sa.String(length=2), nullable=True),
        sa.Column("ra_id", sa.String(length=60), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=True),
        sa.PrimaryKeyConstraint("lei"),
    )
    op.create_index("ix_lei_records_country", "lei_records", ["country_code"])
    op.create_index("ix_lei_records_ra_id", "lei_records", ["ra_id"])
    op.create_index(
        "ix_lei_records_name_normalized", "lei_records", ["country_code", "name_normalized"]
    )

    op.create_table(
        "lei_relationships",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("child_lei", sa.String(length=20), nullable=False),
        sa.Column("parent_lei", sa.String(length=20), nullable=False),
        sa.Column("relationship_type", sa.String(length=40), nullable=False),
        sa.Column("corroboration", sa.String(length=40), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "child_lei", "parent_lei", "relationship_type", name="uq_lei_rel_child_parent_type"
        ),
    )
    op.create_index("ix_lei_relationships_child", "lei_relationships", ["child_lei"])
    op.create_index("ix_lei_relationships_parent", "lei_relationships", ["parent_lei"])

    op.create_table(
        "lei_exceptions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lei", sa.String(length=20), nullable=False),
        sa.Column("exception_type", sa.String(length=60), nullable=False),
        sa.Column("reason", sa.String(length=80), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("lei", "exception_type", name="uq_lei_exception_type"),
    )
    op.create_index("ix_lei_exceptions_lei", "lei_exceptions", ["lei"])


def downgrade() -> None:
    op.drop_table("lei_exceptions")
    op.drop_table("lei_relationships")
    op.drop_table("lei_records")
    op.drop_table("entity_group_map")
    op.drop_table("groups")

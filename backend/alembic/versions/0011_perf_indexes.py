"""Indexes the corpus outgrew (chantier performance, O1).

Measured on 464 727 projects / 842 493 participations (2026-08-03):
the country filter had no index to lean on — `EXISTS (participations
WHERE country_code = …)` cost 836 ms where the direct join costs 78 ms.
The composite (country_code, project_id) serves both the filter and the
country facet, which count distinct projects per country.

Revision ID: 0011
Revises: 0010
Create Date: 2026-08-03

"""

from collections.abc import Sequence

from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_participations_country_project",
        "participations",
        ["country_code", "project_id"],
    )
    # The relevance page reads projects by id after the top-N is chosen
    # in the match set; sorting by amount is the second most common exit.
    op.create_index(
        "ix_projects_funding_amount_eur",
        "projects",
        ["funding_amount_eur"],
        postgresql_using="btree",
    )


def downgrade() -> None:
    op.drop_index("ix_projects_funding_amount_eur", table_name="projects")
    op.drop_index("ix_participations_country_project", table_name="participations")

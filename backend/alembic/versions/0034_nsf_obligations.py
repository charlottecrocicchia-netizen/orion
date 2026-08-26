"""Les obligations annuelles d'awards NSF et leur provenance (lot R5B).

Trois tables neuves et RIEN d'autre — la métrique `Share of NSF award
obligations` est INDÉPENDANTE du Reference Engine (R5A § 19.3) : elle ne
touche ni `projects`, ni `participations`, ni `macro_series`, et le
sélecteur « View funding as » l'ignore.

- `nsf_obligation_artifacts` : la provenance de chaque artefact officiel
  téléchargé (« @Award Details Sheet » par fiscal year, série Trends de
  contrôle) — URL, feuille, filtres, SHA256, version du parseur,
  résultat de validation. L'éligibilité d'une obligation est sa PRÉSENCE
  dans un artefact (R5A § 9.4.9) : aucun prédicat Orion, aucun filtre
  d'instrument.
- `nsf_award_obligations` : les lignes du snapshot officiel, stockées
  TELLES QUELLES. Le crosstab est un agrégat Tableau dont le grain réel
  est la combinaison de toutes ses dimensions (constaté sur pièces : un
  même award se scinde par funding division, par institution, par État
  d'exécution — Cornell NY/PR —, par managing division sur une
  dé-obligation) : aucune contrainte d'unicité sur un grain supposé —
  le chargeur refuse seulement une ligne rigoureusement identique
  (impossible dans un crosstab agrégé), et les validations qui font foi
  sont Σ = total officiel et le contrôle Trends. Versionnée par vintage
  — même discipline que `price_indices` : une ré-acquisition qui
  restate l'histoire AJOUTE une vintage, ne réécrit jamais.
- `nsf_obligation_totals` : par (vintage, FY) — total officiel,
  total joignable à Orion (`Award ID` ↔ `participations.source_uid`),
  couverture, contrôle contre la série Trends. Le seuil de
  disponibilité (couverture de jointure, R5A § 20.1 C4) se lit ici :
  jamais de zéro, jamais de repli — un FY hors seuil est indisponible.

Revision ID: 0034
Revises: 0033
Create Date: 2026-08-26

"""

import sqlalchemy as sa
from alembic import op

revision = "0034"
down_revision = "0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "nsf_obligation_artifacts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("vintage_date", sa.Date(), nullable=False),
        sa.Column("filename", sa.String(length=200), nullable=False),
        sa.Column("sheet", sa.String(length=100), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("filters", sa.JSON(), nullable=True),
        sa.Column("acquired_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("codebook_version", sa.String(length=60), nullable=True),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("bytes", sa.Integer(), nullable=False),
        sa.Column("parser_version", sa.String(length=20), nullable=False),
        sa.Column("validation", sa.JSON(), nullable=False),
        sa.Column(
            "imported_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("vintage_date", "filename", name="uq_nsf_obl_artifact_vintage"),
    )
    op.create_table(
        "nsf_award_obligations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("vintage_date", sa.Date(), nullable=False),
        sa.Column(
            "artifact_id",
            sa.Integer(),
            sa.ForeignKey("nsf_obligation_artifacts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("award_id", sa.String(length=20), nullable=False),
        sa.Column("fiscal_year", sa.Integer(), nullable=False),
        sa.Column("award_fiscal_year", sa.Integer(), nullable=True),
        sa.Column("funding_directorate", sa.String(length=120), nullable=True),
        sa.Column("funding_division", sa.String(length=120), nullable=True),
        sa.Column("award_instrument", sa.String(length=60), nullable=True),
        sa.Column("managing_directorate", sa.String(length=120), nullable=True),
        sa.Column("managing_division", sa.String(length=120), nullable=True),
        sa.Column("institution_id", sa.String(length=30), nullable=True),
        sa.Column("institution_name", sa.String(length=300), nullable=True),
        sa.Column("institution_state_code", sa.String(length=10), nullable=True),
        sa.Column("country_code", sa.String(length=10), nullable=True),
        sa.Column("amount", sa.Numeric(16, 2), nullable=False),
    )
    # Index couvrant : la pré-agrégation par award (dimensions jointes)
    # lit (award_id, amount) en index-only scan — mesuré : le pire cas
    # multi-FY passe de ~800 à ~470 ms à froid.
    op.create_index(
        "ix_nsf_obl_vintage_fy",
        "nsf_award_obligations",
        ["vintage_date", "fiscal_year"],
        postgresql_include=["award_id", "amount"],
    )
    op.create_index(
        "ix_nsf_obl_vintage_award",
        "nsf_award_obligations",
        ["vintage_date", "award_id"],
    )
    op.create_table(
        "nsf_obligation_totals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("vintage_date", sa.Date(), nullable=False),
        sa.Column("fiscal_year", sa.Integer(), nullable=False),
        sa.Column("official_total", sa.Numeric(16, 2), nullable=False),
        sa.Column("trend_total", sa.Numeric(16, 2), nullable=True),
        sa.Column("joinable_total", sa.Numeric(16, 2), nullable=False),
        sa.Column("unjoinable_total", sa.Numeric(16, 2), nullable=False),
        sa.Column("coverage", sa.Numeric(7, 4), nullable=False),
        sa.Column("available", sa.Boolean(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.UniqueConstraint("vintage_date", "fiscal_year", name="uq_nsf_obl_totals"),
    )


def downgrade() -> None:
    op.drop_table("nsf_obligation_totals")
    op.drop_index("ix_nsf_obl_vintage_award", table_name="nsf_award_obligations")
    op.drop_index("ix_nsf_obl_vintage_fy", table_name="nsf_award_obligations")
    op.drop_table("nsf_award_obligations")
    op.drop_table("nsf_obligation_artifacts")

"""Les obligations annuelles d'awards NSF (lot R5B).

Métrique INDÉPENDANTE du Reference Engine (R5A § 19.3) : l'éligibilité
d'une obligation est sa présence dans le snapshot officiel « @Award
Details Sheet » du millésime courant — jamais un prédicat Orion, jamais
un filtre d'instrument (R5A § 9.4.9, règle invalidée sur preuve). La
jointure `award_id` ↔ `participations.source_uid` n'apporte que les
dimensions d'Orion, pas l'éligibilité.
"""

from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from orion.models.base import Base


class NsfObligationArtifact(Base):
    """La provenance d'un artefact officiel (R5A § 20.1 C2).

    official downloaded artifact → immutable raw snapshot → SHA256 →
    deterministic parser → validated reference vintage. Aucun chiffre
    retapé : la ligne dit d'où viennent les octets, jamais elle ne les
    remplace."""

    __tablename__ = "nsf_obligation_artifacts"
    __table_args__ = (
        UniqueConstraint("vintage_date", "filename", name="uq_nsf_obl_artifact_vintage"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vintage_date: Mapped[date] = mapped_column(Date)
    filename: Mapped[str] = mapped_column(String(200))
    sheet: Mapped[str] = mapped_column(String(100))
    source_url: Mapped[str] = mapped_column(Text)
    filters: Mapped[dict | None] = mapped_column(JSON)
    acquired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    codebook_version: Mapped[str | None] = mapped_column(String(60))
    sha256: Mapped[str] = mapped_column(String(64))
    bytes: Mapped[int] = mapped_column(Integer)
    parser_version: Mapped[str] = mapped_column(String(20))
    validation: Mapped[dict] = mapped_column(JSON)
    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class NsfAwardObligation(Base):
    """Une ligne du snapshot officiel, stockée TELLE QUELLE.

    Le crosstab officiel est un agrégat Tableau : son grain réel est la
    combinaison de toutes ses dimensions (funding division, institution,
    État d'exécution, managing division… — constaté sur pièces). Aucune
    contrainte d'unicité sur un grain supposé : le chargeur refuse une
    ligne rigoureusement identique (impossible dans un agrégat), et les
    validations qui font foi sont Σ = total officiel + contrôle Trends.
    Versionnée par vintage, même discipline que `price_indices` : une
    ré-acquisition qui restate des FY historiques AJOUTE une vintage."""

    __tablename__ = "nsf_award_obligations"
    __table_args__ = (
        Index(
            "ix_nsf_obl_vintage_fy",
            "vintage_date",
            "fiscal_year",
            postgresql_include=["award_id", "amount"],
        ),
        Index("ix_nsf_obl_vintage_award", "vintage_date", "award_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vintage_date: Mapped[date] = mapped_column(Date)
    artifact_id: Mapped[int] = mapped_column(
        ForeignKey("nsf_obligation_artifacts.id", ondelete="CASCADE")
    )
    award_id: Mapped[str] = mapped_column(String(20))
    fiscal_year: Mapped[int] = mapped_column(Integer)
    award_fiscal_year: Mapped[int | None] = mapped_column(Integer)
    funding_directorate: Mapped[str | None] = mapped_column(String(120))
    funding_division: Mapped[str | None] = mapped_column(String(120))
    award_instrument: Mapped[str | None] = mapped_column(String(60))
    managing_directorate: Mapped[str | None] = mapped_column(String(120))
    managing_division: Mapped[str | None] = mapped_column(String(120))
    institution_id: Mapped[str | None] = mapped_column(String(30))
    institution_name: Mapped[str | None] = mapped_column(String(300))
    institution_state_code: Mapped[str | None] = mapped_column(String(10))
    country_code: Mapped[str | None] = mapped_column(String(10))
    amount: Mapped[float] = mapped_column(Numeric(16, 2))


class NsfObligationTotal(Base):
    """Réconciliation et disponibilité par (vintage, FY) — R5A § 20.1 C3/C4.

    `official_total` = Σ des lignes du snapshot ; `joinable_total` = la
    part jointe à `participations.source_uid` ; `coverage` = part
    joignable ; `available` applique le seuil gelé (couverture de
    jointure) : un FY hors seuil est INDISPONIBLE — jamais un zéro,
    jamais un repli, jamais une renormalisation."""

    __tablename__ = "nsf_obligation_totals"
    __table_args__ = (UniqueConstraint("vintage_date", "fiscal_year", name="uq_nsf_obl_totals"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vintage_date: Mapped[date] = mapped_column(Date)
    fiscal_year: Mapped[int] = mapped_column(Integer)
    official_total: Mapped[float] = mapped_column(Numeric(16, 2))
    trend_total: Mapped[float | None] = mapped_column(Numeric(16, 2))
    joinable_total: Mapped[float] = mapped_column(Numeric(16, 2))
    unjoinable_total: Mapped[float] = mapped_column(Numeric(16, 2))
    coverage: Mapped[float] = mapped_column(Numeric(7, 4))
    available: Mapped[bool] = mapped_column(Boolean)
    notes: Mapped[str | None] = mapped_column(Text)

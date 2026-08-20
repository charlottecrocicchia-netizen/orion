"""Le registre des lentilles et leurs tags (M0 multi-lentilles, 2026-08-17).

`lenses` MIRE backend/curation/lenses/registry.csv — famille → lentille,
la clé de famille est technique et stable, les mots vivent en i18n ; le
fichier reste la seule vérité éditable, la table sert les FK et la
validation `sector`. `project_lens_tags` remplace l'ancienne colonne
projects.space_tag : une ligne par (projet, lentille) — un projet peut
porter plusieurs lentilles (D1), chaque vue n'en lit qu'une (D3), et le
tag reste DÉRIVÉ des fichiers de règles, jamais posé à la main.
"""

from datetime import date

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from orion.models.base import Base


class Lens(Base):
    __tablename__ = "lenses"
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'published', 'retired')", name="ck_lenses_status"),
    )

    slug: Mapped[str] = mapped_column(String(30), primary_key=True)
    family_key: Mapped[str] = mapped_column(String(40))
    rank: Mapped[int] = mapped_column(Integer)
    # I2 (2026-08-18) : seule une lentille `published` existe pour le
    # produit ; `draft` se vérifie en base, `retired` reste gelée.
    status: Mapped[str] = mapped_column(String(12), server_default="published")
    # Le compte des règles, posé par le chargeur (M1.3) : l'À-propos le
    # LIT au lieu de l'écrire en dur.
    rules_total: Mapped[int] = mapped_column(Integer, server_default="0")
    rules_programme: Mapped[int] = mapped_column(Integer, server_default="0")
    rules_theme: Mapped[int] = mapped_column(Integer, server_default="0")
    rules_text: Mapped[int] = mapped_column(Integer, server_default="0")
    # Les adjudications de revue — par projet nommé (lot 2, 2026-08-20).
    rules_review: Mapped[int] = mapped_column(Integer, server_default="0")
    # La version de MÉTHODOLOGIE (S1) : un changement de règles qui
    # déplace des chiffres publics se date et se raconte.
    version: Mapped[int] = mapped_column(Integer, server_default="1")


class LensChangelog(Base):
    """Une version de méthodologie : sa date, son avant/après chiffré."""

    __tablename__ = "lens_changelog"

    lens: Mapped[str] = mapped_column(String(30), ForeignKey("lenses.slug"), primary_key=True)
    version: Mapped[int] = mapped_column(Integer, primary_key=True)
    changed_on: Mapped[date] = mapped_column(Date)
    core_before: Mapped[int] = mapped_column(Integer)
    core_after: Mapped[int] = mapped_column(Integer)
    enabling_before: Mapped[int] = mapped_column(Integer)
    enabling_after: Mapped[int] = mapped_column(Integer)
    funding_before_eur: Mapped[float] = mapped_column(Numeric(18, 2))
    funding_after_eur: Mapped[float] = mapped_column(Numeric(18, 2))


class ProjectLensTag(Base):
    __tablename__ = "project_lens_tags"
    __table_args__ = (
        CheckConstraint("tag IN ('core', 'enabling')", name="ck_project_lens_tags_tag"),
        CheckConstraint(
            "proof IN ('structural', 'taxonomic', 'textual')",
            name="ck_project_lens_tags_proof",
        ),
        Index("ix_project_lens_tags_lens_project", "lens", "project_id"),
    )

    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    lens: Mapped[str] = mapped_column(String(30), ForeignKey("lenses.slug"), primary_key=True)
    tag: Mapped[str] = mapped_column(String(8))
    # L'origine de la classification (I6) : l'audit sait quelle famille
    # de règles corriger, et le veto sait ce qu'il n'a pas le droit de
    # renverser.
    proof: Mapped[str] = mapped_column(String(12), server_default="taxonomic")

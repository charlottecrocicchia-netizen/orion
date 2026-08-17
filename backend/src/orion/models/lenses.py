"""Le registre des lentilles et leurs tags (M0 multi-lentilles, 2026-08-17).

`lenses` MIRE backend/curation/lenses/registry.csv — famille → lentille,
la clé de famille est technique et stable, les mots vivent en i18n ; le
fichier reste la seule vérité éditable, la table sert les FK et la
validation `sector`. `project_lens_tags` remplace l'ancienne colonne
projects.space_tag : une ligne par (projet, lentille) — un projet peut
porter plusieurs lentilles (D1), chaque vue n'en lit qu'une (D3), et le
tag reste DÉRIVÉ des fichiers de règles, jamais posé à la main.
"""

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from orion.models.base import Base


class Lens(Base):
    __tablename__ = "lenses"

    slug: Mapped[str] = mapped_column(String(30), primary_key=True)
    family_key: Mapped[str] = mapped_column(String(40))
    rank: Mapped[int] = mapped_column(Integer)


class ProjectLensTag(Base):
    __tablename__ = "project_lens_tags"
    __table_args__ = (
        CheckConstraint("tag IN ('core', 'adjacent')", name="ck_project_lens_tags_tag"),
        Index("ix_project_lens_tags_lens_project", "lens", "project_id"),
    )

    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    lens: Mapped[str] = mapped_column(String(30), ForeignKey("lenses.slug"), primary_key=True)
    tag: Mapped[str] = mapped_column(String(8))

from datetime import date, datetime

from sqlalchemy import (
    Computed,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column

from orion.models.base import Base

_SEARCH_VECTOR_SQL = (
    "setweight(to_tsvector("
    "CASE WHEN lang = 'fr' THEN 'orion_fr'::regconfig ELSE 'orion_en'::regconfig END, "
    "coalesce(title, '')), 'A') || "
    "setweight(to_tsvector("
    "CASE WHEN lang = 'fr' THEN 'orion_fr'::regconfig ELSE 'orion_en'::regconfig END, "
    "coalesce(abstract, '')), 'B')"
)


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (UniqueConstraint("source", "source_id", name="uq_projects_source_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(50))
    source_id: Mapped[str] = mapped_column(String(100))
    acronym: Mapped[str | None] = mapped_column(String(100))
    title: Mapped[str] = mapped_column(Text)
    title_lang: Mapped[str | None] = mapped_column(String(2))
    abstract: Mapped[str | None] = mapped_column(Text)
    abstract_lang: Mapped[str | None] = mapped_column(String(2))
    status: Mapped[str | None] = mapped_column(String(30))
    start_date: Mapped[date | None] = mapped_column(Date, index=True)
    end_date: Mapped[date | None] = mapped_column(Date)
    total_cost: Mapped[float | None] = mapped_column(Numeric(16, 2))
    total_cost_currency: Mapped[str | None] = mapped_column(String(3))
    funding_amount: Mapped[float | None] = mapped_column(Numeric(16, 2))
    funding_currency: Mapped[str | None] = mapped_column(String(3))
    funding_amount_eur: Mapped[float | None] = mapped_column(Numeric(16, 2))
    funder_id: Mapped[int] = mapped_column(ForeignKey("funders.id"), index=True)
    programme_id: Mapped[int | None] = mapped_column(ForeignKey("programmes.id"), index=True)
    call_id: Mapped[int | None] = mapped_column(ForeignKey("calls.id"), index=True)
    url: Mapped[str | None] = mapped_column(Text)
    content_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    raw: Mapped[dict | None] = mapped_column(JSONB)
    first_imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ProjectText(Base):
    """Title and abstract in one language; the unit bilingual search indexes."""

    __tablename__ = "project_texts"
    __table_args__ = (UniqueConstraint("project_id", "lang", name="uq_project_texts_project_lang"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    lang: Mapped[str] = mapped_column(String(2))
    title: Mapped[str] = mapped_column(Text)
    abstract: Mapped[str | None] = mapped_column(Text)
    search_vector = mapped_column(TSVECTOR, Computed(_SEARCH_VECTOR_SQL, persisted=True))


class Participation(Base):
    """One organisation's role in one project, with its own funding share."""

    __tablename__ = "participations"
    __table_args__ = (
        UniqueConstraint("source", "source_uid", name="uq_participations_source_uid"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    organisation_id: Mapped[int] = mapped_column(
        ForeignKey("organisations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str | None] = mapped_column(String(30))
    country_code: Mapped[str | None] = mapped_column(String(2), ForeignKey("countries.code"))
    amount: Mapped[float | None] = mapped_column(Numeric(16, 2))
    currency: Mapped[str | None] = mapped_column(String(3))
    amount_eur: Mapped[float | None] = mapped_column(Numeric(16, 2))
    order_index: Mapped[int | None] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String(50))
    source_uid: Mapped[str] = mapped_column(String(200))
    first_imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

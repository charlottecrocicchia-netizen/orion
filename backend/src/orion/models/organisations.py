from datetime import datetime

from sqlalchemy import (
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


def _trigram_index(name: str, column: str) -> Index:
    """GIN trigram index backing fuzzy organisation matching (created in 0002)."""
    return Index(name, column, postgresql_using="gin", postgresql_ops={column: "gin_trgm_ops"})


class Organisation(Base):
    """Canonical organisation; provenance lives in aliases and identifiers."""

    __tablename__ = "organisations"
    __table_args__ = (_trigram_index("ix_organisations_name_trgm", "name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    country_code: Mapped[str | None] = mapped_column(String(2), ForeignKey("countries.code"))
    city: Mapped[str | None] = mapped_column(String(200))
    org_type: Mapped[str | None] = mapped_column(String(50))
    website: Mapped[str | None] = mapped_column(Text)
    lat: Mapped[float | None] = mapped_column(Numeric(9, 6))
    lon: Mapped[float | None] = mapped_column(Numeric(9, 6))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class OrganisationIdentifier(Base):
    """External identifier by extensible scheme: pic, siren, siret… (ror reserved)."""

    __tablename__ = "organisation_identifiers"
    __table_args__ = (UniqueConstraint("scheme", "value", name="uq_org_identifiers_scheme_value"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organisation_id: Mapped[int] = mapped_column(
        ForeignKey("organisations.id", ondelete="CASCADE"), index=True
    )
    scheme: Mapped[str] = mapped_column(String(20))
    value: Mapped[str] = mapped_column(String(100))


class OrganisationAlias(Base):
    """Raw label seen in a source, linked to its canonical organisation."""

    __tablename__ = "organisation_aliases"
    __table_args__ = (
        UniqueConstraint("source", "name_raw", "country_raw", name="uq_org_aliases_source_raw"),
        _trigram_index("ix_org_aliases_name_raw_trgm", "name_raw"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organisation_id: Mapped[int] = mapped_column(
        ForeignKey("organisations.id", ondelete="CASCADE"), index=True
    )
    source: Mapped[str] = mapped_column(String(50))
    name_raw: Mapped[str] = mapped_column(Text)
    # Raw label as published: a code for CORDIS, a full country name for ANR.
    country_raw: Mapped[str | None] = mapped_column(String(100))

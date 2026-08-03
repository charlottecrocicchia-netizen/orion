from datetime import date, datetime

from sqlalchemy import (
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

# The groups layer (vague 1, socle identité — cahier des charges
# docs/groupes-couche.md): CANONICAL LAYERING. Legal entities stay true
# and untouched; a group is a reading laid OVER them. Memberships carry
# their method, confidence, source and validity window — joint ventures
# are weighted and flagged, never rounded to 100 %.


class Group(Base):
    """A corporate group — the canonical head, never a merged entity."""

    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    country_code: Mapped[str | None] = mapped_column(String(2), ForeignKey("countries.code"))
    # The ultimate parent's LEI when the group was built from GLEIF.
    lei: Mapped[str | None] = mapped_column(String(20), unique=True)
    source: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class EntityGroupMap(Base):
    """Entity → group membership, with its evidence and validity."""

    __tablename__ = "entity_group_map"
    __table_args__ = (
        UniqueConstraint("organisation_id", "group_id", "method", name="uq_entity_group_method"),
        Index("ix_entity_group_map_group", "group_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organisation_id: Mapped[int] = mapped_column(
        ForeignKey("organisations.id", ondelete="CASCADE"), index=True
    )
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"))
    # gleif | wikidata | bridge | rule | curation
    method: Mapped[str] = mapped_column(String(30))
    confidence: Mapped[float] = mapped_column(Numeric(3, 2))
    source: Mapped[str] = mapped_column(String(50))
    # Joint ventures: the ownership share (0–100) with the JV flag —
    # a 67/33 stays a 67/33, never a silent 100.
    share: Mapped[float | None] = mapped_column(Numeric(5, 2))
    is_jv: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    valid_from: Mapped[date | None] = mapped_column(Date)
    valid_to: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LeiRecord(Base):
    """GLEIF Level 1 — one legal entity as the LEI system knows it.

    `ra_id` keeps the registration-authority entity id verbatim: for
    French records that is the SIREN — the SIREN↔LEI bridge captured on
    the GLEIF side, ready the day a French source brings SIRENs (the ANR
    publishes none — instruction finding, 2026-08-03)."""

    __tablename__ = "lei_records"
    __table_args__ = (
        Index("ix_lei_records_country", "country_code"),
        Index("ix_lei_records_ra_id", "ra_id"),
        Index("ix_lei_records_name_normalized", "country_code", "name_normalized"),
    )

    lei: Mapped[str] = mapped_column(String(20), primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    # Same normalizer as organisations.name_normalized — the two sides
    # of the name+country bridge must speak one key.
    name_normalized: Mapped[str | None] = mapped_column(Text)
    country_code: Mapped[str | None] = mapped_column(String(2))
    ra_id: Mapped[str | None] = mapped_column(String(60))
    status: Mapped[str | None] = mapped_column(String(30))


class LeiRelationship(Base):
    """GLEIF Level 2 (RR-CDF) — who consolidates whom, by LEI."""

    __tablename__ = "lei_relationships"
    __table_args__ = (
        UniqueConstraint(
            "child_lei", "parent_lei", "relationship_type", name="uq_lei_rel_child_parent_type"
        ),
        Index("ix_lei_relationships_child", "child_lei"),
        Index("ix_lei_relationships_parent", "parent_lei"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    child_lei: Mapped[str] = mapped_column(String(20))
    parent_lei: Mapped[str] = mapped_column(String(20))
    # IS_DIRECTLY_CONSOLIDATED_BY | IS_ULTIMATELY_CONSOLIDATED_BY
    relationship_type: Mapped[str] = mapped_column(String(40))
    corroboration: Mapped[str | None] = mapped_column(String(40))


class LeiException(Base):
    """GLEIF Reporting Exceptions — WHY a LEI declares no parent.

    Loaded for bridged LEIs only (the full file mirrors most of the 3.4 M
    population; the cache keeps it whole, the base keeps what our corpus
    can use — honest scope, stated in the registry)."""

    __tablename__ = "lei_exceptions"
    __table_args__ = (
        UniqueConstraint("lei", "exception_type", name="uq_lei_exception_type"),
        Index("ix_lei_exceptions_lei", "lei"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lei: Mapped[str] = mapped_column(String(20))
    # DIRECT_ACCOUNTING_CONSOLIDATION_PARENT | ULTIMATE_…
    exception_type: Mapped[str] = mapped_column(String(60))
    reason: Mapped[str | None] = mapped_column(String(80))

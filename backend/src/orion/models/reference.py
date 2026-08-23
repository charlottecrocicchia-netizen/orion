from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from orion.models.base import Base


class Country(Base):
    """ISO 3166-1 alpha-2 country reference, seeded by `orion-ingest reference`."""

    __tablename__ = "countries"

    code: Mapped[str] = mapped_column(String(2), primary_key=True)
    name_en: Mapped[str] = mapped_column(String(120))
    region: Mapped[str | None] = mapped_column(String(30))
    eu_member: Mapped[bool] = mapped_column(Boolean, default=False)


class ExchangeRate(Base):
    """Yearly average rate to EUR (ECB reference rates); empty while all sources are EUR."""

    __tablename__ = "exchange_rates"

    currency: Mapped[str] = mapped_column(String(3), primary_key=True)
    year: Mapped[int] = mapped_column(Integer, primary_key=True)
    rate_to_eur: Mapped[float] = mapped_column(Numeric(14, 6))
    source: Mapped[str] = mapped_column(String(50), default="ecb")


class PriceIndex(Base):
    """Indice des prix annuel, versionné par vintage (lot A, euros constants).

    Une vintage = un jeu complet chargé tel quel ; une révision officielle
    AJOUTE une vintage, ne réécrit jamais la précédente — le calcul lit la
    dernière vintage par devise, la méthodologie l'affiche. EUR → HICP
    Eurostat (`prc_hicp_aind`, CC-BY 4.0) ; USD → CPI-U BLS
    (`CUUR0000SA0`, domaine public). La base de la série (2015=100,
    1982-84=100) n'importe pas : seuls les ratios entrent au facteur."""

    __tablename__ = "price_indices"
    __table_args__ = (
        UniqueConstraint("currency", "year", "vintage_date", name="uq_price_indices_vintage"),
        Index("ix_price_indices_currency_vintage", "currency", "vintage_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    currency: Mapped[str] = mapped_column(String(3))
    year: Mapped[int] = mapped_column(Integer)
    value: Mapped[float] = mapped_column(Numeric(10, 4))
    series_source: Mapped[str] = mapped_column(String(20))
    series_code: Mapped[str] = mapped_column(String(40))
    vintage_date: Mapped[date] = mapped_column(Date)
    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

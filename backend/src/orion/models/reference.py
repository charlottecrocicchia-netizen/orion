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


class Jurisdiction(Base):
    """Juridiction de financement (R0 § D2, lot R3) — l'objet MONDIAL.

    `code` stable et non traduit : ISO 3166-1 alpha-2 pour les pays,
    « EU » (code exceptionnellement réservé ISO) pour l'Union. Seedée
    par `orion-ingest reference` depuis le référentiel des pays + la
    ligne UE ; un financeur dont la `jurisdiction` n'existe pas ici est
    un défaut de seed, refusé bruyamment — jamais un cas d'exécution
    silencieux. Rien n'est hardcodé Europe/USA : ajouter UKRI→GB ou
    JSPS→JP est un ajout de données, pas une modification du moteur."""

    __tablename__ = "jurisdictions"

    code: Mapped[str] = mapped_column(String(10), primary_key=True)
    kind: Mapped[str] = mapped_column(String(10))  # country | union
    name_key: Mapped[str] = mapped_column(String(40))
    currency: Mapped[str | None] = mapped_column(String(3))


class MacroSeries(Base):
    """Série macro annuelle d'une juridiction, versionnée par vintage
    (R0 § D2, lot R3) — même discipline que `price_indices` : une
    révision officielle AJOUTE une vintage, l'application lit la
    dernière par (juridiction, concept). Concepts R3 :
    `gdp_current_usd` (WDI NY.GDP.MKTP.CD) et `population`
    (WDI SP.POP.TOTL) — CC BY-4.0 vérifié PAR INDICATEUR
    (2026-08-24). Aucun agrégat maison : l'UE est la série publiée
    par la source."""

    __tablename__ = "macro_series"
    __table_args__ = (
        UniqueConstraint(
            "jurisdiction_code", "concept", "year", "vintage_date", name="uq_macro_series_vintage"
        ),
        Index("ix_macro_series_concept_jur_year", "concept", "jurisdiction_code", "year"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    jurisdiction_code: Mapped[str] = mapped_column(String(10))
    concept: Mapped[str] = mapped_column(String(30))
    year: Mapped[int] = mapped_column(Integer)
    value: Mapped[float] = mapped_column(Numeric(20, 4))
    series_source: Mapped[str] = mapped_column(String(20))
    series_code: Mapped[str] = mapped_column(String(40))
    vintage_date: Mapped[date] = mapped_column(Date)
    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

from sqlalchemy import Boolean, Integer, Numeric, String
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

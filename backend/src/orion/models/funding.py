from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from orion.models.base import Base


class Funder(Base):
    """Funding body (European Commission, NIH… later NSF, UKRI, SNSF)."""

    __tablename__ = "funders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    jurisdiction: Mapped[str] = mapped_column(String(10))
    country_code: Mapped[str | None] = mapped_column(String(2), ForeignKey("countries.code"))
    default_currency: Mapped[str] = mapped_column(String(3))


class Programme(Base):
    __tablename__ = "programmes"
    __table_args__ = (UniqueConstraint("funder_id", "code", name="uq_programmes_funder_code"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    funder_id: Mapped[int] = mapped_column(ForeignKey("funders.id"), index=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("programmes.id"))
    code: Mapped[str] = mapped_column(String(100))
    name: Mapped[str | None] = mapped_column(Text)


class Call(Base):
    """Call for proposals a project was funded under; extended in phase 5 for upcoming calls."""

    __tablename__ = "calls"
    __table_args__ = (UniqueConstraint("funder_id", "code", name="uq_calls_funder_code"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    funder_id: Mapped[int] = mapped_column(ForeignKey("funders.id"), index=True)
    code: Mapped[str] = mapped_column(String(200))
    title: Mapped[str | None] = mapped_column(Text)
    year: Mapped[int | None] = mapped_column(Integer)

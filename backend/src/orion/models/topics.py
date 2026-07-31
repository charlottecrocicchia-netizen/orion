from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from orion.models.base import Base


class Topic(Base):
    """Thematic classification entry, per source scheme (euroscivoc, anr_axis…)."""

    __tablename__ = "topics"
    __table_args__ = (UniqueConstraint("scheme", "code", name="uq_topics_scheme_code"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    scheme: Mapped[str] = mapped_column(String(30))
    code: Mapped[str] = mapped_column(String(100))
    label: Mapped[str] = mapped_column(Text)
    path: Mapped[str | None] = mapped_column(Text)


class ProjectTopic(Base):
    __tablename__ = "project_topics"

    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    topic_id: Mapped[int] = mapped_column(
        ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True, index=True
    )

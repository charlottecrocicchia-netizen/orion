"""Les appels à venir (E1, phase 5) — le FAIT source, séparé de la lecture Orion.

Doctrine du chantier ([conception E1](../../../../docs/conception-e1-appels.md)) :
donnée officielle ≠ classification Orion ≠ analyse Orion, et la
séparation vit dans le modèle. `call_topics` porte le fait publié par le
portail EU Funding & Tenders (identifiant, dates, budget, textes —
verbatim en `raw`) ; `call_topic_lens_tags` porte la lecture Orion
(lentille, preuve, règle qui a mordu) ; l'analyse (scores E3) aura sa
table à elle, plus tard.

Le grain est le TOPIC (`HORIZON-JU-CBE-2026-IAFlag-04`) — c'est lui qui
porte deadlines et budget. Son appel parent (`callIdentifier`) est ponté
vers la table `calls` existante : CORDIS y range les mêmes codes, c'est
la charnière d'E2 (« qui a gagné les appels similaires »).
"""

from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from orion.models.base import Base


class CallTopic(Base):
    __tablename__ = "call_topics"
    __table_args__ = (UniqueConstraint("source", "source_id", name="uq_call_topics_source"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(30))
    source_id: Mapped[str] = mapped_column(String(200))
    # L'id de document SEDIA (`reference`) — utile au support, jamais une clé.
    reference: Mapped[str | None] = mapped_column(Text)
    identifier: Mapped[str] = mapped_column(String(200), index=True)
    title: Mapped[str | None] = mapped_column(Text)
    call_code: Mapped[str | None] = mapped_column(String(200), index=True)
    call_id: Mapped[int | None] = mapped_column(ForeignKey("calls.id"))
    framework_programme_code: Mapped[str | None] = mapped_column(String(30), index=True)
    framework_programme_label: Mapped[str | None] = mapped_column(Text)
    # Le statut SOURCE, verbatim (31094501 Forthcoming / 31094502 Open /
    # 31094503 Closed). Le statut AFFICHÉ est dérivé des dates à la
    # lecture — jamais du seul code : aucun appel clos présenté ouvert.
    status_code: Mapped[str | None] = mapped_column(String(30), index=True)
    status_label: Mapped[str | None] = mapped_column(String(50))
    opening_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Liste d'instants UTC ISO — un appel « multiple cut-off » en porte
    # plusieurs ; le fuseau officiel de soumission (Bruxelles) est une
    # affaire d'affichage.
    deadline_dates: Mapped[list | None] = mapped_column(JSONB)
    deadline_model: Mapped[str | None] = mapped_column(String(50))
    types_of_action: Mapped[list | None] = mapped_column(JSONB)
    keywords: Mapped[list | None] = mapped_column(JSONB)
    tags: Mapped[list | None] = mapped_column(JSONB)
    cross_cutting: Mapped[list | None] = mapped_column(JSONB)
    # Dérivés de budgetOverview pour les actions du topic lui-même ;
    # NULL quand la source ne les donne pas — jamais un zéro inventé.
    budget_min_eur: Mapped[float | None] = mapped_column(Numeric(16, 2))
    budget_max_eur: Mapped[float | None] = mapped_column(Numeric(16, 2))
    expected_grants: Mapped[int | None] = mapped_column(Integer)
    budget_overview: Mapped[dict | None] = mapped_column(JSONB)
    # HTML SANITIZÉ à l'ingestion (allowlist) ; l'original vit dans raw.
    description_html: Mapped[str | None] = mapped_column(Text)
    conditions_html: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(Text)
    raw: Mapped[dict | None] = mapped_column(JSONB)
    first_imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class CallTopicLensTag(Base):
    """La lecture Orion d'un appel — V1 structurelle uniquement : les
    règles `call` (préfixes d'identifiant) des lentilles publiées. La
    règle qui a mordu est conservée : c'est le « pourquoi » affiché."""

    __tablename__ = "call_topic_lens_tags"
    __table_args__ = (
        CheckConstraint("tag IN ('core', 'enabling')", name="ck_call_topic_lens_tag"),
    )

    call_topic_id: Mapped[int] = mapped_column(
        ForeignKey("call_topics.id", ondelete="CASCADE"), primary_key=True
    )
    lens: Mapped[str] = mapped_column(
        String(30), ForeignKey("lenses.slug", ondelete="CASCADE"), primary_key=True
    )
    tag: Mapped[str] = mapped_column(String(10))
    proof: Mapped[str] = mapped_column(String(12), default="structural")
    rule: Mapped[str | None] = mapped_column(Text)

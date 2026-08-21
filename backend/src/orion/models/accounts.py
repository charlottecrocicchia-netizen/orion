"""Le socle comptes (conception-workspace, D2) : une identité, un
contenant, une appartenance, des jetons. Aucune FK vers le corpus,
jamais — les objets du workspace pointent le produit par ses URLs.

Les secrets (lien magique, session) ne vivent HACHÉS qu'ici : le clair
n'existe que dans l'email ou le navigateur.
"""

from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from orion.models.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Normalisé lower() à l'écriture — l'unicité est une contrainte de
    # base, pas une politesse de code (verrou 3).
    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LoginToken(Base):
    """Un lien magique : usage unique, 15 minutes, jamais en clair."""

    __tablename__ = "login_tokens"

    token_hash: Mapped[str] = mapped_column(Text, primary_key=True)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    # Le nonce de continuité navigateur (verrou 2) — haché comme le reste.
    nonce_hash: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class UserSession(Base):
    """Une session : cookie opaque, 30 jours glissants, 90 absolus (D3)."""

    __tablename__ = "sessions"

    token_hash: Mapped[str] = mapped_column(Text, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_used_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    # Le plafond ABSOLU (created_at + 90 j) : rien ne le repousse.
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Membership(Base):
    __tablename__ = "memberships"
    __table_args__ = (CheckConstraint("role IN ('owner', 'member')", name="ck_memberships_role"),)

    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[str] = mapped_column(Text, nullable=False)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    invited_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class LoginRequest(Base):
    """Le journal des demandes de lien — la matière du rate limit
    (fenêtre glissante en Postgres, verrou 5). Toute demande s'y
    inscrit, admise ou non : les compteurs par IP ont besoin de tout
    voir."""

    __tablename__ = "login_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    ip: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )


class Dossier(Base):
    """Le dossier durable (D5) : une liste ordonnée d'items dont le
    format EST celui du dossier de session (lib/dossier.ts) — des URLs
    du produit, jamais des FK vers le corpus."""

    __tablename__ = "dossiers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workspace_id: Mapped[int] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    items: Mapped[list] = mapped_column(JSONB, nullable=False, server_default="[]")
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

"""Le cœur du socle comptes — les garanties D1/D3 et les verrous du
contrat (conception-workspace), une fonction par geste.

Toutes les fonctions prennent la session DB de la requête et ne
commitent pas elles-mêmes sauf indication : le premier login est UNE
transaction (verrou 3) — un échec en route ne laisse rien à moitié.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from orion.auth.tokens import hash_token, new_token
from orion.core.config import get_settings
from orion.models.accounts import (
    Dossier,
    LoginRequest,
    LoginToken,
    Membership,
    User,
    UserSession,
    Workspace,
)

TOKEN_TTL = timedelta(minutes=15)
SESSION_SLIDE = timedelta(days=30)
SESSION_CAP = timedelta(days=90)
# Le glissement s'écrit au plus une fois par heure : une lecture ne
# doit pas coûter un UPDATE par requête.
SLIDE_WRITE_THROTTLE = timedelta(hours=1)

# Verrou 5 — le rate limit ne verrouille pas une victime : limite
# forte par IP, serrée par paire IP×email, PLUS GÉNÉREUSE par email
# seul (5 saisies d'un inconnu ne privent pas la vraie personne), et
# un cooldown court entre deux envois.
LIMIT_PER_IP_HOUR = 20
LIMIT_PER_PAIR_HOUR = 5
LIMIT_PER_EMAIL_HOUR = 10
COOLDOWN_PER_EMAIL = timedelta(seconds=60)


def _now() -> datetime:
    return datetime.now(UTC)


@dataclass
class LoginOutcome:
    """Ce que la route NE dit PAS au client : la réponse publique est
    identique quoi qu'il arrive (anti-énumération). `link` n'est rempli
    qu'en mode dev, `send_to` que si un envoi doit partir."""

    send_to: str | None = None
    link: str | None = None
    nonce: str | None = None


def request_login(db: Session, email: str, ip: str) -> LoginOutcome:
    """La demande de lien : journalisée, filtrée par la porte (liste
    d'emails approuvés) et par les compteurs — sans que la réponse ne
    trahisse quel garde-fou a mordu."""
    settings = get_settings()
    email = email.strip().lower()
    now = _now()

    # Le nonce de continuité (verrou 2) est généré et posé en cookie
    # QUOI QU'IL ARRIVE : un Set-Cookie présent seulement pour les
    # emails approuvés rendrait la liste observable.
    nonce_clear, nonce_hashed = new_token()

    db.add(LoginRequest(email=email, ip=ip, requested_at=now))
    db.flush()

    window = now - timedelta(hours=1)

    def count(*conds) -> int:
        return db.scalar(
            select(func.count())
            .select_from(LoginRequest)
            .where(LoginRequest.requested_at >= window, *conds)
        )

    if count(LoginRequest.ip == ip) > LIMIT_PER_IP_HOUR:
        return LoginOutcome(nonce=nonce_clear)
    if count(LoginRequest.ip == ip, LoginRequest.email == email) > LIMIT_PER_PAIR_HOUR:
        return LoginOutcome(nonce=nonce_clear)
    if count(LoginRequest.email == email) > LIMIT_PER_EMAIL_HOUR:
        return LoginOutcome(nonce=nonce_clear)
    last_sent = db.scalar(select(func.max(LoginToken.created_at)).where(LoginToken.email == email))
    if last_sent is not None and now - last_sent < COOLDOWN_PER_EMAIL:
        return LoginOutcome(nonce=nonce_clear)

    # La porte (amendement 2026-08-21) : hors liste, rien ne part et
    # aucun token n'est créé — la liste elle-même n'est pas observable.
    if email not in settings.allowed_emails:
        return LoginOutcome(nonce=nonce_clear)

    token_clear, token_hashed = new_token()
    db.add(
        LoginToken(
            token_hash=token_hashed,
            email=email,
            nonce_hash=nonce_hashed,
            created_at=now,
            expires_at=now + TOKEN_TTL,
        )
    )
    # Verrou 1 : le token voyage en FRAGMENT — jamais dans une query
    # que le serveur ou un proxy pourrait journaliser.
    link = f"{settings.public_origin}/login/verify#token={token_clear}"
    return LoginOutcome(send_to=email, link=link, nonce=nonce_clear)


def peek_token(db: Session, token_clear: str) -> LoginToken | None:
    """Lecture SANS consommation (verrou 2 : la page de confirmation
    affiche l'adresse masquée AVANT le POST qui consomme)."""
    token = db.get(LoginToken, hash_token(token_clear))
    if token is None or token.used_at is not None or token.expires_at <= _now():
        return None
    return token


def consume_token(db: Session, token_clear: str) -> tuple[User, str] | None:
    """La consommation et le premier login, UNE transaction (verrou 3).

    L'UPDATE conditionnel ne gagne qu'une fois : deux consommations en
    course ne créeront jamais deux sessions. Retourne (user, cookie en
    clair) ou None si le lien est mort — sans dire pourquoi.
    """
    now = _now()
    won = db.execute(
        update(LoginToken)
        .where(
            LoginToken.token_hash == hash_token(token_clear),
            LoginToken.used_at.is_(None),
            LoginToken.expires_at > now,
        )
        .values(used_at=now)
        .returning(LoginToken.email)
    ).first()
    if won is None:
        db.rollback()
        return None
    email = won[0]

    # get-or-create : la contrainte UNIQUE(email) est le juge de paix.
    db.execute(pg_insert(User).values(email=email).on_conflict_do_nothing(index_elements=["email"]))
    user = db.scalar(select(User).where(User.email == email))
    user.last_seen_at = now

    # Le workspace personnel, au PREMIER lien consommé (pas à la demande).
    has_workspace = db.scalar(
        select(func.count()).select_from(Membership).where(Membership.user_id == user.id)
    )
    if not has_workspace:
        workspace = Workspace(name=email, created_by=user.id, created_at=now)
        db.add(workspace)
        db.flush()
        db.add(Membership(workspace_id=workspace.id, user_id=user.id, role="owner", joined_at=now))

    # ROTATION (D3) : chaque connexion crée SA session — jamais de
    # réutilisation d'un identifiant antérieur.
    cookie_clear, cookie_hashed = new_token()
    db.add(
        UserSession(
            token_hash=cookie_hashed,
            user_id=user.id,
            created_at=now,
            last_used_at=now,
            expires_at=now + SESSION_CAP,
        )
    )
    db.commit()
    return user, cookie_clear


def resolve_session(db: Session, cookie_clear: str) -> User | None:
    """La session du cookie — 30 jours glissants, 90 absolus. Le
    glissement s'écrit avec parcimonie (une fois par heure au plus)."""
    now = _now()
    session = db.get(UserSession, hash_token(cookie_clear))
    if session is None:
        return None
    if session.expires_at <= now or session.last_used_at + SESSION_SLIDE <= now:
        return None
    if now - session.last_used_at >= SLIDE_WRITE_THROTTLE:
        session.last_used_at = now
        db.commit()
    return db.get(User, session.user_id)


def revoke_session(db: Session, cookie_clear: str) -> None:
    """La déconnexion RÉVOQUE en base (D3) — le cookie effacé ne suffit
    pas : un cookie rejoué après logout doit être mort."""
    db.execute(delete(UserSession).where(UserSession.token_hash == hash_token(cookie_clear)))
    db.commit()


def delete_account(db: Session, user: User) -> None:
    """Suppression de compte (D5 bis) : sessions et appartenances par
    CASCADE ; tout workspace dont l'utilisateur est le seul membre part
    avec ses objets. (Au lot 1 il n'existe que des workspaces
    personnels ; le refus « dernier owner d'une équipe » arrive avec
    les équipes, lot 2.)"""
    members_per_workspace = (
        select(Membership.workspace_id, func.count().label("n"))
        .group_by(Membership.workspace_id)
        .subquery()
    )
    solo_workspaces = db.scalars(
        select(Membership.workspace_id)
        .join(
            members_per_workspace,
            members_per_workspace.c.workspace_id == Membership.workspace_id,
        )
        .where(Membership.user_id == user.id, members_per_workspace.c.n == 1)
    ).all()
    for wid in solo_workspaces:
        db.execute(delete(Workspace).where(Workspace.id == wid))
    db.delete(user)
    db.commit()


def workspaces_of(db: Session, user: User) -> list[dict]:
    rows = db.execute(
        select(Workspace.id, Workspace.name, Membership.role)
        .join(Membership, Membership.workspace_id == Workspace.id)
        .where(Membership.user_id == user.id)
        .order_by(Workspace.created_at)
    ).all()
    return [{"id": r.id, "name": r.name, "role": r.role} for r in rows]


def membership_role(db: Session, user: User, workspace_id: int) -> str | None:
    return db.scalar(
        select(Membership.role).where(
            Membership.workspace_id == workspace_id, Membership.user_id == user.id
        )
    )


__all__ = [
    "Dossier",
    "LoginOutcome",
    "consume_token",
    "delete_account",
    "membership_role",
    "peek_token",
    "request_login",
    "resolve_session",
    "revoke_session",
    "workspaces_of",
]

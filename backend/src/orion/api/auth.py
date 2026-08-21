"""Les routes d'identité (conception-workspace, lot 1) — toutes sous
`/api/auth` et `/api/me` ; aucune mutation via GET, jamais.

La demande de lien répond STRICTEMENT PAREIL qu'un compte existe ou
non, que la porte soit ouverte ou non, que le compteur ait mordu ou
non — même corps, même statut, même Set-Cookie ; l'envoi part en tâche
de fond pour que le temps de réponse ne trahisse rien non plus.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from orion.auth import service
from orion.auth.deps import (
    NONCE_COOKIE,
    SESSION_COOKIE,
    current_user,
    require_same_origin,
)
from orion.auth.emails import send_login_email
from orion.auth.tokens import hash_token, mask_email
from orion.core.config import get_settings
from orion.core.db import get_db
from orion.models.accounts import User

logger = logging.getLogger(__name__)
router = APIRouter()

NONCE_TTL_SECONDS = 15 * 60
SESSION_TTL_SECONDS = 90 * 24 * 3600


def _set_cookie(response: Response, name: str, value: str, max_age: int) -> None:
    response.set_cookie(
        key=name,
        value=value,
        max_age=max_age,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )


def _clear_cookie(response: Response, name: str) -> None:
    response.set_cookie(
        key=name, value="", max_age=0, httponly=True, secure=True, samesite="lax", path="/"
    )


def _send_quietly(to: str, link: str) -> None:
    try:
        send_login_email(to, link)
    except Exception:
        # L'échec d'envoi ne doit ni casser la réponse (déjà partie) ni
        # révéler quoi que ce soit — il se lit dans les logs.
        logger.exception("envoi du lien magique impossible")


class LoginBody(BaseModel):
    email: str = Field(min_length=3, max_length=254)


@router.post("/auth/login")
def login(
    body: LoginBody,
    request: Request,
    response: Response,
    tasks: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_same_origin)],
) -> dict:
    ip = request.client.host if request.client else "?"
    outcome = service.request_login(db, body.email, ip)
    db.commit()
    if outcome.nonce:
        _set_cookie(response, NONCE_COOKIE, outcome.nonce, NONCE_TTL_SECONDS)
    payload: dict = {"status": "ok"}
    if outcome.send_to and outcome.link:
        settings = get_settings()
        if settings.auth_dev:
            # Mode dev/e2e UNIQUEMENT : le lien s'écrit dans la réponse,
            # aucun email ne part (contrat D1).
            payload["dev_link"] = outcome.link
        else:
            tasks.add_task(_send_quietly, outcome.send_to, outcome.link)
    return payload


class TokenBody(BaseModel):
    token: str = Field(min_length=10, max_length=200)


@router.post("/auth/verify/preview")
def verify_preview(
    body: TokenBody, request: Request, db: Annotated[Session, Depends(get_db)]
) -> dict:
    """Lecture sans consommation (verrou 2) : la page affiche l'adresse
    masquée AVANT le POST qui consomme. Un lien mort répond 400 sobre —
    jamais pourquoi."""
    token = service.peek_token(db, body.token)
    if token is None:
        raise HTTPException(status_code=400, detail={"error": "INVALID_LINK"})
    nonce = request.cookies.get(NONCE_COOKIE)
    same_browser = bool(nonce) and hash_token(nonce) == token.nonce_hash
    return {"email_masked": mask_email(token.email), "same_browser": same_browser}


@router.post("/auth/verify")
def verify(
    body: TokenBody,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_same_origin)],
) -> dict:
    result = service.consume_token(db, body.token)
    if result is None:
        raise HTTPException(status_code=400, detail={"error": "INVALID_LINK"})
    user, cookie_clear = result
    _set_cookie(response, SESSION_COOKIE, cookie_clear, SESSION_TTL_SECONDS)
    _clear_cookie(response, NONCE_COOKIE)
    return {"email": user.email, "display_name": user.display_name}


@router.post("/auth/logout")
def logout(
    request: Request,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_same_origin)],
) -> dict:
    cookie = request.cookies.get(SESSION_COOKIE)
    if cookie:
        service.revoke_session(db, cookie)
    _clear_cookie(response, SESSION_COOKIE)
    return {"status": "ok"}


@router.get("/me")
def me(
    user: Annotated[User, Depends(current_user)], db: Annotated[Session, Depends(get_db)]
) -> dict:
    return {
        "email": user.email,
        "display_name": user.display_name,
        "workspaces": service.workspaces_of(db, user),
    }


@router.delete("/me")
def delete_me(
    response: Response,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[None, Depends(require_same_origin)],
) -> dict:
    service.delete_account(db, user)
    _clear_cookie(response, SESSION_COOKIE)
    return {"status": "deleted"}

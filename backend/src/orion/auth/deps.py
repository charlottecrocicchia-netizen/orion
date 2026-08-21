"""Les dépendances FastAPI du socle : l'utilisateur courant et le
garde-fou d'origine sur les mutations (doctrine CSRF, D3).
"""

from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from orion.auth.service import resolve_session
from orion.core.db import get_db
from orion.models.accounts import User

# __Host- : Secure + Path=/ + pas de Domain — le cookie n'appartient
# qu'à l'origine exacte. Les navigateurs traitent localhost en contexte
# sécurisé, la prod passe par HTTPS Caddy (verrou 3).
SESSION_COOKIE = "__Host-orion_session"
NONCE_COOKIE = "__Host-orion_login_nonce"


def require_same_origin(request: Request) -> None:
    """`Origin` (à défaut `Sec-Fetch-Site`) contrôlé sur TOUTE requête
    mutante ; origine étrangère → refus, sans exception « pratique ».
    Un client sans navigateur (tests, curl) n'envoie aucun des deux :
    le CSRF est une attaque DE navigateur, l'absence des deux en-têtes
    n'en est pas un."""
    origin = request.headers.get("origin")
    if origin is not None:
        origin_host = origin.removeprefix("https://").removeprefix("http://")
        if origin_host != request.headers.get("host", ""):
            raise HTTPException(status_code=403, detail={"error": "FOREIGN_ORIGIN"})
        return
    fetch_site = request.headers.get("sec-fetch-site")
    if fetch_site is not None and fetch_site not in ("same-origin", "none"):
        raise HTTPException(status_code=403, detail={"error": "FOREIGN_ORIGIN"})


def current_user(request: Request, db: Annotated[Session, Depends(get_db)]) -> User:
    cookie = request.cookies.get(SESSION_COOKIE)
    user = resolve_session(db, cookie) if cookie else None
    if user is None:
        raise HTTPException(status_code=401, detail={"error": "NOT_AUTHENTICATED"})
    return user

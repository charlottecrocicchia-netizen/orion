"""L'application — et sa frontière d'accès (pivot du 2026-08-22 :
Orion est une application PRIVÉE derrière une landing publique).

La frontière est UN middleware, fermé par défaut : toute route `/api/*`
exige une session valide, sauf la liste publique nommée ci-dessous.
Une route ajoutée demain naît privée sans qu'on y pense — c'est le
point : la sécurité des données ne dépend jamais de ce que le front
cache ou pas.
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from orion import __version__
from orion.api.router import api_router

# La liste publique EST le contrat — chaque entrée a sa raison :
# - /api/health : la supervision n'a pas de compte ;
# - /api/auth/  : on ne peut pas exiger une session pour en créer une ;
# - /api/public/ : le strict nécessaire de la landing (totaux, noms de
#   lentilles) — rien qui se fouille, rien qui se liste.
PUBLIC_API_PREFIXES = ("/api/health", "/api/auth/", "/api/public/")


def _session_user_id(request: Request) -> int | None:
    """Résolution SYNCHRONE de la session (SQLAlchemy bloquant) — le
    middleware l'appelle via le threadpool pour ne pas geler la boucle."""
    from orion.auth.deps import SESSION_COOKIE
    from orion.auth.service import resolve_session
    from orion.core.db import SessionLocal

    cookie = request.cookies.get(SESSION_COOKIE)
    if not cookie:
        return None
    db = SessionLocal()
    try:
        user = resolve_session(db, cookie)
        return user.id if user is not None else None
    finally:
        db.close()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Orion API",
        version=__version__,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )
    app.include_router(api_router, prefix="/api")

    @app.middleware("http")
    async def porte_privee(request: Request, call_next):
        path = request.url.path
        if path.startswith("/api") and not path.startswith(PUBLIC_API_PREFIXES):
            user_id = await run_in_threadpool(_session_user_id, request)
            if user_id is None:
                # 401 sobre, identique pour toute la surface privée —
                # la doc et l'openapi comprises.
                return JSONResponse(
                    status_code=401, content={"detail": {"error": "NOT_AUTHENTICATED"}}
                )
        return await call_next(request)

    return app


app = create_app()

from fastapi import FastAPI

from orion import __version__
from orion.api.router import api_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="Orion API",
        version=__version__,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )
    app.include_router(api_router, prefix="/api")
    return app


app = create_app()

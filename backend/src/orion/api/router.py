from fastapi import APIRouter

from orion.api import (
    auth,
    dossiers,
    explore,
    health,
    news,
    organisations,
    projects,
    search,
    sources,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["system"])
api_router.include_router(sources.router, tags=["data"])
api_router.include_router(search.router, tags=["search"])
api_router.include_router(projects.router, tags=["projects"])
api_router.include_router(organisations.router, tags=["organisations"])
api_router.include_router(explore.router, tags=["explore"])
api_router.include_router(news.router, tags=["news"])
api_router.include_router(auth.router, tags=["accounts"])
api_router.include_router(dossiers.router, tags=["accounts"])

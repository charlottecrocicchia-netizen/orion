from fastapi import APIRouter

from orion.api import health, organisations, projects, search, sources

api_router = APIRouter()
api_router.include_router(health.router, tags=["system"])
api_router.include_router(sources.router, tags=["data"])
api_router.include_router(search.router, tags=["search"])
api_router.include_router(projects.router, tags=["projects"])
api_router.include_router(organisations.router, tags=["organisations"])

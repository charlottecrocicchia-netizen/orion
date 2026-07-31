from fastapi import APIRouter

from orion.api import health, sources

api_router = APIRouter()
api_router.include_router(health.router, tags=["system"])
api_router.include_router(sources.router, tags=["data"])

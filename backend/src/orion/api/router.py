from fastapi import APIRouter

from orion.api import health

api_router = APIRouter()
api_router.include_router(health.router, tags=["system"])

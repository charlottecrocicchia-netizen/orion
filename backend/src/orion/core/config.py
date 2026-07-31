from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, read from ORION_* environment variables."""

    model_config = SettingsConfigDict(env_prefix="ORION_", extra="ignore")

    env: str = "dev"
    database_url: str = "postgresql+psycopg://orion:orion@localhost:5432/orion"


@lru_cache
def get_settings() -> Settings:
    return Settings()

import os
import subprocess
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import psycopg
import pytest

# Tests own their database. Pointing them at the development one made assertions
# depend on whatever had been ingested locally — set this before importing any
# orion module, since the engine is built at import time.
DEFAULT_TEST_URL = "postgresql+psycopg://orion:orion@localhost:5432/orion_test"
os.environ.setdefault("ORION_TEST_DATABASE_URL", DEFAULT_TEST_URL)
os.environ["ORION_DATABASE_URL"] = os.environ["ORION_TEST_DATABASE_URL"]

BACKEND_DIR = Path(__file__).resolve().parents[1]


def _create_database_if_missing(url: str) -> None:
    parts = urlsplit(url.replace("postgresql+psycopg://", "postgresql://"))
    database = parts.path.lstrip("/")
    admin_url = urlunsplit(parts._replace(path="/postgres"))
    with psycopg.connect(admin_url, autocommit=True) as conn:
        exists = conn.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (database,)
        ).fetchone()
        if not exists:
            conn.execute(f'CREATE DATABASE "{database}"')


@pytest.fixture(scope="session", autouse=True)
def test_database() -> None:
    """Create the test database and bring it to the latest migration."""
    _create_database_if_missing(os.environ["ORION_DATABASE_URL"])
    subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
        check=True,
        capture_output=True,
        env={**os.environ},
    )


@pytest.fixture(autouse=True)
def clear_search_cache():
    """The in-process search cache is keyed by the ingestion stamp, which never
    moves in the test database — savepoint-rolled-back data would leak between
    tests through it."""
    from orion.search import service

    service._CACHE.clear()
    yield
    service._CACHE.clear()


@pytest.fixture(scope="session")
def client(test_database):
    from fastapi.testclient import TestClient

    from orion.main import app

    return TestClient(app)

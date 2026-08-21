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


@pytest.fixture
def client(test_database):
    """Un client AUTHENTIFIÉ. Pivot du 2026-08-22 : l'API est privée par
    défaut (middleware fermé), les tests de données parlent donc avec
    une session valide — semée directement en base, comme le ferait un
    login. Base https : le cookie de session est Secure (__Host-)."""
    import hashlib
    import secrets

    from fastapi.testclient import TestClient
    from sqlalchemy import text as sql_text

    from orion.core.db import engine as orion_engine
    from orion.main import app

    cookie = secrets.token_urlsafe(32)
    cookie_hash = hashlib.sha256(cookie.encode()).hexdigest()
    with orion_engine.begin() as conn:
        user_id = conn.execute(
            sql_text(
                "INSERT INTO users(email) VALUES ('suite@orion.test') "
                "ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email "
                "RETURNING id"
            )
        ).scalar()
        conn.execute(
            sql_text(
                "INSERT INTO sessions(token_hash, user_id, expires_at) "
                "VALUES (:h, :u, now() + interval '90 days')"
            ),
            {"h": cookie_hash, "u": user_id},
        )
    # Le cookie part en en-tête fixe : le jar httpx n'émet pas les
    # cookies injectés à la main (seulement ceux posés par Set-Cookie).
    return TestClient(
        app,
        base_url="https://testserver",
        headers={"Cookie": f"__Host-orion_session={cookie}"},
    )

import pytest
from fastapi.testclient import TestClient

from orion.main import app


@pytest.fixture(scope="session")
def client() -> TestClient:
    return TestClient(app)

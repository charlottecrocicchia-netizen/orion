"""La frontière d'accès (pivot du 2026-08-22) : l'API est PRIVÉE par
défaut. Un anonyme n'obtient aucune donnée — quelle que soit la route,
y compris celles qui n'existent pas encore (middleware fermé par
défaut, liste publique nommée).
"""

import pytest
from fastapi.testclient import TestClient

PRIVATE_ROUTES = [
    "/api/stats",
    "/api/countries",
    "/api/search/projects?q=space",
    "/api/search/organisations?q=a",
    "/api/search/suggest?q=a",
    "/api/explore/aggregate?metric=funding&by=year",
    "/api/projects/1",
    "/api/organisations/1",
    "/api/news",
    "/api/sources",
    "/api/programmes",
    "/api/regions",
    "/api/openapi.json",
    "/api/docs",
    "/api/une-route-qui-n-existe-pas-encore",
]


@pytest.fixture
def anonymous(test_database):
    from orion.main import app

    return TestClient(app, base_url="https://testserver")


@pytest.mark.parametrize("route", PRIVATE_ROUTES)
def test_anonyme_refuse_partout(anonymous, route):
    """401 sobre sur TOUTE la surface privée — même une route inconnue
    ne révèle pas si elle existe."""
    response = anonymous.get(route)
    assert response.status_code == 401
    assert response.json() == {"detail": {"error": "NOT_AUTHENTICATED"}}


def test_anonyme_garde_la_porte_d_entree(anonymous):
    """La liste publique, et rien d'autre : santé, auth, overview."""
    assert anonymous.get("/api/health").status_code == 200
    overview = anonymous.get("/api/public/overview")
    assert overview.status_code == 200
    body = overview.json()
    # Le payload marketing, au complet et rien de plus — chaque champ
    # est une décision de publication délibérée (voir api/public.py).
    assert set(body.keys()) == {"totals", "funding_by_year", "lenses", "coverage"}
    for lens in body["lenses"]:
        assert set(lens.keys()) == {"slug", "rank", "version", "core", "enabling"}
    for country in body["coverage"]:
        # Des pays couverts : code, nom, région — JAMAIS un montant.
        assert set(country.keys()) == {"code", "name", "region"}
    assert anonymous.post("/api/auth/login", json={"email": "x@y.z"}).status_code == 200


def test_session_ouvre_les_donnees(client):
    """Le même appel, avec session : les données répondent."""
    assert client.get("/api/stats").status_code == 200
    assert client.get("/api/sources").status_code == 200

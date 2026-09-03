"""Le socle comptes (conception-workspace, lot 1) — les garanties D1/D3
et les verrous du contrat, une à une : porte fermée par défaut, réponse
indiscernable, usage unique, expiration, rate limit, rotation,
révocation, plafond absolu, dossier durable, suppression de compte.
"""

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from orion.core.db import engine

ALLOWED = "charlotte@example.com"
STRANGER = "inconnue@example.com"

ACCOUNT_TABLES = [
    "dossiers",
    "login_requests",
    "sessions",
    "memberships",
    "workspaces",
    "login_tokens",
    "users",
]


@pytest.fixture(autouse=True)
def accounts_env(test_database):
    """La porte ouverte au seul email de test, mode dev (le lien s'écrit
    dans la réponse) — et des tables vierges à chaque test."""
    from orion.core.config import get_settings

    previous = {k: os.environ.get(k) for k in ("ORION_LOGIN_ALLOWLIST", "ORION_AUTH_DEV")}
    os.environ["ORION_LOGIN_ALLOWLIST"] = ALLOWED
    os.environ["ORION_AUTH_DEV"] = "1"
    get_settings.cache_clear()
    try:
        yield
    finally:
        for key, value in previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        get_settings.cache_clear()
        with engine.begin() as conn:
            for table in ACCOUNT_TABLES:
                conn.execute(text(f"DELETE FROM {table}"))


@pytest.fixture
def https_client():
    """Un client en https : le cookie de session est Secure (__Host-),
    httpx ne le rejouerait pas sur du http."""
    from orion.main import app

    return TestClient(app, base_url="https://testserver")


def request_link(client: TestClient, email: str) -> str | None:
    res = client.post("/api/auth/login", json={"email": email})
    assert res.status_code == 200
    return res.json().get("dev_link")


def extract_token(link: str) -> str:
    assert "/login/verify#token=" in link
    return link.split("#token=", 1)[1]


def sign_in(client: TestClient, email: str = ALLOWED) -> str:
    link = request_link(client, email)
    assert link, "l'email approuvé doit produire un lien en mode dev"
    token = extract_token(link)
    res = client.post("/api/auth/verify", json={"token": token})
    assert res.status_code == 200
    return token


def test_porte_fermee_par_defaut(https_client):
    """Liste vide = porte fermée pour TOUS (défaut sûr)."""
    from orion.core.config import get_settings

    os.environ["ORION_LOGIN_ALLOWLIST"] = ""
    get_settings.cache_clear()
    assert request_link(https_client, ALLOWED) is None
    with engine.connect() as conn:
        count = conn.execute(text("SELECT count(*) FROM login_tokens")).scalar()
    assert count == 0


def test_reponse_indiscernable_hors_liste(https_client):
    """Un email hors liste : même statut, même corps, même Set-Cookie —
    et aucun token créé (hors mode dev, où le lien trahirait)."""
    from orion.core.config import get_settings

    os.environ["ORION_AUTH_DEV"] = "0"
    get_settings.cache_clear()
    res_allowed = https_client.post("/api/auth/login", json={"email": ALLOWED})
    res_stranger = https_client.post("/api/auth/login", json={"email": STRANGER})
    assert res_allowed.status_code == res_stranger.status_code == 200
    assert res_allowed.json() == res_stranger.json() == {"status": "ok"}
    assert ("set-cookie" in res_allowed.headers) and ("set-cookie" in res_stranger.headers)
    with engine.connect() as conn:
        emails = [r[0] for r in conn.execute(text("SELECT email FROM login_tokens")).fetchall()]
    assert emails == [ALLOWED]


def test_porte_insensible_a_la_casse_et_sans_doublon(https_client):
    """La porte compare en lower() des DEUX côtés : une adresse inscrite
    avec des majuscules s'ouvre quelle que soit la casse saisie — et deux
    connexions en casses différentes ne font qu'UN compte (verrou 3 :
    l'unicité est une contrainte de base, pas une politesse de code)."""
    from orion.core.config import get_settings
    from orion.main import app

    os.environ["ORION_LOGIN_ALLOWLIST"] = "Mixte.Casse@Example.com"
    get_settings.cache_clear()

    sign_in(https_client, "MIXTE.CASSE@example.com")
    assert https_client.get("/api/me").json()["email"] == "mixte.casse@example.com"

    autre_navigateur = TestClient(app, base_url="https://testserver")
    sign_in(autre_navigateur, "mixte.casse@EXAMPLE.COM")

    with engine.connect() as conn:
        emails = [r[0] for r in conn.execute(text("SELECT email FROM users")).fetchall()]
        workspaces = conn.execute(text("SELECT count(*) FROM workspaces")).scalar()
    assert emails == ["mixte.casse@example.com"]
    assert workspaces == 1


def test_porte_a_plusieurs_adresses_ouvre_a_chacune_et_refuse_l_inconnue(https_client):
    """La liste réelle est une ligne de `.env` éditée à la main : plusieurs
    adresses séparées par des virgules, avec les espaces qu'une main laisse.
    CHACUNE des inscrites ouvre la porte — et une adresse arbitraire hors
    liste reste refusée, sans lien ni token. Le registre des adresses
    approuvées vit en conception-workspace, jamais dans le code."""
    from orion.core.config import get_settings
    from orion.main import app

    inscrites = ["une@example.com", "deux@example.com", "trois@example.com"]
    os.environ["ORION_LOGIN_ALLOWLIST"] = " , ".join(inscrites) + " "
    get_settings.cache_clear()
    assert get_settings().allowed_emails == frozenset(inscrites)

    for email in inscrites:
        navigateur = TestClient(app, base_url="https://testserver")
        sign_in(navigateur, email)
        assert navigateur.get("/api/me").json()["email"] == email

    assert request_link(https_client, STRANGER) is None
    with engine.connect() as conn:
        emis = [r[0] for r in conn.execute(text("SELECT email FROM login_tokens")).fetchall()]
    assert sorted(emis) == sorted(inscrites)


def test_premier_login_cree_compte_et_workspace_personnel(https_client):
    sign_in(https_client)
    res = https_client.get("/api/me")
    assert res.status_code == 200
    body = res.json()
    assert body["email"] == ALLOWED
    assert len(body["workspaces"]) == 1
    assert body["workspaces"][0]["role"] == "owner"
    assert body["workspaces"][0]["name"] == ALLOWED


def test_preview_masque_et_reconnait_le_navigateur(https_client):
    link = request_link(https_client, ALLOWED)
    token = extract_token(link)
    res = https_client.post("/api/auth/verify/preview", json={"token": token})
    assert res.status_code == 200
    assert res.json()["email_masked"] == "c••••@example.com"
    # Même navigateur : le nonce posé à la demande correspond.
    assert res.json()["same_browser"] is True
    # Un autre « navigateur » (sans cookie) : jamais bloqué, juste signalé.
    from orion.main import app

    other = TestClient(app, base_url="https://testserver")
    res2 = other.post("/api/auth/verify/preview", json={"token": token})
    assert res2.status_code == 200
    assert res2.json()["same_browser"] is False


def test_usage_unique_sous_course(https_client):
    token = sign_in(https_client)
    # Le même lien re-cliqué ne rouvre JAMAIS de session.
    res = https_client.post("/api/auth/verify", json={"token": token})
    assert res.status_code == 400
    # Et sa preview est morte aussi.
    res = https_client.post("/api/auth/verify/preview", json={"token": token})
    assert res.status_code == 400


def test_expiration_15_minutes(https_client):
    link = request_link(https_client, ALLOWED)
    token = extract_token(link)
    with engine.begin() as conn:
        conn.execute(text("UPDATE login_tokens SET expires_at = now() - interval '1 minute'"))
    res = https_client.post("/api/auth/verify", json={"token": token})
    assert res.status_code == 400


def test_rate_limit_paire_ip_email(https_client):
    """La 6ᵉ demande dans l'heure (paire IP×email) ne produit rien — et
    répond exactement pareil."""
    produced = [request_link(https_client, ALLOWED) is not None for _ in range(8)]
    # En mode dev le cooldown ne joue pas (aucun email à protéger) :
    # c'est la limite par paire IP×email (5/h) qui retient — la 6ᵉ
    # demande et les suivantes ne produisent rien et répondent pareil.
    assert produced[:5] == [True] * 5
    assert produced[5:] == [False] * 3
    with engine.connect() as conn:
        tokens = conn.execute(text("SELECT count(*) FROM login_tokens")).scalar()
        requests = conn.execute(text("SELECT count(*) FROM login_requests")).scalar()
    assert requests == 8  # tout s'inscrit au journal
    assert tokens == 5  # la paire IP×email a retenu le reste


def test_rotation_des_sessions(https_client):
    sign_in(https_client)
    first_cookie = https_client.cookies.get("__Host-orion_session")
    # Une seconde connexion (cooldown contourné en vidant le journal).
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM login_tokens"))
        conn.execute(text("DELETE FROM login_requests"))
    sign_in(https_client)
    second_cookie = https_client.cookies.get("__Host-orion_session")
    assert first_cookie != second_cookie


def test_revocation_au_logout(https_client):
    sign_in(https_client)
    cookie = https_client.cookies.get("__Host-orion_session")
    assert https_client.get("/api/me").status_code == 200
    https_client.post("/api/auth/logout")
    # Le cookie REJOUÉ à la main est mort (révocation en base, D3) — en
    # en-tête direct : le jar httpx n'émet pas un cookie injecté à la main.
    res = https_client.get("/api/me", headers={"Cookie": f"__Host-orion_session={cookie}"})
    assert res.status_code == 401


def test_plafond_absolu_90_jours(https_client):
    sign_in(https_client)
    with engine.begin() as conn:
        conn.execute(text("UPDATE sessions SET expires_at = now() - interval '1 day'"))
    assert https_client.get("/api/me").status_code == 401


def test_glissement_30_jours(https_client):
    sign_in(https_client)
    with engine.begin() as conn:
        conn.execute(text("UPDATE sessions SET last_used_at = now() - interval '31 days'"))
    assert https_client.get("/api/me").status_code == 401


def test_origine_etrangere_refusee(https_client):
    res = https_client.post(
        "/api/auth/login",
        json={"email": ALLOWED},
        headers={"Origin": "https://evil.example"},
    )
    assert res.status_code == 403


ITEMS = [
    {
        "id": "a",
        "params": "metric=funding&by=year",
        "title": "Vue 1",
        "note": "",
        "addedAt": "2026-08-21",
    },
    {
        "id": "b",
        "params": "metric=projects&by=country",
        "title": "Vue 2",
        "note": "n",
        "addedAt": "2026-08-21",
    },
    {"id": "c", "params": "q=space", "title": "Vue 3", "note": "", "addedAt": "2026-08-21"},
]


def test_dossier_garde_et_retrouve(https_client):
    sign_in(https_client)
    wid = https_client.get("/api/me").json()["workspaces"][0]["id"]
    res = https_client.post(
        f"/api/workspaces/{wid}/dossiers", json={"title": "Veille espace", "items": ITEMS}
    )
    assert res.status_code == 201
    did = res.json()["id"]
    listing = https_client.get(f"/api/workspaces/{wid}/dossiers").json()["dossiers"]
    assert [d["items_count"] for d in listing] == [3]
    full = https_client.get(f"/api/workspaces/{wid}/dossiers/{did}").json()
    # Le format localStorage EST le schéma : les items reviennent tels quels.
    assert full["items"] == ITEMS
    assert https_client.delete(f"/api/workspaces/{wid}/dossiers/{did}").status_code == 204
    assert https_client.get(f"/api/workspaces/{wid}/dossiers").json()["dossiers"] == []


def test_dossier_refuse_anonyme_et_etranger(https_client):
    sign_in(https_client)
    wid = https_client.get("/api/me").json()["workspaces"][0]["id"]
    https_client.post(f"/api/workspaces/{wid}/dossiers", json={"title": "Privé", "items": ITEMS})
    # Anonyme : 401.
    from orion.main import app

    anonymous = TestClient(app, base_url="https://testserver")
    assert anonymous.get(f"/api/workspaces/{wid}/dossiers").status_code == 401
    # Étranger au workspace : 403 sobre.
    from orion.core.config import get_settings

    os.environ["ORION_LOGIN_ALLOWLIST"] = f"{ALLOWED},{STRANGER}"
    get_settings.cache_clear()
    stranger = TestClient(app, base_url="https://testserver")
    sign_in(stranger, STRANGER)
    assert stranger.get(f"/api/workspaces/{wid}/dossiers").status_code == 403


def test_suppression_de_compte_ne_laisse_rien(https_client):
    sign_in(https_client)
    wid = https_client.get("/api/me").json()["workspaces"][0]["id"]
    https_client.post(f"/api/workspaces/{wid}/dossiers", json={"title": "Éphémère", "items": ITEMS})
    res = https_client.delete("/api/me")
    assert res.status_code == 200
    assert https_client.get("/api/me").status_code == 401
    with engine.connect() as conn:
        for table in ("users", "sessions", "memberships", "workspaces", "dossiers"):
            count = conn.execute(text(f"SELECT count(*) FROM {table}")).scalar()
            assert count == 0, f"{table} devrait être vide"

"""E1 — les appels : parsing sur pièces réelles, statut dérivé aux
bornes, idempotence de l'upsert, API et sa doctrine (fait source ≠
lecture Orion), sanitizer."""

import json
from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import text

from orion.api.calls import derived_status, next_deadline
from orion.ingest.ftcalls.parse import framework_labels, parse_topic
from orion.ingest.ftcalls.sanitize import sanitize_html
from orion.ingest.upsert import upsert
from orion.models import CallTopic

FIXTURES = Path(__file__).parent / "fixtures" / "ftcalls"


@pytest.fixture(scope="module")
def search_page() -> dict:
    return json.loads((FIXTURES / "search-page.json").read_text())


@pytest.fixture(scope="module")
def facets_payload() -> dict:
    return json.loads((FIXTURES / "facets.json").read_text())


# ---------------------------------------------------------------- parsing


def test_parse_topic_reads_real_record(search_page):
    row = parse_topic(search_page["results"][0])
    assert row is not None
    assert row["source"] == "ft-portal"
    assert row["identifier"] == row["source_id"]
    assert row["identifier"].startswith("HORIZON-")
    assert row["status_code"] == "31094502"
    assert row["status_label"] == "Open for submission"
    assert row["deadline_dates"], "un topic ouvert porte sa deadline"
    # Les instants sont normalisés ISO avec fuseau — parseables en retour.
    parsed = datetime.fromisoformat(row["deadline_dates"][0])
    assert parsed.tzinfo is not None
    assert row["url"].startswith("https://ec.europa.eu/")
    assert row["raw"]["metadata"], "le payload complet reste en raw"


def test_parse_topic_budget_is_scoped_to_the_topic(search_page):
    """budgetTopicActionMap liste les actions de TOUT l'appel : seules
    celles du topic comptent — et rien ne devient zéro."""
    row = parse_topic(search_page["results"][0])
    overview = row["budget_overview"]
    if row["budget_min_eur"] is None:
        # La source ne donne pas d'action pour ce topic : NULL, pas 0.
        assert row["budget_max_eur"] is None
    else:
        assert row["budget_min_eur"] <= row["budget_max_eur"]
        assert overview is not None


def test_parse_topic_without_identifier_is_refused():
    assert parse_topic({"metadata": {"title": ["sans identifiant"]}}) is None


def test_framework_labels_from_real_facets(facets_payload):
    labels = framework_labels(facets_payload)
    assert labels.get("43108390") == "Horizon Europe (HORIZON)"
    # La FACET encode ses libellés en URL (« Coal %26 Steel ») : décodés.
    assert labels.get("43252449") == "Research Fund for Coal & Steel (RFCS)"


# ---------------------------------------------------- statut dérivé (bornes)

NOW = datetime(2026, 8, 22, 12, 0, tzinfo=UTC)


def _dt(value: str) -> datetime:
    return datetime.fromisoformat(value)


def test_closed_deadline_never_shows_open():
    """La règle du chantier : un statut source « Open » avec une deadline
    passée s'affiche clos — les dates priment sur le code."""
    deadlines = [_dt("2026-08-22T11:59:00+00:00")]
    assert derived_status(None, deadlines, "31094502", NOW) == "closed"


def test_open_until_the_very_deadline():
    deadlines = [_dt("2026-08-22T12:01:00+00:00")]
    assert derived_status(None, deadlines, "31094502", NOW) == "open"


def test_multiple_cutoffs_stay_open_between_cutoffs():
    """Un « multiple cut-off » dont une échéance est passée mais pas la
    suivante reste ouvert, et la PROCHAINE échéance est la future."""
    deadlines = [_dt("2026-05-01T00:00:00+00:00"), _dt("2026-11-01T00:00:00+00:00")]
    assert derived_status(None, deadlines, "31094502", NOW) == "open"
    assert next_deadline(deadlines, NOW) == _dt("2026-11-01T00:00:00+00:00")


def test_future_opening_is_upcoming_even_with_future_deadline():
    opening = _dt("2026-10-01T00:00:00+00:00")
    deadlines = [_dt("2027-01-15T00:00:00+00:00")]
    assert derived_status(opening, deadlines, "31094501", NOW) == "upcoming"


def test_no_dates_falls_back_to_source_status():
    assert derived_status(None, [], "31094501", NOW) == "upcoming"
    assert derived_status(None, [], "31094502", NOW) == "open"
    assert derived_status(None, [], "31094503", NOW) == "closed"
    assert derived_status(None, [], None, NOW) == "closed"


# ------------------------------------------------------------- sanitizer


def test_sanitize_keeps_structure_drops_scripts():
    dirty = (
        '<p>Un <strong>texte</strong> <script>alert("x")</script>'
        '<a href="https://ec.europa.eu/x" onclick="evil()">lien</a>'
        '<a href="javascript:evil()">piège</a><img src="x.png"></p>'
    )
    clean = sanitize_html(dirty)
    assert "<script" not in clean and "alert" not in clean
    assert "onclick" not in clean and "javascript:" not in clean
    assert "<img" not in clean
    assert (
        '<a href="https://ec.europa.eu/x" rel="noopener noreferrer" target="_blank">lien</a>'
        in clean
    )
    assert "piège" in clean, "le texte d'un lien refusé survit à la balise"
    assert "<strong>texte</strong>" in clean


def test_sanitize_escapes_text_and_handles_empty():
    assert sanitize_html("a < b & c") == "a &lt; b &amp; c"
    assert sanitize_html("") is None
    assert sanitize_html(None) is None
    assert sanitize_html("<script>x()</script>") is None


# ------------------------------------------------- upsert + API (base réelle)


@pytest.fixture
def seeded_topics(client, search_page):
    """Deux topics réels + un topic synthétique clos, semés par l'upsert
    du chargeur — puis nettoyés."""
    from orion.core.db import SessionLocal

    session = SessionLocal()
    try:
        rows = [parse_topic(result) for result in search_page["results"]]
        rows = [r for r in rows if r is not None]
        # Le topic synthétique passe par parse_topic, comme au chargeur :
        # mêmes clés (l'upsert par lots exige des lignes homogènes).
        synthetic = parse_topic(
            {
                "reference": "TEST-REF",
                "url": "https://example.invalid/topic",
                "metadata": {
                    "identifier": ["TEST-CLOSED-2026-01"],
                    "title": ["Un appel clos de test"],
                    "callIdentifier": ["TEST-CLOSED-2026"],
                    "status": ["31094502"],  # la source dit encore « Open »…
                    "deadlineDate": ["2026-01-15T17:00:00.000+0000"],  # …la date dit clos
                },
            }
        )
        assert synthetic is not None
        rows.append(synthetic)
        for _ in range(2):  # deux passes : l'idempotence se prouve en base
            upsert(
                session,
                CallTopic,
                rows,
                conflict_cols=["source", "source_id"],
                update_cols=["title", "status_code", "deadline_dates", "raw"],
                touch_last_seen=True,
            )
        session.commit()
        yield rows
    finally:
        session.execute(text("DELETE FROM call_topics WHERE source = 'ft-portal'"))
        session.commit()
        session.close()


def test_upsert_is_idempotent(seeded_topics, client):
    from orion.core.db import SessionLocal

    session = SessionLocal()
    try:
        count = session.execute(
            text("SELECT count(*) FROM call_topics WHERE source = 'ft-portal'")
        ).scalar_one()
        assert count == len(seeded_topics), "deux passes, zéro doublon"
    finally:
        session.close()


def test_calls_api_lists_and_derives_status(seeded_topics, client):
    payload = client.get("/api/calls").json()
    assert payload["total"] == len(seeded_topics)
    assert payload["meta"]["attribution"].startswith("Contains data from the EU Funding")
    by_id = {row["identifier"]: row for row in payload["results"]}
    # Le topic « Open » à la deadline passée s'affiche CLOS, et son
    # statut source reste visible à côté — jamais mêlés.
    closed = by_id["TEST-CLOSED-2026-01"]
    assert closed["status"] == "closed"
    assert closed["source_status"]["code"] == "31094502"

    open_only = client.get("/api/calls", params={"status": "closed"}).json()
    assert [r["identifier"] for r in open_only["results"]] == ["TEST-CLOSED-2026-01"]


def test_calls_api_search_and_filters(seeded_topics, client):
    hit = client.get("/api/calls", params={"q": "un appel clos"}).json()
    assert hit["total"] == 1

    miss = client.get("/api/calls", params={"q": "zzz-aucune-correspondance"}).json()
    assert miss["total"] == 0

    bad = client.get("/api/calls", params={"status": "ouvert"})
    assert bad.status_code == 400

    refused = client.get("/api/calls", params={"sector": "inconnue"})
    assert refused.status_code == 400
    assert refused.json()["detail"]["error"] == "INVALID_LENS"


def test_calls_api_detail_serves_fact_and_reading_apart(seeded_topics, client):
    listing = client.get("/api/calls", params={"q": "TEST-CLOSED"}).json()
    topic_id = listing["results"][0]["id"]
    detail = client.get(f"/api/calls/{topic_id}").json()
    assert detail["identifier"] == "TEST-CLOSED-2026-01"
    assert detail["lens_tags"] == []
    assert detail["meta"]["attribution"]

    assert client.get("/api/calls/999999999").status_code == 404


def test_calls_api_is_private(seeded_topics, client):
    from fastapi.testclient import TestClient

    from orion.main import app

    anonymous = TestClient(app, base_url="https://testserver")
    assert anonymous.get("/api/calls").status_code == 401

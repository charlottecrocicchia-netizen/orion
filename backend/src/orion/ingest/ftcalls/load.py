"""La moisson des appels — le premier chargeur du régime « fraîcheur légère ».

Deux passes par run (conception E1) :

1. les topics OUVERTS et À VENIR (subventions : types 1 et 2, langue EN) ;
2. les topics CLOS des six derniers mois (fenêtre `range` sur la
   deadline) — c'est ce qui alimente « récemment clos » et enregistre
   la bascule d'un appel qu'Orion suivait ouvert.

Idempotent (upsert sur (source, source_id)), jamais de suppression : un
topic disparu du flux garde sa dernière photographie et le compteur
`missing_from_feed` le dit. Les pages brutes de la moisson sont posées
dans le cache (`data/cache/ft-calls/`) pour l'audit, et le payload
complet de chaque topic vit dans `raw`.

Après la moisson : pont vers `calls` (les codes d'appel que CORDIS
connaît déjà — la charnière d'E2), puis la LECTURE Orion — les règles
`call` (préfixes) des lentilles publiées, appliquées à l'identifiant et
au code d'appel, insensibles à la casse (le portail écrit
HORIZON-JU-CLEAN-AVIATION, CORDIS HORIZON-JU-Clean-Aviation : même
identifiant, casse différente). Core gagne sur enabling, comme au moteur.
"""

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import text

from orion.core.config import get_settings
from orion.core.db import SessionLocal
from orion.ingest.ftcalls import client as ft
from orion.ingest.ftcalls.parse import framework_labels, parse_topic
from orion.ingest.lenses import LENSES_DIR, REGISTRY_FILE, parse_registry, parse_rules
from orion.ingest.runlog import RunStats, record_run
from orion.ingest.upsert import upsert
from orion.models import CallTopic

SOURCE = "calls"
GRANT_TYPES = ["1", "2"]
STATUS_FORTHCOMING = "31094501"
STATUS_OPEN = "31094502"
STATUS_CLOSED = "31094503"
CLOSED_WINDOW_DAYS = 180

# Colonnes de contenu rejouées à chaque moisson (tout sauf les clés et
# first_imported_at) — la source fait foi, y compris pour effacer.
UPDATE_COLS = [
    "reference",
    "title",
    "call_code",
    "framework_programme_code",
    "framework_programme_label",
    "status_code",
    "status_label",
    "opening_date",
    "deadline_dates",
    "deadline_model",
    "types_of_action",
    "keywords",
    "tags",
    "cross_cutting",
    "budget_min_eur",
    "budget_max_eur",
    "expected_grants",
    "budget_overview",
    "description_html",
    "conditions_html",
    "url",
    "raw",
]


def _live_query() -> dict[str, Any]:
    return {
        "bool": {
            "must": [
                {"terms": {"type": GRANT_TYPES}},
                {"terms": {"status": [STATUS_FORTHCOMING, STATUS_OPEN]}},
            ]
        }
    }


def _recently_closed_query(now: datetime) -> dict[str, Any]:
    since = (now - timedelta(days=CLOSED_WINDOW_DAYS)).strftime("%Y-%m-%dT00:00:00.000Z")
    until = (now + timedelta(days=1)).strftime("%Y-%m-%dT00:00:00.000Z")
    return {
        "bool": {
            "must": [
                {"terms": {"type": GRANT_TYPES}},
                {"terms": {"status": [STATUS_CLOSED]}},
                {"range": {"deadlineDate": {"gte": since, "lte": until}}},
            ]
        }
    }


def _snapshot(pages: list[dict[str, Any]], name: str) -> None:
    cache_dir = Path(get_settings().data_dir) / "cache" / "ft-calls"
    cache_dir.mkdir(parents=True, exist_ok=True)
    for number, page in enumerate(pages, start=1):
        path = cache_dir / f"{name}-p{number:03d}.json"
        partial = path.with_suffix(".part")
        partial.write_text(json.dumps(page, ensure_ascii=False), encoding="utf-8")
        partial.replace(path)


def _bridge_calls(session: Any, stats: RunStats) -> None:
    """Les codes d'appel du flux rejoignent la table `calls` (funder ec)
    puis chaque topic reçoit son `call_id`. DO NOTHING sur conflit : un
    titre posé par CORDIS n'est jamais écrasé par le portail."""
    session.execute(
        text("""
        INSERT INTO calls (funder_id, code)
        SELECT f.id, ct.call_code
        FROM (SELECT DISTINCT call_code FROM call_topics
              WHERE source = 'ft-portal' AND call_code IS NOT NULL) ct
        CROSS JOIN funders f
        WHERE f.code = 'ec'
        ON CONFLICT (funder_id, code) DO NOTHING
        """)
    )
    linked = session.execute(
        text("""
        UPDATE call_topics ct
        SET call_id = c.id
        FROM calls c JOIN funders f ON f.id = c.funder_id AND f.code = 'ec'
        WHERE ct.source = 'ft-portal' AND ct.call_code = c.code
          AND ct.call_id IS DISTINCT FROM c.id
        """)
    )
    stats.add("calls_linked", linked.rowcount or 0)


def _retag_lenses(session: Any, stats: RunStats) -> None:
    """La lecture Orion, rejouée entière à chaque run (comme le moteur
    des lentilles : les fichiers sont la seule vérité)."""
    published = [
        entry
        for entry in parse_registry(REGISTRY_FILE)
        if entry["status"] == "published"
    ]
    topics = session.execute(
        text(
            "SELECT id, identifier, call_code FROM call_topics WHERE source = 'ft-portal'"
        )
    ).all()

    rows: dict[tuple[int, str], dict[str, Any]] = {}
    for entry in published:
        call_rules = [
            rule
            for rule in parse_rules(LENSES_DIR / f"{entry['slug']}.csv")
            if rule["rule_type"] == "call"
        ]
        # enabling d'abord, core ensuite : core gagne, comme au moteur.
        for rule in sorted(call_rules, key=lambda r: r["tag"] == "core"):
            prefix = rule["value"].upper()
            for topic_id, identifier, call_code in topics:
                haystacks = (identifier or "", call_code or "")
                if any(h.upper().startswith(prefix) for h in haystacks):
                    rows[(topic_id, entry["slug"])] = {
                        "call_topic_id": topic_id,
                        "lens": entry["slug"],
                        "tag": rule["tag"],
                        "proof": "structural",
                        "rule": f"call:{rule['value']}",
                    }

    session.execute(text("DELETE FROM call_topic_lens_tags WHERE proof = 'structural'"))
    if rows:
        session.execute(
            text("""
            INSERT INTO call_topic_lens_tags (call_topic_id, lens, tag, proof, rule)
            VALUES (:call_topic_id, :lens, :tag, :proof, :rule)
            """),
            list(rows.values()),
        )
    stats.add("lens_tags", len(rows))


def run(force: bool = False) -> dict[str, int]:  # noqa: ARG001 — flux vivant, toujours moissonné
    now = datetime.now(UTC)
    with record_run(SOURCE) as stats:
        with ft.make_client() as http:
            live_results, live_pages = ft.fetch_all(http, _live_query())
            closed_results, closed_pages = ft.fetch_all(http, _recently_closed_query(now))
            # Les libellés des DEUX passes : un programme peut n'exister
            # que côté clos (fenêtre de 6 mois).
            labels = framework_labels(ft.fetch_facets(http, _live_query()))
            labels.update(framework_labels(ft.fetch_facets(http, _recently_closed_query(now))))
        _snapshot(live_pages, "live")
        _snapshot(closed_pages, "closed")
        stats.add("pages", len(live_pages) + len(closed_pages))

        rows: dict[str, dict[str, Any]] = {}
        for result in live_results + closed_results:
            row = parse_topic(result)
            if row is None:
                stats.add("invalid_no_identifier")
                continue
            code = row["framework_programme_code"]
            row["framework_programme_label"] = labels.get(code or "")
            # Un topic revenu par les deux passes (clôture le jour de la
            # moisson) : la dernière lecture gagne, jamais un doublon.
            rows[row["source_id"]] = row

        session = SessionLocal()
        try:
            upsert(
                session,
                CallTopic,
                list(rows.values()),
                conflict_cols=["source", "source_id"],
                update_cols=UPDATE_COLS,
                touch_last_seen=True,
            )
            stats.add("topics", len(rows))
            missing = session.execute(
                text("""
                SELECT count(*) FROM call_topics
                WHERE source = 'ft-portal' AND last_seen_at < now() - interval '2 days'
                """)
            ).scalar_one()
            stats.add("missing_from_feed", int(missing))

            _bridge_calls(session, stats)
            _retag_lenses(session, stats)
            session.commit()
        finally:
            session.close()
    return stats.counts

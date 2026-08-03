"""Wikidata parent links for LEI-bearing organisations (socle identité).

Licence CC0. One SPARQL query fetches every (child LEI → parent LEI)
pair where BOTH entities carry P1278 — tens of thousands of rows, the
notable groups our clients search first. The pairs land in
lei_relationships under their own relationship type so provenance stays
readable; the groups builder uses them as FALLBACK when GLEIF Level 2
says nothing (the ~4 % lucidity of the charter). Declarative data: a
signal with a score, never a truth."""

import httpx
from sqlalchemy import text

from orion.core.db import SessionLocal
from orion.ingest.download import cache_dir
from orion.ingest.runlog import record_run
from orion.ingest.upsert import upsert
from orion.models import LeiRelationship

SOURCE = "wikidata"
ENDPOINT = "https://query.wikidata.org/sparql"
RELATIONSHIP_TYPE = "WIKIDATA_PARENT"
USER_AGENT = "OrionBot/0.1 (owner@example.com) groups-layer"

QUERY = """
SELECT ?childLei ?parentLei WHERE {
  ?child wdt:P1278 ?childLei ; wdt:P749 ?parent .
  ?parent wdt:P1278 ?parentLei .
}
"""


def fetch_pairs() -> list[dict[str, str]]:
    response = httpx.get(
        ENDPOINT,
        params={"query": QUERY, "format": "json"},
        headers={"User-Agent": USER_AGENT},
        timeout=120,
    )
    response.raise_for_status()
    payload = response.json()
    # Cache the raw answer beside the other source files — auditable,
    # and a network-free replay for debugging.
    (cache_dir() / f"{SOURCE}-parents.json").write_text(response.text)
    out: list[dict[str, str]] = []
    for binding in payload["results"]["bindings"]:
        child = binding["childLei"]["value"].strip()
        parent = binding["parentLei"]["value"].strip()
        if child and parent and child != parent:
            out.append({"child_lei": child, "parent_lei": parent})
    return out


def run(force: bool = False) -> dict[str, int]:  # noqa: ARG001 — cadence handled upstream
    with record_run(SOURCE) as stats:
        pairs = fetch_pairs()
        session = SessionLocal()
        try:
            session.execute(
                text("DELETE FROM lei_relationships WHERE relationship_type = :t"),
                {"t": RELATIONSHIP_TYPE},
            )
            rows = [
                {
                    "child_lei": pair["child_lei"],
                    "parent_lei": pair["parent_lei"],
                    "relationship_type": RELATIONSHIP_TYPE,
                    "corroboration": None,
                }
                for pair in pairs
            ]
            # A child can declare several parents in Wikidata (JV
            # candidates): every pair is kept, the builder arbitrates.
            upsert(
                session,
                LeiRelationship,
                rows,
                conflict_cols=["child_lei", "parent_lei", "relationship_type"],
            )
            stats.add("pairs", len(rows))
            session.commit()
        finally:
            session.close()
    return stats.counts

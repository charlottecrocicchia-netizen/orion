"""Build the groups layer from the identity mirrors (socle identité).

Three passes, each idempotent and journaled:

1. BRIDGES — organisations gain a `lei` identifier when exactly ONE
   ACTIVE LEI record shares their (country, normalized name) and the
   name is unambiguous on OUR side too. Conservative by design: a bridge
   that hesitates is not a bridge. (The SIREN path waits on a French
   source that publishes SIRENs — the ANR does not; GLEIF's ra_id
   already holds the LEI→SIREN side.)
2. EXCEPTIONS — the reporting-exceptions slice for bridged LEIs, read
   from the cached golden-copy file (WHY an entity declares no parent).
3. GROUPS — for every bridged organisation, resolve the group head:
   GLEIF ultimate consolidation first, then direct links walked up
   (≤ 5 hops), then the Wikidata parent as fallback. Heads become
   `groups` rows; memberships carry method + confidence. Rebuilds wipe
   ONLY gleif/wikidata memberships — curation survives every run."""

from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from orion.core.db import SessionLocal
from orion.ingest.gleif.load import repex_cache_path
from orion.ingest.runlog import RunStats, record_run
from orion.ingest.upsert import upsert
from orion.models import EntityGroupMap, LeiException

SOURCE = "groups"
BUILT_METHODS = ("gleif", "wikidata")
MAX_HOPS = 5

CONFIDENCE = {
    "gleif_corroborated": 0.90,
    "gleif": 0.75,
    "wikidata": 0.60,
}


def bridge_organisations(session: Session, stats: RunStats) -> None:
    """Pass 1 — the conservative name+country bridge, in one SQL move:
    unique on the LEI side (one ACTIVE record for the key) AND unique on
    ours (one organisation for the key), skipping already-bridged
    organisations."""
    # Bridges are DERIVED data — rebuilt whole each run so a bridge
    # posed on a partial mirror never outlives the ambiguity a fuller
    # mirror reveals (real-run lesson, 2026-08-03).
    session.execute(text("DELETE FROM organisation_identifiers WHERE scheme = 'lei'"))
    inserted = session.execute(
        text("""
        WITH unique_lei AS (
            SELECT country_code, name_normalized, max(lei) AS lei
            FROM lei_records
            WHERE status = 'ACTIVE' AND name_normalized IS NOT NULL AND country_code IS NOT NULL
            GROUP BY country_code, name_normalized
            HAVING count(*) = 1
        ),
        unique_org AS (
            SELECT country_code, name_normalized, max(id) AS organisation_id
            FROM organisations
            WHERE name_normalized IS NOT NULL AND country_code IS NOT NULL
            GROUP BY country_code, name_normalized
            HAVING count(*) = 1
        )
        INSERT INTO organisation_identifiers (organisation_id, scheme, value)
        SELECT uo.organisation_id, 'lei', ul.lei
        FROM unique_org uo
        JOIN unique_lei ul USING (country_code, name_normalized)
        WHERE NOT EXISTS (
            SELECT 1 FROM organisation_identifiers oi
            WHERE oi.organisation_id = uo.organisation_id AND oi.scheme = 'lei'
        )
        ON CONFLICT (scheme, value) DO NOTHING
        """)
    )
    stats.add("bridged_lei", inserted.rowcount or 0)
    session.commit()


def load_bridged_exceptions(session: Session, stats: RunStats) -> None:
    """Pass 2 — reporting exceptions for the bridged LEIs only."""
    from orion.ingest.gleif import parse

    path = repex_cache_path()
    if not path.exists():
        stats.add("exceptions_file_missing")
        return
    bridged = frozenset(
        row[0]
        for row in session.execute(
            text("SELECT value FROM organisation_identifiers WHERE scheme = 'lei'")
        )
    )
    session.execute(text("TRUNCATE lei_exceptions"))
    rows = list(parse.parse_exceptions(path, keep=bridged))
    # One row per (lei, type): the file may repeat categories.
    unique: dict[tuple[str, str], dict[str, Any]] = {
        (row["lei"], row["exception_type"]): row for row in rows
    }
    upsert(
        session,
        LeiException,
        list(unique.values()),
        conflict_cols=["lei", "exception_type"],
    )
    stats.add("exceptions", len(unique))
    session.commit()


def _resolve_heads(session: Session) -> dict[str, tuple[str, str]]:
    """child LEI → (head LEI, method) for every bridged LEI.

    GLEIF ultimate wins; else direct links walked up; else Wikidata.
    Corroborated GLEIF keeps its stronger confidence through the method
    name 'gleif_corroborated'."""
    ultimate: dict[str, tuple[str, str]] = {}
    direct: dict[str, tuple[str, str]] = {}
    wikidata: dict[str, str] = {}
    for child, parent, rel_type, corroboration in session.execute(
        text(
            "SELECT child_lei, parent_lei, relationship_type, corroboration FROM lei_relationships"
        )
    ):
        method = "gleif_corroborated" if corroboration == "FULLY_CORROBORATED" else "gleif"
        if rel_type == "IS_ULTIMATELY_CONSOLIDATED_BY":
            ultimate[child] = (parent, method)
        elif rel_type == "IS_DIRECTLY_CONSOLIDATED_BY":
            direct[child] = (parent, method)
        elif rel_type == "WIKIDATA_PARENT" and (
            # First parent kept deterministically (sorted) — multiple
            # parents are JV candidates for the curation queue, not for
            # silent automation.
            child not in wikidata or parent < wikidata[child]
        ):
            wikidata[child] = parent

    heads: dict[str, tuple[str, str]] = {}
    bridged = [
        row[0]
        for row in session.execute(
            text("SELECT value FROM organisation_identifiers WHERE scheme = 'lei'")
        )
    ]
    for lei in bridged:
        if lei in ultimate:
            heads[lei] = ultimate[lei]
            continue
        current, method, hops = lei, None, 0
        while current in direct and hops < MAX_HOPS:
            current, method = direct[current][0], direct[current][1]
            hops += 1
        if current != lei and method is not None:
            heads[lei] = (current, method)
        elif lei in wikidata:
            heads[lei] = (wikidata[lei], "wikidata")
    return heads


def build_groups(session: Session, stats: RunStats) -> None:
    """Pass 3 — heads become groups, bridged organisations become
    members. Only automatic memberships are rebuilt; curation stays."""
    session.execute(
        text("DELETE FROM entity_group_map WHERE method = ANY(:methods)"),
        {"methods": list(BUILT_METHODS)},
    )
    session.execute(
        text("""
        DELETE FROM groups g WHERE g.source = ANY(:sources)
        AND NOT EXISTS (SELECT 1 FROM entity_group_map m WHERE m.group_id = g.id)
        """),
        {"sources": list(BUILT_METHODS)},
    )
    session.commit()

    heads = _resolve_heads(session)
    if not heads:
        stats.add("groups", 0)
        return

    lei_to_org = {
        value: org_id
        for org_id, value in session.execute(
            text("SELECT organisation_id, value FROM organisation_identifiers WHERE scheme = 'lei'")
        )
    }
    head_names = {
        lei: (name, country)
        for lei, name, country in session.execute(
            text("SELECT lei, name, country_code FROM lei_records WHERE lei = ANY(:leis)"),
            {"leis": list({head for head, _ in heads.values()})},
        )
    }

    group_ids: dict[str, int] = {}
    for head_lei in sorted({head for head, _ in heads.values()}):
        name, country = head_names.get(head_lei, (None, None))
        if name is None:
            # Head unknown to Level 1 (rare): name the group after a
            # member organisation, honestly marked.
            member_lei = next(lei for lei, (head, _) in heads.items() if head == head_lei)
            org_id = lei_to_org.get(member_lei)
            row = session.execute(
                text("SELECT name, country_code FROM organisations WHERE id = :id"), {"id": org_id}
            ).first()
            name, country = (row[0] if row else head_lei), (row[1] if row else None)
        result = session.execute(
            text("""
            INSERT INTO groups (name, country_code, lei, source)
            VALUES (:name, :country, :lei, 'gleif')
            ON CONFLICT (lei) DO UPDATE SET name = excluded.name
            RETURNING id
            """),
            {"name": name, "country": country, "lei": head_lei},
        )
        group_ids[head_lei] = result.scalar_one()
    stats.add("groups", len(group_ids))

    memberships = []
    for member_lei, (head_lei, method) in heads.items():
        org_id = lei_to_org.get(member_lei)
        if org_id is None:
            continue
        memberships.append(
            {
                "organisation_id": org_id,
                "group_id": group_ids[head_lei],
                "method": "gleif" if method.startswith("gleif") else "wikidata",
                "confidence": CONFIDENCE[method],
                "source": "gleif" if method.startswith("gleif") else "wikidata",
            }
        )
    # The head's own organisation (when bridged) belongs to its group —
    # consolidated views gather the parent's projects too.
    for head_lei, group_id in group_ids.items():
        org_id = lei_to_org.get(head_lei)
        if org_id is not None:
            memberships.append(
                {
                    "organisation_id": org_id,
                    "group_id": group_id,
                    "method": "gleif",
                    "confidence": CONFIDENCE["gleif_corroborated"],
                    "source": "gleif",
                }
            )
    unique = {(row["organisation_id"], row["group_id"], row["method"]): row for row in memberships}
    upsert(
        session,
        EntityGroupMap,
        list(unique.values()),
        conflict_cols=["organisation_id", "group_id", "method"],
    )
    stats.add("memberships", len(unique))
    session.commit()


def run(force: bool = False) -> dict[str, int]:  # noqa: ARG001 — rebuild is total
    with record_run(SOURCE) as stats:
        session = SessionLocal()
        try:
            bridge_organisations(session, stats)
            load_bridged_exceptions(session, stats)
            build_groups(session, stats)
        finally:
            session.close()
    return stats.counts

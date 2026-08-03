"""Organisation deduplication: exact merge on the normalized name, then a
deliberately cautious fuzzy pass. Precision before recall — wrongly merging
two distinct organisations is far worse than leaving a duplicate behind.
"""

from sqlalchemy import delete, func, select, text, update
from sqlalchemy.orm import Session

from orion.core.db import SessionLocal
from orion.ingest.dedup.normalize import normalize_name
from orion.ingest.runlog import RunStats, record_run
from orion.models import (
    Organisation,
    OrganisationAlias,
    OrganisationIdentifier,
    Participation,
)

# Similarity above which two names in the same country are considered the same
# organisation. High on purpose; lower it only with fresh evidence.
FUZZY_THRESHOLD = 0.92

# Below this length a trigram score is not trustworthy ("CEA" vs "CEB").
MIN_FUZZY_LENGTH = 12

# Identifier schemes that designate a distinct legal entity: two organisations
# holding different values of the same scheme must never be merged.
STRONG_SCHEMES = ("pic", "siren", "siret", "rnsr", "ror")

# CORDIS activity codes; more reliable than the ANR free-text categories.
CORDIS_ACTIVITY_TYPES = ["REC", "HES", "PRC", "PUB", "OTH"]


def refresh_normalized_names(session: Session, stats: RunStats) -> None:
    """(Re)compute the comparison key for every organisation."""
    rows = session.execute(select(Organisation.id, Organisation.name)).all()
    updates = [{"org_id": org_id, "key": normalize_name(name)} for org_id, name in rows]
    for start in range(0, len(updates), 5000):
        chunk = updates[start : start + 5000]
        session.execute(
            text(
                "UPDATE organisations SET name_normalized = v.key "
                "FROM (VALUES "
                + ",".join(f"(:id{i}, :key{i})" for i in range(len(chunk)))
                + ") AS v(id, key) WHERE organisations.id = v.id"
            ),
            {
                f"{field}{i}": row["org_id"] if field == "id" else row["key"]
                for i, row in enumerate(chunk)
                for field in ("id", "key")
            },
        )
    session.commit()
    stats.add("names_normalized", len(updates))


def _identifiers_by_org(session: Session, org_ids: list[int]) -> dict[int, dict[str, str]]:
    rows = session.execute(
        select(
            OrganisationIdentifier.organisation_id,
            OrganisationIdentifier.scheme,
            OrganisationIdentifier.value,
        ).where(OrganisationIdentifier.organisation_id.in_(org_ids))
    ).all()
    by_org: dict[int, dict[str, str]] = {}
    for org_id, scheme, value in rows:
        by_org.setdefault(org_id, {})[scheme] = value
    return by_org


def _split_by_identifier_conflict(
    group: list[int], identifiers: dict[int, dict[str, str]]
) -> list[list[int]]:
    """Split a candidate group so that no bucket holds conflicting strong ids."""
    buckets: list[list[int]] = []
    for org_id in group:
        own = identifiers.get(org_id, {})
        for bucket in buckets:
            if all(
                not (
                    (theirs := identifiers.get(other, {})).get(scheme)
                    and own.get(scheme)
                    and theirs[scheme] != own[scheme]
                )
                for other in bucket
                for scheme in STRONG_SCHEMES
            ):
                bucket.append(org_id)
                break
        else:
            buckets.append([org_id])
    return buckets


def merge_group(session: Session, keeper_id: int, victim_ids: list[int]) -> None:
    """Move everything attached to the victims onto the keeper, then drop them."""
    if not victim_ids:
        return
    opts = {"synchronize_session": False}

    session.execute(
        update(Participation)
        .where(Participation.organisation_id.in_(victim_ids))
        .values(organisation_id=keeper_id)
        .execution_options(**opts)
    )
    session.execute(
        update(OrganisationIdentifier)
        .where(OrganisationIdentifier.organisation_id.in_(victim_ids))
        .values(organisation_id=keeper_id)
        .execution_options(**opts)
    )
    session.execute(
        update(OrganisationAlias)
        .where(OrganisationAlias.organisation_id.in_(victim_ids))
        .values(organisation_id=keeper_id)
        .execution_options(**opts)
    )
    # Keep the richest available location on the survivor. For the type, the
    # CORDIS activity codes are authoritative over ANR free-text categories
    # (the ANR files label e.g. the CEA as « Université »).
    session.execute(
        text(
            "UPDATE organisations k SET "
            "  country_code = coalesce(k.country_code, v.country_code), "
            "  city = coalesce(k.city, v.city), "
            "  org_type = CASE "
            "      WHEN k.org_type = ANY(:cordis_types) THEN k.org_type "
            "      WHEN v.cordis_type IS NOT NULL THEN v.cordis_type "
            "      ELSE coalesce(k.org_type, v.any_type) END, "
            "  website = coalesce(k.website, v.website), "
            "  lat = coalesce(k.lat, v.lat), lon = coalesce(k.lon, v.lon) "
            "FROM (SELECT max(country_code) country_code, max(city) city, "
            "        max(org_type) FILTER (WHERE org_type = ANY(:cordis_types)) cordis_type, "
            "        max(org_type) any_type, max(website) website, "
            "        max(lat) lat, max(lon) lon "
            "      FROM organisations WHERE id = ANY(:victims)) v "
            "WHERE k.id = :keeper"
        ),
        {"victims": victim_ids, "keeper": keeper_id, "cordis_types": CORDIS_ACTIVITY_TYPES},
    )
    session.execute(
        delete(Organisation).where(Organisation.id.in_(victim_ids)).execution_options(**opts)
    )


def merge_exact(session: Session, stats: RunStats) -> None:
    """Merge organisations sharing a country and an identical normalized name."""
    groups = session.execute(
        select(
            Organisation.country_code,
            Organisation.name_normalized,
            func.array_agg(Organisation.id).label("ids"),
        )
        .where(Organisation.name_normalized.is_not(None))
        .group_by(Organisation.country_code, Organisation.name_normalized)
        .having(func.count(Organisation.id) > 1)
    ).all()

    for _country, _key, ids in groups:
        buckets = _split_by_identifier_conflict(sorted(ids), _identifiers_by_org(session, ids))
        for bucket in buckets:
            if len(bucket) > 1:
                merge_group(session, bucket[0], bucket[1:])
                stats.add("merged_exact", len(bucket) - 1)
            elif len(buckets) > 1:
                stats.add("kept_apart_by_identifier")
    session.commit()


def merge_fuzzy(
    session: Session,
    stats: RunStats,
    threshold: float = FUZZY_THRESHOLD,
    name_prefix: str | None = None,
) -> None:
    """Merge near-identical names within a country, using trigram similarity.

    `name_prefix` narrows the pass to organisations whose name starts with it,
    which is what an incremental run over a freshly ingested batch needs.
    """
    # set_config, not SET: the latter refuses bind parameters.
    session.execute(
        text("SELECT set_config('pg_trgm.similarity_threshold', :t, true)"),
        {"t": str(threshold)},
    )
    scope = "AND a.name LIKE :prefix AND b.name LIKE :prefix " if name_prefix else ""
    params: dict[str, object] = {"minlen": MIN_FUZZY_LENGTH, "t": threshold}
    if name_prefix:
        params["prefix"] = f"{name_prefix}%"

    pairs = session.execute(
        text(
            "SELECT a.id, b.id FROM organisations a JOIN organisations b "
            "  ON a.country_code = b.country_code AND a.id < b.id "
            " AND a.name_normalized % b.name_normalized "
            "WHERE a.country_code IS NOT NULL "
            "  AND length(a.name_normalized) >= :minlen "
            "  AND length(b.name_normalized) >= :minlen "
            "  AND similarity(a.name_normalized, b.name_normalized) >= :t " + scope
        ),
        params,
    ).all()

    parent: dict[int, int] = {}

    def find(node: int) -> int:
        parent.setdefault(node, node)
        while parent[node] != node:
            parent[node] = parent[parent[node]]
            node = parent[node]
        return node

    for left, right in pairs:
        root_left, root_right = find(left), find(right)
        if root_left != root_right:
            parent[max(root_left, root_right)] = min(root_left, root_right)

    clusters: dict[int, list[int]] = {}
    for node in parent:
        clusters.setdefault(find(node), []).append(node)

    for members in clusters.values():
        if len(members) < 2:
            continue
        buckets = _split_by_identifier_conflict(
            sorted(members), _identifiers_by_org(session, members)
        )
        for bucket in buckets:
            if len(bucket) > 1:
                merge_group(session, bucket[0], bucket[1:])
                stats.add("merged_fuzzy", len(bucket) - 1)
            elif len(buckets) > 1:
                stats.add("kept_apart_by_identifier")
    session.commit()
    stats.add("fuzzy_pairs_examined", len(pairs))


def drop_orphan_organisations(session: Session, stats: RunStats) -> None:
    """Remove organisations left with no participation at all.

    They carry no information — Orion only ever describes an organisation
    through the projects it took part in — and a handful accumulate from
    interrupted runs and skipped duplicate rows. Identifiers and aliases
    cascade away with them.
    """
    result = session.execute(
        delete(Organisation)
        .where(
            ~select(Participation.id)
            .where(Participation.organisation_id == Organisation.id)
            .exists()
        )
        .execution_options(synchronize_session=False)
    )
    session.commit()
    if result.rowcount:
        stats.add("orphan_organisations_dropped", result.rowcount)


def measure(session: Session, stats: RunStats) -> None:
    """Record what the pass left behind, so quality is visible, not assumed."""
    stats.add("organisations_after", session.scalar(select(func.count(Organisation.id))) or 0)
    remaining = session.scalar(
        select(func.count()).select_from(
            select(Organisation.country_code, Organisation.name_normalized)
            .where(Organisation.name_normalized.is_not(None))
            .group_by(Organisation.country_code, Organisation.name_normalized)
            .having(func.count(Organisation.id) > 1)
            .subquery()
        )
    )
    stats.add("residual_exact_duplicate_groups", remaining or 0)
    doubled = session.scalar(
        select(func.count()).select_from(
            select(Participation.project_id, Participation.organisation_id)
            .group_by(Participation.project_id, Participation.organisation_id)
            .having(func.count(Participation.id) > 1)
            .subquery()
        )
    )
    # Not an error: two merged entries of one organisation on the same project
    # keep their own amounts. Analytics must count organisations DISTINCT.
    stats.add("projects_with_repeated_organisation", doubled or 0)


# Every materialised aggregate the product reads. They are refreshed
# together, at the end of the ingestion chain, so a loader can never
# forget one: adding a view here is the whole wiring (chantier
# performance, O2 — an aggregate that lies is worse than a slow one).
MATERIALIZED_VIEWS = (
    "organisation_stats",
    "country_stats",
    "country_pair_stats",
)


def refresh_organisation_stats() -> None:
    """Rebuild the materialized aggregates.

    CONCURRENTLY cannot run inside a transaction, hence the autocommit
    connection; it keeps reads unblocked while the views rebuild.
    """
    from orion.core.db import engine

    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        for view in MATERIALIZED_VIEWS:
            conn.execute(text(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {view}"))


def run(force: bool = False) -> dict[str, int]:
    with record_run("dedup") as stats:
        session = SessionLocal()
        try:
            stats.add(
                "organisations_before", session.scalar(select(func.count(Organisation.id))) or 0
            )
            refresh_normalized_names(session, stats)
            merge_exact(session, stats)
            merge_fuzzy(session, stats)
            drop_orphan_organisations(session, stats)
            measure(session, stats)
        finally:
            session.close()
        refresh_organisation_stats()
        stats.add("organisation_stats_refreshed", 1)
    return stats.counts

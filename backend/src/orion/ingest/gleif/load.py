"""Load the GLEIF Golden Copy mirror (vague 1, socle identité).

Licence CC0, re-verified on gleif.org at instruction time (2026-08-03):
reuse free, commercial included. The publishes/latest endpoint names the
day's full files; downloads go through the shared change-detecting
cache. The mirror is rebuilt whole on each run (TRUNCATE + streamed
batched inserts) — idempotent by construction, ~weekly cadence with the
scheduler. Reporting exceptions are NOT loaded here: the groups builder
loads the bridged slice once the bridges exist."""

from itertools import islice
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy import insert, text

from orion.core.db import SessionLocal
from orion.ingest.dedup.normalize import normalize_name
from orion.ingest.download import cache_dir, cached_download
from orion.ingest.runlog import RunStats, record_run
from orion.models import LeiRecord, LeiRelationship

SOURCE = "gleif"
PUBLISHES_URL = "https://goldencopy.gleif.org/api/v2/golden-copies/publishes/latest"
BATCH = 5_000


def latest_files() -> dict[str, str]:
    """The day's full-file CSV URLs for lei2 and rr (repex cached too —
    consumed later by the groups builder)."""
    with httpx.Client(timeout=60) as client:
        response = client.get(PUBLISHES_URL)
        response.raise_for_status()
        data = response.json()["data"]
    return {kind: data[kind]["full_file"]["csv"]["url"] for kind in ("lei2", "rr", "repex")}


def repex_cache_path() -> Path:
    return cache_dir() / f"{SOURCE}-repex.csv.zip"


def _bulk_insert(session: Any, model: type, rows: Any, stats: RunStats, counter: str) -> None:
    while True:
        chunk = list(islice(rows, BATCH))
        if not chunk:
            break
        session.execute(insert(model), chunk)
        stats.add(counter, len(chunk))
        session.commit()


def run(force: bool = False) -> dict[str, int]:
    from orion.ingest.gleif import parse

    with record_run(SOURCE) as stats:
        urls = latest_files()
        lei2_path, lei2_changed = cached_download(
            urls["lei2"], f"{SOURCE}-lei2.csv.zip", force=force
        )
        rr_path, rr_changed = cached_download(urls["rr"], f"{SOURCE}-rr.csv.zip", force=force)
        # The exceptions file is only cached here; the groups builder
        # reads the bridged slice.
        cached_download(urls["repex"], repex_cache_path().name, force=force)
        stats.add("download_changed" if (lei2_changed or rr_changed) else "download_cached")

        session = SessionLocal()
        try:
            session.execute(text("TRUNCATE lei_relationships"))
            session.execute(text("TRUNCATE lei_records"))
            session.commit()

            records = (
                {**row, "name_normalized": normalize_name(row["name"])}
                for row in parse.parse_lei_records(lei2_path)
            )
            _bulk_insert(session, LeiRecord, records, stats, "lei_records")
            _bulk_insert(
                session, LeiRelationship, parse.parse_relationships(rr_path), stats, "relationships"
            )
        finally:
            session.close()
    return stats.counts

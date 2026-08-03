"""Parse the RePORTER bulk CSVs (projects and abstracts).

Latin-1 encoded, one CSV per zip, 46 columns on the project file
(verified 2026-08-03 on FY2023). Personal-data columns are dropped at
the door — they never reach a dict, let alone the base. Rows are
streamed: a single fiscal year is 212 MB of CSV."""

import csv
import io
import sys
import zipfile
from collections.abc import Iterator
from datetime import date
from pathlib import Path
from typing import Any

from orion.ingest.nih.config import PERSONAL_DATA_COLUMNS

# One RePORTER abstract can exceed the default 128 KB field limit.
csv.field_size_limit(min(sys.maxsize, 2**31 - 1))


def _rows(path: Path) -> Iterator[dict[str, str]]:
    with zipfile.ZipFile(path) as archive:
        inner = next(name for name in archive.namelist() if name.lower().endswith(".csv"))
        with archive.open(inner) as raw:
            reader = csv.DictReader(io.TextIOWrapper(raw, encoding="latin-1", newline=""))
            for row in reader:
                yield {k: v for k, v in row.items() if k and k not in PERSONAL_DATA_COLUMNS}


def _amount(raw: str | None) -> float | None:
    value = (raw or "").strip().replace(",", "")
    if not value:
        return None
    try:
        parsed = float(value)
    except ValueError:
        return None
    return parsed if parsed > 0 else None


def _date(raw: str | None) -> date | None:
    """RePORTER ships ISO dates, occasionally with a time part."""
    value = (raw or "").strip()
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def parse_awards(path: Path) -> Iterator[dict[str, Any]]:
    """One award-year row: the grain RePORTER publishes."""
    for row in _rows(path):
        core = (row.get("CORE_PROJECT_NUM") or "").strip()
        application_id = (row.get("APPLICATION_ID") or "").strip()
        if not core or not application_id:
            continue
        fy_raw = (row.get("FY") or "").strip()
        organisation = (row.get("ORG_NAME") or "").strip()
        yield {
            "core_num": core,
            "application_id": application_id,
            "fy": int(fy_raw) if fy_raw.isdigit() else None,
            # A sub-project row belongs to its core award and carries its
            # own share in TOTAL_COST_SUB_PROJECT: folded, never doubled.
            "is_subproject": bool((row.get("SUBPROJECT_ID") or "").strip()),
            "total_cost": _amount(row.get("TOTAL_COST")),
            "subproject_cost": _amount(row.get("TOTAL_COST_SUB_PROJECT")),
            "project_start": _date(row.get("PROJECT_START")),
            "project_end": _date(row.get("PROJECT_END")),
            "title": (row.get("PROJECT_TITLE") or "").strip() or None,
            "activity": (row.get("ACTIVITY") or "").strip() or None,
            "ic_code": (row.get("ADMINISTERING_IC") or "").strip() or None,
            "ic_name": (row.get("IC_NAME") or "").strip() or None,
            "org_name": organisation or None,
            "org_city": (row.get("ORG_CITY") or "").strip() or None,
            "org_country": (row.get("ORG_COUNTRY") or "").strip() or None,
            "org_ipf": (row.get("ORG_IPF_CODE") or "").strip() or None,
            "org_duns": (row.get("ORG_DUNS") or "").strip() or None,
        }


def parse_abstracts(path: Path) -> Iterator[tuple[str, str]]:
    """(application_id, abstract) pairs, streamed."""
    for row in _rows(path):
        application_id = (row.get("APPLICATION_ID") or "").strip()
        abstract = (row.get("ABSTRACT_TEXT") or "").strip()
        if application_id and abstract:
            yield application_id, abstract

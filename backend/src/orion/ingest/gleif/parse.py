"""Parse the GLEIF Golden Copy CSVs (LEI-CDF 3.1), straight from the zips.

Column names come from the published files themselves (verified
2026-08-03 on the real RR file). Everything is streamed — the Level 1
file carries 3.4 M records and never fits in memory as a list."""

import csv
import io
import re
import zipfile
from collections.abc import Iterator
from pathlib import Path
from typing import Any

# An LEI is exactly 20 alphanumerics (ISO 17442) — anything else in a
# LEI slot is dirty data and never enters the mirror (real-run finding,
# 2026-08-03: Wikidata carries a few malformed P1278 values).
LEI_SHAPE = re.compile(r"^[A-Z0-9]{20}$")

# Only accounting consolidation makes a group (docs/groupes-couche.md);
# fund management, sub-funds and branches are other stories.
CONSOLIDATION_TYPES = frozenset({"IS_DIRECTLY_CONSOLIDATED_BY", "IS_ULTIMATELY_CONSOLIDATED_BY"})


def _rows(path: Path) -> Iterator[dict[str, str]]:
    """Stream the single CSV inside a golden-copy zip."""
    with zipfile.ZipFile(path) as archive:
        inner = next(name for name in archive.namelist() if name.endswith(".csv"))
        with archive.open(inner) as raw:
            yield from csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8"))


def parse_lei_records(path: Path) -> Iterator[dict[str, Any]]:
    """Level 1: one legal entity per row — identity plus the
    registration-authority id (the SIREN for French records)."""
    for row in _rows(path):
        lei = (row.get("LEI") or "").strip().upper()
        name = (row.get("Entity.LegalName") or "").strip()
        if not LEI_SHAPE.match(lei) or not name:
            continue
        country = (row.get("Entity.LegalAddress.Country") or "").strip().upper() or None
        ra_id = (
            row.get("Entity.RegistrationAuthority.RegistrationAuthorityEntityID") or ""
        ).strip() or None
        status = (row.get("Entity.EntityStatus") or "").strip() or None
        yield {
            "lei": lei,
            "name": name,
            "country_code": country if country and len(country) == 2 else None,
            "ra_id": ra_id,
            "status": status,
        }


def parse_relationships(path: Path) -> Iterator[dict[str, Any]]:
    """Level 2 (RR): ACTIVE accounting-consolidation links only."""
    for row in _rows(path):
        relationship_type = (row.get("Relationship.RelationshipType") or "").strip()
        if relationship_type not in CONSOLIDATION_TYPES:
            continue
        if (row.get("Relationship.RelationshipStatus") or "").strip() != "ACTIVE":
            continue
        child = (row.get("Relationship.StartNode.NodeID") or "").strip().upper()
        parent = (row.get("Relationship.EndNode.NodeID") or "").strip().upper()
        if not LEI_SHAPE.match(child) or not LEI_SHAPE.match(parent) or child == parent:
            continue
        yield {
            "child_lei": child,
            "parent_lei": parent,
            "relationship_type": relationship_type,
            "corroboration": (row.get("Registration.ValidationSources") or "").strip() or None,
        }


def parse_exceptions(path: Path, keep: frozenset[str]) -> Iterator[dict[str, Any]]:
    """Reporting exceptions, filtered to the LEIs our corpus bridged —
    the full file mirrors most of the LEI population (6.3 M rows) and
    only the bridged slice can ever explain anything to a reader."""
    for row in _rows(path):
        lei = (row.get("LEI") or "").strip()
        if lei not in keep:
            continue
        category = (row.get("Exception.Category") or "").strip()
        if not category:
            continue
        yield {
            "lei": lei,
            "exception_type": category,
            "reason": (row.get("Exception.Reason.1") or "").strip() or None,
        }

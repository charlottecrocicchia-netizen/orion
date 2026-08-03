"""Parse the NSF yearly bulk archives — one JSON file per award.

A year is a zip of thousands of small JSON documents (11 687 for
FY2024), so awards stream out one at a time and a year never sits in
memory whole.

Rows are built from an EXPLICIT WHITELIST of fields. That is the
guarantee on personal data: principal investigators, program officers
and institution phone numbers are not filtered out, they are never read
— they cannot reach a dict, let alone the base."""

import json
import re
import zipfile
from collections.abc import Iterator
from datetime import date
from pathlib import Path
from typing import Any

# NSF's only published signal that N awards are ONE project. Measured
# 2026-08-03: without this prefix, identical titles are fellowship
# umbrellas (152 awards share "NSF East Asia Summer Institutes…") and
# folding them would be a disaster.
COLLABORATIVE = re.compile(r"^\s*collaborative\s+(?:research|proposal)\s*:\s*", re.IGNORECASE)


def collaborative_title(title: str | None) -> str | None:
    """The award's title without NSF's collaboration prefix, or None."""
    if not title or not COLLABORATIVE.match(title):
        return None
    return COLLABORATIVE.sub("", title).strip() or None


def collaborative_key(title: str | None) -> str | None:
    """The fold key shared by the siblings of one collaborative project."""
    stripped = collaborative_title(title)
    if stripped is None:
        return None
    key = " ".join("".join(c if c.isalnum() else " " for c in stripped.lower()).split())
    return key or None


def _amount(raw: Any) -> float | None:
    """Award money. Zero means "nothing obligated", not "unknown" — but a
    project worth nothing carries no information, so it stays NULL."""
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    return value if value > 0 else None


def _date(raw: Any) -> date | None:
    value = str(raw or "").strip()
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def _text(raw: Any) -> str | None:
    value = str(raw or "").strip()
    return value or None


def _award(award: dict[str, Any]) -> dict[str, Any] | None:
    """One award → one staging row, whitelist only."""
    awd_id = _text(award.get("awd_id"))
    if not awd_id:
        return None
    title = _text(award.get("awd_titl_txt"))
    institution = award.get("inst") or {}
    # The per-fiscal-year obligations: convention ① keeps the detail for
    # the audit while the project carries their sum.
    slices = [
        {"fy": entry.get("fund_oblg_fiscal_yr"), "amount": entry.get("fund_oblg_amt")}
        for entry in (award.get("oblg_fy") or [])
        if entry.get("fund_oblg_fiscal_yr")
    ]
    return {
        "awd_id": awd_id,
        "title": title,
        # The prefix is NSF plumbing, not the project's name.
        "title_clean": collaborative_title(title) or title,
        "collab_key": collaborative_key(title),
        "abstract": _text(award.get("awd_abstract_narration")),
        # Founder-validated: the amount is what NSF OBLIGATED, never the
        # intention — the intention is absent on 40 % of FY2005 awards
        # and inverts against the obligated figure between generations.
        "amount": _amount(award.get("awd_amount")),
        "start_date": _date(award.get("awd_eff_date")),
        "end_date": _date(award.get("awd_exp_date")),
        "instrument": _text(award.get("awd_istr_txt")),
        "tran_type": _text(award.get("tran_type")),
        "cfda": _text(award.get("cfda_num")),
        # Programmes are the NSF divisions (founder-validated, as the
        # NIH institutes are). 55 distinct abbreviations, no collision.
        "div_code": _text(award.get("div_abbr")),
        "div_name": _text(award.get("org_div_long_name")),
        "dir_name": _text(award.get("org_dir_long_name")),
        "slices": slices,
        "org_name": _text(institution.get("inst_name")),
        "org_city": _text(institution.get("inst_city_name")),
        # The country comes from the NAME, never from `perf_ctry_code`:
        # that code is not ISO (DA for Denmark, SP for Spain, JA for
        # Japan, UK for GB) — founder-validated ⑥.
        "org_country": _text(institution.get("inst_country_name")),
        "org_uei": _text(institution.get("org_uei_num")),
        "org_parent_uei": _text(institution.get("org_prnt_uei_num")),
    }


def parse_awards(path: Path) -> Iterator[dict[str, Any]]:
    """Stream one fiscal year's awards out of its archive."""
    with zipfile.ZipFile(path) as archive:
        for name in sorted(archive.namelist()):
            if not name.lower().endswith(".json"):
                continue
            try:
                award = json.loads(archive.read(name))
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue
            if not isinstance(award, dict):
                continue
            row = _award(award)
            if row is not None:
                yield row

"""One-shot repair: restore CORDIS activity codes on organisations whose type
was overwritten by an ANR free-text category during past merges.

The dedup and CORDIS loaders now prefer activity codes (REC/HES/PRC/PUB/OTH),
so future runs stay clean; this script fixes rows created before that rule.
It reads the already-extracted organization.csv files (no download) and maps
each PIC back to its activity type.

Run from backend/:  uv run python scripts/fix_org_types.py
"""

import csv
import sys
from collections import Counter
from pathlib import Path

from sqlalchemy import create_engine, text

from orion.core.config import get_settings

CORDIS_ACTIVITY_TYPES = {"REC", "HES", "PRC", "PUB", "OTH"}
DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "extracted"


def pic_to_type() -> dict[str, str]:
    mapping: dict[str, str] = {}
    for csv_path in sorted(DATA_DIR.glob("cordis-*/organization.csv")):
        with csv_path.open(encoding="utf-8-sig", newline="") as handle:
            for row in csv.DictReader(handle, delimiter=";"):
                pic = (row.get("organisationID") or "").strip()
                activity = (row.get("activityType") or "").strip()
                if pic.isdigit() and activity in CORDIS_ACTIVITY_TYPES:
                    mapping[pic] = activity
    return mapping


def main() -> int:
    mapping = pic_to_type()
    if not mapping:
        print(f"No organization.csv found under {DATA_DIR}", file=sys.stderr)
        return 1
    print(f"{len(mapping)} PICs with an activity type in the extracted files")

    engine = create_engine(get_settings().database_url)
    fixed: Counter[str] = Counter()
    with engine.begin() as conn:
        rows = conn.execute(
            text("""
            SELECT oi.value AS pic, oi.organisation_id, o.org_type
            FROM organisation_identifiers oi
            JOIN organisations o ON o.id = oi.organisation_id
            WHERE oi.scheme = 'pic'
            """)
        ).all()
        for pic, organisation_id, org_type in rows:
            wanted = mapping.get(pic)
            if wanted is None or org_type in CORDIS_ACTIVITY_TYPES or org_type == wanted:
                continue
            conn.execute(
                text("UPDATE organisations SET org_type = :t WHERE id = :i"),
                {"t": wanted, "i": organisation_id},
            )
            fixed[f"{org_type or '(null)'} -> {wanted}"] += 1

    total = sum(fixed.values())
    print(f"{total} organisations repaired")
    for change, count in fixed.most_common(12):
        print(f"  {count:>6}  {change}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

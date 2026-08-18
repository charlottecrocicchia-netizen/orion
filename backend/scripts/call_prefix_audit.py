"""L'audit de PURETÉ des préfixes d'appel d'une lentille.

Une règle `call` est une preuve structurelle : elle n'a le droit
d'attraper que ce qu'elle prétend. Ce script liste, pour chaque préfixe,
les codes d'appel réellement atteints et leurs projets — toute dérive du
corpus (un code voisin qui s'y glisserait) devient visible.

Run from backend/:  ORION_DATABASE_URL=... uv run python scripts/call_prefix_audit.py aviation
"""

import csv
import sys
from pathlib import Path

from sqlalchemy import text

from orion.core.db import SessionLocal

LENSES = Path(__file__).resolve().parents[1] / "curation" / "lenses"


def main(lens: str) -> int:
    rules = [
        row
        for row in csv.DictReader((LENSES / f"{lens}.csv").open(encoding="utf-8"))
        if row["rule_type"] == "call"
    ]
    session = SessionLocal()
    total = 0
    try:
        print(f"\n=== pureté des préfixes d'appel · lentille « {lens} » ===")
        for rule in rules:
            rows = session.execute(
                text(
                    "SELECT c.code, count(DISTINCT p.id) AS projets, "
                    "       coalesce(sum(p.funding_amount_eur), 0) AS eur "
                    "FROM calls c LEFT JOIN projects p ON p.call_id = c.id "
                    "WHERE c.code LIKE :prefix GROUP BY c.code ORDER BY c.code"
                ),
                {"prefix": rule["value"] + "%"},
            ).all()
            projets = sum(r.projets for r in rows)
            total += projets
            print(f"\n  {rule['value']}  → {len(rows)} code(s), {projets} projet(s)")
            for r in rows:
                print(f"      {r.code:34} {r.projets:>5} projets  {float(r.eur) / 1e6:>8.0f} M€")
        print(f"\n  total atteint par les préfixes : {total} projets\n")
    finally:
        session.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1] if len(sys.argv) > 1 else "aviation"))

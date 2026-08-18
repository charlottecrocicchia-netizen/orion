"""Le seed adversarial : confronte le gold set d'une lentille au corpus réel.

C'est l'ACTIF cumulatif d'Orion — enrichi à chaque faux positif ou faux
négatif intéressant, jamais purgé. Un cas `excluded` qui entre par une
preuve forte est une alerte : la règle est trop large.

Run from backend/:  ORION_DATABASE_URL=... uv run python scripts/gold_check.py aviation
"""

import csv
import sys
from pathlib import Path

from sqlalchemy import text

from orion.core.db import SessionLocal

GOLD_DIR = Path(__file__).resolve().parents[1] / "curation" / "lenses" / "gold"


def main(lens: str) -> int:
    rows = list(csv.DictReader((GOLD_DIR / f"{lens}.csv").open(encoding="utf-8")))
    session = SessionLocal()
    verdicts: list[tuple[str, str, str, str, str]] = []
    try:
        for row in rows:
            found = session.execute(
                text(
                    "SELECT plt.tag, plt.proof FROM projects p "
                    "LEFT JOIN project_lens_tags plt ON plt.project_id = p.id AND plt.lens = :lens "
                    "WHERE p.source = :source AND p.source_id = :sid"
                ),
                {"lens": lens, "source": row["source"], "sid": row["source_id"]},
            ).first()
            if found is None:
                actual, proof = "ABSENT DU CORPUS", "—"
            else:
                actual, proof = (found[0] or "none"), (found[1] or "—")
            expected = row["expected"]
            if expected == "a_arbitrer":
                verdict = "à arbitrer"
            elif expected == "core":
                verdict = "OK" if actual == "core" else "MANQUÉ"
            else:  # excluded
                verdict = "OK" if actual == "none" else "FAUX POSITIF"
            verdicts.append((verdict, row["cas"], row["acronym"], actual, proof))
    finally:
        session.close()

    order = {"FAUX POSITIF": 0, "MANQUÉ": 1, "à arbitrer": 2, "OK": 3}
    print(f"\n=== seed adversarial · lentille « {lens} » · {len(rows)} cas ===")
    for verdict, cas, acronym, actual, proof in sorted(verdicts, key=lambda v: order[v[0]]):
        print(f"  {verdict:13} {acronym:14} {cas:26} → {actual} ({proof})")
    tally = {v: sum(1 for x in verdicts if x[0] == v) for v in order}
    print(f"\n  {tally}")
    faults = tally["FAUX POSITIF"] + tally["MANQUÉ"]
    print(f"  VERDICT : {'aucune faute' if faults == 0 else str(faults) + ' faute(s)'}\n")
    return 1 if tally["FAUX POSITIF"] else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1] if len(sys.argv) > 1 else "aviation"))

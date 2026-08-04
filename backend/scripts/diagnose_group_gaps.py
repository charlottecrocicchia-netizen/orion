"""Diagnostic chiffré du trou de couverture des groupes (recette
fondatrice, 2026-08-04 : « Safran affiche 4 entités et 27,4 M€ — un
utilisateur qui connaît Safran conclura que le site est faux »).

Pour chaque groupe : les organisations du corpus qui portent son nom
sans y être rattachées, et ce qu'elles pèsent. Sortie markdown sur
stdout, classée par périmètre potentiel (rattaché + homonymes), pour
alimenter la fournée de curation. Le radar se relance après chaque
rebuild identité — le trou se mesure, il ne se devine pas.

    uv run python scripts/diagnose_group_gaps.py [--top 20]
"""

import argparse
import sys

from sqlalchemy import text

from orion.core.db import SessionLocal
from orion.ingest.groups.homonyms import unattached_all_groups


def eur(value: float) -> str:
    if value >= 1e9:
        return f"{value / 1e9:.2f} Md€"
    if value >= 1e6:
        return f"{value / 1e6:.1f} M€"
    if value > 0:
        return f"{value / 1e3:.0f} k€"
    return "0"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--top", type=int, default=20)
    args = parser.parse_args()

    session = SessionLocal()
    attached = {
        row.group_id: (float(row.funding or 0), row.projects, row.entities)
        for row in session.execute(
            text("""
            SELECT m.group_id,
                   sum(pa.amount_eur) AS funding,
                   count(DISTINCT pa.project_id) AS projects,
                   count(DISTINCT m.organisation_id) AS entities
            FROM entity_group_map m
            LEFT JOIN participations pa ON pa.organisation_id = m.organisation_id
            GROUP BY m.group_id
            """)
        )
    }

    report = []
    for entry in unattached_all_groups(session):
        gid = entry["gid"]
        att_funding, att_projects, att_entities = attached.get(gid, (0.0, 0, 0))
        hole = [o for o in entry["unattached"] if o["other_group"] is None]
        arbitrated = [o for o in entry["unattached"] if o["other_group"] is not None]
        hole_funding = sum(o["funding_eur"] for o in hole)
        report.append(
            {
                "gid": gid,
                "name": entry["gname"],
                "country": entry["gcountry"],
                "attached_funding": att_funding,
                "attached_projects": att_projects,
                "attached_entities": att_entities,
                "hole": hole,
                "hole_funding": hole_funding,
                "arbitrated": arbitrated,
                "potential": att_funding + hole_funding,
            }
        )

    report.sort(key=lambda r: -r["potential"])
    top = report[: args.top]

    total_hole = sum(r["hole_funding"] for r in report)
    total_attached = sum(r["attached_funding"] for r in report)
    print("# Diagnostic — homonymes non rattachés aux groupes\n")
    print(
        f"Corpus : {len(report)} groupes · rattaché {eur(total_attached)} · "
        f"trou homonyme TOTAL {eur(total_hole)} "
        f"({100 * total_hole / (total_attached + total_hole):.0f} % du potentiel)\n"
    )
    print(f"## Les {len(top)} plus gros périmètres potentiels\n")
    print(
        "| Groupe | Rattaché | Entités | Homonymes hors périmètre | Leur poids | % du potentiel |"
    )
    print("|---|---:|---:|---:|---:|---:|")
    for r in top:
        pct = 100 * r["hole_funding"] / r["potential"] if r["potential"] > 0 else 0
        print(
            f"| {r['name']} ({r['country'] or '—'}) | {eur(r['attached_funding'])} "
            f"| {r['attached_entities']} | {len(r['hole'])} | {eur(r['hole_funding'])} "
            f"| {pct:.0f} % |"
        )

    print("\n## Détail — chaque homonyme, pesé\n")
    for r in top:
        if not r["hole"] and not r["arbitrated"]:
            continue
        print(f"### {r['name']} — trou {eur(r['hole_funding'])}\n")
        for o in r["hole"]:
            print(
                f"- {o['name']} ({o['country'] or '—'}) — "
                f"{eur(o['funding_eur'])}, {o['projects']} projets [org {o['id']}]"
            )
        for o in r["arbitrated"]:
            print(
                f"- {o['name']} ({o['country'] or '—'}) — rattachée à « {o['other_group']} » "
                f"({eur(o['funding_eur'])}) : arbitrage, pas oubli"
            )
        print()


if __name__ == "__main__":
    sys.exit(main())

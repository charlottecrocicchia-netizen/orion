"""Audit méthodologique des conventions PPP — DIAGNOSTIQUE, NON BLOQUANT.

Le niveau 2 du filet R4B (doc § 17, étape 2). Il ne fait partie d'aucune
chaîne de production : il lit quatre indicateurs du WDI **en mémoire**,
n'écrit rien en base, et rend un rapport — jamais un échec.

Un seul contrôle y a valeur de preuve, et son périmètre est écrit :

    NY.GDP.MKTP.CD × PA.NUS.ATLS = NY.GDP.MKTP.CN

CE QU'IL PROUVE : que la Banque mondiale convertit toujours le PIB en
dollars courants avec son DEC alternative conversion factor — donc que
la phrase de la note ⓘ sur la convention reste vraie.
OÙ IL EST CENSÉ TENIR : sur TOUTE cellule (pays, année) où les trois
séries sont publiées. Mesuré le 2026-08-25 : 5 428 cellules sur 5 428,
soit 100,000 %, redénominations comprises. Une cellule qui s'en écarte
est donc un signal réel, pas du bruit.
CE QU'IL NE PROUVE PAS : rien sur le numérateur, rien sur `PA.NUS.PPP`,
rien sur la justesse du ratio de production.

Les autres relations sont affichées à titre DOCUMENTAIRE, avec la
mention explicite qu'elles divergent légitimement : le facteur PPP est
réexprimé dans la monnaie actuelle sur tout l'historique quand le taux
officiel garde celle de l'époque, et l'identité du numérateur casse là
où les séries de PIB ne partagent pas la même base (Inde, Nigeria). Ces
divergences sont la RAISON de consommer le couple publié plutôt que de
reconstruire une route intermédiaire — elles ne sont ni un seuil, ni une
alerte, ni un chemin de calcul.

Usage : uv run python scripts/audit_ppp_conventions.py [FR DE PL …]
"""

import sys
from decimal import Decimal

import httpx

API = "https://api.worldbank.org/v2"
TIMEOUT = 60.0
YEARS = (2010, 2025)
# Aucun de ces indicateurs n'entre en base : ils vivent le temps du
# rapport, et c'est toute la différence entre un audit et une source.
SERIES = {
    "gdp_usd": "NY.GDP.MKTP.CD",
    "gdp_lcu": "NY.GDP.MKTP.CN",
    "gdp_ppp": "NY.GDP.MKTP.PP.CD",
    "atls": "PA.NUS.ATLS",
    "ppp": "PA.NUS.PPP",
    "fcrf": "PA.NUS.FCRF",
}
DEFAULT_CODES = ["US", "FR", "DE", "PL", "SE", "DK", "JP", "KR", "IN", "NG", "AR", "EG", "HR"]


def fetch(client: httpx.Client, code: str, indicator: str) -> dict[int, Decimal]:
    response = client.get(
        f"{API}/country/{code}/indicator/{indicator}",
        params={"format": "json", "per_page": 200, "date": f"{YEARS[0]}:{YEARS[1]}"},
    )
    if response.status_code != 200:
        return {}
    payload = response.json()
    if len(payload) < 2 or payload[1] is None:
        return {}
    return {
        int(row["date"]): Decimal(str(row["value"]))
        for row in payload[1]
        if row["value"] is not None and row["value"] > 0
    }


def gap(a: Decimal, b: Decimal) -> Decimal:
    return (a / b - 1) * 100


def main() -> None:
    codes = sys.argv[1:] or DEFAULT_CODES
    print(f"Audit des conventions PPP — {len(codes)} juridictions, {YEARS[0]}-{YEARS[1]}")
    print("Rapport documentaire. Aucune écriture, aucun seuil, aucun verdict.\n")

    proven_ok = proven_total = 0
    print(f"{'pays':>5}{'PREUVE : GDP_USD == GDP_LCU/ATLS':>36}{'doc : GDP_PPP vs LCU/PPP':>28}")
    print(f"{'':>5}{'(censé tenir partout)':>36}{'(diverge légitimement)':>28}")
    rows: list[tuple[str, Decimal, Decimal | None]] = []
    with httpx.Client(timeout=TIMEOUT) as client:
        for code in codes:
            data = {name: fetch(client, code, ind) for name, ind in SERIES.items()}
            worst_proof = Decimal(0)
            worst_doc: Decimal | None = None
            for year in range(YEARS[0], YEARS[1] + 1):
                lcu, usd, atls = (
                    data["gdp_lcu"].get(year),
                    data["gdp_usd"].get(year),
                    data["atls"].get(year),
                )
                if lcu and usd and atls:
                    proven_total += 1
                    deviation = abs(gap(lcu / atls, usd))
                    if deviation < Decimal("0.001"):
                        proven_ok += 1
                    worst_proof = max(worst_proof, deviation)
                ppp, ppp_cd = data["ppp"].get(year), data["gdp_ppp"].get(year)
                if lcu and ppp and ppp_cd:
                    deviation = abs(gap(lcu / ppp, ppp_cd))
                    worst_doc = deviation if worst_doc is None else max(worst_doc, deviation)
            rows.append((code, worst_proof, worst_doc))
            doc = "—" if worst_doc is None else f"{worst_doc:.3f} %"
            print(f"{code:>5}{f'{worst_proof:.3f} %':>36}{doc:>28}")

    print()
    if proven_total:
        print(
            f"PREUVE : {proven_ok}/{proven_total} cellules exactes à 0,001 % près"
            f" — {100 * proven_ok / proven_total:.3f} %."
        )
        if proven_ok < proven_total:
            print(
                "  ⚠ Une cellule s'écarte : la convention de conversion du dénominateur\n"
                "    a peut-être changé chez la source. La phrase de la note ⓘ sur la\n"
                "    convention est à revérifier — ce n'est PAS un défaut de calcul."
            )
    divergent = [code for code, _, doc in rows if doc is not None and doc > Decimal("0.001")]
    if divergent:
        print(
            f"\nDOCUMENTAIRE : l'identité du numérateur diverge pour {', '.join(divergent)}.\n"
            "  Attendu, et sans conséquence sur le mode : Orion ne reconstruit rien,\n"
            "  il consomme le couple d'agrégats publié. C'est précisément parce que ces\n"
            "  identités intermédiaires cassent que la reconstruction est écartée."
        )


if __name__ == "__main__":
    main()

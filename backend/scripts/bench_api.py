"""The latency bench — the chantier performance's measuring instrument.

Times the four key journeys in the THREE regimes that behave differently
(instruction 2026-08-03): a term never seen before (the user's first
gesture), the same term again (application cache warm), and a filter
path with no term at all. Output is JSON, dated, meant to be committed
under docs/perf/ so every before/after is on the record.

PROTOCOL — read before comparing two runs. The application cache lives
in the API process and survives between bench runs: a "fresh term" is
only fresh the FIRST time it is asked. Restart the API before every
reference measurement, or the fresh-term figure silently becomes a
warm-cache figure (learned the hard way, 2026-08-03).

Usage:
    uv run python scripts/bench_api.py                  # human table
    uv run python scripts/bench_api.py --json out.json  # + JSON file
    uv run python scripts/bench_api.py --base http://localhost:8080
    uv run python scripts/bench_api.py --budgets        # exit 1 over budget
"""

import argparse
import json
import random
import statistics
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

# Terms drawn at random per run so the "never seen" regime stays honest:
# reusing one term would measure the cache, not the corpus.
FRESH_TERMS = [
    "protein", "photonics", "microbiome", "turbine", "catalysis", "genome",
    "aerosol", "neutrino", "polymer", "vaccine", "graphene", "seismic",
    "enzyme", "satellite", "antibiotic", "battery", "quantum", "hydrogel",
]  # fmt: skip

# Budgets (ms) per journey and regime — the instruction's targets. The CI
# guard uses the same file with a tighter set for the tiny seeded corpus.
BUDGETS_FULL = {
    "search_fresh_term": 1500,
    "search_warm_term": 300,
    "filter_country": 300,
    "countries_index": 300,
    "organisation_detail": 300,
    "organisation_partners": 300,
}
BUDGETS_SEEDED = dict.fromkeys(BUDGETS_FULL, 150)


def _time(client: httpx.Client, path: str) -> float:
    started = time.perf_counter()
    response = client.get(path)
    response.raise_for_status()
    return (time.perf_counter() - started) * 1000


def _pick_organisation(client: httpx.Client) -> int | None:
    """A real organisation from the corpus — never a hardcoded id."""
    response = client.get("/api/search/organisations?size=1")
    response.raise_for_status()
    results = response.json().get("results") or []
    return results[0]["id"] if results else None


def run_bench(base: str, passes: int, seed: int | None = None) -> dict[str, Any]:
    rng = random.Random(seed)
    measurements: dict[str, list[float]] = {name: [] for name in BUDGETS_FULL}

    with httpx.Client(base_url=base, timeout=120) as client:
        organisation_id = _pick_organisation(client)
        for _ in range(passes):
            term = rng.choice(FRESH_TERMS)
            # 1. a term never seen: FTS + facets + page, nothing cached
            measurements["search_fresh_term"].append(
                _time(client, f"/api/search/projects?q={term}&lang=en")
            )
            # 2. the same term again: the application cache should answer
            measurements["search_warm_term"].append(
                _time(client, f"/api/search/projects?q={term}&lang=en")
            )
            # 3. a filter path with no term at all
            measurements["filter_country"].append(
                _time(client, "/api/search/projects?country=FR")
            )
            # 4. the map's data
            measurements["countries_index"].append(_time(client, "/api/countries"))
            if organisation_id is not None:
                measurements["organisation_detail"].append(
                    _time(client, f"/api/organisations/{organisation_id}")
                )
                measurements["organisation_partners"].append(
                    _time(client, f"/api/organisations/{organisation_id}/partners")
                )

    journeys = {
        name: {
            "median_ms": round(statistics.median(values), 1),
            "worst_ms": round(max(values), 1),
            "samples": len(values),
        }
        for name, values in measurements.items()
        if values
    }
    return {
        "at": datetime.now(UTC).isoformat(timespec="seconds"),
        "base": base,
        "passes": passes,
        "journeys": journeys,
    }


def check_budgets(report: dict[str, Any], budgets: dict[str, int]) -> list[str]:
    """Median over budget fails; the worst is reported, never silent."""
    return [
        f"{name}: {data['median_ms']} ms > {budgets[name]} ms budget"
        for name, data in report["journeys"].items()
        if name in budgets and data["median_ms"] > budgets[name]
    ]


def main() -> int:
    parser = argparse.ArgumentParser(prog="bench_api", description=__doc__)
    parser.add_argument("--base", default="http://localhost:8000")
    parser.add_argument("--passes", type=int, default=3)
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("--json", dest="json_path", default=None)
    parser.add_argument(
        "--budgets",
        action="store_true",
        help="fail (exit 1) when a journey's median exceeds its budget",
    )
    parser.add_argument(
        "--seeded",
        action="store_true",
        help="use the tight budgets meant for the CI seeded corpus",
    )
    parser.add_argument("--label", default=None, help="a note stored in the report")
    args = parser.parse_args()

    report = run_bench(args.base, args.passes, args.seed)
    if args.label:
        report["label"] = args.label

    width = max(len(name) for name in report["journeys"])
    print(f"{'journey'.ljust(width)}  median      worst")
    for name, data in report["journeys"].items():
        print(f"{name.ljust(width)}  {data['median_ms']:>8.1f}ms {data['worst_ms']:>8.1f}ms")

    if args.json_path:
        Path(args.json_path).write_text(json.dumps(report, indent=2) + "\n")
        print(f"\n→ {args.json_path}")

    if args.budgets:
        breaches = check_budgets(report, BUDGETS_SEEDED if args.seeded else BUDGETS_FULL)
        if breaches:
            print("\nBUDGET EXCEEDED:", file=sys.stderr)
            for breach in breaches:
                print(f"  {breach}", file=sys.stderr)
            return 1
        print("\nAll journeys within budget.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

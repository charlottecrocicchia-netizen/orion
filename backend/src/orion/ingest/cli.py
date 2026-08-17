import argparse
import sys
import time
from functools import partial

from orion.ingest import cordis, dedup
from orion.ingest import reference as reference_module
from orion.ingest.cordis.config import FRAMEWORKS
from orion.ingest.gleif import load as gleif_load
from orion.ingest.groups import build as groups_build
from orion.ingest.lenses import run as lenses_run
from orion.ingest.nih import load as nih_load
from orion.ingest.nsf import load as nsf_load
from orion.ingest.rates import run as rates_run
from orion.ingest.subdivisions import run as subdivisions_run
from orion.ingest.wikidata import load as wikidata_load

REGISTRY = {
    "reference": reference_module.run,
    **{key: partial(cordis.load.run, key) for key in FRAMEWORKS},
    # Wave 1: yearly ECB rates first (every non-EUR source converts
    # through them), then the sources themselves.
    "rates": rates_run,
    "nih": nih_load.run,
    "nsf": nsf_load.run,
    "dedup": dedup.merge.run,
    # The identity layer (vague 1, socle): GLEIF mirror, Wikidata parent
    # links, then bridges + groups built over the deduplicated corpus.
    "gleif": gleif_load.run,
    "wikidata": wikidata_load.run,
    "groups": groups_build.run,
    # Les lentilles : un TAGGING dérivé des fichiers versionnés (registre
    # famille → lentille, M0), pas une source — elles se rejouent après
    # tout chargement de corpus, chacune sous son run `<slug>-lens`.
    "lenses": lenses_run,
    # La maille sous le pays : référentiel + backfill depuis les caches
    # (dérivée comme la lentille, rejouable, jamais un retéléchargement).
    "subdivisions": subdivisions_run,
}

# `all` rebuilds everything: reference data first, deduplication before
# the identity layer (bridges need canonical organisations).
ALL = [
    "reference",
    "rates",
    *FRAMEWORKS.keys(),
    "nih",
    "nsf",
    "dedup",
    "gleif",
    "wikidata",
    "groups",
    "lenses",
    "subdivisions",
]


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="orion-ingest",
        description="Rebuild or refresh the Orion database from public sources.",
    )
    parser.add_argument(
        "sources",
        nargs="+",
        choices=["all", *REGISTRY.keys()],
        help="sources to ingest, in order",
    )
    parser.add_argument(
        "--force", action="store_true", help="re-download even if the source is unchanged"
    )
    args = parser.parse_args()

    sources = ALL if "all" in args.sources else args.sources
    failures = 0
    for source in sources:
        started = time.perf_counter()
        print(f"==> {source}", flush=True)
        try:
            counts = REGISTRY[source](force=args.force)
        except Exception as exc:  # noqa: BLE001 — report and continue with next source
            failures += 1
            print(f"    FAILED: {type(exc).__name__}: {exc}", file=sys.stderr, flush=True)
            continue
        elapsed = time.perf_counter() - started
        summary = ", ".join(f"{k}={v}" for k, v in sorted(counts.items()))
        print(f"    done in {elapsed:.1f}s — {summary}", flush=True)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())

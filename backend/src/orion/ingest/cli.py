import argparse
import sys
import time
from functools import partial

from orion.ingest import anr, cordis
from orion.ingest import reference as reference_module
from orion.ingest.cordis.config import FRAMEWORKS

REGISTRY = {
    "reference": reference_module.run,
    **{key: partial(cordis.load.run, key) for key in FRAMEWORKS},
    "anr": anr.load.run,
}

# `all` rebuilds everything, reference data first.
ALL = ["reference", *FRAMEWORKS.keys(), "anr"]


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

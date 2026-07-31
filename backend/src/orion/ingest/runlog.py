from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime

from orion.core.db import SessionLocal
from orion.models import IngestionRun


class RunStats:
    """Counters accumulated during one ingestion run."""

    def __init__(self) -> None:
        self.counts: dict[str, int] = {}

    def add(self, key: str, n: int = 1) -> None:
        self.counts[key] = self.counts.get(key, 0) + n

    @property
    def total(self) -> int:
        return sum(v for k, v in self.counts.items() if not k.startswith("invalid"))


@contextmanager
def record_run(source: str) -> Iterator[RunStats]:
    """Journal one ingestion run in ingestion_runs, whatever its outcome."""
    session = SessionLocal()
    run = IngestionRun(source=source, status="running")
    session.add(run)
    session.commit()

    stats = RunStats()
    try:
        yield stats
    except Exception as exc:
        run.status = "failed"
        run.error = f"{type(exc).__name__}: {exc}"[:2000]
        raise
    else:
        run.status = "succeeded"
    finally:
        run.finished_at = datetime.now(UTC)
        run.records_processed = stats.total
        run.detail = stats.counts
        session.commit()
        session.close()

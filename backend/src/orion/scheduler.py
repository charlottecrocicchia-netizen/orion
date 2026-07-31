"""Weekly data refresh: replays the full ingestion pipeline on a cron schedule.

Runs as its own container (see infra/compose.prod.yml). Upserts are idempotent
and downloads are cached, so a weekly full replay is cheap when sources have
not changed; every run lands in the ingestion_runs journal either way.
"""

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from orion.core.config import get_settings


def refresh_all_sources() -> None:
    from orion.ingest.cli import ALL, REGISTRY

    for source in ALL:
        try:
            counts = REGISTRY[source](force=False)
        except Exception as exc:  # noqa: BLE001 — one failing source must not stop the others
            print(f"[scheduler] {source} FAILED: {type(exc).__name__}: {exc}", flush=True)
        else:
            summary = ", ".join(f"{k}={v}" for k, v in sorted(counts.items()))
            print(f"[scheduler] {source}: {summary}", flush=True)


def build_scheduler() -> BlockingScheduler:
    settings = get_settings()
    scheduler = BlockingScheduler(timezone="UTC")
    scheduler.add_job(
        refresh_all_sources,
        CronTrigger.from_crontab(settings.ingest_cron, timezone="UTC"),
        id="scheduled-refresh",
        coalesce=True,
        misfire_grace_time=6 * 3600,
    )
    if settings.ingest_on_start:
        scheduler.add_job(refresh_all_sources, id="startup-refresh")
    return scheduler


def main() -> None:
    settings = get_settings()
    print(
        f"[scheduler] started — cron '{settings.ingest_cron}' (UTC), "
        f"ingest_on_start={settings.ingest_on_start}",
        flush=True,
    )
    build_scheduler().start()


if __name__ == "__main__":
    main()

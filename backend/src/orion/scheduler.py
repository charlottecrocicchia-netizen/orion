"""Rafraîchissements planifiés — deux régimes d'ingestion (E1).

Le conteneur scheduler porte les jobs que `ORION_SCHEDULER_JOBS` lui
confie (liste à virgules) :

- `all`   — la moisson complète hebdomadaire (corpus lourd). C'est le
  régime « Mac + dump » : en prod ce job reste éteint tant que le
  corpus vit au rythme des dumps ;
- `calls` — les appels du portail EU Funding & Tenders, quotidiens :
  le régime « fraîcheur légère », le premier job pensé pour le VPS
  (≈ 1 300 topics, quelques minutes, journalisé dans ingestion_runs).

Upserts idempotents et téléchargements cachés : rejouer est bon marché,
et chaque run atterrit au journal quoi qu'il arrive.
"""

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from orion.core.config import get_settings


def _run_source(source: str) -> None:
    from orion.ingest.cli import REGISTRY

    try:
        counts = REGISTRY[source](force=False)
    except Exception as exc:  # noqa: BLE001 — journalisé, jamais silencieux
        print(f"[scheduler] {source} FAILED: {type(exc).__name__}: {exc}", flush=True)
    else:
        summary = ", ".join(f"{k}={v}" for k, v in sorted(counts.items()))
        print(f"[scheduler] {source}: {summary}", flush=True)


def refresh_all_sources() -> None:
    from orion.ingest.cli import ALL

    for source in ALL:
        _run_source(source)


def refresh_calls() -> None:
    _run_source("calls")


def build_scheduler() -> BlockingScheduler:
    settings = get_settings()
    jobs = {j.strip() for j in settings.scheduler_jobs.split(",") if j.strip()}
    unknown = jobs - {"all", "calls"}
    if unknown:
        raise ValueError(f"ORION_SCHEDULER_JOBS inconnus : {sorted(unknown)}")
    scheduler = BlockingScheduler(timezone="UTC")
    if "all" in jobs:
        scheduler.add_job(
            refresh_all_sources,
            CronTrigger.from_crontab(settings.ingest_cron, timezone="UTC"),
            id="scheduled-refresh",
            coalesce=True,
            misfire_grace_time=6 * 3600,
        )
    if "calls" in jobs:
        scheduler.add_job(
            refresh_calls,
            CronTrigger.from_crontab(settings.calls_cron, timezone="UTC"),
            id="calls-refresh",
            coalesce=True,
            misfire_grace_time=6 * 3600,
        )
    if settings.ingest_on_start:
        scheduler.add_job(refresh_all_sources, id="startup-refresh")
    return scheduler


def main() -> None:
    settings = get_settings()
    print(
        f"[scheduler] started — jobs '{settings.scheduler_jobs}', "
        f"cron all '{settings.ingest_cron}' / calls '{settings.calls_cron}' (UTC), "
        f"ingest_on_start={settings.ingest_on_start}",
        flush=True,
    )
    build_scheduler().start()


if __name__ == "__main__":
    main()

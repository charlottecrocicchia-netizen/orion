from apscheduler.triggers.cron import CronTrigger

from orion.scheduler import build_scheduler


def test_scheduler_registers_the_weekly_refresh():
    scheduler = build_scheduler()

    job = scheduler.get_job("scheduled-refresh")
    assert job is not None
    assert isinstance(job.trigger, CronTrigger)
    # Default settings: no ingestion at container start.
    assert scheduler.get_job("startup-refresh") is None

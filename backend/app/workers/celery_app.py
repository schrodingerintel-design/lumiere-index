from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery = Celery("lumiere", broker=settings.redis_url, backend=settings.redis_url)
celery.conf.timezone = "UTC"

celery.conf.beat_schedule = {
    "ingest-reddit": {"task": "app.workers.tasks.ingest_reddit", "schedule": 600.0},
    "ingest-news": {"task": "app.workers.tasks.ingest_news", "schedule": 900.0},
    "ingest-youtube": {"task": "app.workers.tasks.ingest_youtube", "schedule": 1800.0},
    "ingest-tiktok": {"task": "app.workers.tasks.ingest_tiktok", "schedule": 1800.0},
    "ingest-wikipedia": {"task": "app.workers.tasks.ingest_wikipedia", "schedule": 3600.0},
    "ingest-trends": {"task": "app.workers.tasks.ingest_trends", "schedule": 3600.0},
    "ingest-letterboxd": {"task": "app.workers.tasks.ingest_letterboxd", "schedule": 1800.0},
    "ingest-tmdb-catalog": {"task": "app.workers.tasks.ingest_tmdb_catalog", "schedule": 21600.0},
    "discover-candidates": {"task": "app.workers.tasks.discover_candidates", "schedule": 600.0},
    "recompute-rankings": {
        "task": "app.workers.tasks.recompute_rankings",
        "schedule": settings.refresh_interval_minutes * 60.0,
    },
    "rebuild-trending": {"task": "app.workers.tasks.rebuild_trending", "schedule": 1800.0},
    "rollup-daily": {"task": "app.workers.tasks.rollup_daily", "schedule": crontab(minute=0)},
}

import app.workers.tasks  # noqa: E402,F401

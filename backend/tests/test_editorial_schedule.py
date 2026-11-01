from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.services.editorial_schedule import claim_news_window, NEWS_REFRESH_SECONDS
from app.ingest.scheduler import _INTERVALS
from app.workers.celery_app import celery


def test_news_schedulers_wait_72_hours():
    assert NEWS_REFRESH_SECONDS == 259200
    assert _INTERVALS["ingest_news"] == NEWS_REFRESH_SECONDS
    assert celery.conf.beat_schedule["ingest-news"]["schedule"] == NEWS_REFRESH_SECONDS


def test_generation_cooldown_survives_new_session(db_session):
    now = datetime(2026, 11, 1, 12, tzinfo=timezone.utc)
    assert claim_news_window(db_session, now=now) == now + timedelta(hours=72)
    with Session(db_session.get_bind()) as other:
        with pytest.raises(HTTPException) as error:
            claim_news_window(other, now=now + timedelta(hours=71))
        assert error.value.status_code == 429
        assert error.value.headers["Retry-After"] == "3600"
        assert claim_news_window(other, now=now + timedelta(hours=72)) == now + timedelta(hours=144)


def test_failed_attempt_does_not_release_cooldown(db_session):
    now = datetime(2026, 11, 1, 12, tzinfo=timezone.utc)
    claim_news_window(db_session, now=now)
    db_session.rollback()  # A later provider failure cannot undo the committed reservation.
    with pytest.raises(HTTPException):
        claim_news_window(db_session, now=now + timedelta(minutes=1))

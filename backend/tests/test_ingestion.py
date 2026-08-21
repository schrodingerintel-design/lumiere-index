"""Tests for the ingestion pipeline."""
from datetime import datetime

from app.ingest.base import RawMention
from app.ingest.pipeline import ingest_batch
from app.models import Mention, Source


def test_ingest_batch_creates_source(db_session):
    raw = RawMention(
        external_id="e1", text="Test Mickey 17 review", url=None,
        author="tester", engagement=50, created_at=datetime.utcnow(),
    )
    count = ingest_batch(db_session, "custom_source", [raw])
    assert count == 1

    src = db_session.query(Source).filter_by(key="custom_source").first()
    assert src is not None
    assert src.name == "Custom_source"


def test_ingest_batch_deduplicates_by_external_id(db_session):
    raw = RawMention(
        external_id="e2", text="Test Superman review", url=None,
        author="tester", engagement=50, created_at=datetime.utcnow(),
    )
    count1 = ingest_batch(db_session, "dedup_test", [raw])
    count2 = ingest_batch(db_session, "dedup_test", [raw])
    assert count1 == 1
    assert count2 == 0

    total = db_session.query(Mention).count()
    assert total == 1


def test_ingest_batch_skips_unmatched_films(db_session):
    raw = RawMention(
        external_id="e3", text="This talks about nothing relevant",
        url=None, author="tester", engagement=10, created_at=datetime.utcnow(),
    )
    count = ingest_batch(db_session, "skip_test", [raw])
    assert count == 0

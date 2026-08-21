"""Shared ingest pipeline: dedupe, match to film, score sentiment, insert.

Unmatched mentions are no longer dropped — they are queued into
``pending_mentions`` for the discovery pipeline (see ``app/ingest/discovery.py``),
which can create new films from conversation and re-ingest the mention.
"""
import threading
from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Mention, PendingMention, Source
from app.services.matching import FilmMatcher
from app.services.sentiment import score_text
from app.ingest.base import RawMention

_matcher_cache: dict[int, FilmMatcher] = {}
_matcher_lock = threading.Lock()


def _get_matcher(db: Session) -> FilmMatcher:
    """Return a cached FilmMatcher for the current process, keyed by DB identity."""
    db_id = id(db.get_bind())
    with _matcher_lock:
        if db_id not in _matcher_cache:
            _matcher_cache[db_id] = FilmMatcher(db)
        return _matcher_cache[db_id]


def invalidate_matcher_cache() -> None:
    """Drop cached matchers so newly created films become matchable."""
    with _matcher_lock:
        _matcher_cache.clear()


def _ensure_source(db: Session, source_key: str) -> Source:
    src = db.query(Source).filter_by(key=source_key).first()
    if not src:
        src = Source(key=source_key, name=source_key.capitalize(), weight=1.0)
        db.add(src)
        db.commit()
        db.refresh(src)
    return src


def record_ingest(db: Session, source_key: str, error: str | None = None) -> None:
    """Record the outcome of an ingest run on the source row (health endpoint)."""
    src = _ensure_source(db, source_key)
    src.last_ingested_at = datetime.now(timezone.utc)
    if error:
        src.last_error = error[:5000]
        src.last_error_at = datetime.now(timezone.utc)
    else:
        src.last_error = None
        src.last_error_at = None
    db.commit()


def _enqueue_pending(db: Session, src: Source, r: RawMention) -> bool:
    """Queue an unmatched mention for candidate discovery. Returns True if queued."""
    existing = db.query(PendingMention.id).filter_by(source_id=src.id, external_id=r.external_id).first()
    if existing:
        return False
    db.add(PendingMention(
        source_id=src.id,
        external_id=r.external_id,
        url=r.url,
        author=r.author,
        country_code=r.country_code,
        language=r.language,
        text=r.text[:5000],
        engagement=r.engagement,
        created_at=r.created_at,
    ))
    try:
        db.commit()
        return True
    except IntegrityError:
        db.rollback()
        return False


def ingest_batch(db: Session, source_key: str, raws: list[RawMention]) -> int:
    src = _ensure_source(db, source_key)
    matcher = _get_matcher(db)
    inserted = 0
    errors = 0
    for r in raws:
        try:
            fid = matcher.match(r.text)
            if not fid:
                _enqueue_pending(db, src, r)
                continue
            score, label = score_text(r.text)
            m = Mention(
                film_id=fid, source_id=src.id, external_id=r.external_id,
                url=r.url, author=r.author, country_code=r.country_code,
                language=r.language, text=r.text[:5000],
                sentiment_score=score, sentiment_label=label,
                engagement=r.engagement, created_at=r.created_at,
            )
            db.add(m)
            db.commit()
            inserted += 1
        except IntegrityError:
            db.rollback()
        except Exception:
            db.rollback()
            errors += 1

    record_ingest(db, source_key, error=f"{errors} items failed" if errors else None)
    return inserted

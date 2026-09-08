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


def record_ingest_stats(
    db: Session,
    source_key: str,
    *,
    requested: int = 0,
    received: int = 0,
    processed: int = 0,
    rejected: int = 0,
    api_errors: int = 0,
    rate_limit_errors: int = 0,
) -> None:
    """Record per-run ingest counters on the source row (Data/Signal Health).

    Counters are absolute for the run (the adapter reports what it fetched), so
    the health view can distinguish "upstream returned nothing" from "pipeline
    dropped everything".
    """
    src = _ensure_source(db, source_key)
    src.records_requested = max(requested, 0)
    src.records_received = max(received, 0)
    src.records_processed = max(processed, 0)
    src.records_rejected = max(rejected, 0)
    src.api_errors = max(api_errors, 0)
    src.rate_limit_errors = max(rate_limit_errors, 0)
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
    incoming = len(raws)
    rejected = 0
    for r in raws:
        try:
            fid = matcher.match(r.text)
            if not fid:
                # Unmatched mentions are queued for discovery, not dropped — but
                # they ARE rejected by this pipeline step and must count as such.
                _enqueue_pending(db, src, r)
                rejected += 1
                continue
            score, label = score_text(r.text)
            m = Mention(
                film_id=fid, source_id=src.id, external_id=r.external_id,
                url=r.url, author=r.author, country_code=r.country_code,
                language=r.language, text=r.text[:5000],
                sentiment_score=score, sentiment_label=label,
                engagement=r.engagement,
                # Raw observation volume: aggregate sources report the real
                # underlying count; per-item sources default to engagement
                # (one record = one observation).
                observations=(
                    r.observations if r.observations is not None else r.engagement
                ),
                created_at=r.created_at,
            )
            db.add(m)
            db.commit()
            inserted += 1
        except IntegrityError:
            db.rollback()
            rejected += 1  # duplicate external_id — not a new observation
        except Exception:
            db.rollback()
            errors += 1

    rejected += errors
    # Surface the raw API outcome so the health view can distinguish upstream
    # silence from pipeline rejection.
    record_ingest(db, source_key, error=f"{errors} items failed" if errors else None)
    record_ingest_stats(
        db,
        source_key,
        requested=incoming,
        received=incoming,
        processed=inserted,
        rejected=rejected,
        api_errors=errors,
        rate_limit_errors=0,
    )
    return inserted

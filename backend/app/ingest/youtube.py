"""YouTube ingestion adapter using YouTube Data API v3.

Follows the official Source Policy:
- Backend-only YouTube Data API v3 key
- Search is used strictly for initial candidate video discovery
- Discovered video IDs are persisted to avoid repeated search quota burn
- Existing videos refresh stats (views, likes, comments) directly via video stats
- Emits RawMention for content (trailers/videos)
- Emits and ingests RawMetricSnapshot for aggregate metrics:
  view_count, like_count, comment_count, view_velocity, like_rate, comment_rate
- Gracefully handles missing stats, disabled comments/ratings, quota limits (403/429)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from app.config import settings
from app.core.source_policy import is_adapter_permitted, STATUS_DISABLED_CONFIG
from app.ingest.base import RawMention, RawMetricSnapshot, SourceAdapter, SourceHealth
from app.ingest.pipeline import ingest_metric_batch, record_ingest_stats
from app.models.youtube import YouTubeSignal

log = logging.getLogger(__name__)


def fetch_youtube_for_film(
    film_id: int,
    title: str,
    year: Optional[int] = None,
    db: Any | None = None,
) -> tuple[RawMention | None, list[RawMetricSnapshot]]:
    """Query YouTube Data API v3 for official trailer, returning (RawMention, list[RawMetricSnapshot])."""
    from app.services.youtube_service import youtube_service

    if not settings.enable_youtube_adapter or not youtube_service.is_configured:
        return None, []

    from app.db import SessionLocal

    def _get_session():
        if db is not None:
            return db, False
        return SessionLocal(), True

    session, should_close = _get_session()
    try:
        # Step 1: Check if we already have a persisted video_id for this film
        existing_signal = session.query(YouTubeSignal).filter_by(film_id=film_id).first()
        now = datetime.now(timezone.utc)
        stats = None

        if existing_signal and existing_signal.video_id:
            # Refresh statistics directly without re-searching
            try:
                stats = youtube_service.get_video_stats(
                    existing_signal.video_id,
                    video_title=existing_signal.video_title,
                    channel_title=existing_signal.channel_title,
                    confidence=existing_signal.confidence,
                    is_official=existing_signal.is_official,
                )
            except Exception as e:
                log.warning("youtube.refresh_stats_failed", video_id=existing_signal.video_id, error=str(e))
                stats = None

        if not stats:
            # Search candidate video only if no existing valid stats
            try:
                match = youtube_service.search_trailer(title, year)
                if match:
                    stats = youtube_service.get_video_stats(
                        match.video_id,
                        video_title=match.video_title,
                        channel_title=match.channel_title,
                        confidence=match.confidence,
                        is_official=match.is_official,
                    )
            except Exception as e:
                log.warning("youtube.search_failed", title=title, error=str(e))
                return None, []

        if not stats:
            return None, []

        # Step 2: Compute delta-based view velocity if previous measurement exists
        # view_velocity = (current_views - previous_views) / elapsed_hours
        view_velocity = stats.view_velocity
        if existing_signal and existing_signal.fetched_at:
            prev_fetched = existing_signal.fetched_at.replace(tzinfo=timezone.utc) if existing_signal.fetched_at.tzinfo is None else existing_signal.fetched_at
            elapsed_hours = max((now - prev_fetched).total_seconds() / 3600.0, 0.01)
            if stats.view_count >= existing_signal.view_count:
                view_velocity = (stats.view_count - existing_signal.view_count) / elapsed_hours
            else:
                view_velocity = stats.view_velocity

        like_rate = stats.like_count / max(stats.view_count, 1)
        comment_rate = stats.comment_count / max(stats.view_count, 1)

        # Step 3: Persist or update YouTubeSignal
        if existing_signal:
            existing_signal.view_count = stats.view_count
            existing_signal.like_count = stats.like_count
            existing_signal.comment_count = stats.comment_count
            existing_signal.view_velocity = view_velocity
            existing_signal.confidence = stats.confidence
            existing_signal.is_official = stats.is_official
            existing_signal.fetched_at = now
        else:
            session.add(YouTubeSignal(
                film_id=film_id,
                video_id=stats.video_id,
                video_title=stats.video_title,
                channel_title=stats.channel_title,
                view_count=stats.view_count,
                like_count=stats.like_count,
                comment_count=stats.comment_count,
                published_at=stats.published_at,
                view_velocity=view_velocity,
                confidence=stats.confidence,
                is_official=stats.is_official,
                fetched_at=now,
            ))
        session.commit()

        # Step 4: Build content RawMention
        engagement = stats.like_count * 3 + stats.comment_count * 5 + stats.view_count // 100
        year_str = f"({year})" if year else ""
        mention = RawMention(
            external_id=f"youtube_{film_id}_{stats.video_id}",
            text=(
                f"{title} {year_str} official trailer on YouTube ({stats.channel_title}). "
                f"{stats.view_count:,} views, {stats.like_count:,} likes, {stats.comment_count:,} comments."
            ),
            url=f"https://youtube.com/watch?v={stats.video_id}",
            author=stats.channel_title or "youtube_official",
            language="en",
            engagement=engagement,
            observations=stats.view_count,
            created_at=stats.published_at or now,
        )

        # Step 5: Build aggregate RawMetricSnapshots
        video_url = f"https://youtube.com/watch?v={stats.video_id}"
        metric_snapshots = [
            RawMetricSnapshot(
                source_id="youtube",
                external_id=f"yt_{stats.video_id}_views",
                film_id=film_id,
                metric_type="view_count",
                value=float(stats.view_count),
                observed_at=now,
                observations=stats.view_count,
                source_url=video_url,
                attribution="YouTube Data API v3",
            ),
            RawMetricSnapshot(
                source_id="youtube",
                external_id=f"yt_{stats.video_id}_likes",
                film_id=film_id,
                metric_type="like_count",
                value=float(stats.like_count),
                observed_at=now,
                observations=stats.like_count,
                source_url=video_url,
                attribution="YouTube Data API v3",
            ),
            RawMetricSnapshot(
                source_id="youtube",
                external_id=f"yt_{stats.video_id}_comments",
                film_id=film_id,
                metric_type="comment_count",
                value=float(stats.comment_count),
                observed_at=now,
                observations=stats.comment_count,
                source_url=video_url,
                attribution="YouTube Data API v3",
            ),
            RawMetricSnapshot(
                source_id="youtube",
                external_id=f"yt_{stats.video_id}_velocity",
                film_id=film_id,
                metric_type="view_velocity",
                value=float(view_velocity),
                observed_at=now,
                source_url=video_url,
                attribution="YouTube Data API v3",
            ),
            RawMetricSnapshot(
                source_id="youtube",
                external_id=f"yt_{stats.video_id}_likerate",
                film_id=film_id,
                metric_type="like_rate",
                value=float(like_rate),
                observed_at=now,
                source_url=video_url,
                attribution="YouTube Data API v3",
            ),
            RawMetricSnapshot(
                source_id="youtube",
                external_id=f"yt_{stats.video_id}_commentrate",
                film_id=film_id,
                metric_type="comment_rate",
                value=float(comment_rate),
                observed_at=now,
                source_url=video_url,
                attribution="YouTube Data API v3",
            ),
        ]

        return mention, metric_snapshots

    finally:
        if should_close:
            session.close()


def fetch_youtube(
    film_titles: list[tuple[int, str, Optional[int]]],
    db: Any | None = None,
) -> list[RawMention]:
    """Main entry point called by tasks and scheduler."""
    from app.services.youtube_service import youtube_service

    if not settings.enable_youtube_adapter or not youtube_service.is_configured:
        return []

    mentions: list[RawMention] = []
    all_metrics: list[RawMetricSnapshot] = []

    # Limit films processed per run to respect configured batch limits
    max_items = settings.source_max_items_per_run
    for tup in film_titles[:max_items]:
        film_id, title, year = tup[:3]
        try:
            mention, snapshots = fetch_youtube_for_film(film_id, title, year, db=db)
            if mention:
                mentions.append(mention)
            if snapshots:
                all_metrics.extend(snapshots)
        except Exception as exc:
            log.warning("youtube.fetch.error", title=title, error=str(exc))

    # Ingest metric snapshots directly into metric_snapshots table
    if all_metrics and db is not None:
        try:
            ingest_metric_batch(db, "youtube", all_metrics)
        except Exception as e:
            log.warning("youtube.metrics_ingest_failed", error=str(e))

    return mentions


class YouTubeAdapter(SourceAdapter):
    """SourceAdapter implementation for YouTube Data API v3."""
    source_key = "youtube"

    def collect(self, since: datetime | None = None) -> list[RawMention]:
        from app.db import SessionLocal
        from app.models import Film

        with SessionLocal() as db:
            films = db.query(Film.id, Film.title, Film.year).all()
            film_tuples = [(f.id, f.title, f.year) for f in films]
            return fetch_youtube(film_tuples, db=db)

    def health(self) -> SourceHealth:
        from app.services.youtube_service import youtube_service, QuotaGuard
        from app.db import SessionLocal
        from app.models import Source

        if not settings.enable_youtube_adapter:
            return SourceHealth(source_key=self.source_key, status=STATUS_DISABLED_CONFIG)

        if not youtube_service.is_configured:
            return SourceHealth(source_key=self.source_key, status="no_credentials")

        daily_usage = QuotaGuard.get_daily_usage()
        status = "ok"
        if not QuotaGuard.can_consume(1):
            status = "quota_exhausted"

        with SessionLocal() as db:
            src = db.query(Source).filter_by(key=self.source_key).first()
            if src:
                return SourceHealth(
                    source_key=self.source_key,
                    status=status,
                    records_requested=src.records_requested,
                    records_received=src.records_received,
                    records_processed=src.records_processed,
                    records_rejected=src.records_rejected,
                    api_errors=src.api_errors,
                    rate_limit_errors=src.rate_limit_errors,
                    last_run=src.last_ingested_at,
                    last_error=src.last_error,
                )

        return SourceHealth(source_key=self.source_key, status=status)

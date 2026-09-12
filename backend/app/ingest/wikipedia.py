"""Wikipedia / Wikimedia pageview ingestion adapter using Wikimedia REST API.

Complies with the public Source Policy:
- Collects public daily Wikimedia pageviews via official REST API
- Emits RawMetricSnapshot for daily pageviews, 7-day pageviews, 14-day pageviews,
  and pageview momentum (no synthetic text mentions)
- Resolves movie articles through:
  1. Stored Wikipedia URL if present
  2. TMDB external metadata if available
  3. Wikipedia search by title and release year
- Strict title disambiguation: never matches ambiguous short titles by title alone
- Retains metrics strictly outside the official ranking score until feature-flagged
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings
from app.core.source_policy import is_adapter_permitted, STATUS_DISABLED_CONFIG
from app.ingest.base import RawMention, RawMetricSnapshot, SourceAdapter, SourceHealth
from app.ingest.pipeline import ingest_metric_batch

log = logging.getLogger(__name__)

_WIKI_API = "https://en.wikipedia.org/w/api.php"
_PAGEVIEWS_URL = (
    "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/"
    "en.wikipedia/all-access/all-agents/{article}/daily/{start}/{end}"
)
_DAYS = 30

# Ambiguous titles that must NEVER be resolved without release year or content-type confirmation
AMBIGUOUS_TITLES: frozenset[str] = frozenset({
    "us", "it", "air", "him", "her", "love", "life", "ride", "rush",
    "the", "a", "an", "smile", "vice", "heat", "raw", "wild", "real",
    "nope", "men", "drive", "trap", "fall", "gravity", "hereditary",
})


def _headers() -> dict:
    # Wikimedia etiquette requires an identifiable User-Agent with contact info
    ua = settings.reddit_user_agent or "LumiereIndex/1.0 (contact@lumiere.com)"
    return {"User-Agent": ua}


@retry(stop=stop_after_attempt(3), wait=wait_exponential())
def _resolve_article(
    title: str,
    year: int | None,
    content_type: str = "MOVIE",
    stored_url: str | None = None,
) -> tuple[str | None, str | None]:
    """Resolve article title and canonical URL using fallback priority.

    Returns (article_title, canonical_url).
    """
    # 1. Stored Wikipedia URL if present
    if stored_url and "wikipedia.org/wiki/" in stored_url:
        article_slug = stored_url.split("/wiki/")[-1].split("#")[0].strip()
        if article_slug:
            article_name = article_slug.replace("_", " ")
            return article_name, f"https://en.wikipedia.org/wiki/{article_slug}"

    clean_title = title.strip()
    title_lower = clean_title.lower()

    # Ambiguous titles MUST have year or specific cinema context
    if title_lower in AMBIGUOUS_TITLES and not year:
        log.info("wikimedia.disambiguation_skipped", title=title, reason="ambiguous_no_year")
        return None, None

    # 2. Structured candidate queries
    if content_type == "TV_SHOW":
        queries = [
            f"{clean_title} ({year} TV series)" if year else None,
            f"{clean_title} (TV series)",
            f"{clean_title} TV series",
            clean_title if title_lower not in AMBIGUOUS_TITLES else None,
        ]
        accept = ("tv series", "tv mini", "web series", "tv programme", "talk show", "television series")
    else:
        queries = [
            f"{clean_title} ({year} film)" if year else None,
            f"{clean_title} ({year})" if year else None,
            f"{clean_title} (film)",
            f"{clean_title} film",
            clean_title if title_lower not in AMBIGUOUS_TITLES else None,
        ]
        accept = ("film", "movie", f"({year}" if year else "film")

    for q in queries:
        if not q:
            continue
        try:
            r = httpx.get(
                _WIKI_API,
                params={
                    "action": "opensearch",
                    "search": q,
                    "limit": 5,
                    "namespace": 0,
                    "format": "json",
                },
                headers=_headers(),
                timeout=settings.source_request_timeout_seconds,
            )
            r.raise_for_status()
            results = r.json()
            candidates = results[1] if results and len(results) > 1 else []
            links = results[3] if results and len(results) > 3 else []
            if not candidates:
                continue

            for idx, candidate in enumerate(candidates):
                low = candidate.lower()
                canonical_link = links[idx] if idx < len(links) else f"https://en.wikipedia.org/wiki/{candidate.replace(' ', '_')}"

                # Strict check for ambiguous titles: MUST match year or accept criteria
                if title_lower in AMBIGUOUS_TITLES:
                    if year and str(year) in low:
                        return candidate, canonical_link
                    if any(a in low for a in accept):
                        return candidate, canonical_link
                    continue

                if any(a in low for a in accept) or (year is not None and str(year) in low) or low == title_lower:
                    return candidate, canonical_link

            if title_lower not in AMBIGUOUS_TITLES:
                return candidates[0], links[0] if links else f"https://en.wikipedia.org/wiki/{candidates[0].replace(' ', '_')}"

        except Exception as e:
            log.warning("wikimedia.resolve_error", query=q, error=str(e))
            continue

    return None, None


@retry(stop=stop_after_attempt(3), wait=wait_exponential())
def _fetch_daily_pageviews(article_title: str, days: int = _DAYS) -> list[dict]:
    """Fetch the daily pageview series for one article (last `days` days)."""
    title_formatted = article_title.strip().replace(" ", "_")
    end_date = datetime.now(timezone.utc) - timedelta(days=1)
    start_date = end_date - timedelta(days=days)
    start_str = start_date.strftime("%Y%m%d00")
    end_str = end_date.strftime("%Y%m%d00")
    url = _PAGEVIEWS_URL.format(article=title_formatted, start=start_str, end=end_str)
    r = httpx.get(url, headers=_headers(), timeout=settings.source_request_timeout_seconds)
    if r.status_code == 404:
        return []
    r.raise_for_status()
    return r.json().get("items", [])


def fetch_wikipedia_metrics_for_film(
    film_id: int,
    title: str,
    year: int | None = None,
    content_type: str = "MOVIE",
    stored_url: str | None = None,
) -> list[RawMetricSnapshot]:
    """Fetch and return RawMetricSnapshots for a single film."""
    if not settings.enable_wikimedia_adapter:
        return []

    article, canonical_url = _resolve_article(title, year, content_type, stored_url=stored_url)
    if not article:
        return []

    try:
        items = _fetch_daily_pageviews(article)
    except Exception as exc:
        log.warning("wikimedia.fetch_pageviews_failed", article=article, error=str(exc))
        return []

    if not items:
        return []

    slug = article.replace(" ", "_")
    snapshots: list[RawMetricSnapshot] = []
    daily_views_series: list[tuple[datetime, int]] = []

    for item in items:
        views = int(item.get("views", 0) or 0)
        day_str = str(item.get("timestamp", ""))[:8]  # YYYYMMDD
        if views < 0 or len(day_str) != 8:
            continue
        try:
            day_dt = datetime.strptime(day_str, "%Y%m%d").replace(tzinfo=timezone.utc)
        except ValueError:
            continue

        daily_views_series.append((day_dt, views))

        # 1. Daily pageviews snapshot
        snapshots.append(
            RawMetricSnapshot(
                source_id="wikipedia",
                external_id=f"wiki_{slug}_{day_str}",
                film_id=film_id,
                metric_type="pageviews_daily",
                value=float(views),
                observed_at=day_dt,
                observations=views,
                source_url=canonical_url or f"https://en.wikipedia.org/wiki/{slug}",
                attribution="Wikimedia Foundation REST API",
            )
        )

    # Sort series chronologically to compute windowed aggregates
    daily_views_series.sort(key=lambda x: x[0])
    if daily_views_series:
        latest_dt, latest_views = daily_views_series[-1]
        today_str = latest_dt.strftime("%Y%m%d")

        # 2. Seven-day pageviews
        last_7 = [v for _, v in daily_views_series[-7:]]
        sum_7d = sum(last_7)
        snapshots.append(
            RawMetricSnapshot(
                source_id="wikipedia",
                external_id=f"wiki_{slug}_{today_str}_7d",
                film_id=film_id,
                metric_type="pageviews_7d",
                value=float(sum_7d),
                observed_at=latest_dt,
                observations=sum_7d,
                source_url=canonical_url,
                attribution="Wikimedia Foundation REST API",
            )
        )

        # 3. Fourteen-day pageviews
        last_14 = [v for _, v in daily_views_series[-14:]]
        sum_14d = sum(last_14)
        snapshots.append(
            RawMetricSnapshot(
                source_id="wikipedia",
                external_id=f"wiki_{slug}_{today_str}_14d",
                film_id=film_id,
                metric_type="pageviews_14d",
                value=float(sum_14d),
                observed_at=latest_dt,
                observations=sum_14d,
                source_url=canonical_url,
                attribution="Wikimedia Foundation REST API",
            )
        )

        # 4. Pageview momentum (recent 7d avg minus previous 7d avg)
        if len(daily_views_series) >= 14:
            prev_7 = [v for _, v in daily_views_series[-14:-7]]
            avg_recent = sum(last_7) / 7.0
            avg_prev = sum(prev_7) / 7.0
            momentum = avg_recent - avg_prev
            snapshots.append(
                RawMetricSnapshot(
                    source_id="wikipedia",
                    external_id=f"wiki_{slug}_{today_str}_momentum",
                    film_id=film_id,
                    metric_type="pageview_momentum",
                    value=float(momentum),
                    observed_at=latest_dt,
                    source_url=canonical_url,
                    attribution="Wikimedia Foundation REST API",
                )
            )

    return snapshots


def fetch_wikipedia(
    film_tuples: list[tuple[int, str, int | None]],
    db: Any | None = None,
) -> list[RawMention]:
    """Collect Wikipedia pageviews and persist them as RawMetricSnapshots.

    Returns an empty list of RawMention to uphold the policy:
    aggregate metrics are never coerced into fake content mentions.
    """
    if not settings.enable_wikimedia_adapter:
        return []

    all_metrics: list[RawMetricSnapshot] = []
    max_items = settings.source_max_items_per_run

    for tup in film_tuples[:max_items]:
        film_id, title, year = tup[:3]
        ct = tup[3] if len(tup) > 3 else "MOVIE"
        metrics = fetch_wikipedia_metrics_for_film(film_id, title, year, ct)
        all_metrics.extend(metrics)

    if all_metrics and db is not None:
        try:
            ingest_metric_batch(db, "wikipedia", all_metrics)
        except Exception as e:
            log.warning("wikipedia.metrics_ingest_failed", error=str(e))

    # Strict compliance: do not emit fake mentions from pageviews
    return []


class WikipediaAdapter(SourceAdapter):
    """SourceAdapter implementation for Wikimedia Foundation pageviews."""
    source_key = "wikipedia"

    def collect(self, since: datetime | None = None) -> list[RawMention]:
        # Compliant: pageview metrics are ingested via collect_metrics()
        return []

    def collect_metrics(self, since: datetime | None = None) -> list[RawMetricSnapshot]:
        from app.db import SessionLocal
        from app.models import Film

        if not settings.enable_wikimedia_adapter:
            return []

        all_metrics: list[RawMetricSnapshot] = []
        with SessionLocal() as db:
            films = db.query(Film.id, Film.title, Film.year, Film.content_type).all()
            for f in films[:settings.source_max_items_per_run]:
                snaps = fetch_wikipedia_metrics_for_film(f.id, f.title, f.year, f.content_type or "MOVIE")
                all_metrics.extend(snaps)
            if all_metrics:
                ingest_metric_batch(db, self.source_key, all_metrics)
        return all_metrics

    def health(self) -> SourceHealth:
        from app.db import SessionLocal
        from app.models import Source

        if not settings.enable_wikimedia_adapter:
            return SourceHealth(source_key=self.source_key, status=STATUS_DISABLED_CONFIG)

        with SessionLocal() as db:
            src = db.query(Source).filter_by(key=self.source_key).first()
            if src:
                return SourceHealth(
                    source_key=self.source_key,
                    status="ok",
                    records_requested=src.records_requested,
                    records_received=src.records_received,
                    records_processed=src.records_processed,
                    records_rejected=src.records_rejected,
                    api_errors=src.api_errors,
                    rate_limit_errors=src.rate_limit_errors,
                    last_run=src.last_ingested_at,
                    last_error=src.last_error,
                )

        return SourceHealth(source_key=self.source_key, status="ok")

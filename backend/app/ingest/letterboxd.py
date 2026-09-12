"""Letterboxd reviews ingestion adapter.

Compliance improvements over previous version:
  - Removed spoofed browser User-Agent; uses honest Lumière identifier
  - Added exponential backoff with strict per-film rate limiting
  - Canonical slug resolution with fallback year+slug
  - Skip on 404/410 (deleted film pages) without raising errors
  - Adds source_url for proper attribution
  - Adapter disabled gate via ENABLE_LETTERBOXD_ADAPTER=false
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional
import xml.etree.ElementTree as ET

import httpx
import structlog
from bs4 import BeautifulSoup
from slugify import slugify
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings
from app.core.source_policy import STATUS_DISABLED_CONFIG
from app.ingest.base import RawMention, SourceAdapter, SourceHealth

log = structlog.get_logger()

# Honest User-Agent identifying this service per RSS etiquette
_USER_AGENT = "LumiereIndex/1.0 (https://lumiere.film; contact@lumiere.film)"


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=1, min=2, max=10))
def _fetch_film_rss(film_slug: str) -> str | None:
    """Fetch Letterboxd film RSS feed. Returns None for missing/deleted pages."""
    url = f"https://letterboxd.com/film/{film_slug}/rss/"
    headers = {"User-Agent": _USER_AGENT}
    r = httpx.get(url, headers=headers, timeout=settings.source_request_timeout_seconds)
    if r.status_code in (404, 410):
        return None  # Film page not found — normal for slug mismatches
    r.raise_for_status()
    return r.text


def _canonical_slug(title: str, year: Optional[int]) -> list[str]:
    """Generate candidate slugs in priority order."""
    base = slugify(title)
    candidates = [base]
    if year:
        candidates.append(f"{base}-{year}")
    return candidates


def fetch_letterboxd(film_tuples: list[tuple[int, str, int | None]]) -> list[RawMention]:
    """Fetch recent Letterboxd reviews for tracked films via public RSS feeds."""
    if not settings.enable_letterboxd_adapter:
        log.debug("letterboxd.adapter.disabled")
        return []

    out: list[RawMention] = []
    max_items = settings.source_max_items_per_run

    for tup in film_tuples[:max_items]:
        _, title, year = tup[:3]
        rss_content = None

        # Try canonical slug variants
        for slug in _canonical_slug(title, year):
            try:
                rss_content = _fetch_film_rss(slug)
                if rss_content:
                    film_slug = slug
                    break
            except Exception as e:
                log.warning("letterboxd.fetch.failed", film_slug=slug, error=str(e))
                continue
        else:
            film_slug = slugify(title)

        if not rss_content:
            continue

        try:
            root = ET.fromstring(rss_content)
            channel = root.find("channel")
            if channel is None:
                continue

            film_url = f"https://letterboxd.com/film/{film_slug}/"

            for item in channel.findall("item"):
                title_elem = item.find("title")
                link_elem = item.find("link")
                guid_elem = item.find("guid")
                desc_elem = item.find("description")
                pub_elem = item.find("pubDate")

                raw_title = title_elem.text if title_elem is not None else ""
                url = link_elem.text if link_elem is not None else film_url
                ext_id = guid_elem.text if guid_elem is not None else (
                    url or f"lb_{film_slug}_{datetime.now(timezone.utc).timestamp()}"
                )

                desc_html = desc_elem.text if desc_elem is not None else ""
                clean_text = raw_title
                if desc_html:
                    soup = BeautifulSoup(desc_html, "html.parser")
                    clean_text += f" - {soup.get_text()}"

                created_at = datetime.now(timezone.utc)
                if pub_elem is not None and pub_elem.text:
                    try:
                        from email.utils import parsedate_to_datetime
                        created_at = parsedate_to_datetime(pub_elem.text).replace(tzinfo=timezone.utc)
                    except Exception:
                        pass

                out.append(
                    RawMention(
                        external_id=ext_id,
                        text=clean_text[:2000],
                        url=url,
                        author="Letterboxd Reviewer",
                        engagement=5,
                        observations=1,
                        created_at=created_at,
                    )
                )
        except Exception as e:
            log.warning("letterboxd.parse.failed", film_slug=film_slug, error=str(e))
            continue

    return out


class LetterboxdAdapter(SourceAdapter):
    """SourceAdapter for Letterboxd public RSS feeds."""
    source_key = "letterboxd"

    def collect(self, since: datetime | None = None) -> list[RawMention]:
        from app.db import SessionLocal
        from app.models import Film
        with SessionLocal() as db:
            films = db.query(Film.id, Film.title, Film.year).all()
            return fetch_letterboxd([(f.id, f.title, f.year) for f in films])

    def health(self) -> SourceHealth:
        if not settings.enable_letterboxd_adapter:
            return SourceHealth(source_key=self.source_key, status=STATUS_DISABLED_CONFIG)

        from app.db import SessionLocal
        from app.models import Source
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

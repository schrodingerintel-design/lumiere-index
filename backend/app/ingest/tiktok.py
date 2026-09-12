"""TikTok adapter — policy-disabled stub.

The previous implementation used an unapproved third-party RapidAPI scraper
proxy (tiktok-api28, tiktok-scraper7) which:
  - Has no official TikTok API authorization
  - Violates TikTok's automated scraping terms of service
  - Was non-functional (no RAPIDAPI_KEY was ever configured)
  - Used a hardcoded API base URL that didn't match the configured host

Per the Source Policy (app/core/source_policy.py), this adapter is permanently
disabled. Status: 'disabled_access_policy'.

If TikTok grants official API access in the future, implement a compliant
adapter using the TikTok Research API (research.tiktok.com) with proper
OAuth credentials and honor all TikTok data retention and deletion signals.

Manual CSV import is provided as the safe alternative for lawfully collected
TikTok analytics exports (e.g., from TikTok Business Center dashboards).
"""
from __future__ import annotations

import csv
import io
import logging
from datetime import datetime, timezone
from typing import Optional

from app.config import settings
from app.core.source_policy import STATUS_DISABLED_ACCESS_POLICY
from app.ingest.base import RawMention, SourceAdapter, SourceHealth

log = logging.getLogger(__name__)


def fetch_tiktok(film_titles: list[tuple[int, str, Optional[int]]]) -> list[RawMention]:
    """Entry point stub — always returns empty, adapter is policy-disabled.

    Previous implementation used an unauthorized scraper proxy:
    https://tiktok-api28.p.rapidapi.com (no official TikTok authorization).
    This is permanently disabled per the Source Policy.
    """
    if not settings.enable_tiktok_adapter:
        log.debug("tiktok.adapter.disabled_access_policy")
        return []

    # Even if somehow force-enabled, there is no compliant implementation.
    # Do not attempt unapproved access.
    log.warning(
        "tiktok.adapter.no_compliant_impl",
        msg="TikTok adapter was enabled but has no approved API access. "
            "Configure TikTok Research API credentials or use manual CSV import."
    )
    return []


def fetch_tiktok_for_film(
    film_id: int,
    title: str,
    year: Optional[int] = None,
) -> RawMention | None:
    """Single-film stub — always returns None."""
    return None


def ingest_from_csv(csv_content: str, film_id: int, title: str) -> list[RawMention]:
    """Parse a TikTok Business Center analytics CSV export into RawMentions.

    This is the approved manual import path. Export the CSV from:
      TikTok Business Center → Analytics → Content → Export.

    Expected CSV columns (at minimum): date, video_views, likes, comments, shares.
    Columns are matched case-insensitively; missing columns default to 0.

    Args:
        csv_content: Raw CSV string from TikTok analytics export.
        film_id: Film ID to associate with.
        title: Film title for the mention text.

    Returns:
        List of RawMentions with observations=video_views and engagement weighted.
    """
    out: list[RawMention] = []
    try:
        reader = csv.DictReader(io.StringIO(csv_content))
        for row in reader:
            # Case-insensitive key lookup
            row_lower = {k.lower().strip(): v for k, v in row.items()}

            date_str = row_lower.get("date", "").strip()
            views = int(row_lower.get("video_views", 0) or 0)
            likes = int(row_lower.get("likes", 0) or 0)
            comments = int(row_lower.get("comments", 0) or 0)
            shares = int(row_lower.get("shares", 0) or 0)

            if not date_str or views <= 0:
                continue

            try:
                # Support YYYY-MM-DD and MM/DD/YYYY formats
                for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y"):
                    try:
                        obs_dt = datetime.strptime(date_str, fmt).replace(tzinfo=timezone.utc)
                        break
                    except ValueError:
                        continue
                else:
                    continue
            except Exception:
                continue

            engagement = likes * 2 + comments * 4 + shares * 3 + views // 500
            out.append(RawMention(
                external_id=f"tiktok_csv_{film_id}_{date_str}",
                text=(
                    f"{title} TikTok analytics (manual export) for {date_str}: "
                    f"{views:,} views, {likes:,} likes, {comments:,} comments."
                ),
                url=None,
                author="tiktok_manual_export",
                language="en",
                engagement=max(engagement, 1),
                observations=views,
                created_at=obs_dt,
            ))
    except Exception as exc:
        log.error("tiktok.csv_import.failed", error=str(exc))

    return out


class TikTokAdapter(SourceAdapter):
    """Disabled SourceAdapter stub for TikTok.

    Status: disabled_access_policy — unauthorized scraper removed.
    Compliant alternative: manual CSV import via ingest_from_csv().
    """
    source_key = "tiktok"

    def collect(self, since: datetime | None = None) -> list[RawMention]:
        return []

    def health(self) -> SourceHealth:
        return SourceHealth(
            source_key=self.source_key,
            status=STATUS_DISABLED_ACCESS_POLICY,
            last_error=(
                "Adapter disabled: previous implementation used an unapproved "
                "third-party scraper proxy (tiktok-api28.p.rapidapi.com) with no official "
                "TikTok API authorization. Use manual CSV import for lawfully collected data."
            ),
        )

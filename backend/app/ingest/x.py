"""X / Twitter ingestion adapter — permanently disabled stub.

Status: disabled_access_policy

X (formerly Twitter) strictly prohibits automated collection via:
  - Unauthenticated scraping of the public website (ToS §4)
  - Unofficial proxy APIs or web scraping wrappers
  - Account credential sharing or rotation to bypass limits
  - Browser automation targeting x.com

X API v2 access (the compliant path) requires:
  - Developer account approval at developer.x.com
  - A paid Basic or Pro API tier for search functionality ($100–$5000/month)
  - OAuth 1.0a or OAuth 2.0 (Bearer Token) with project-level credentials
  - Data storage and deletion signal compliance per X Developer Policy

This stub can be replaced with a compliant X API v2 implementation
if official credentials and a paid plan are in place. Until then,
a manual CSV import from X Analytics is provided as the safe alternative.
"""
from __future__ import annotations

import csv
import io
import logging
from datetime import datetime, timezone
from typing import Optional

from app.core.source_policy import STATUS_DISABLED_ACCESS_POLICY
from app.ingest.base import RawMention, SourceAdapter, SourceHealth

log = logging.getLogger(__name__)


def fetch_x(film_titles: list[tuple]) -> list[RawMention]:
    """Policy-disabled stub — always returns empty list."""
    log.debug("x.adapter.disabled_access_policy")
    return []


def ingest_from_csv(csv_content: str, film_id: int, title: str) -> list[RawMention]:
    """Parse an X Analytics or X Ads Manager CSV export into RawMentions.

    Export from: analytics.x.com → Tweets → Export data.

    Expected columns: date, impressions, engagements, likes, replies, retweets.
    """
    out: list[RawMention] = []
    try:
        reader = csv.DictReader(io.StringIO(csv_content))
        for row in reader:
            row_lower = {k.lower().strip(): v for k, v in row.items()}

            date_str = row_lower.get("date", "").strip()
            impressions = int(row_lower.get("impressions", 0) or 0)
            likes = int(row_lower.get("likes", row_lower.get("favorites", 0)) or 0)
            replies = int(row_lower.get("replies", 0) or 0)
            retweets = int(row_lower.get("retweets", row_lower.get("repost count", 0)) or 0)

            if not date_str or impressions <= 0:
                continue

            try:
                for fmt in ("%Y-%m-%d", "%m/%d/%Y"):
                    try:
                        obs_dt = datetime.strptime(date_str, fmt).replace(tzinfo=timezone.utc)
                        break
                    except ValueError:
                        continue
                else:
                    continue
            except Exception:
                continue

            engagement = likes * 2 + replies * 4 + retweets * 3 + impressions // 500
            out.append(RawMention(
                external_id=f"x_csv_{film_id}_{date_str}",
                text=(
                    f"{title} X/Twitter analytics (manual export) for {date_str}: "
                    f"{impressions:,} impressions, {likes:,} likes, {replies:,} replies."
                ),
                url=None,
                author="x_manual_export",
                language="en",
                engagement=max(engagement, 1),
                observations=impressions,
                created_at=obs_dt,
            ))
    except Exception as exc:
        log.error("x.csv_import.failed", error=str(exc))
    return out


class XAdapter(SourceAdapter):
    """Disabled SourceAdapter stub for X / Twitter."""
    source_key = "x"

    def collect(self, since: datetime | None = None) -> list[RawMention]:
        return []

    def health(self) -> SourceHealth:
        return SourceHealth(
            source_key=self.source_key,
            status=STATUS_DISABLED_ACCESS_POLICY,
            last_error=(
                "X adapter is permanently disabled. "
                "X API v2 requires a paid developer plan and approved credentials at developer.x.com. "
                "Use manual CSV import from X Analytics as an alternative."
            ),
        )

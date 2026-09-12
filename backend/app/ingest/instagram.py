"""Instagram ingestion adapter — permanently disabled stub.

Status: disabled_access_policy

Instagram (Meta) strictly prohibits automated data collection via:
  - Automation using the public website (ToS §3.2, §3.13)
  - Unauthenticated scraping
  - Unofficial proxy APIs
  - Account credential sharing / rotation

Meta's Graph API access requires:
  - A registered Meta App with business verification
  - An approved Instagram Basic Display or Instagram Graph API integration
  - User OAuth consent for each profile accessed
  - Data use agreements and privacy policy approval

This stub can be replaced with a compliant Graph API implementation
if official access is granted. Until then, a manual CSV import
from Meta Business Suite analytics is provided as the safe alternative.
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


def fetch_instagram(film_titles: list[tuple]) -> list[RawMention]:
    """Policy-disabled stub — always returns empty list."""
    log.debug("instagram.adapter.disabled_access_policy")
    return []


def ingest_from_csv(csv_content: str, film_id: int, title: str) -> list[RawMention]:
    """Parse a Meta Business Suite / Instagram Insights CSV export into RawMentions.

    Export from: Instagram Creator Studio → Insights → Export Data.

    Expected columns: date, reach, impressions, likes, comments, saves.
    """
    out: list[RawMention] = []
    try:
        reader = csv.DictReader(io.StringIO(csv_content))
        for row in reader:
            row_lower = {k.lower().strip(): v for k, v in row.items()}

            date_str = row_lower.get("date", "").strip()
            reach = int(row_lower.get("reach", 0) or 0)
            impressions = int(row_lower.get("impressions", 0) or 0)
            likes = int(row_lower.get("likes", 0) or 0)
            comments = int(row_lower.get("comments", 0) or 0)

            if not date_str or (reach <= 0 and impressions <= 0):
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

            engagement = likes * 2 + comments * 4 + reach // 200
            out.append(RawMention(
                external_id=f"instagram_csv_{film_id}_{date_str}",
                text=(
                    f"{title} Instagram analytics (manual export) for {date_str}: "
                    f"{reach:,} reach, {impressions:,} impressions, {likes:,} likes."
                ),
                url=None,
                author="instagram_manual_export",
                language="en",
                engagement=max(engagement, 1),
                observations=impressions,
                created_at=obs_dt,
            ))
    except Exception as exc:
        log.error("instagram.csv_import.failed", error=str(exc))
    return out


class InstagramAdapter(SourceAdapter):
    """Disabled SourceAdapter stub for Instagram."""
    source_key = "instagram"

    def collect(self, since: datetime | None = None) -> list[RawMention]:
        return []

    def health(self) -> SourceHealth:
        return SourceHealth(
            source_key=self.source_key,
            status=STATUS_DISABLED_ACCESS_POLICY,
            last_error=(
                "Instagram adapter is permanently disabled. "
                "Meta Graph API requires business verification and app approval. "
                "Use manual CSV import from Meta Business Suite as an alternative."
            ),
        )

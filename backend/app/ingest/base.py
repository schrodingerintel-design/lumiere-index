from dataclasses import dataclass
from datetime import datetime


@dataclass
class RawMention:
    external_id: str
    text: str
    url: str | None = None
    author: str | None = None
    country_code: str | None = None
    language: str | None = None
    engagement: int = 0
    # Raw underlying observations this record aggregates (views, pageviews,
    # search-interest units). Defaults to None → pipeline stores `engagement`
    # for per-item sources (1 record = 1 observation) and the adapter's real
    # count for aggregate sources.
    observations: int | None = None
    created_at: datetime | None = None

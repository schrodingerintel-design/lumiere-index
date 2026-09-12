from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone


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
    raw_payload_hash: str | None = None

    @property
    def source_url(self) -> str | None:
        return self.url


@dataclass
class RawMetricSnapshot:
    """Aggregate observation snapshot (e.g., pageviews, view velocity, search interest).

    Kept strictly distinct from textual RawMention content records.
    """
    source_id: str
    external_id: str
    metric_type: str
    value: float
    observed_at: datetime
    film_id: int | None = None
    country: str | None = None
    observations: int | None = None
    source_url: str | None = None
    attribution: str | None = None
    raw_payload_hash: str | None = None
    created_at: datetime | None = None


@dataclass
class SourceHealth:
    """Standard health status report for any adapter."""
    source_key: str
    status: str = "ok"
    records_requested: int = 0
    records_received: int = 0
    records_processed: int = 0
    records_rejected: int = 0
    api_errors: int = 0
    rate_limit_errors: int = 0
    last_run: datetime | None = None
    last_error: str | None = None


class SourceAdapter(ABC):
    """Formal interface contract for content and signal adapters."""
    source_key: str

    @abstractmethod
    def collect(self, since: datetime | None = None) -> list[RawMention]:
        """Collect and return raw content mentions."""
        ...

    @abstractmethod
    def health(self) -> SourceHealth:
        """Return the current health counters and operational status."""
        ...

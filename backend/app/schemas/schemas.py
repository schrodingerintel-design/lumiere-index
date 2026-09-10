from datetime import datetime, date
from typing import Any

from pydantic import BaseModel, EmailStr, ConfigDict, field_validator, model_validator


def _coerce_content_type(v: Any) -> str:
    """Treat NULL/unknown content_type as MOVIE (legacy catalog rows)."""
    if not v:
        return "MOVIE"
    return str(v).upper() if str(v).upper() in ("MOVIE", "TV_SHOW") else "MOVIE"


class FilmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    slug: str
    title: str
    original_title: str | None = None
    # First-class content type: MOVIE or TV_SHOW. Every consumer branches on
    # this instead of inferring from dates or shapes. NULL (pre-migration
    # rows) coerces to MOVIE so legacy data serializes instead of erroring.
    content_type: str = "MOVIE"
    _coerce_ct = field_validator("content_type", mode="before")(_coerce_content_type)
    director: str | None = None
    year: int | None = None
    country_origin: str | None = None
    poster_url: str | None = None
    backdrop_url: str | None = None
    synopsis: str | None = None
    gradient_from: str | None = None
    gradient_to: str | None = None
    release_date: date | None = None
    # TV first-air date — the TV analogue of release_date.
    first_air_date: date | None = None
    # Canonical genre tag — the frontend groups collections by this field.
    genre_tag: str | None = None


class RankedFilm(FilmBase):
    rank: int
    score: float
    prev_rank: int | None = None
    movement: int = 0
    peak_rank: int | None = None
    weeks_on_chart: int = 0
    # Days since the title's FIRST appearance on the continuous 15-minute
    # chart — the tenure unit the UI shows (weeks is legacy, kept for
    # backward-compatible API consumers).
    days_on_chart: int | None = None
    mentions_total: int = 0
    is_fallback: bool = False
    # Per-component sub-scores for UI breakdown / debugging
    ca_score: float | None = None
    momentum_score: float | None = None
    recency_score: float | None = None
    ae_score: float | None = None
    cp_score: float | None = None
    # Absolute evidence floor for editorial claims
    sample_size: int | None = None      # raw mention/signal count feeding the scores
    confidence: str | None = None       # "insufficient"|"low"|"moderate"|"high"


class SentimentBreakdown(BaseModel):
    positive: float | None = None
    neutral: float | None = None
    negative: float | None = None
    sufficient_data: bool = False


class SourceSignalBreakdown(BaseModel):
    """Per-source observation funnel for one film.

    `observations` is the raw underlying volume (views, pageviews, search
    units, posts); `records` is how many ingest records carried it. They are
    different numbers by design — record count is never a proxy for volume.
    """
    source_key: str
    records: int = 0
    observations: int = 0
    last_collected_at: datetime | None = None


class SignalFunnel(BaseModel):
    """The observation → signal funnel for one film (Signal Health internals)."""
    raw_observations_30d: int = 0
    ingest_records_30d: int = 0
    source_coverage: int = 0
    window_start: datetime | None = None
    window_end: datetime | None = None
    sources: list[SourceSignalBreakdown] = []


class FilmDetail(RankedFilm):
    mentions_total: int = 0
    sentiment: SentimentBreakdown
    # Observation funnel — raw volume behind the score, for internal Signal
    # Health consumers. Optional so older clients ignore it cleanly.
    signal_funnel: SignalFunnel | None = None


class TimelinePoint(BaseModel):
    day: date
    mentions: int
    score: float


class CountryScoreOut(BaseModel):
    country_code: str
    mentions: int
    score: float


class TrendingFilmOut(BaseModel):
    """Film-centric trending entry for the /trending/films endpoint."""
    film_slug: str
    title: str
    director: str | None = None
    year: int | None = None
    rank: int
    score: float
    poster_url: str | None = None
    gradient_from: str | None = None
    gradient_to: str | None = None
    trend_reason: str
    tags: list[str] = []
    delta_pct: float = 0.0
    mentions_24h: int = 0
    # Data-grounding fields for the editorial brief
    dominant_driver: str | None = None     # component key: "recency"|"momentum"|"attention"|"engagement"|"declining"|"cross_platform"
    driver_label: str | None = None        # display-safe driver name (never the metric's own name)
    attention_delta_pct: float | None = None  # % change vs prior 3 days; None when no evidence
    top_platform: str | None = None        # real external platform key, or None when no per-platform data
    top_topic: str | None = None           # top discussion keyword from recent mentions
    # Absolute evidence floor
    sample_size: int = 0                   # raw mention/signal count feeding the scores
    confidence: str = "insufficient"       # "insufficient"|"low"|"moderate"|"high"
    # Current-activity gate for the top editorial headline ("anchors the Index").
    # True only when CA_norm or M_norm clears the headline floor — a high blended
    # FinalScore carried by recency or cross-platform history alone is not enough.
    headline_eligible: bool = False


class LiveStats(BaseModel):
    total_mentions_24h: int
    tracked_films: int
    active_countries: int
    snapshot_at: datetime


class RefreshMeta(BaseModel):
    snapshot_at: datetime | None
    next_refresh_at: datetime
    interval_minutes: int


class SourceHealth(BaseModel):
    key: str
    name: str
    enabled: bool = True
    weight: float = 1.0
    last_ingested_at: datetime | None = None
    last_error: str | None = None
    last_error_at: datetime | None = None
    mentions_24h: int = 0
    # Raw engagement volume flowing through this source in 24h (views, pageviews,
    # search units, upvotes…) — distinct from the row count above.
    observations_24h: int = 0
    key_configured: bool = False
    # Per-run ingest counters (Data/Signal Health view)
    records_requested: int = 0
    records_received: int = 0
    records_processed: int = 0
    records_rejected: int = 0
    api_errors: int = 0
    rate_limit_errors: int = 0


class SignalHealthFilm(BaseModel):
    """Per-film evidence status for the Data/Signal Health view."""
    slug: str
    title: str
    rank: int = 0
    score: float = 0.0
    sample_size: int = 0
    confidence: str = "insufficient"
    weeks_on_chart: int = 0
    last_seen_at: datetime | None = None


class SignalHealthSummary(BaseModel):
    """Aggregate health summary for the Data/Signal Health view."""
    total_films_tracked: int
    films_charted: int
    films_with_insufficient_evidence: int
    films_with_low_evidence: int
    total_mentions_30d: int
    pending_unresolved: int
    sources_ok: int
    sources_error: int
    snapshot_at: datetime | None = None
    # Raw observation volume (upstream counts: views, pageviews, search units,
    # posts) vs ingest record count — the funnel the audit requires.
    total_observations_30d: int = 0
    total_records_30d: int = 0
    scheduler_enabled: bool = False
    scheduler_last_runs: dict[str, str] = {}


class NewsletterIn(BaseModel):
    email: EmailStr


# ── Official Index contracts (published snapshots) ───────────────────────────

class IndexEntryOut(BaseModel):
    """One row of the official Daily Index."""
    model_config = ConfigDict(from_attributes=True)

    film_id: int
    slug: str
    title: str
    original_title: str | None = None
    content_type: str = "MOVIE"
    _coerce_ct = field_validator("content_type", mode="before")(_coerce_content_type)
    director: str | None = None
    year: int | None = None
    poster_url: str | None = None
    backdrop_url: str | None = None
    gradient_from: str | None = None
    gradient_to: str | None = None
    release_date: date | None = None
    first_air_date: date | None = None
    genre_tag: str | None = None
    rank: int
    score: float
    previous_rank: int | None = None
    rank_delta: int = 0
    score_delta: float | None = None
    signal_volume: int = 0
    confidence: str | None = None
    source_coverage: int = 0
    sentiment_positive: float | None = None
    sentiment_neutral: float | None = None
    sentiment_negative: float | None = None
    snapshot_date: date


class IndexMetaOut(BaseModel):
    """Metadata about the published Index being returned."""
    snapshot_date: date
    published_at: datetime | None = None
    entry_count: int = 0


class DailyIndexOut(BaseModel):
    """The official Daily Index — a published, immutable snapshot."""
    meta: IndexMetaOut
    entries: list[IndexEntryOut]


class WeeklyEntryOut(BaseModel):
    """One row of the official Weekly Index."""
    model_config = ConfigDict(from_attributes=True)

    film_id: int
    slug: str
    title: str
    original_title: str | None = None
    content_type: str = "MOVIE"
    _coerce_ct = field_validator("content_type", mode="before")(_coerce_content_type)
    director: str | None = None
    year: int | None = None
    poster_url: str | None = None
    backdrop_url: str | None = None
    gradient_from: str | None = None
    gradient_to: str | None = None
    release_date: date | None = None
    first_air_date: date | None = None
    genre_tag: str | None = None
    rank: int
    score: float
    previous_week_rank: int | None = None
    rank_delta: int = 0
    avg_daily_mentions: float = 0
    total_signal_volume: int = 0
    avg_sentiment: float | None = None
    peak_daily_rank: int | None = None
    source_coverage: int = 0
    confidence: str | None = None
    week_start: date
    week_end: date


class WeeklyMetaOut(BaseModel):
    week_start: date
    week_end: date
    published_at: datetime | None = None
    entry_count: int = 0


class WeeklyIndexOut(BaseModel):
    """The official Weekly Index — a published, immutable weekly snapshot."""
    meta: WeeklyMetaOut
    entries: list[WeeklyEntryOut]


class MoverOut(BaseModel):
    """Biggest Movers entry — rank-position change between published dailies."""
    slug: str
    title: str
    original_title: str | None = None
    content_type: str = "MOVIE"
    _coerce_ct = field_validator("content_type", mode="before")(_coerce_content_type)
    poster_url: str | None = None
    direction: str                     # "up" | "down"
    movement: int                      # absolute rank positions
    previous_rank: int | None
    current_rank: int
    current_score: float
    previous_score: float | None = None
    score_delta: float | None = None
    confidence: str | None = None


class MoversOut(BaseModel):
    gainers: list[MoverOut]
    decliners: list[MoverOut]


class NewEntryOut(BaseModel):
    """New Entries — films entering The Index for the first time."""
    slug: str
    title: str
    original_title: str | None = None
    content_type: str = "MOVIE"
    _coerce_ct = field_validator("content_type", mode="before")(_coerce_content_type)
    director: str | None = None
    year: int | None = None
    poster_url: str | None = None
    gradient_from: str | None = None
    gradient_to: str | None = None
    release_date: date | None = None
    first_air_date: date | None = None
    debut_date: date
    debut_rank: int
    debut_score: float
    current_rank: int | None = None
    confidence: str | None = None
    signal_volume: int = 0

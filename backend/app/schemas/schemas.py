from datetime import datetime, date
from pydantic import BaseModel, EmailStr, ConfigDict


class FilmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    slug: str
    title: str
    director: str | None = None
    year: int | None = None
    country_origin: str | None = None
    poster_url: str | None = None
    backdrop_url: str | None = None
    synopsis: str | None = None
    gradient_from: str | None = None
    gradient_to: str | None = None
    release_date: date | None = None
    # Canonical genre tag — the frontend groups collections by this field.
    genre_tag: str | None = None


class RankedFilm(FilmBase):
    rank: int
    score: float
    prev_rank: int | None = None
    movement: int = 0
    peak_rank: int | None = None
    weeks_on_chart: int = 0
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


class FilmDetail(RankedFilm):
    mentions_total: int = 0
    sentiment: SentimentBreakdown


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
    key_configured: bool = False


class NewsletterIn(BaseModel):
    email: EmailStr

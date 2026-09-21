import os

from pydantic import Field, AliasChoices
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = Field(
        # "*" by default: this is a public, read-only, keyless API (no cookies,
        # no sessions) with its own rate limiting — any frontend host (Vercel,
        # Railway, Freebuff, custom domains) must be able to read it.
        default="*",
        validation_alias=AliasChoices("cors_origins", "CORS_ORIGINS"),
        description="Comma-separated list of allowed CORS origins, or * for all",
    )

    # -- MySQL ---------------------------------------------------------------
    # Railway / Heroku / Render expose DATABASE_URL; individual MYSQL_* vars
    # are a fallback for Docker Compose.
    database_url_raw: str = Field(
        default="",
        validation_alias=AliasChoices("database_url_raw", "DATABASE_URL", "MYSQL_URL"),
        description="Full SQLAlchemy DB URL (overrides individual fields)",
    )

    mysql_host: str = Field(
        default="mysql",
        validation_alias=AliasChoices("mysql_host", "MYSQLHOST"),
    )
    mysql_port: int = Field(
        default=3306,
        validation_alias=AliasChoices("mysql_port", "MYSQLPORT"),
    )
    mysql_user: str = Field(
        default="lumiere",
        validation_alias=AliasChoices("mysql_user", "MYSQLUSER"),
    )
    mysql_password: str = Field(
        default="",
        validation_alias=AliasChoices("mysql_password", "MYSQLPASSWORD"),
        description="MySQL user password",
    )
    mysql_db: str = Field(
        default="lumiere",
        validation_alias=AliasChoices("mysql_db", "MYSQLDATABASE"),
    )

    def model_post_init(self, __context) -> None:
        """Ensure Railway env vars override defaults.

        AliasChoices does not always resolve env vars in pydantic-settings,
        so we fall back to explicit os.environ lookups.
        """
        # DATABASE_URL — Railway's canonical connection string
        if not self.database_url_raw:
            self.database_url_raw = (
                os.environ.get("DATABASE_URL")
                or os.environ.get("MYSQL_URL")
                or ""
            )
        # Individual MySQL fields — Railway uses MYSQLDATABASE (no underscore)
        if self.mysql_db == "lumiere":
            self.mysql_db = (
                os.environ.get("MYSQLDATABASE")
                or os.environ.get("MYSQL_DATABASE")
                or self.mysql_db
            )
        if self.mysql_host == "mysql":
            self.mysql_host = os.environ.get("MYSQLHOST") or self.mysql_host
        if self.mysql_port == 3306:
            self.mysql_port = int(
                os.environ.get("MYSQLPORT") or self.mysql_port
            )
        if self.mysql_user == "lumiere":
            self.mysql_user = os.environ.get("MYSQLUSER") or self.mysql_user
        if self.mysql_password == "":
            self.mysql_password = (
                os.environ.get("MYSQLPASSWORD") or self.mysql_password
            )

    # -- Redis ---------------------------------------------------------------
    redis_url: str = Field(
        default="redis://redis:6379/0",
        validation_alias=AliasChoices("redis_url", "REDIS_URL"),
    )
    redis_password: str = Field(
        default="",
        validation_alias=AliasChoices("redis_password", "REDIS_PASSWORD"),
        description="Redis password",
    )

    reddit_user_agent: str = "lumiere-index/0.1"

    # -- Data retention -------------------------------------------------------
    # Calendar days of collapsed ranking-snapshot history to keep. The collapse
    # (app/services/retention.py) preserves every published number bit-exactly:
    # one row per (chart, film, day) + each title's exact first appearance.
    ranking_history_days: int = 400
    newsapi_key: str = ""
    youtube_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("youtube_api_key", "YOUTUBE_API_KEY"),
        description="YouTube Data API v3 Key",
    )
    youtube_quota_daily_limit: int = Field(
        default=10000,
        validation_alias=AliasChoices("youtube_quota_daily_limit", "YOUTUBE_QUOTA_DAILY_LIMIT"),
        description="Daily quota limit for YouTube Data API v3 (default 10,000 units)",
    )
    youtube_cache_ttl_hours: int = Field(
        default=12,
        validation_alias=AliasChoices("youtube_cache_ttl_hours", "YOUTUBE_CACHE_TTL_HOURS"),
        description="Cache TTL in hours for YouTube API results (6-12 hours recommended)",
    )
    youtube_min_confidence: float = Field(
        default=0.6,
        description="Minimum confidence score required for automatic trailer acceptance",
    )
    tmdb_api_key: str = Field(
        default="b58020901e8a8af0f3d636c6d83b08c6",
        validation_alias=AliasChoices("tmdb_api_key", "TMDB_API_KEY"),
        description="TMDB API Key",
    )
    rapidapi_key: str = ""
    rapidapi_tiktok_host: str = ""
    rapidapi_youtube_host: str = "youtube-v3-alternative.p.rapidapi.com"

    discovery_batch_size: int = 50
    tmdb_search_per_run: int = 30

    # IMDb enrichment & experimental momentum
    enable_imdb_momentum: bool = Field(
        default=False,
        validation_alias=AliasChoices("enable_imdb_momentum", "ENABLE_IMDB_MOMENTUM"),
        description="Enable experimental IMDb vote momentum diagnostics (OFF by default; does not affect official rankings)",
    )
    imdb_datasets_dir: str = Field(
        default="data/imdb",
        validation_alias=AliasChoices("imdb_datasets_dir", "IMDB_DATASETS_DIR"),
        description="Local directory for downloaded IMDb datasets (title.basics.tsv.gz, title.ratings.tsv.gz)",
    )

    # ── Source Adapter Feature Flags ──────────────────────────────────────────
    enable_youtube_adapter: bool = Field(
        default=True,
        validation_alias=AliasChoices("enable_youtube_adapter", "ENABLE_YOUTUBE_ADAPTER"),
    )
    enable_wikimedia_adapter: bool = Field(
        default=True,
        validation_alias=AliasChoices("enable_wikimedia_adapter", "ENABLE_WIKIMEDIA_ADAPTER"),
    )
    enable_letterboxd_adapter: bool = Field(
        default=True,
        validation_alias=AliasChoices("enable_letterboxd_adapter", "ENABLE_LETTERBOXD_ADAPTER"),
    )
    enable_reddit_adapter: bool = Field(
        default=False,
        validation_alias=AliasChoices("enable_reddit_adapter", "ENABLE_REDDIT_ADAPTER"),
    )
    enable_tiktok_adapter: bool = Field(
        default=False,
        validation_alias=AliasChoices("enable_tiktok_adapter", "ENABLE_TIKTOK_ADAPTER"),
    )
    enable_instagram_adapter: bool = Field(
        default=False,
        validation_alias=AliasChoices("enable_instagram_adapter", "ENABLE_INSTAGRAM_ADAPTER"),
    )
    enable_x_adapter: bool = Field(
        default=False,
        validation_alias=AliasChoices("enable_x_adapter", "ENABLE_X_ADAPTER"),
    )

    # ── Per-Source Ingest Controls ────────────────────────────────────────────
    source_max_items_per_run: int = Field(
        default=100,
        validation_alias=AliasChoices("source_max_items_per_run", "SOURCE_MAX_ITEMS_PER_RUN"),
    )
    source_lookback_hours: int = Field(
        default=48,
        validation_alias=AliasChoices("source_lookback_hours", "SOURCE_LOOKBACK_HOURS"),
    )
    source_request_timeout_seconds: int = Field(
        default=20,
        validation_alias=AliasChoices("source_request_timeout_seconds", "SOURCE_REQUEST_TIMEOUT_SECONDS"),
    )
    source_max_retries: int = Field(
        default=3,
        validation_alias=AliasChoices("source_max_retries", "SOURCE_MAX_RETRIES"),
    )
    source_min_request_delay_seconds: float = Field(
        default=0.5,
        validation_alias=AliasChoices("source_min_request_delay_seconds", "SOURCE_MIN_REQUEST_DELAY_SECONDS"),
    )

    admin_key: str = ""

    # In-process ingest scheduler (see app/ingest/scheduler.py). On by default
    # so the API deployment collects signals without needing a separate Celery
    # worker; set INGEST_SCHEDULER_ENABLED=false when a dedicated worker runs.
    enable_ingest_scheduler: bool = Field(
        default=True,
        validation_alias=AliasChoices("enable_ingest_scheduler", "INGEST_SCHEDULER_ENABLED"),
    )

    ranking_ca_lambda: float = 0.89           # daily decay factor for CA window (≈6-day half-life)
    ranking_ca_window_days: int = 30          # max lookback days for CA
    ranking_momentum_short_hl: float = 1.5   # EWMA short half-life (days) for momentum
    ranking_momentum_long_hl: float = 7.0    # EWMA long half-life (days) for momentum
    ranking_ae_window_days: int = 14          # audience-engagement rolling window (days)
    ranking_recency_window_days: int = 21     # linear recency decay window (days)
    ranking_min_tracked_days: int = 2         # min days of data before trusting CA/AE scores
    # Cross-Platform Reach: a platform only counts toward CP when its decay-weighted
    # presence (same λ as CA) clears this floor.  Old-only activity (nothing within
    # roughly one half-life) stops counting, so cumulative 30-day history can never
    # inflate CP.  0.5 ≈ a mention within ~6 days under the default λ=0.89.
    ranking_cp_min_signal: float = 0.5
    # Headline gate: "anchors the Index" requires current activity — CA_norm or
    # M_norm at/above these floors — independent of blended FinalScore rank.
    headline_min_ca: float = 0.5             # CA_norm (percentile) floor for headline
    headline_min_momentum: float = 0.6       # M_norm floor for headline (neutral center = 0.5)
    refresh_interval_minutes: int = 15

    # ── Index Score calibration (absolute attention scale) ──────────────────
    # The displayed Index Score is an ABSOLUTE measure of attention, not a
    # pool-relative one: score = 100·log10(1+A)/log10(1+A_ref), where A is the
    # title's own decay-weighted mentions/day. A_ref is the attention level
    # that maps to exactly 100 (technically achievable, exceptionally rare).
    # A_ref is a CALIBRATION CONSTANT tied to current source coverage.  With
    # the beta-era source set (Wikipedia/Trends/Letterboxd/News/YouTube),
    # charting titles measure ~0.2–3 decayed mentions/day, so A_ref=25 means:
    # today's chart spans a wide, honest band (#1 ≈ 25–40, #100 in the single
    # digits — measured attention IS low at beta coverage), a 10× blockbuster
    # surge tops out in the 80s (no saturation), and 100 — reached at 25
    # decayed mentions/day — stays genuinely rare.  As sources scale up
    # (Reddit/TikTok/X enabled, millions of signals), RAISE this anchor via
    # the SCORE_ATTENTION_REF env var — no code change.  Historical
    # attention_raw is persisted on every ranking row, so past scores remain
    # exactly re-derivable under any anchor.  Rank never feeds the score.
    score_attention_ref: float = 25.0
    # YouTube view velocity → mention-equivalents divisor. A trailer pulling
    # 250k new views/day contributes the same absolute attention as ~100
    # mentions/day (2500 views ≈ one measured mention of attention).
    score_youtube_views_per_mention: float = 2500.0

    # Confidence tiers for editorial claims (raw mention/signal counts, pre-normalization)
    confidence_low_threshold: int = 5       # below this → "insufficient"
    confidence_medium_threshold: int = 25   # below this → "low"
    confidence_high_threshold: int = 100    # below this → "moderate"; at/above → "high"

    @property
    def resolved_database_url(self) -> str:
        """Return the database URL, preferring DATABASE_URL / MYSQL_URL.

        Railway provides ``mysql://...`` which targets the C MySQL client.
        We only ship ``pymysql``, so rewrite the prefix and ensure the
        charset query-parameter is present.
        """
        url = self.database_url_raw
        if not url:
            url = (
                f"mysql+pymysql://{self.mysql_user}:{self.mysql_password}"
                f"@{self.mysql_host}:{self.mysql_port}/{self.mysql_db}"
            )
        # Normalise: mysql:// → mysql+pymysql:// (we ship pymysql, not mysqlclient)
        if url.startswith("mysql://"):
            url = "mysql+pymysql://" + url[len("mysql://") :]
        elif url.startswith("mysql+pymysql://"):
            pass  # already correct
        # Ensure charset param
        if "charset=" not in url:
            url += ("&" if "?" in url else "?") + "charset=utf8mb4"
        return url

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

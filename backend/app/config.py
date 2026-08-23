from pydantic import Field, AliasChoices
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = (
        "http://localhost:8080,https://lumiere-index.vercel.app"
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
        validation_alias=AliasChoices("mysql_db", "MYSQLDATABASE", "MYSQL_DATABASE"),
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
    newsapi_key: str = ""
    youtube_api_key: str = ""
    tmdb_api_key: str = ""
    rapidapi_key: str = ""
    rapidapi_tiktok_host: str = ""
    rapidapi_youtube_host: str = "youtube-v3-alternative.p.rapidapi.com"

    discovery_batch_size: int = 50
    tmdb_search_per_run: int = 30

    admin_key: str = ""

    ranking_half_life_hours: float = 24.0
    ranking_window_hours: float = 48.0
    refresh_interval_minutes: int = 15

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

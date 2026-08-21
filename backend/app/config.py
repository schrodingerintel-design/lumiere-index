from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:8080"

    mysql_host: str = "mysql"
    mysql_port: int = 3306
    mysql_user: str = "lumiere"
    mysql_password: str = "lumiere_pw"
    mysql_db: str = "lumiere"

    redis_url: str = "redis://redis:6379/0"
    redis_password: str = ""

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
    def database_url(self) -> str:
        return (
            f"mysql+pymysql://{self.mysql_user}:{self.mysql_password}"
            f"@{self.mysql_host}:{self.mysql_port}/{self.mysql_db}?charset=utf8mb4"
        )

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

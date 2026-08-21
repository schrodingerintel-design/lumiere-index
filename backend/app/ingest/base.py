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
    created_at: datetime | None = None

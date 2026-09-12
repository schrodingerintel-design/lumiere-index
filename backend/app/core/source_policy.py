"""Explicit Data Ingestion Source Policy for Lumière.

Enforces compliance boundaries, access authorization, and safe operational
practices across all external platforms and data providers.
"""
from __future__ import annotations
from typing import Final, Literal

# 1. APPROVED_API_SOURCES
# Sources with officially documented, authorized API access and developer credentials.
APPROVED_API_SOURCES: Final[frozenset[str]] = frozenset({
    "youtube",  # YouTube Data API v3 using backend server-side API key
    "news",     # NewsAPI v2 using developer API key
})

# 2. EXISTING_SOURCES
# Legacy or established sources present in the signal pipeline.
EXISTING_SOURCES: Final[frozenset[str]] = frozenset({
    "reddit",
    "letterboxd",
    "news",
    "youtube",
    "tiktok",
    "wikipedia",
    "trends",
})

# 3. ENRICHMENT_ONLY_SOURCES
# Metadata/enrichment providers that populate the catalog or diagnostic views.
# Under no circumstances may metrics from these sources leak into attention scoring.
ENRICHMENT_ONLY_SOURCES: Final[frozenset[str]] = frozenset({
    "tmdb",      # TMDB catalog sync (films metadata only)
    "wikidata",  # Future semantic entity resolution
    "imdb",      # Official non-commercial IMDb dataset exports (diagnostic only)
})

# Firewall: sources that must never contribute to ranking components
CATALOG_ONLY_SOURCE_KEYS: Final[frozenset[str]] = frozenset({
    "tmdb",
    "imdb",
    "wikidata",
})

# 4. EXPERIMENTAL_SOURCES
# Sources whose automated collection is restricted, unauthorized, or pending
# formal partner/API licensing. ALL experimental adapters MUST be disabled by default.
EXPERIMENTAL_SOURCES: Final[frozenset[str]] = frozenset({
    "instagram",       # Instagram public page collection (strictly disabled)
    "x",               # X / Twitter public page collection (strictly disabled)
    "tiktok_scraper",  # TikTok unapproved proxy/scraper APIs (disabled)
    "reddit_json",     # Reddit unauthenticated JSON endpoints (disabled)
})

# Health status constants for disabled / policy-restricted adapters
STATUS_OK = "ok"
STATUS_DISABLED_ACCESS_POLICY = "disabled_access_policy"
STATUS_DISABLED_CONFIG = "disabled_by_config"
STATUS_NO_CREDENTIALS = "no_credentials"


def is_adapter_permitted(source_key: str, is_configured: bool = True) -> tuple[bool, str]:
    """Check if an adapter is permitted to run under the Source Policy.

    Returns (is_permitted, status_code).
    """
    if source_key in EXPERIMENTAL_SOURCES or source_key in ("instagram", "x"):
        return False, STATUS_DISABLED_ACCESS_POLICY

    if source_key == "tiktok":
        # Unless an approved official TikTok partner API is provided, unapproved
        # scrapers are strictly blocked.
        return False, STATUS_DISABLED_ACCESS_POLICY

    if source_key == "reddit":
        # Unauthenticated Reddit scraping is prohibited. Requires approved OAuth2.
        return False, STATUS_DISABLED_ACCESS_POLICY

    if not is_configured:
        return False, STATUS_NO_CREDENTIALS

    return True, STATUS_OK

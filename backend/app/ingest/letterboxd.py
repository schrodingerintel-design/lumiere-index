"""Letterboxd reviews ingestion adapter."""
from datetime import datetime, timezone
import xml.etree.ElementTree as ET
import httpx
import structlog
from bs4 import BeautifulSoup
from slugify import slugify
from tenacity import retry, stop_after_attempt, wait_exponential

from app.ingest.base import RawMention

log = structlog.get_logger()


@retry(stop=stop_after_attempt(2), wait=wait_exponential())
def _fetch_film_rss(film_slug: str) -> str | None:
    url = f"https://letterboxd.com/film/{film_slug}/rss/"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    r = httpx.get(url, headers=headers, timeout=15)
    if r.status_code != 200:
        return None
    return r.text


def fetch_letterboxd(film_tuples: list[tuple[int, str, int | None]]) -> list[RawMention]:
    """Fetch recent Letterboxd reviews for tracked films."""
    out: list[RawMention] = []

    for _, title, _ in film_tuples:
        film_slug = slugify(title)
        rss_content = None
        try:
            rss_content = _fetch_film_rss(film_slug)
        except Exception as e:
            log.warning("letterboxd.fetch.failed", film_slug=film_slug, error=str(e))
            continue

        if not rss_content:
            continue

        try:
            root = ET.fromstring(rss_content)
            channel = root.find("channel")
            if channel is None:
                continue

            for item in channel.findall("item"):
                title_elem = item.find("title")
                link_elem = item.find("link")
                guid_elem = item.find("guid")
                desc_elem = item.find("description")
                pub_elem = item.find("pubDate")

                raw_title = title_elem.text if title_elem is not None else ""
                url = link_elem.text if link_elem is not None else None
                ext_id = guid_elem.text if guid_elem is not None else (url or f"lb_{film_slug}_{datetime.now(timezone.utc).timestamp()}")

                # Clean HTML from description
                desc_html = desc_elem.text if desc_elem is not None else ""
                clean_text = raw_title
                if desc_html:
                    soup = BeautifulSoup(desc_html, "html.parser")
                    clean_text += f" - {soup.get_text()}"

                out.append(
                    RawMention(
                        external_id=ext_id,
                        text=clean_text[:2000],
                        url=url,
                        author="Letterboxd Reviewer",
                        engagement=5,
                        created_at=datetime.now(timezone.utc),
                    )
                )
        except Exception as e:
            log.warning("letterboxd.parse.failed", film_slug=film_slug, error=str(e))
            continue

    return out

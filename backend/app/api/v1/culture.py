"""Small, cached culture enrichment. No database, API key, or paid service.

Only curated identities can be fetched. Wikimedia text is plain text and
images are exposed only with their supplied author/license attribution.
"""
import asyncio
import html
import json
import re
import time
from pathlib import Path
from urllib.parse import unquote, quote

import httpx
from fastapi import APIRouter, HTTPException, Response

router = APIRouter()
REGISTRY = json.loads((Path(__file__).parents[2] / "data" / "culture_registry.json").read_text())
_cache: dict[str, tuple[float, dict]] = {}
_locks: dict[str, asyncio.Lock] = {}
_limit = asyncio.Semaphore(4)
_TTL = 21600
USER_AGENT = "LumiereIndex/1.0 (https://lumiereindex.com/about; privacy@lumiereindex.com)"


def plain(value: str) -> str:
    return html.unescape(re.sub(r"<[^>]*>", "", value or "")).strip()


async def _enrich(slug: str) -> dict:
    title = unquote(REGISTRY[slug])
    result = {"slug": slug, "source_url": "https://en.wikipedia.org/wiki/" + quote(title, safe="_():"),
              "extract": None, "image_url": None, "image_credit": None,
              "image_license": None, "image_source": None}
    async with _limit, httpx.AsyncClient(timeout=6, headers={"User-Agent": USER_AGENT}) as client:
        res = await client.get("https://en.wikipedia.org/w/api.php", params={
            "action": "query", "format": "json", "formatversion": "2",
            "prop": "extracts|pageimages", "exintro": "1", "explaintext": "1",
            "piprop": "thumbnail|name", "pithumbsize": "800", "redirects": "1", "titles": title,
        })
        res.raise_for_status()
        pages = res.json().get("query", {}).get("pages", [])
        if not pages or pages[0].get("missing"):
            return result
        page = pages[0]
        # Use a paragraph only; never forward HTML or unbounded article text.
        extract = page.get("extract", "").split("\n")[0]
        result["extract"] = extract[:1800] or None
        name = page.get("pageimage")
        image = page.get("thumbnail", {}).get("source")
        if not name or not image or not image.startswith(("https://upload.wikimedia.org/", "https://thumb.wikimedia.org/")):
            return result
        try:
            credit = await client.get("https://en.wikipedia.org/w/api.php", params={
                "action": "query", "format": "json", "formatversion": "2", "prop": "imageinfo",
                "iiprop": "extmetadata", "titles": "File:" + name,
            })
            credit.raise_for_status()
            images = credit.json().get("query", {}).get("pages", [{}])[0].get("imageinfo", [])
            metadata = images[0].get("extmetadata", {}) if images else {}
            artist = plain(metadata.get("Artist", {}).get("value", ""))
            license_name = plain(metadata.get("LicenseShortName", {}).get("value", ""))
            # Non-free album covers/game box art are deliberately not rehosted.
            if artist and (license_name.startswith(("CC BY ", "CC BY-SA ", "CC0")) or "public domain" in license_name.lower()):
                result.update(image_url=image, image_credit=artist[:400], image_license=license_name,
                              image_source="https://en.wikipedia.org/wiki/File:" + quote(name, safe="_()"))
        except (httpx.HTTPError, ValueError, KeyError, IndexError):
            pass
    return result


@router.get("/culture/wiki/{slug}")
async def culture_profile(slug: str, response: Response):
    if slug not in REGISTRY:
        raise HTTPException(404, "Unknown culture profile")
    response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=86400"
    hit = _cache.get(slug)
    if hit and time.monotonic() - hit[0] < _TTL:
        return hit[1]
    async with _locks.setdefault(slug, asyncio.Lock()):
        hit = _cache.get(slug)
        if hit and time.monotonic() - hit[0] < _TTL:
            return hit[1]
        try:
            data = await _enrich(slug)
            _cache[slug] = (time.monotonic(), data)
            return data
        except (httpx.HTTPError, ValueError, KeyError, IndexError):
            if hit:
                return {**hit[1], "stale": True}
            # The editorial profile remains useful without this enrichment.
            raise HTTPException(503, "Reference information is temporarily unavailable")

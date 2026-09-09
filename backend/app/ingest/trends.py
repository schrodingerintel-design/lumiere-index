"""Google Trends ingestion adapter using pytrends."""
from datetime import datetime, timezone
from pytrends.request import TrendReq
from app.ingest.base import RawMention

# pytrends category codes: 34 = Movies, 722 = TV Shows & Programs.
_MOVIES_CATEGORY = 34
_TV_CATEGORY = 722


def fetch_trends(film_tuples: list[tuple[int, str, int | None]]) -> list[RawMention]:
    """Fetch search interest for tracked titles (max 5 keywords per query).

    TV shows are queried in the TV category — previously every title was
    queried under the Movies category, so shows had (near) zero search-
    interest data. Each chunk is queried with its own content type."""
    out: list[RawMention] = []
    if not film_tuples:
        return out

    pytrend = TrendReq(hl="en-US", tz=360, timeout=(10, 25))

    # (title, content_type) pairs, then chunk per content type so the right
    # category code applies to every keyword in a payload.
    pairs: list[tuple[str, str]] = [
        (t[1], (t[3] if len(t) > 3 else "MOVIE")) for t in film_tuples
    ]
    movie_titles = [title for title, ct in pairs if ct != "TV_SHOW"]
    tv_titles = [title for title, ct in pairs if ct == "TV_SHOW"]
    chunk_size = 5
    
    for titles, category in ((movie_titles, _MOVIES_CATEGORY), (tv_titles, _TV_CATEGORY)):
        out.extend(
            _fetch_chunk(pytrend, titles, category, chunk_size)
        )
    return out


def _fetch_chunk(
    pytrend: TrendReq, titles: list[str], category: int, chunk_size: int
) -> list[RawMention]:
    """Query one content type's titles in its category and build RawMentions."""
    out: list[RawMention] = []
    for i in range(0, len(titles), chunk_size):
        chunk = titles[i : i + chunk_size]
        try:
            pytrend.build_payload(chunk, cat=category, timeframe="now 7-d", geo="")
            interest_df = pytrend.interest_over_time()
            if interest_df.empty:
                continue
                
            for title in chunk:
                if title in interest_df.columns:
                    recent_score = int(interest_df[title].iloc[-1])
                    if recent_score > 0:
                        # Sum the weekly interest series: each day's 0-100 index
                        # is a real, comparable observation of search demand.
                        # One record per (film, day) — the daily ext_id makes
                        # re-runs idempotent instead of re-counting the same
                        # weekly series on every hourly run.
                        weekly_total = int(interest_df[title].sum())
                        ext_id = f"gtrends_{title.replace(' ', '_')}_{datetime.now(timezone.utc).strftime('%Y%m%d')}"
                        out.append(
                            RawMention(
                                external_id=ext_id,
                                text=f"{title} Google Trends search interest rating is {recent_score}/100.",
                                url=f"https://trends.google.com/trends/explore?q={title}",
                                author="Google Trends",
                                engagement=recent_score * 10,
                                observations=weekly_total,
                                created_at=datetime.now(timezone.utc),
                            )
                        )
        except Exception:
            # Handle rate limiting or API downtime gracefully
            continue

    return out

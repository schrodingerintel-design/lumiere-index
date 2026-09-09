"""Google Trends ingestion adapter using pytrends."""
from datetime import datetime, timezone
from pytrends.request import TrendReq
from app.ingest.base import RawMention


def fetch_trends(film_tuples: list[tuple[int, str, int | None]]) -> list[RawMention]:
    """Fetch search interest index for film titles using pytrends (max 5 keywords per query)."""
    out: list[RawMention] = []
    if not film_tuples:
        return out

    pytrend = TrendReq(hl="en-US", tz=360, timeout=(10, 25))
    
    # Process in chunks of 5 (pytrends limit)
    titles = [title for _, title, _ in film_tuples]
    chunk_size = 5
    
    for i in range(0, len(titles), chunk_size):
        chunk = titles[i : i + chunk_size]
        try:
            pytrend.build_payload(chunk, cat=34, timeframe="now 7-d", geo="")
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

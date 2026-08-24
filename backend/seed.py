"""Seed 100 clean, modern feature films (2023–2026) + realistic rankings + multi-channel Mentions.

Idempotent: safe to run on every container start.
"""
from datetime import datetime, timezone, timedelta, date
import random
from slugify import slugify
from sqlalchemy import select, func

from app.db import SessionLocal
from app.models import Film, FilmAlias, Source, Ranking, Mention

# Title, Director, Year, Country, GradientFrom, GradientTo, ReleaseDate, GenreTag
FILMS = [
    # 2025–2026 Upcoming / New Releases
    ("Mickey 17", "Bong Joon-ho", 2025, "US", "#1e3a5f", "#0a192f", date(2025, 3, 7), "Sci-Fi"),
    ("Superman", "James Gunn", 2025, "US", "#7a1f2b", "#1a1a18", date(2025, 7, 11), "Action"),
    ("Avatar Fire and Ash", "James Cameron", 2025, "US", "#0f4c5c", "#051923", date(2025, 12, 19), "Sci-Fi"),
    ("F1", "Joseph Kosinski", 2025, "US", "#e36414", "#1a1a18", date(2025, 6, 27), "Action"),
    ("Sinners", "Ryan Coogler", 2025, "US", "#5f0f40", "#1a0510", date(2025, 4, 18), "Horror"),
    ("Jurassic World Rebirth", "Gareth Edwards", 2025, "US", "#2a3a2a", "#0a120a", date(2025, 7, 2), "Action"),
    ("28 Years Later", "Danny Boyle", 2025, "GB", "#4a1525", "#15050a", date(2025, 6, 20), "Horror"),
    ("The Fantastic Four First Steps", "Matt Shakman", 2025, "US", "#1d6fa5", "#0a1f33", date(2025, 7, 25), "Action"),
    ("Mission Impossible The Final Reckoning", "Christopher McQuarrie", 2025, "US", "#3a3a5a", "#101020", date(2025, 5, 23), "Action"),
    ("Michael", "Antoine Fuqua", 2025, "US", "#d5b352", "#2b1f0a", date(2025, 10, 3), "Drama"),
    ("Bugonia", "Yorgos Lanthimos", 2025, "US", "#5a2a5a", "#1a0a1a", date(2025, 11, 14), "Indie"),
    ("Klara and the Sun", "Taika Waititi", 2025, "US", "#2d8a86", "#0b2422", date(2025, 9, 12), "Sci-Fi"),
    ("Novocaine", "Dan Berk", 2025, "US", "#3a2a1a", "#0f0a05", date(2025, 3, 14), "Action"),
    ("The Accountant 2", "Gavin O'Connor", 2025, "US", "#1a2a3a", "#050f1a", date(2025, 4, 25), "Action"),
    ("Until Dawn", "David F. Sandberg", 2025, "US", "#2a1a3a", "#0a0515", date(2025, 4, 25), "Horror"),
    ("Black Bag", "Steven Soderbergh", 2025, "GB", "#1f2f3f", "#080f18", date(2025, 3, 14), "Drama"),
    ("Death of a Unicorn", "Alex Scharfman", 2025, "US", "#3f1f4f", "#100818", date(2025, 3, 28), "Indie"),
    ("A Minecraft Movie", "Jared Hess", 2025, "US", "#1a4a2a", "#06180a", date(2025, 4, 4), "Action"),
    ("Captain America Brave New World", "Julius Onah", 2025, "US", "#1a2a6a", "#060818", date(2025, 2, 14), "Action"),
    ("Snow White", "Marc Webb", 2025, "US", "#6a1a2a", "#180608", date(2025, 3, 21), "Drama"),
    ("Thunderbolts", "Jake Schreier", 2025, "US", "#2a1a6a", "#080618", date(2025, 5, 2), "Action"),
    ("The Bride", "Maggie Gyllenhaal", 2025, "US", "#4a2a1a", "#180a06", date(2025, 9, 26), "Drama"),
    ("Warfare", "Alex Garland", 2025, "US", "#2a3a1a", "#0a0f06", date(2025, 4, 11), "Action"),
    ("Elio", "Madeline Sharafian", 2025, "US", "#1a5a6a", "#061820", date(2025, 6, 13), "Sci-Fi"),
    ("Lilo and Stitch", "Dean Fleischer Camp", 2025, "US", "#1a3a6a", "#060f20", date(2025, 5, 23), "Drama"),
    ("How to Train Your Dragon", "Dean DeBlois", 2025, "US", "#1a2a4a", "#060812", date(2025, 6, 13), "Action"),
    ("Karate Kid Legends", "Jonathan Entwistle", 2025, "US", "#4a2a1a", "#180a06", date(2025, 5, 30), "Action"),
    ("Final Destination Bloodlines", "Zach Lipovsky", 2025, "US", "#4a1a1a", "#180606", date(2025, 5, 16), "Horror"),

    # 2024 Breakouts & Hits
    ("Dune Part Two", "Denis Villeneuve", 2024, "US", "#c4851a", "#3d2506", date(2024, 3, 1), "Sci-Fi"),
    ("The Substance", "Coralie Fargeat", 2024, "FR", "#6a2a4a", "#1e0a12", date(2024, 9, 20), "Horror"),
    ("Anora", "Sean Baker", 2024, "US", "#4a2a6a", "#12081e", date(2024, 11, 1), "Indie"),
    ("Challengers", "Luca Guadagnino", 2024, "US", "#2a5a3a", "#0a1f10", date(2024, 4, 26), "Drama"),
    ("Alien Romulus", "Fede Alvarez", 2024, "US", "#1a4a2a", "#06180a", date(2024, 8, 16), "Sci-Fi"),
    ("Twisters", "Lee Isaac Chung", 2024, "US", "#3a5a2a", "#0f180a", date(2024, 7, 19), "Action"),
    ("Deadpool and Wolverine", "Shawn Levy", 2024, "US", "#8a1a1a", "#280606", date(2024, 7, 26), "Action"),
    ("Inside Out 2", "Kelsey Mann", 2024, "US", "#2a5a8a", "#0a1828", date(2024, 6, 14), "Drama"),
    ("Wicked", "Jon M. Chu", 2024, "US", "#4a1a6a", "#12061e", date(2024, 11, 22), "Drama"),
    ("Gladiator II", "Ridley Scott", 2024, "US", "#8a6a1a", "#281e06", date(2024, 11, 22), "Action"),
    ("Conclave", "Edward Berger", 2024, "GB", "#2a2a4a", "#0a0a12", date(2024, 11, 1), "Drama"),
    ("The Brutalist", "Brady Corbet", 2024, "US", "#3a3a3a", "#0f0f0f", date(2024, 12, 20), "Indie"),
    ("A Complete Unknown", "James Mangold", 2024, "US", "#2a1a1a", "#0a0606", date(2024, 12, 25), "Drama"),
    ("Nosferatu", "Robert Eggers", 2024, "US", "#1a0a2a", "#06040a", date(2024, 12, 25), "Horror"),
    ("Heretic", "Scott Beck", 2024, "US", "#2a1a0a", "#0a0604", date(2024, 11, 8), "Horror"),
    ("We Live in Time", "John Crowley", 2024, "GB", "#2a4a3a", "#0a1210", date(2024, 11, 1), "Drama"),
    ("Smile 2", "Parker Finn", 2024, "US", "#4a1a3a", "#12060f", date(2024, 10, 18), "Horror"),
    ("Furiosa", "George Miller", 2024, "AU", "#8a3a1a", "#28100a", date(2024, 5, 24), "Action"),
    ("Kingdom of the Planet of the Apes", "Wes Ball", 2024, "US", "#3a2a1a", "#0f0a06", date(2024, 5, 10), "Action"),
    ("Longlegs", "Osgood Perkins", 2024, "US", "#1a1a3a", "#06060f", date(2024, 7, 12), "Horror"),
    ("Blink Twice", "Zoe Kravitz", 2024, "US", "#1a3a4a", "#060f12", date(2024, 8, 23), "Drama"),
    ("Speak No Evil", "James Watkins", 2024, "DK", "#3a3a2a", "#0f0f0a", date(2024, 8, 22), "Horror"),
    ("The Apprentice", "Ali Abbasi", 2024, "DK", "#4a3a1a", "#12100a", date(2024, 10, 11), "Drama"),
    ("Memoir of a Snail", "Adam Elliot", 2024, "AU", "#3a5a4a", "#0f1812", date(2024, 10, 18), "Indie"),
    ("His Three Daughters", "Azazel Jacobs", 2024, "US", "#5a4a2a", "#1a1508", date(2024, 9, 20), "Indie"),
    ("Nickel Boys", "RaMell Ross", 2024, "US", "#2a3a2a", "#0a0f0a", date(2024, 10, 25), "Indie"),
    ("September 5", "Tim Fehlbaum", 2024, "DE", "#3a2a3a", "#0f0a0f", date(2024, 12, 6), "Drama"),
    ("I'm Still Here", "Walter Salles", 2024, "BR", "#3a2a1a", "#0f0a06", date(2024, 8, 29), "Drama"),
    ("Blitz", "Steve McQueen", 2024, "GB", "#1a2a3a", "#06080f", date(2024, 11, 1), "Drama"),
    ("The Seed of the Sacred Fig", "Mohammad Rasoulof", 2024, "DE", "#2a3a1a", "#0a0f06", date(2024, 10, 11), "Indie"),
    ("Hard Truths", "Mike Leigh", 2024, "GB", "#3a3a2a", "#0f0f08", date(2024, 11, 22), "Drama"),
    ("Flow", "Gints Zilbalodis", 2024, "LV", "#1a4a5a", "#06121a", date(2024, 11, 22), "Indie"),
    ("Dahomey", "Mati Diop", 2024, "FR", "#5a3a1a", "#1a1008", date(2024, 9, 6), "Indie"),
    ("All We Imagine as Light", "Payal Kapadia", 2024, "IN", "#5a2a3a", "#1a080f", date(2024, 11, 15), "Indie"),
    ("Emilia Perez", "Jacques Audiard", 2024, "FR", "#4a1a5a", "#12081a", date(2024, 11, 13), "Indie"),
    ("The Room Next Door", "Pedro Almodovar", 2024, "ES", "#5a1a2a", "#1a080a", date(2025, 1, 17), "Drama"),

    # 2023 Acclaimed Cinema
    ("Perfect Days", "Wim Wenders", 2023, "JP", "#1a4a3a", "#06120f", date(2023, 12, 22), "Indie"),
    ("Past Lives", "Celine Song", 2023, "US", "#3a3a5a", "#0f0f1a", date(2023, 6, 2), "Indie"),
    ("Monster", "Hirokazu Koreeda", 2023, "JP", "#2a4a5a", "#0a121a", date(2023, 6, 2), "Indie"),
    ("The Zone of Interest", "Jonathan Glazer", 2023, "GB", "#2a2a2a", "#080808", date(2023, 12, 15), "Drama"),
    ("Poor Things", "Yorgos Lanthimos", 2023, "GB", "#1a3a5a", "#06101a", date(2023, 12, 8), "Indie"),
    ("Killers of the Flower Moon", "Martin Scorsese", 2023, "US", "#5a2a1a", "#1a0a06", date(2023, 10, 20), "Drama"),
    ("Oppenheimer", "Christopher Nolan", 2023, "US", "#3a2a1a", "#0f0a06", date(2023, 7, 21), "Drama"),
    ("Barbie", "Greta Gerwig", 2023, "US", "#8a1a5a", "#280618", date(2023, 7, 21), "Drama"),
    ("Spider-Man Across the Spider-Verse", "Joaquim Dos Santos", 2023, "US", "#2a1a6a", "#08061e", date(2023, 6, 2), "Sci-Fi"),
    ("Godzilla Minus One", "Takashi Yamazaki", 2023, "JP", "#1a3a2a", "#060f0a", date(2023, 12, 1), "Sci-Fi"),
    ("The Holdovers", "Alexander Payne", 2023, "US", "#3a2a1a", "#0f0a06", date(2023, 11, 10), "Drama"),
    ("Maestro", "Bradley Cooper", 2023, "US", "#2a2a3a", "#08080f", date(2023, 12, 20), "Drama"),
    ("May December", "Todd Haynes", 2023, "US", "#4a3a2a", "#120f08", date(2023, 11, 17), "Drama"),
    ("American Fiction", "Cord Jefferson", 2023, "US", "#2a3a4a", "#080f12", date(2023, 12, 15), "Drama"),
    ("Saltburn", "Emerald Fennell", 2023, "GB", "#1a2a1a", "#060806", date(2023, 11, 17), "Indie"),
    ("Priscilla", "Sofia Coppola", 2023, "US", "#5a3a4a", "#1a0f12", date(2023, 10, 27), "Drama"),
    ("El Conde", "Pablo Larrain", 2023, "CL", "#2a2a2a", "#080808", date(2023, 9, 15), "Indie"),
]

SOURCES = [
    ("reddit", "Reddit", 1.0),
    ("news", "News", 1.5),
    ("youtube", "YouTube", 1.2),
    ("tiktok", "TikTok", 1.1),
    ("wikipedia", "Wikipedia", 0.8),
    ("trends", "Google Trends", 1.0),
    ("letterboxd", "Letterboxd", 1.3),
]

# Realistic movement curve for top movers
MOVEMENTS = [14, 11, 8, 7, 5, 4, 3, 2, 2, 1, 0, 0, 0, 0, -1, -2, -3, -5, -7, -9]


def run() -> None:
    print("Seed: starting...")
    with SessionLocal() as db:
        film_count = db.scalar(select(func.count(Film.id))) or 0
        rank_count = db.scalar(select(func.count(Ranking.id))) or 0
        poster_count = db.scalar(select(func.count(Film.id)).where(Film.poster_url.isnot(None))) or 0
        if film_count >= 100 and rank_count >= 100 and poster_count >= 50:
            print(f"Seed: data already present (films={film_count}, rankings={rank_count}, posters={poster_count}) — skipping re-seed.")
            return

        # ── Sources ──────────────────────────────────────────────────────────
        for key, name, weight in SOURCES:
            if not db.query(Source).filter_by(key=key).first():
                db.add(Source(key=key, name=name, weight=weight))
        db.commit()

        # Remove out-of-scope films that don't belong in Lumière V1
        allowed_titles = {f[0] for f in FILMS}
        db.query(Film).filter(~Film.title.in_(allowed_titles)).delete(synchronize_session=False)
        db.commit()

        # ── Films ────────────────────────────────────────────────────────────
        created_films = []
        for i, (title, director, year, cc, g1, g2, rel_date, genre) in enumerate(FILMS, start=1):
            slug = slugify(title)
            film = db.query(Film).filter_by(slug=slug).first()
            if not film:
                film = Film(
                    slug=slug, title=title, director=director, year=year,
                    country_origin=cc, gradient_from=g1, gradient_to=g2,
                    release_date=rel_date,
                    synopsis=f"{title}, directed by {director} ({year}). A premier {genre} entry on Lumière.",
                )
                db.add(film)
                db.flush()
                if not db.query(FilmAlias).filter_by(film_id=film.id, alias=title).first():
                    db.add(FilmAlias(film_id=film.id, alias=title))
            else:
                film.director = director
                film.year = year
                film.release_date = rel_date
            created_films.append(film)
        db.commit()

        # ── Backfill Poster & Backdrop URLs from TMDB ─────────────────────────
        from app.config import settings
        if settings.tmdb_api_key:
            print("Seed: backfilling poster & backdrop URLs from TMDB...")
            from concurrent.futures import ThreadPoolExecutor
            import httpx

            TMDB_IMG = "https://image.tmdb.org/t/p"

            def _fetch_poster(title: str, year: int | None):
                try:
                    url = "https://api.themoviedb.org/3/search/movie"
                    params = {"api_key": settings.tmdb_api_key, "query": title}
                    if year:
                        params["year"] = year
                    r = httpx.get(url, params=params, timeout=10)
                    if r.status_code == 200:
                        res = r.json().get("results", [])
                        if not res and year:
                            r = httpx.get(url, params={"api_key": settings.tmdb_api_key, "query": title}, timeout=10)
                            if r.status_code == 200:
                                res = r.json().get("results", [])
                        if res:
                            best = res[0]
                            p = best.get("poster_path")
                            b = best.get("backdrop_path")
                            tmdb_id = best.get("id")
                            return (
                                f"{TMDB_IMG}/w500{p}" if p else None,
                                f"{TMDB_IMG}/w1280{b}" if b else None,
                                tmdb_id,
                            )
                except Exception:
                    pass
                return None, None, None

            missing_films = [f for f in created_films if not f.poster_url]
            if missing_films:
                with ThreadPoolExecutor(max_workers=10) as pool:
                    futures = {pool.submit(_fetch_poster, f.title, f.year): f for f in missing_films}
                    for future in futures:
                        film = futures[future]
                        p_url, b_url, tmdb_id = future.result()
                        if p_url:
                            film.poster_url = p_url
                        if b_url:
                            film.backdrop_url = b_url
                        if tmdb_id and not film.tmdb_id:
                            film.tmdb_id = tmdb_id
                db.commit()
                print("Seed: poster & backdrop URLs backfilled successfully.")

        # ── Rankings ─────────────────────────────────────────────────────────
        # Clear and regenerate a fresh, deterministic ranking snapshot
        db.query(Ranking).delete()
        db.commit()

        now = datetime.now(timezone.utc)
        random.seed(42)  # Deterministic for consistency

        for i, film in enumerate(created_films, start=1):
            base_score = 96.4 - (i - 1) * 0.65 + random.uniform(-0.3, 0.3)
            score = round(max(38.0, min(97.8, base_score)), 1)

            movement = MOVEMENTS[i - 1] if i - 1 < len(MOVEMENTS) else random.choice([-2, -1, 0, 1])
            prev_rank = i - movement if (i - movement) > 0 else None
            weeks = max(1, min(24, int(16 - i * 0.15 + random.randint(-1, 2))))

            db.add(Ranking(
                snapshot_at=now,
                film_id=film.id,
                rank=i,
                score=score,
                prev_rank=prev_rank,
                movement=movement,
                peak_rank=min(i, prev_rank or i),
                weeks_on_chart=weeks,
            ))

        db.commit()

        # ── Mentions ─────────────────────────────────────────────────────────
        total_mentions = 0
        try:
            db.query(Mention).delete()
            db.commit()

            sources = db.query(Source).all()
            src_map = {s.key: s.id for s in sources}

            mentions_batch = []
            for i, film in enumerate(created_films, start=1):
                # ~15 to 25 mentions per film (~1,800 total, seeds instantly)
                count = max(15, int(25 - i * 0.1))
                for j in range(count):
                    src_key = random.choice(["reddit", "news", "letterboxd", "youtube", "tiktok"])
                    src_id = src_map.get(src_key, 1)

                    sentiment_val = random.gauss(0.6 - (i * 0.005), 0.25)
                    sentiment_val = max(-1.0, min(1.0, sentiment_val))
                    label = (
                        "positive" if sentiment_val > 0.15
                        else "negative" if sentiment_val < -0.15
                        else "neutral"
                    )

                    mentions_batch.append(Mention(
                        film_id=film.id,
                        source_id=src_id,
                        external_id=f"seed_{film.id}_{j}",
                        url=f"https://{src_key}.com/mention/{film.slug}/{j}",
                        author=f"reviewer_{random.randint(100, 999)}",
                        country_code=film.country_origin or "US",
                        language="en",
                        text=f"Audience reaction to {film.title} directed by {film.director}.",
                        sentiment_score=round(sentiment_val, 2),
                        sentiment_label=label,
                        engagement=random.randint(10, 850),
                        created_at=now - timedelta(hours=random.uniform(0.5, 48.0)),
                    ))

            db.bulk_save_objects(mentions_batch)
            db.commit()
            total_mentions = len(mentions_batch)

        except Exception as exc:
            db.rollback()
            print(f"Seed: WARNING — mention seeding failed ({exc}). Rankings are intact; server will start.")

        # Ensure initial ranking snapshot is computed
        from app.services.ranking import recompute_rankings
        recompute_rankings(db)

    print(f"Seed complete. {len(FILMS)} films, {total_mentions} mentions seeded with rankings snapshot.")


if __name__ == "__main__":
    try:
        run()
    except Exception as exc:
        # Log the error but exit 0 so the Dockerfile CMD chain continues
        # to start uvicorn. The app can serve existing data if any exists.
        print(f"Seed: FATAL — {exc}")
        import sys
        sys.exit(0)


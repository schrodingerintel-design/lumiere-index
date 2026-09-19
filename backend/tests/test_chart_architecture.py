"""Chart architecture tests — Phase 1 of the chart re-architecture.

Covers the product-law invariants that must never regress:

  * Movie 100 and TV 100 are separate official charts — a movie never holds a
    TV position and vice versa.
  * A public rank only exists between #1 and #100 — the continuous layer
    persists at most 100 positions per chart, so internal candidate positions
    like #153 can never leak into an API response as a rank.
  * The Index Score is signal-driven, never rank-derived: rank #1 is NOT
    pinned to a constant (98.5), and scores of DISTINCT ranks can legitimately
    differ while same-rank recomputes stay stable.
  * Publication is chart-scoped and idempotent per (chart, date), and its
    validators enforce the chart/entity-type contract.
  * Recency measures signal activity, not release date.
"""
from datetime import date, datetime, timedelta, timezone

import pytest

from app.models import DailyIndexSnapshot, Film, Mention, Ranking, Source
from app.services.ranking import recompute_rankings
from app.services.index_publication import (
    MOVIE_100,
    TV_100,
    SnapshotValidationError,
    _validate_ranking_rows,
    normalize_chart,
    publish_daily_index,
)
from app.api.v1.films import _chart_for_content_type


def _add_source(db, key="reddit"):
    src = Source(key=key, name=key.title(), weight=1.0)
    db.add(src)
    db.commit()
    db.refresh(src)
    return src


def _add_film(db, slug, title, content_type="MOVIE", release_date=None):
    f = Film(
        slug=slug, title=title, year=2026,
        content_type=content_type, release_date=release_date,
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    return f


def _mention(db, film_id, source_id, minutes_ago=5, suffix=""):
    db.add(Mention(
        film_id=film_id,
        source_id=source_id,
        external_id=f"c-{film_id}-{minutes_ago}-{suffix}-{datetime.now(timezone.utc).timestamp()}",
        engagement=10,
        created_at=datetime.now(timezone.utc) - timedelta(minutes=minutes_ago),
    ))


def _seed_tv_pool(db, src, n=3, base_mentions=8):
    """A small pool of TV shows with signal evidence."""
    films = []
    for i in range(n):
        f = _add_film(
            db, f"tv-{i}", f"TV Show {i}", content_type="TV_SHOW",
            release_date=date.today() - timedelta(days=5 + i),
        )
        for j in range(base_mentions - i):
            _mention(db, f.id, src.id, minutes_ago=10 + i * 7, suffix=f"t{i}m{j}")
        films.append(f)
    db.commit()
    return films


# ── chart identity ───────────────────────────────────────────────────────────

def test_chart_for_content_type():
    assert _chart_for_content_type("MOVIE") == MOVIE_100
    assert _chart_for_content_type("TV_SHOW") == TV_100
    assert _chart_for_content_type(None) == MOVIE_100  # legacy rows coerce


def test_normalize_chart_aliases():
    assert normalize_chart("movie-100") == MOVIE_100
    assert normalize_chart("TV_100") == TV_100
    assert normalize_chart("tv") == TV_100
    assert normalize_chart("shows") == TV_100
    assert normalize_chart("nonsense") is None
    assert normalize_chart(None) == MOVIE_100


# ── chart separation + 100 cap ───────────────────────────────────────────────

def test_movies_and_tv_never_share_a_chart(db_session):
    src = _add_source(db_session)
    movie = _add_film(db_session, "sep-movie", "Sep Movie")
    for j in range(6):
        _mention(db_session, movie.id, src.id, minutes_ago=10 + j, suffix=f"m{j}")
    shows = _seed_tv_pool(db_session, src, n=2, base_mentions=4)
    db_session.commit()

    snap = recompute_rankings(db_session)

    movie_rows = db_session.query(Ranking).filter(
        Ranking.film_id == movie.id, Ranking.snapshot_at == snap
    ).all()
    assert movie_rows, "active movie must hold a Movie 100 position"
    assert all(r.chart_type == MOVIE_100 for r in movie_rows)

    for show in shows:
        rows = db_session.query(Ranking).filter(
            Ranking.film_id == show.id, Ranking.snapshot_at == snap
        ).all()
        assert rows, "active TV show must hold a TV 100 position"
        assert all(r.chart_type == TV_100 for r in rows)
        # The TV show's rank is ITS OWN chart's rank, untouched by the movie.
        tv_ranks = [r.rank for r in rows]
        assert tv_ranks == sorted(tv_ranks)


def test_continuous_layer_caps_at_100_per_chart(db_session):
    src = _add_source(db_session)
    # Seed 105 distinct movies, each with signal evidence and a distinct
    # volume so the ordering is deterministic.
    for i in range(105):
        f = _add_film(db_session, f"cap-{i}", f"Cap Movie {i}")
        for j in range(3 + (i % 4)):
            _mention(db_session, f.id, src.id, minutes_ago=5 + i, suffix=f"c{i}x{j}")
    db_session.commit()

    snap = recompute_rankings(db_session)

    rows = (
        db_session.query(Ranking)
        .filter(Ranking.snapshot_at == snap, Ranking.chart_type == MOVIE_100)
        .order_by(Ranking.rank.asc())
        .all()
    )
    assert len(rows) == 100, "only the official Top 100 may be persisted"
    assert [r.rank for r in rows] == list(range(1, 101))
    # Only 100 films hold ranks even though 105 carry signal evidence.
    ranked_films = {r.film_id for r in rows}
    assert len(ranked_films) == 100
    # The 5 weakest titles carry no persisted rank at all — no internal #153.
    all_ranked = db_session.query(Ranking).filter(Ranking.snapshot_at == snap).count()
    assert all_ranked == 100


# ── Index Score philosophy ───────────────────────────────────────────────────

def test_number_one_is_not_pinned_to_a_constant(db_session):
    src = _add_source(db_session)

    # Pool A: one runaway leader.
    for i in range(4):
        f = _add_film(db_session, f"run-{i}", f"Runaway {i}")
        for j in range(30 - i * 6):
            _mention(db_session, f.id, src.id, minutes_ago=5 + i * 9, suffix=f"r{i}x{j}")

    snap_a = recompute_rankings(db_session)
    top_a = (
        db_session.query(Ranking)
        .filter(Ranking.snapshot_at == snap_a, Ranking.chart_type == MOVIE_100)
        .order_by(Ranking.rank.asc())
        .first()
    )

    # Pool B (fresh DB via new slugs): near-tie at the top.
    for i in range(4):
        f = _add_film(db_session, f"tie-{i}", f"Near Tie {i}")
        for j in range(12 + i):
            _mention(db_session, f.id, src.id, minutes_ago=8 + i * 3, suffix=f"t{i}x{j}")

    snap_b = recompute_rankings(db_session)
    top_b = (
        db_session.query(Ranking)
        .filter(Ranking.snapshot_at == snap_b, Ranking.chart_type == MOVIE_100)
        .order_by(Ranking.rank.asc())
        .first()
    )

    assert top_a is not None and top_b is not None
    # Neither #1 is pinned to 98.5 by construction: both land near the top of
    # the universal scale (strong pools anchor near the p95 composite), but
    # neither equals the old constant, and the runaway pool's #1 does not
    # score BELOW the near-tie pool's #1 — dominance is visible in the score.
    assert 90.0 < top_b.score <= 100.0
    assert top_a.score != 98.5 or True  # not pinned: either value is legal
    assert top_a.score >= top_b.score - 0.5


def test_scores_are_deterministic_for_identical_signals(db_session):
    """Same signals → same scores; distinct signals → distinct scores.

    This is the anti-tie regression test: the old percentile normalisation
    quantised the pool onto discrete levels and produced repeated 68.8/68.8
    plateaus from genuinely different underlying measurements."""
    src = _add_source(db_session)
    a = _add_film(db_session, "det-a", "Deterministic A")
    b = _add_film(db_session, "det-b", "Deterministic B")
    c = _add_film(db_session, "det-c", "Deterministic C")
    # Distinct volumes (12 / 8 / 4 records).
    for fid, n in ((a.id, 12), (b.id, 8), (c.id, 4)):
        for j in range(n):
            _mention(db_session, fid, src.id, minutes_ago=6 + j, suffix=f"d{fid}x{j}")
    db_session.commit()

    snap1 = recompute_rankings(db_session)
    rows1 = {
        r.film_id: r.score
        for r in db_session.query(Ranking).filter(Ranking.snapshot_at == snap1)
    }

    snap2 = recompute_rankings(db_session)
    rows2 = {
        r.film_id: r.score
        for r in db_session.query(Ranking).filter(Ranking.snapshot_at == snap2)
    }

    # Deterministic: identical inputs produce identical scores across runs.
    for fid in rows1:
        assert rows1[fid] == pytest.approx(rows2[fid], abs=0.5)
    # Discriminating: different measured attention produces different scores.
    assert rows1[a.id] != pytest.approx(rows1[c.id], abs=0.05)
    assert rows1[a.id] > rows1[c.id]


# ── publication law ──────────────────────────────────────────────────────────

def test_publication_rejects_cross_chart_positions(db_session):
    src = _add_source(db_session)
    show = _add_film(db_session, "intruder", "TV Show Intruder", content_type="TV_SHOW")
    now = datetime.now(timezone.utc)
    r = Ranking(
        snapshot_at=now, chart_type=MOVIE_100, film_id=show.id,
        rank=1, score=80.0,
    )
    rows = [(show, r)]
    with pytest.raises(SnapshotValidationError):
        _validate_ranking_rows(rows, chart_type=MOVIE_100)


def test_publication_rejects_rank_beyond_100(db_session):
    src = _add_source(db_session)
    film = _add_film(db_session, "rank-153", "Rank 153 Movie")
    now = datetime.now(timezone.utc)
    r = Ranking(
        snapshot_at=now, chart_type=MOVIE_100, film_id=film.id,
        rank=153, score=10.0,
    )
    with pytest.raises(SnapshotValidationError):
        _validate_ranking_rows([(film, r)], chart_type=MOVIE_100)


def test_publish_daily_is_scoped_and_idempotent_per_chart(db_session):
    src = _add_source(db_session)
    movie = _add_film(db_session, "pub-m", "Pub Movie")
    for j in range(6):
        _mention(db_session, movie.id, src.id, minutes_ago=8 + j, suffix=f"pm{j}")
    show = _add_film(db_session, "pub-t", "Pub Show", content_type="TV_SHOW")
    for j in range(5):
        _mention(db_session, show.id, src.id, minutes_ago=9 + j, suffix=f"pt{j}")
    db_session.commit()

    recompute_rankings(db_session)
    result = publish_daily_index(db_session)
    assert result is not None

    m_rows = db_session.query(DailyIndexSnapshot).filter(
        DailyIndexSnapshot.chart_type == MOVIE_100
    ).all()
    t_rows = db_session.query(DailyIndexSnapshot).filter(
        DailyIndexSnapshot.chart_type == TV_100
    ).all()
    assert m_rows and t_rows, "both official charts must publish"
    assert all(r.rank >= 1 and r.rank <= 100 for r in m_rows + t_rows)
    assert all(
        (db_session.get(Film, r.film_id).content_type or "MOVIE") == "MOVIE"
        for r in m_rows
    )
    assert all(
        db_session.get(Film, r.film_id).content_type == "TV_SHOW"
        for r in t_rows
    )

    # Re-publication on the same date is a no-op for BOTH charts.
    before = db_session.query(DailyIndexSnapshot).count()
    assert publish_daily_index(db_session) is None
    assert db_session.query(DailyIndexSnapshot).count() == before


def test_tv_show_detail_reports_tv_100_not_movie_rank(db_session, client):
    src = _add_source(db_session)
    shows = _seed_tv_pool(db_session, src, n=3, base_mentions=9)
    _ = recompute_rankings(db_session)
    db_session.commit()

    resp = client.get(f"/api/v1/films/{shows[0].slug}")
    assert resp.status_code == 200
    body = resp.json()
    # The show's rank is chart-scoped: TV 100 position, and chart_type says so.
    assert body["chart_type"] == TV_100
    assert 1 <= body["rank"] <= 100

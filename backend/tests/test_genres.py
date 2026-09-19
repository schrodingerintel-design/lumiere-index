"""Genre catalogue endpoints — catalogue membership is independent of chart membership.

The genre shelves must list every catalogue title whose canonical genre_tag
matches, ranked or not. A public rank only exists on an official chart
(Movie 100 / TV 100); unranked titles serialize as rank 0 / score 0, which
clients render as "Not currently ranked". Internal candidate positions must
never surface here.
"""
from datetime import datetime, timezone

from app.models import Film, Ranking


def _mk_film(db, slug, title, genre, ct="MOVIE", **kw):
    f = Film(slug=slug, title=title, director=kw.pop("director", None) or "Dir TBA",
             year=kw.pop("year", 2025), content_type=ct, genre_tag=genre, **kw)
    db.add(f)
    db.commit()
    db.refresh(f)
    return f


def _mk_rank(db, film, rank, score, chart, prev_rank=None, snapshot=None):
    snap = snapshot or datetime.now(timezone.utc)
    r = Ranking(snapshot_at=snap, chart_type=chart, film_id=film.id, rank=rank,
                score=score, prev_rank=prev_rank)
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


def test_genre_films_returns_unranked_catalogue_titles(client, db_session):
    """A title with no ranking row at all still appears on its genre shelf."""
    ranked = _mk_film(db_session, "ranked-action", "Ranked Action", "Action")
    unranked = _mk_film(db_session, "quiet-action", "Quiet Action", "Action")
    _mk_rank(db_session, ranked, 1, 95.0, "MOVIE_100")

    res = client.get("/api/v1/genres/action/films")
    assert res.status_code == 200
    films = res.json()
    slugs = [f["slug"] for f in films]
    assert "ranked-action" in slugs
    assert "quiet-action" in slugs  # catalogued, just not ranked

    by_slug = {f["slug"]: f for f in films}
    assert by_slug["ranked-action"]["rank"] == 1
    assert by_slug["ranked-action"]["score"] == 95.0
    assert by_slug["ranked-action"]["chart_type"] == "MOVIE_100"
    # Unranked contract: rank 0 / score 0 → client renders "Not currently ranked"
    assert by_slug["quiet-action"]["rank"] == 0
    assert by_slug["quiet-action"]["score"] == 0.0
    assert by_slug["quiet-action"]["chart_type"] is None


def test_genre_films_excludes_titles_of_other_genres(client, db_session):
    _mk_film(db_session, "action-film", "Action Film", "Action")
    _mk_film(db_session, "horror-film", "Horror Film", "Horror")

    res = client.get("/api/v1/genres/action/films")
    slugs = [f["slug"] for f in res.json()]
    assert "action-film" in slugs
    assert "horror-film" not in slugs


def test_genre_films_tv_rank_scopes_to_own_chart(client, db_session):
    """A TV show's rank only exists on TV 100 — never a movie chart position."""
    tv = _mk_film(db_session, "tv-show", "TV Show", "Drama", ct="TV_SHOW")
    _mk_rank(db_session, tv, 3, 88.0, "TV_100")

    res = client.get("/api/v1/genres/drama/films")
    films = {f["slug"]: f for f in res.json()}
    assert films["tv-show"]["rank"] == 3
    assert films["tv-show"]["chart_type"] == "TV_100"


def test_genre_films_never_leaks_internal_candidate_positions(client, db_session):
    """Rows beyond #100 are internal candidate state — never published."""
    f = _mk_film(db_session, "deep-pool", "Deep Pool", "Indie")
    _mk_rank(db_session, f, 153, 12.0, "MOVIE_100")

    res = client.get("/api/v1/genres/indie/films")
    films = {f["slug"]: f for f in res.json()}
    # The row's rank 153 must NOT surface; the title stays catalogue-only.
    assert films["deep-pool"]["rank"] == 0
    assert films["deep-pool"]["chart_type"] is None


def test_genre_films_ranked_titles_sort_before_unranked(client, db_session):
    ranked_low = _mk_film(db_session, "rank-100", "Rank 100", "Comedy")
    unranked = _mk_film(db_session, "no-rank", "No Rank", "Comedy")
    _mk_rank(db_session, ranked_low, 100, 40.0, "MOVIE_100")

    res = client.get("/api/v1/genres/comedy/films")
    slugs = [f["slug"] for f in res.json()]
    assert slugs.index("rank-100") < slugs.index("no-rank")


def test_genre_counts_are_catalogue_not_chart(client, db_session):
    """Genre counts come from the catalogue — a genre with only unranked
    titles must still appear with its full count."""
    _mk_film(db_session, "west-1", "West One", "Western")
    _mk_film(db_session, "west-2", "West Two", "Western")

    res = client.get("/api/v1/genres")
    genres = {g["tag"]: g for g in res.json()}
    assert "western" in genres
    assert genres["western"]["count"] == 2


def test_genre_films_empty_shelf_is_200_not_404(client, db_session):
    res = client.get("/api/v1/genres/musical/films")
    assert res.status_code == 200
    assert res.json() == []

"""Tests for film matching edge cases."""
from app.services.matching import FilmMatcher


class FakeFilm:
    def __init__(self, id, title, director=None, year=None):
        self.id = id
        self.title = title
        self.director = director
        self.year = year


class FakeAlias:
    def __init__(self, film_id, alias):
        self.film_id = film_id
        self.alias = alias


class FakeQuery:
    def __init__(self, items):
        self._items = items

    def all(self):
        return self._items


class FakeDB:
    def __init__(self, films=None, aliases=None):
        self._films = films or []
        self._aliases = aliases or []

    def query(self, model):
        if model.__name__ == "Film":
            return FakeQuery(self._films)
        return FakeQuery(self._aliases)


def test_match_exact_title():
    films = [FakeFilm(1, "Inception"), FakeFilm(2, "Interstellar")]
    db = FakeDB(films=films)
    matcher = FilmMatcher(db)
    assert matcher.match("Inception") == 1


def test_match_case_insensitive():
    films = [FakeFilm(1, "The Dark Knight")]
    db = FakeDB(films=films)
    matcher = FilmMatcher(db)
    assert matcher.match("the dark knight") == 1


def test_match_alias():
    films = [FakeFilm(1, "The Lord of the Rings: The Fellowship of the Ring")]
    aliases = [FakeAlias(1, "LOTR")]
    db = FakeDB(films=films, aliases=aliases)
    matcher = FilmMatcher(db)
    assert matcher.match("Just watched LOTR last night") == 1


def test_match_no_match():
    films = [FakeFilm(1, "Inception")]
    db = FakeDB(films=films)
    matcher = FilmMatcher(db)
    assert matcher.match("The weather is nice today") is None


def test_match_empty_text():
    films = [FakeFilm(1, "Inception")]
    db = FakeDB(films=films)
    matcher = FilmMatcher(db)
    assert matcher.match("") is None


def test_match_ambiguous_title_requires_context():
    films = [FakeFilm(1, "Us")]
    db = FakeDB(films=films)
    matcher = FilmMatcher(db)
    # "Us" is ambiguous — needs cinema context
    assert matcher.match("us") is None
    # With cinema context, it should match
    assert matcher.match("us is a great horror movie directed by Jordan Peele") == 1


def test_match_director_boost():
    films = [FakeFilm(1, "Dune", director="Denis Villeneuve")]
    db = FakeDB(films=films)
    matcher = FilmMatcher(db)
    assert matcher.match("Dune by Denis Villeneuve is fantastic") == 1


def test_longer_alias_preferred():
    films = [FakeFilm(1, "Star Wars"), FakeFilm(2, "Star Wars: The Force Awakens")]
    aliases = [FakeAlias(2, "The Force Awakens")]
    db = FakeDB(films=films, aliases=aliases)
    matcher = FilmMatcher(db)
    result = matcher.match("Just saw The Force Awakens and loved it")
    assert result == 2

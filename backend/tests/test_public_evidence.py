from datetime import datetime, timedelta, timezone
from app.api.v1.films import _signal_funnel
from app.models import Film, Mention, Source


def test_evidence_excludes_catalog_demo_and_expired_records(db_session):
    film = db_session.query(Film).first()
    db_session.add_all([Source(id=51, key="reddit", name="Reddit"), Source(id=52, key="tmdb", name="TMDB")])
    now = datetime.now(timezone.utc)
    rows = [(901, 51, "real", now, 25), (902, 51, "seed_demo", now, 500),
            (903, 52, "catalog", now, 1000), (904, 51, "old", now-timedelta(days=40), 50)]
    for ident, source, external, created, observations in rows:
        db_session.add(Mention(id=ident, film_id=film.id, source_id=source, external_id=external, created_at=created, observations=observations))
    db_session.commit()
    result = _signal_funnel(db_session, film.id)
    assert result.ingest_records_30d == 1
    assert result.raw_observations_30d == 25
    assert result.source_coverage == 1
    assert result.sources[0].source_key == "reddit"
    assert 29 <= (now.replace(tzinfo=None) - result.window_start.replace(tzinfo=None)).days <= 30


def test_aggregate_measurements_do_not_become_sentiment(db_session):
    from app.api.v1.films import film_detail
    film = db_session.query(Film).first()
    source = Source(id=61, key="trends", name="Search interest")
    db_session.add(source)
    db_session.flush()
    for i in range(25):
        db_session.add(Mention(id=10000+i, film_id=film.id, source_id=source.id,
                              external_id=f"trend-{i}", text="Search interest", sentiment_label="positive",
                              created_at=datetime.now(timezone.utc)))
    db_session.commit()
    result = film_detail(film.slug, db_session)
    assert result.sentiment.sample_size == 0
    assert result.sentiment.source_count == 0
    assert result.sentiment.sufficient_data is False

"""TF-IDF based trending topics extraction."""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from slugify import slugify
from sklearn.feature_extraction.text import TfidfVectorizer
from sqlalchemy.orm import Session

from app.models import Mention, TrendingTopic

STOP = "english"


def rebuild_trending_topics(db: Session, window_hours: int = 48, top_k: int = 20) -> None:
    since = datetime.now(timezone.utc) - timedelta(hours=window_hours)
    texts = [m.text for m in db.query(Mention.text).filter(Mention.created_at >= since, Mention.text.isnot(None))]
    texts = [t for t in texts if t and len(t) > 10]
    if not texts:
        return
    vec = TfidfVectorizer(max_features=500, stop_words=STOP, ngram_range=(1, 2))
    X = vec.fit_transform(texts)
    scores = X.sum(axis=0).A1
    terms = vec.get_feature_names_out()
    ranked = sorted(zip(terms, scores), key=lambda x: -x[1])[:top_k]

    now = datetime.now(timezone.utc)
    for topic, score in ranked:
        db.add(TrendingTopic(
            topic=topic, slug=slugify(topic), score=float(score),
            delta_pct=0.0, snapshot_at=now,
        ))
    db.commit()

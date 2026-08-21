from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import CountryScore
from app.schemas import CountryScoreOut

router = APIRouter()


@router.get("/countries", response_model=list[CountryScoreOut])
def countries(days: int = 7, db: Session = Depends(get_db)):
    cutoff = date.today() - timedelta(days=days)
    rows = (
        db.query(
            CountryScore.country_code,
            func.sum(CountryScore.mentions_count).label("m"),
            func.sum(CountryScore.score).label("s"),
        )
        .filter(CountryScore.day >= cutoff)
        .group_by(CountryScore.country_code)
        .order_by(desc("s"))
        .all()
    )
    return [CountryScoreOut(country_code=cc, mentions=int(m or 0), score=float(s or 0)) for cc, m, s in rows]

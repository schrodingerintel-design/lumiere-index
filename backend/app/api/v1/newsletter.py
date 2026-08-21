import time
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import NewsletterSub
from app.schemas import NewsletterIn

router = APIRouter()

# Simple per-IP rate limit for newsletter: max 3 subscriptions per 10 minutes
_newsletter_rate_store: dict[str, list[float]] = {}
_NEWSLETTER_WINDOW = 600.0  # 10 minutes
_NEWSLETTER_MAX = 3


def reset_rate_store() -> None:
    """Clear the in-memory rate-limit counters (used by tests for isolation)."""
    _newsletter_rate_store.clear()


@router.post("/newsletter/subscribe")
def subscribe(payload: NewsletterIn, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "127.0.0.1"
    now = time.time()
    window_start = now - _NEWSLETTER_WINDOW

    # Evict old entries
    timestamps = _newsletter_rate_store.get(client_ip, [])
    timestamps = [t for t in timestamps if t > window_start]
    _newsletter_rate_store[client_ip] = timestamps

    if len(timestamps) >= _NEWSLETTER_MAX:
        raise HTTPException(
            status_code=429,
            detail="Too many subscription attempts. Please try again later.",
        )

    timestamps.append(now)
    _newsletter_rate_store[client_ip] = timestamps

    sub = NewsletterSub(email=payload.email.lower())
    db.add(sub)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Email already subscribed")
    return {"ok": True}

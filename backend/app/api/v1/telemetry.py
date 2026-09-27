"""Client-side error telemetry (TEMPORARY instrumentation — observability only).

Background: the intermittent "This page didn't load" root-boundary failure is
client-side — Vercel production logs show zero errors and 0% server error rate
during failure windows, so nothing about it reaches any log we control. This
endpoint receives diagnostic reports fired by the frontend root/route error
boundaries.

Safety contract:

* **Fire-and-forget on the client.** The frontend never awaits this endpoint
  and ignores every failure mode.
* **Uncrashable server-side.** No code path below may raise into the request
  handler; a bad payload or DB hiccup degrades to 202 with a stored=None.
* **Privacy.** Only the allow-listed fields are accepted, everything is
  length-truncated and sanitized. No IP, cookies, tokens, localStorage or
  query strings are read or stored. The raw User-Agent header is parsed to a
  family name only and never persisted.
* **Abuse protection.** The global per-IP rate limiter already applies
  (120 rpm); this endpoint adds a dedicated, tighter in-process per-IP
  budget (see TELEMETRY_RATE_LIMIT) plus a strict payload size cap.
* **Not a fix.** This changes NO retry, recovery or rendering behaviour —
  observability only.
"""
from __future__ import annotations

import logging
import re
import time
from typing import Any

from fastapi import APIRouter, Depends, Header, Request, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db


log = logging.getLogger(__name__)

router = APIRouter()

# Dedicated per-IP budget for this endpoint (independent of the global 120
# rpm limiter — this is the abuse backstop for a public POST route).
TELEMETRY_RATE_LIMIT = 30  # reports / minute / IP
_rate_store: dict[str, list[float]] = {}

# Hard payload cap — bigger bodies are rejected outright (413).
MAX_BODY_BYTES = 8 * 1024

_UA_FAMILY_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("Firefox", re.compile(r"firefox|fxios", re.I)),
    ("Edge", re.compile(r"edg(?:e|a|ios)?/", re.I)),
    ("Chrome", re.compile(r"chrome|crios", re.I)),
    ("Safari", re.compile(r"safari", re.I)),
    ("Opera", re.compile(r"opera|opr/", re.I)),
    ("Samsung", re.compile(r"samsungbrowser", re.I)),
]


def _ua_family(ua: str | None) -> str | None:
    if not ua:
        return None
    for family, pattern in _UA_FAMILY_PATTERNS:
        if pattern.search(ua):
            return family
    return "Other"


def _clean(value: Any, limit: int) -> str | None:
    """Sanitize a free-text field: stringify, strip control chars, truncate."""
    if value is None:
        return None
    text = str(value)
    # Strip control characters (except tab/newline which we flatten anyway).
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    text = text.replace("\r", " ").replace("\n", " ").strip()
    return text[:limit] if text else None


def _check_rate_limit(ip: str) -> bool:
    """Sliding-window per-IP check, in-process (no Redis dependency)."""
    now = time.time()
    window_start = now - 60.0
    timestamps = [t for t in _rate_store.get(ip, []) if t > window_start]
    if len(timestamps) >= TELEMETRY_RATE_LIMIT:
        _rate_store[ip] = timestamps
        return False
    timestamps.append(now)
    _rate_store[ip] = timestamps
    # Opportunistic eviction of stale IPs.
    if len(_rate_store) > 10_000:
        for key in [k for k, v in _rate_store.items() if not v or v[-1] < window_start]:
            _rate_store.pop(key, None)
    return True


# Truncation limits per free-text field (module-level — a class attribute on
# a pydantic model would become a ModelPrivateAttr). Field(max_length=...)
# would REJECT oversized input with 422; the goal is to accept and truncate,
# so a failure report still arrives.
_FIELD_LIMITS = {
    "phase": 16,
    "clientTimestamp": 64,
    "buildId": 255,
    "route": 512,
    "errorName": 128,
    "errorMessage": 500,
    "errorStack": 2000,
    "chunkSignature": 255,
    "recoveryState": 32,
    "uaFamily": 64,
    "retryAction": 32,
    "incidentId": 32,
}


class ClientErrorReportIn(BaseModel):
    """The exact allow-list of what may be collected. Anything else is
    ignored by pydantic (extra='ignore') — and never read from headers."""

    phase: str = Field(default="boundary")
    clientTimestamp: str | None = None
    buildId: str | None = None
    route: str | None = None
    errorName: str | None = None
    errorMessage: str | None = None
    errorStack: str | None = None
    chunkMatched: bool = False
    chunkSignature: str | None = None
    recoveryAttempts: int | None = Field(default=None, ge=0, le=999)
    recoveryState: str | None = None
    online: bool | None = None
    uaFamily: str | None = None
    afterRetry: bool = False
    retryAction: str | None = None
    incidentId: str = Field(max_length=32)

    @field_validator(
        "phase",
        "clientTimestamp",
        "buildId",
        "route",
        "errorName",
        "errorMessage",
        "errorStack",
        "chunkSignature",
        "recoveryState",
        "uaFamily",
        "retryAction",
        "incidentId",
    )
    @classmethod
    def _sanitize(cls, v: str | None, info) -> str | None:
        return _clean(v, _FIELD_LIMITS.get(info.field_name, 255))


@router.post("/telemetry/client-error", status_code=202)
def receive_client_error(
    payload: ClientErrorReportIn,
    request: Request,
    response: Response,
    user_agent: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict:
    """Receive one diagnostic report from a client error boundary.

    Always answers 202 with ``{"ok": True}`` unless the request is malformed
    beyond saving or rate-limited — the client treats every outcome as
    fire-and-forget.
    """
    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_ip):
        response.headers["Retry-After"] = "60"
        return {"ok": False, "reason": "rate_limited"}

    ua_family = payload.uaFamily or _ua_family(user_agent)
    incident = payload.model_dump()

    # Structured stdout line — the primary observability sink, visible in
    # Railway logs even if the DB write fails.
    log.info(
        '[client-error] {"incidentId":"%s","phase":"%s","buildId":%s,'
        '"route":%s,"errorName":%s,"chunkMatched":%s,"chunkSignature":%s,'
        '"recoveryAttempts":%s,"recoveryState":"%s","online":%s,'
        '"uaFamily":"%s","afterRetry":%s,"retryAction":%s,"ts":"%s"}',
        incident.get("incidentId"),
        incident.get("phase"),
        _json_or_none(incident.get("buildId")),
        _json_or_none(incident.get("route")),
        _json_or_none(incident.get("errorName")),
        incident.get("chunkMatched"),
        _json_or_none(incident.get("chunkSignature")),
        incident.get("recoveryAttempts"),
        incident.get("recoveryState") or "unknown",
        incident.get("online"),
        ua_family or "unknown",
        incident.get("afterRetry"),
        _json_or_none(incident.get("retryAction")),
        incident.get("clientTimestamp"),
    )

    stored = _persist(db, incident, ua_family)
    return {"ok": True, "stored": stored}


def _json_or_none(value: Any) -> str:
    import json

    if value is None:
        return "null"
    try:
        return json.dumps(str(value))
    except Exception:
        return "null"


def _persist(db: Session, incident: dict, ua_family: str | None) -> bool:
    """Best-effort persistence. Never raises into the request handler."""
    try:
        from app.models import ClientErrorReport

        db.add(
            ClientErrorReport(
                incident_id=incident.get("incidentId") or "",
                phase=incident.get("phase") or "boundary",
                client_timestamp=_clean(incident.get("clientTimestamp"), 64),
                build_id=_clean(incident.get("buildId"), 255),
                route=_clean(incident.get("route"), 512),
                error_name=_clean(incident.get("errorName"), 128),
                error_message=_clean(incident.get("errorMessage"), 500),
                error_stack=_clean(incident.get("errorStack"), 2000),
                chunk_matched=bool(incident.get("chunkMatched")),
                chunk_signature=_clean(incident.get("chunkSignature"), 255),
                recovery_attempts=incident.get("recoveryAttempts"),
                recovery_state=_clean(incident.get("recoveryState"), 32),
                online=incident.get("online"),
                ua_family=ua_family,
                after_retry=bool(incident.get("afterRetry")),
                retry_action=_clean(incident.get("retryAction"), 32),
            )
        )
        db.commit()
        return True
    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        log.warning("[client-error] persistence failed (non-fatal): %s", type(exc).__name__)
        return False


def _require_admin(x_admin_key: str = Header(default="")):
    if not settings.admin_key or x_admin_key != settings.admin_key:
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail="Invalid or missing X-Admin-Key header")


@router.get("/telemetry/client-error/recent", dependencies=[Depends(_require_admin)])
def recent_reports(limit: int = 50, db: Session = Depends(get_db)) -> dict:
    """Admin-key-protected readout of recent reports (oldest first per id)."""
    from sqlalchemy import select

    from app.models import ClientErrorReport

    limit = max(1, min(limit, 200))
    rows = (
        db.query(ClientErrorReport)
        .order_by(ClientErrorReport.id.desc())
        .limit(limit)
        .all()
    )
    return {
        "count": len(rows),
        "reports": [
            {
                "id": r.id,
                "incidentId": r.incident_id,
                "phase": r.phase,
                "clientTimestamp": r.client_timestamp,
                "buildId": r.build_id,
                "route": r.route,
                "errorName": r.error_name,
                "errorMessage": r.error_message,
                "chunkMatched": r.chunk_matched,
                "chunkSignature": r.chunk_signature,
                "recoveryAttempts": r.recovery_attempts,
                "recoveryState": r.recovery_state,
                "online": r.online,
                "uaFamily": r.ua_family,
                "afterRetry": r.after_retry,
                "retryAction": r.retry_action,
                "createdAt": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }

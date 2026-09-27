"""Client-side error telemetry — temporary production observability.

The intermittent "This page didn't load" root-boundary failure is client-side
(Vercel logs show 0% server errors during failure windows), so nothing about
it currently reaches any log we control. Reports POSTed by the browser are
persisted here (best-effort — persistence failure never fails the endpoint)
and mirrored to stdout as structured ``[client-error]`` lines.

Privacy contract (enforced by the client collector AND the endpoint):
no IP addresses, no cookies, no auth tokens, no localStorage contents, no
query strings — only the fields the endpoint schema allows, all truncated.
"""
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class ClientErrorReport(Base):
    __tablename__ = "client_error_reports"
    __table_args__ = (
        Index("ix_client_err_created", "created_at"),
        Index("ix_client_err_incident", "incident_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    incident_id: Mapped[str] = mapped_column(String(32), nullable=False)
    # boundary | recovered — "recovered" is the post-Retry success signal.
    phase: Mapped[str] = mapped_column(String(16), nullable=False, default="boundary")
    client_timestamp: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Deployment identifier: the hashed entry-chunk filename this tab ran.
    build_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    route: Mapped[str | None] = mapped_column(String(512), nullable=True)
    error_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    error_stack: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    chunk_matched: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    chunk_signature: Mapped[str | None] = mapped_column(String(255), nullable=True)
    recovery_attempts: Mapped[int | None] = mapped_column(Integer, nullable=True)
    recovery_state: Mapped[str | None] = mapped_column(String(32), nullable=True)
    online: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    ua_family: Mapped[str | None] = mapped_column(String(64), nullable=True)
    after_retry: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    retry_action: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

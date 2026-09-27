/**
 * Root-boundary client diagnostics (TEMPORARY, observability only).
 *
 * Why: the intermittent "This page didn't load" failure is client-side —
 * Vercel production logs show zero errors during failure windows — so nothing
 * about it currently reaches any log we control. When the ROOT error boundary
 * renders, this module fires one diagnostic report to
 * `POST {api}/api/v1/telemetry/client-error` so a failed load can finally be
 * correlated with server logs via the incident reference shown to the user.
 *
 * Hard contracts:
 *
 *  1. NEVER CRASH THE APP. Every browser API access is guarded; the network
 *     send is fire-and-forget (`fetch(...).catch(noop)`) and wrapped in
 *     try/catch. Any failure inside this module is silent by design.
 *  2. NO PERSONAL DATA. Collected fields are exactly the endpoint's
 *     allow-list: incident id, timestamp, build id, route PATHNAME (never the
 *     query string — it may carry secrets), error name/message/stack
 *     (scrubbed + truncated), stale-deploy match state, online flag, UA
 *     FAMILY (parsed name only — the raw UA string never leaves the
 *     browser), and retry context. No IP, cookies, tokens, localStorage
 *     contents, or URLs with query strings are read or sent.
 *  3. NO BEHAVIOUR CHANGE. This module only observes. It does not retry,
 *     recover, cache, or alter rendering — stale-deploy recovery is untouched
 *     (its state is READ here, never written).
 *
 * The Retry button is instrumented by recording the action to sessionStorage
 * before it fires, so the next load can report whether the boundary render
 * followed a retry, which kind of action it was, and (when the app mounts)
 * that the retry SUCCEEDED via a `phase: "recovered"` report under the same
 * incident id.
 */
import { getApiBase } from "@/lib/apiClient";
import {
  matchChunkFailureDeep,
  // The stale-deploy loop-guard state key (staleDeploy.ts owns the format;
  // we only ever READ it for diagnostics).
  RECOVERY_TEST_KEY as RECOVERY_STATE_KEY,
} from "@/lib/staleDeploy";

const TELEMETRY_ENDPOINT = "/api/v1/telemetry/client-error";

// ── incident identity ────────────────────────────────────────────────────────

const ID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — readable

/** 8-character human-readable reference, e.g. "K7M3QX2D". */
export function newIncidentId(): string {
  try {
    const buf = new Uint8Array(8);
    crypto.getRandomValues(buf);
    let id = "";
    for (const b of buf) id += ID_ALPHABET[b % ID_ALPHABET.length];
    return id;
  } catch {
    let id = "";
    for (let i = 0; i < 8; i++)
      id += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
    return id;
  }
}

// One incident id per error object (stable across boundary re-renders).
const incidentIds = new WeakMap<object, string>();
const nonObjectIds = new Map<string, string>();

function incidentIdFor(error: unknown): string {
  if (error && typeof error === "object") {
    let id = incidentIds.get(error);
    if (!id) {
      id = newIncidentId();
      incidentIds.set(error, id);
    }
    return id;
  }
  const key = String(error);
  let id = nonObjectIds.get(key);
  if (!id) {
    id = newIncidentId();
    if (nonObjectIds.size > 50) nonObjectIds.clear();
    nonObjectIds.set(key, id);
  }
  return id;
}

// Each incident is reported once — boundary re-renders must not spam.
const reportedIncidents = new Set<string>();

// ── sanitization ─────────────────────────────────────────────────────────────

/** Remove query strings embedded in messages/stacks (they may carry secrets),
 *  collapse newlines, and truncate. */
function scrub(text: string): string {
  return text.replace(/\?[^)\s'"]{0,200}/g, "?…");
}

function clean(value: string | null | undefined, limit: number): string | null {
  if (!value) return null;
  const flat = scrub(String(value)).replace(/[\r\n\t]+/g, " ").trim();
  return flat ? flat.slice(0, limit) : null;
}

/** Route = pathname ONLY. The query string may contain secrets and is never
 *  collected. Strip any "?..." defensively too: enforced in code, not just by
 *  the invariant that `location.pathname` excludes the query. */
function safePathname(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (window.location.pathname.split("?")[0] || "/").slice(0, 512);
  } catch {
    return null;
  }
}

/** Build identifier: the hashed entry-chunk filename this tab actually ran
 *  (e.g. "index-DIAG1.js"), read from the SSR-rendered entry script tag.
 *  This is what makes a report attributable to one deployment. */
export function getBuildId(): string | null {
  if (typeof document === "undefined") return null;
  try {
    const el = document.querySelector('script[type="module"][src*="/assets/"]');
    const src = el?.getAttribute("src") ?? null;
    if (!src) return null;
    const base = src.split("/").pop() ?? null;
    return base ? base.slice(0, 255) : null;
  } catch {
    return null;
  }
}

/** UA family name only — the raw user-agent string never leaves the browser. */
export function uaFamily(): string | null {
  if (typeof navigator === "undefined") return null;
  try {
    const ua = navigator.userAgent ?? "";
    if (/firefox|fxios/i.test(ua)) return "Firefox";
    if (/edg(e|a|ios)?\//i.test(ua)) return "Edge";
    if (/chrome|crios/i.test(ua)) return "Chrome";
    if (/safari/i.test(ua)) return "Safari";
    if (/opr\/|opera/i.test(ua)) return "Opera";
    if (/samsungbrowser/i.test(ua)) return "Samsung";
    return "Other";
  } catch {
    return null;
  }
}

function navigatorOnLine(): boolean | null {
  if (typeof navigator === "undefined") return null;
  try {
    return navigator.onLine;
  } catch {
    return null;
  }
}

// ── stale-deploy recovery state (READ-ONLY) ─────────────────────────────────

export type RecoveryStateName = "fresh" | "attempted" | "exhausted" | "unknown";

export interface RecoveryDiagnostics {
  attempts: number;
  state: RecoveryStateName;
}

/** Read the stale-deploy loop-guard state without touching it. */
export function readRecoveryDiagnostics(): RecoveryDiagnostics {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) {
      return { attempts: 0, state: "unknown" };
    }
    const raw = window.sessionStorage.getItem(RECOVERY_STATE_KEY);
    if (!raw) return { attempts: 0, state: "fresh" };
    const parsed = JSON.parse(raw) as Record<string, { attempts?: number }>;
    let total = 0;
    let exhausted = false;
    for (const entry of Object.values(parsed ?? {})) {
      const n = typeof entry?.attempts === "number" ? entry.attempts : 0;
      total += n;
      if (n >= 3) exhausted = true;
    }
    return {
      attempts: total,
      state: total === 0 ? "fresh" : exhausted ? "exhausted" : "attempted",
    };
  } catch {
    return { attempts: 0, state: "unknown" };
  }
}

// ── retry instrumentation ────────────────────────────────────────────────────

const RETRY_FLAG_KEY = "lumiere.diag.retry";

interface RetryContext {
  incidentId: string;
  action: string;
  at: number;
}

function readRetryFlag(): RetryContext | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    const raw = window.sessionStorage.getItem(RETRY_FLAG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RetryContext;
    return parsed && typeof parsed.incidentId === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function clearRetryFlag(): void {
  try {
    window.sessionStorage?.removeItem(RETRY_FLAG_KEY);
  } catch {
    /* storage unavailable */
  }
}

/**
 * Record what the Retry button is about to do. Called BEFORE the action so a
 * following page load can attribute itself. The current boundary Retry
 * performs a router `reset()` immediately followed by a full document
 * `reload()` — the reload is the dominant, observable effect, so the action
 * is recorded as "reload" (telemetry must describe reality, not intent).
 */
export function recordRetryAction(incidentId: string, action: "reload"): void {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return;
    const ctx: RetryContext = { incidentId, action, at: Date.now() };
    window.sessionStorage.setItem(RETRY_FLAG_KEY, JSON.stringify(ctx));
  } catch {
    /* storage unavailable — retry telemetry is best-effort */
  }
}

/**
 * Called on mount of the normal app shell. If the previous load ended with a
 * Retry click, report `phase: "recovered"` under the SAME incident id — the
 * "retry succeeded" signal — and clear the flag so later unrelated failures
 * are never misattributed.
 */
export function consumeRetryOutcome(): void {
  if (typeof window === "undefined") return;
  const ctx = readRetryFlag();
  if (!ctx) return;
  clearRetryFlag();
  sendClientErrorReport({
    phase: "recovered",
    incidentId: ctx.incidentId,
    clientTimestamp: new Date().toISOString(),
    buildId: getBuildId(),
    route: safePathname(),
    chunkMatched: false,
    online: navigatorOnLine(),
    uaFamily: uaFamily(),
    afterRetry: true,
    retryAction: clean(ctx.action, 32),
  });
}

// ── transport (fire-and-forget) ──────────────────────────────────────────────

export interface ClientErrorReportPayload {
  phase: "boundary" | "recovered";
  incidentId: string;
  clientTimestamp?: string | null;
  buildId?: string | null;
  route?: string | null;
  errorName?: string | null;
  errorMessage?: string | null;
  errorStack?: string | null;
  chunkMatched?: boolean;
  chunkSignature?: string | null;
  recoveryAttempts?: number | null;
  recoveryState?: RecoveryStateName | null;
  online?: boolean | null;
  uaFamily?: string | null;
  afterRetry?: boolean;
  retryAction?: string | null;
}

/** Fire-and-forget POST. Never throws, never awaits, never logs to console. */
export function sendClientErrorReport(report: ClientErrorReportPayload): void {
  if (typeof window === "undefined") return;
  try {
    void fetch(`${getApiBase()}${TELEMETRY_ENDPOINT}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(report),
      keepalive: true,
    }).catch(() => {
      /* telemetry is best-effort by design */
    });
  } catch {
    /* telemetry is best-effort by design */
  }
}

// ── boundary entry point ─────────────────────────────────────────────────────

/**
 * Report one root-boundary failure. Returns the incident id to display as
 * `Reference: XXXXXXXX`. Idempotent per error object — React may render the
 * boundary multiple times for the same failure and exactly one report goes out.
 */
export function reportRootBoundaryError(error: unknown): string {
  const incidentId = incidentIdFor(error);
  if (typeof window === "undefined") return incidentId;
  if (reportedIncidents.has(incidentId)) return incidentId;
  if (reportedIncidents.size > 20) reportedIncidents.clear();
  reportedIncidents.add(incidentId);

  // A boundary render following a Retry click consumes the retry flag —
  // this IS the "retry did not succeed" outcome.
  const retryCtx = readRetryFlag();
  if (retryCtx) clearRetryFlag();

  const chunkSignature = matchChunkFailureDeep(error);
  const recovery = readRecoveryDiagnostics();
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : String(error);
  const stack = error instanceof Error ? (error.stack ?? null) : null;

  sendClientErrorReport({
    phase: "boundary",
    incidentId,
    clientTimestamp: new Date().toISOString(),
    buildId: getBuildId(),
    route: safePathname(),
    errorName: clean(error instanceof Error ? error.name : `${typeof error}`, 128),
    errorMessage: clean(message, 500),
    errorStack: clean(stack, 2000),
    chunkMatched: chunkSignature != null,
    chunkSignature: clean(chunkSignature, 255),
    recoveryAttempts: recovery.attempts,
    recoveryState: recovery.state,
    online: navigatorOnLine(),
    uaFamily: uaFamily(),
    afterRetry: retryCtx != null,
    retryAction: retryCtx ? clean(retryCtx.action, 32) : null,
  });

  return incidentId;
}

/** Test-only reset of module-level incident/dedupe state. */
export function __resetDiagnosticsForTests(): void {
  reportedIncidents.clear();
  nonObjectIds.clear();
}

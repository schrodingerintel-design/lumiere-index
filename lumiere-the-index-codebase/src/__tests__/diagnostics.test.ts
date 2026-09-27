import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Root-boundary diagnostics (temporary production telemetry).
 *
 * Contract:
 *  1. ID        — every boundary failure gets a readable 8-char incident id,
 *                 stable across re-renders of the same error object.
 *  2. FIRE-AND-FORGET — exactly one POST per incident, never awaited, and a
 *                 failing transport must never throw or log.
 *  3. PRIVACY   — route is pathname only (no query string), messages/stacks
 *                 are scrubbed of query-string tails and truncated, UA family
 *                 is a name (never the raw UA string).
 *  4. STALE-DEPLOY context is READ from the loop guard's storage, never
 *                 written, and the report says whether a chunk failure matched.
 *  5. RETRY     — recordRetryAction before reload; the next boundary render
 *                 reports afterRetry; a successful mount reports recovered
 *                 under the SAME incident id and clears the flag.
 *  6. NEVER CRASHES — SSR (no window) and thrown fetch are silent no-ops.
 */
import {
  newIncidentId,
  reportRootBoundaryError,
  recordRetryAction,
  consumeRetryOutcome,
  readRecoveryDiagnostics,
  getBuildId,
  uaFamily,
  __resetDiagnosticsForTests,
} from "@/lib/diagnostics";
import { RECOVERY_TEST_KEY } from "@/lib/staleDeploy";

const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })));
const store = new Map<string, string>();
const sessionStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

beforeEach(() => {
  __resetDiagnosticsForTests();
  store.clear();
  fetchMock.mockClear();
  fetchMock.mockImplementation(() => Promise.resolve(new Response(null, { status: 202 })));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("sessionStorage", sessionStorageMock);
  vi.stubGlobal("window", {
    location: { pathname: "/films/some-movie?secret=token123", href: "x" },
    sessionStorage: sessionStorageMock,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function lastBody(): Record<string, unknown> {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toContain("/api/v1/telemetry/client-error");
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

const STALE_CHUNK_ERROR = () =>
  new TypeError("Failed to fetch dynamically imported module: /assets/index-XYZ.js");
const APP_ERROR = () => new Error("Cannot read properties of undefined (reading 'map')");

describe("incident identity", () => {
  it("generates a readable 8-char reference from the no-lookalike alphabet", () => {
    for (let i = 0; i < 50; i++) {
      expect(newIncidentId()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    }
  });

  it("is stable across re-renders of the same error object and reports exactly once", () => {
    const error = APP_ERROR();
    const id1 = reportRootBoundaryError(error);
    const id2 = reportRootBoundaryError(error); // React re-render
    expect(id1).toBe(id2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("privacy", () => {
  it("collects the pathname but never the query string", () => {
    reportRootBoundaryError(APP_ERROR());
    const body = lastBody();
    expect(body.route).toBe("/films/some-movie");
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(JSON.stringify(body)).not.toContain("token123");
  });

  it("scrubs query strings embedded in error messages and stacks", () => {
    const error = new Error('Failed to load https://x.test/a.js?token=supersecret thing');
    error.stack = "Error: boom\n    at f (https://site.test/app.js?sid=42:1:1)";
    reportRootBoundaryError(error);
    const raw = JSON.stringify(lastBody());
    expect(raw).not.toContain("supersecret");
    expect(raw).not.toContain("sid=42");
  });

  it("truncates long stacks to the endpoint's limit", () => {
    const error = new Error("boom");
    error.stack = "at f ".repeat(2000);
    reportRootBoundaryError(error);
    const body = lastBody();
    expect(String(body.errorStack).length).toBeLessThanOrEqual(2000);
  });

  it("classifies the UA as a family name only", () => {
    expect(uaFamily()).toBe("Other"); // stubbed navigator has no UA in node env
  });
});

describe("stale-deploy context (read-only)", () => {
  it("reports chunkMatched + signature for a stale chunk failure and leaves state untouched", () => {
    store.set(RECOVERY_TEST_KEY, JSON.stringify({ "dynamic_import_fetch_failed#/assets/index-XYZ.js": { attempts: 2, firstAt: 1, lastAt: 2 } }));
    const before = sessionStorageMock.getItem(RECOVERY_TEST_KEY);
    reportRootBoundaryError(STALE_CHUNK_ERROR());
    const body = lastBody();
    expect(body.chunkMatched).toBe(true);
    expect(String(body.chunkSignature)).toContain("/assets/index-XYZ.js");
    expect(body.recoveryAttempts).toBe(2);
    expect(body.recoveryState).toBe("attempted");
    expect(sessionStorageMock.getItem(RECOVERY_TEST_KEY)).toBe(before);
  });

  it("reports fresh state and chunkMatched=false for an unrelated application error", () => {
    reportRootBoundaryError(APP_ERROR());
    const body = lastBody();
    expect(body.chunkMatched).toBe(false);
    expect(body.recoveryState).toBe("fresh");
    expect(body.recoveryAttempts).toBe(0);
  });

  it("summarises an exhausted recovery budget", () => {
    store.set(RECOVERY_TEST_KEY, JSON.stringify({ sig: { attempts: 3, firstAt: 1, lastAt: 2 } }));
    expect(readRecoveryDiagnostics()).toMatchObject({ attempts: 3, state: "exhausted" });
  });
});

describe("retry instrumentation", () => {
  it("reports afterRetry when the boundary render follows a Retry click", () => {
    const error = APP_ERROR();
    const id = reportRootBoundaryError(error);
    recordRetryAction(id, "reload");
    // Reload happens; the NEXT boundary failure of the same incident reports the retry.
    __resetDiagnosticsForTests();
    fetchMock.mockClear();
    reportRootBoundaryError(error);
    const body = lastBody();
    expect(body.afterRetry).toBe(true);
    expect(body.retryAction).toBe("reload");
    expect(body.incidentId).toBe(id);
  });

  it("reports phase=recovered under the SAME incident id when the retry succeeds", () => {
    const id = "TEST1234";
    recordRetryAction(id, "reload");
    expect(fetchMock).not.toHaveBeenCalled();
    consumeRetryOutcome();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/v1/telemetry/client-error");
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.phase).toBe("recovered");
    expect(body.incidentId).toBe(id);
    expect(body.afterRetry).toBe(true);
    // Flag consumed — a later unrelated failure is never misattributed.
    consumeRetryOutcome();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("never crashes / fire-and-forget", () => {
  it("silently ignores a failing transport", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error("network down")));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => reportRootBoundaryError(APP_ERROR())).not.toThrow();
    // Give the rejected promise a tick; nothing may log or throw.
    await Promise.resolve();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("still returns a reference when telemetry is completely unavailable", () => {
    vi.stubGlobal("fetch", undefined);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const id = reportRootBoundaryError(APP_ERROR());
    expect(id).toMatch(/^[A-Z2-9]{8}$/);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("handles errors that are not Error instances", () => {
    expect(() => reportRootBoundaryError("plain string failure")).not.toThrow();
    const body = lastBody();
    expect(body.errorName).toBe("string");
    expect(String(body.errorMessage)).toContain("plain string failure");
  });
});

describe("build identifier", () => {
  it("reads the hashed entry chunk from the document when present", () => {
    vi.stubGlobal("document", {
      querySelector: (sel: string) =>
        sel.includes('script[type="module"]') ? { getAttribute: () => "https://lumiereindex.com/assets/index-TEST1.js" } : null,
    });
    expect(getBuildId()).toBe("index-TEST1.js");
  });

  it("returns null safely when no entry script exists", () => {
    vi.stubGlobal("document", { querySelector: () => null });
    expect(getBuildId()).toBeNull();
  });
});

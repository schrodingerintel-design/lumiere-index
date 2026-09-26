import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Stale-deploy recovery.
 *
 * Contract:
 *  1. DETECT      — a chunk-load failure matches a known signature; an
 *                   arbitrary application exception does not.
 *  2. RECOVER     — one cache-bypassing reload per failure episode.
 *  3. NO LOOPS    — repeated failures of the SAME signature within the
 *                   recovery window stop reloading and render the boundary.
 *  4. INDEPENDENT — a LATER deployment (different chunk signature) recovers
 *                   on its own; loop prevention is scoped to the failed
 *                   deployment, not the whole session.
 *  5. FALLBACK    — when recovery is exhausted or the error is unrelated,
 *                   the normal error boundary renders (recover returns false,
 *                   no navigation), so genuine bugs stay visible.
 *
 * Loop prevention state: { attempts, firstAt, lastAt } per signature, capped
 * at 3 attempts inside a 5-minute window. A new signature, or the window
 * elapsing, resets the budget.
 */
import {
  matchChunkFailure,
  matchChunkFailureDeep,
  recoverFromStaleDeploy,
  resetStaleDeployStateForTests,
  setRecoveryWindowForTests,
  RECOVERY_TEST_KEY,
} from "@/lib/staleDeploy";

// Minimal sessionStorage surface — the loop guard's primary store.
const store = new Map<string, string>();
const sessionStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

const replaceMock = vi.fn();

const STALE_A = () => new TypeError("Failed to fetch dynamically imported module: /assets/index-AAA.js");
const STALE_B = () => new TypeError("Failed to fetch dynamically imported module: /assets/index-BBB.js");

beforeEach(() => {
  store.clear();
  resetStaleDeployStateForTests();
  setRecoveryWindowForTests(null as unknown as number); // restore default
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-26T12:00:00Z"));
  replaceMock.mockClear();
  vi.stubGlobal("sessionStorage", sessionStorageMock);
  // Define location FIRST, then stub window around it — the module reads
  // window.location.replace to perform the cache-bypassing navigation.
  const location = {
    href: "https://lumiereindex.com/top-100",
    pathname: "/top-100",
    replace: replaceMock,
  };
  vi.stubGlobal("window", { sessionStorage: sessionStorageMock, location });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── 1. DETECT ────────────────────────────────────────────────────────────────

describe("chunk-failure signatures", () => {
  it("matches the Chrome/Edge dynamic-import failure, keyed to the failing asset", () => {
    expect(
      matchChunkFailure(new TypeError("Failed to fetch dynamically imported module: /assets/index-abc.js")),
    ).toBe("dynamic_import_fetch_failed#/assets/index-abc.js");
  });

  it("falls back to the bare family name when the message names no asset", () => {
    expect(matchChunkFailure(new TypeError("Failed to fetch dynamically imported module"))).toBe(
      "dynamic_import_fetch_failed",
    );
  });

  it("matches the Safari module-script failure", () => {
    expect(matchChunkFailure(new Error("Importing a module script failed."))).toBe(
      "module_script_import_failed",
    );
  });

  it("matches the Firefox dynamic-import failure", () => {
    expect(matchChunkFailure(new Error("error loading dynamically imported module"))).toBe(
      "dynamic_import_generic",
    );
  });

  it("matches a MIME-type mismatch (cached HTML shell, asset now serves HTML 404)", () => {
    expect(
      matchChunkFailure(
        new Error('Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "text/html".'),
      ),
    ).toBe("mime_type_mismatch");
  });

  it("does NOT match arbitrary application exceptions", () => {
    expect(matchChunkFailure(new TypeError("Cannot read properties of null (reading 'map')"))).toBeNull();
    expect(matchChunkFailure(new Error("Reducer returned an inconsistent state"))).toBeNull();
    expect(matchChunkFailure("some random string")).toBeNull();
    expect(matchChunkFailure(null)).toBeNull();
    expect(matchChunkFailure(undefined)).toBeNull();
  });

  it("walks the ES2022 cause chain for wrapped chunk failures", () => {
    const wrapped = new Error("Route render failed", {
      cause: new TypeError("Failed to fetch dynamically imported module: /assets/routes-x.js"),
    });
    expect(matchChunkFailureDeep(wrapped)).toBe("dynamic_import_fetch_failed#/assets/routes-x.js");
  });
});

// ── 2. RECOVER ───────────────────────────────────────────────────────────────

describe("recovery reload", () => {
  it("performs exactly one cache-bypassing navigation and returns true", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const navigated = recoverFromStaleDeploy(STALE_A());

    expect(navigated).toBe(true);
    expect(replaceMock).toHaveBeenCalledTimes(1);
    const target = String(replaceMock.mock.calls[0][0]);
    // Cache bypass: a fresh query parameter forces index.html revalidation.
    expect(target).toContain("staleDeployReload=");
    // Structured log separates recovery from genuine failure.
    const record = JSON.parse(String(warn.mock.calls.at(-1)?.[0]).replace("[stale-deploy] ", ""));
    expect(record.action).toBe("reload");
    expect(record.signature).toBe("dynamic_import_fetch_failed#/assets/index-AAA.js");
    expect(record.path).toBe("/top-100");
    expect(typeof record.timestamp).toBe("string");
  });

  it("records the attempt so loop prevention is keyed to this deployment", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    recoverFromStaleDeploy(STALE_A());
    const raw = store.get(RECOVERY_TEST_KEY);
    expect(raw).toBeTruthy();
    const state = JSON.parse(raw!) as Record<string, { attempts: number }>;
    expect(state["dynamic_import_fetch_failed#/assets/index-AAA.js"].attempts).toBe(1);
  });
});

// ── 3. NO LOOPS ──────────────────────────────────────────────────────────────

describe("reload-loop prevention", () => {
  it("stops reloading after repeated failures of the SAME chunk in the window", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Three attempts are permitted within the window.
    expect(recoverFromStaleDeploy(STALE_A())).toBe(true);
    expect(recoverFromStaleDeploy(STALE_A())).toBe(true);
    expect(recoverFromStaleDeploy(STALE_A())).toBe(true);
    expect(replaceMock).toHaveBeenCalledTimes(3);

    // Fourth failure inside the window: blocked, boundary renders.
    expect(recoverFromStaleDeploy(STALE_A())).toBe(false);
    expect(replaceMock).toHaveBeenCalledTimes(3);
    const blocked = JSON.parse(
      String(errorSpy.mock.calls.at(-1)?.[0]).replace("[stale-deploy] ", ""),
    );
    expect(blocked.action).toBe("blocked");
    expect(blocked.reason).toMatch(/exhausted/i);

    // ...and still blocked afterwards (same window, same signature).
    vi.advanceTimersByTime(60_000);
    expect(recoverFromStaleDeploy(STALE_A())).toBe(false);
    expect(replaceMock).toHaveBeenCalledTimes(3);
  });

  it("survives sessionStorage being unavailable (private mode) without looping", () => {
    vi.stubGlobal("window", {
      location: { href: "https://lumiereindex.com/", pathname: "/", replace: replaceMock },
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    // In-memory mirror: three attempts per window, then blocked.
    expect(recoverFromStaleDeploy(STALE_A())).toBe(true);
    expect(recoverFromStaleDeploy(STALE_A())).toBe(true);
    expect(recoverFromStaleDeploy(STALE_A())).toBe(true);
    expect(recoverFromStaleDeploy(STALE_A())).toBe(false);
    expect(replaceMock).toHaveBeenCalledTimes(3);
  });
});

// ── 4. INDEPENDENT RECOVERY ──────────────────────────────────────────────────

describe("a second independent stale deployment later in the session", () => {
  it("recovers for a DIFFERENT chunk signature, even while the first is blocked", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // First deployment: exhausted.
    recoverFromStaleDeploy(STALE_A());
    recoverFromStaleDeploy(STALE_A());
    recoverFromStaleDeploy(STALE_A());
    expect(recoverFromStaleDeploy(STALE_A())).toBe(false);
    expect(replaceMock).toHaveBeenCalledTimes(3);
    expect(errorSpy.mock.calls.some((c) => String(c[0]).includes('"action":"blocked"'))).toBe(true);

    // Later the same session: a NEW deployment ships, this tab now fails on a
    // different chunk. That is a new failure episode — it must recover.
    vi.advanceTimersByTime(60_000);
    warn.mockClear();
    expect(recoverFromStaleDeploy(STALE_B())).toBe(true);
    expect(replaceMock).toHaveBeenCalledTimes(4);
    const rec = JSON.parse(String(warn.mock.calls.at(-1)?.[0]).replace("[stale-deploy] ", ""));
    expect(rec.action).toBe("reload");
  });

  it("resets the budget once the recovery window has elapsed", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    recoverFromStaleDeploy(STALE_A());
    recoverFromStaleDeploy(STALE_A());
    recoverFromStaleDeploy(STALE_A());
    expect(recoverFromStaleDeploy(STALE_A())).toBe(false);
    expect(replaceMock).toHaveBeenCalledTimes(3);

    // Past the 5-minute window with no further failure: fresh budget.
    vi.advanceTimersByTime(5 * 60_000 + 1);
    expect(recoverFromStaleDeploy(STALE_A())).toBe(true);
    expect(replaceMock).toHaveBeenCalledTimes(4);
  });
});

// ── 5. FALLBACK ──────────────────────────────────────────────────────────────

describe("unrelated exceptions", () => {
  it("returns false without navigating and logs the failure as genuine", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const boom = new TypeError("Cannot read properties of null (reading 'map')");

    expect(recoverFromStaleDeploy(boom)).toBe(false);
    expect(replaceMock).not.toHaveBeenCalled();

    const record = JSON.parse(String(errorSpy.mock.calls.at(-1)?.[0]).replace("[stale-deploy] ", ""));
    expect(record.action).toBe("none");
    expect(record.exceptionType).toBe("TypeError");
    expect(record.message).toContain("Cannot read properties of null");
  });

  it("does not consume the recovery budget of a real chunk failure", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    recoverFromStaleDeploy(new Error("genuine bug"));
    recoverFromStaleDeploy(new TypeError("Cannot read properties of undefined (reading 'id')"));

    // A real chunk failure afterwards still gets the full budget.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(recoverFromStaleDeploy(STALE_A())).toBe(true);
    expect(recoverFromStaleDeploy(STALE_A())).toBe(true);
    expect(recoverFromStaleDeploy(STALE_A())).toBe(true);
    expect(replaceMock).toHaveBeenCalledTimes(3);
  });
});

// ── recovery failure → boundary ─────────────────────────────────────────────

describe("failed recovery falls back to the error boundary", () => {
  it("returns false after the cap so the boundary renders, with no further navigation", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    for (let i = 0; i < 3; i++) recoverFromStaleDeploy(STALE_A());
    const navigationsAfterCap = replaceMock.mock.calls.length;

    const stillBroken = recoverFromStaleDeploy(STALE_A());
    expect(stillBroken).toBe(false);
    expect(replaceMock.mock.calls.length).toBe(navigationsAfterCap);

    const record = JSON.parse(
      String(errorSpy.mock.calls.at(-1)?.[0]).replace("[stale-deploy] ", ""),
    );
    expect(record.action).toBe("blocked");
    expect(record.signature).toBe("dynamic_import_fetch_failed#/assets/index-AAA.js");
  });
});

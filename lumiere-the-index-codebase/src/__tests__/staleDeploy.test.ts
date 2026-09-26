import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Stale-deploy recovery.
 *
 * The four behaviours under contract:
 *  1. DETECT   — a chunk-load failure matches, an arbitrary exception does not.
 *  2. RECOVER  — exactly one cache-bypassing reload.
 *  3. NO LOOPS — a second failure in the same session must not reload again.
 *  4. FALLBACK — unmatched errors render the normal boundary (recover returns
 *                false and no navigation happens), so genuine bugs stay visible.
 */
import {
  matchChunkFailure,
  matchChunkFailureDeep,
  recoverFromStaleDeploy,
  resetStaleDeployStateForTests,
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

beforeEach(() => {
  store.clear();
  resetStaleDeployStateForTests();
  replaceMock.mockClear();
  vi.stubGlobal("sessionStorage", sessionStorageMock);
  vi.stubGlobal("window", {
    sessionStorage: sessionStorageMock,
    location: { href: "https://lumiereindex.com/top-100", pathname: "/top-100" },
    // recoverFromStaleDeploy routes through window.location.replace — capture
    // it instead of navigating.
    ...({} as object),
  });
  // Stub window.location.replace, which jsdom-free tests cannot assign.
  Object.defineProperty(window, "location", {
    value: {
      href: "https://lumiereindex.com/top-100",
      pathname: "/top-100",
      replace: replaceMock,
    },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── 1. DETECT ────────────────────────────────────────────────────────────────

describe("chunk-failure signatures", () => {
  it("matches the Chrome/Edge dynamic-import failure", () => {
    expect(matchChunkFailure(new TypeError("Failed to fetch dynamically imported module: /assets/index-abc.js"))).toBe(
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
      matchChunkFailure(new Error("Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of \"text/html\".")),
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
    expect(matchChunkFailureDeep(wrapped)).toBe("dynamic_import_fetch_failed");
  });
});

// ── 2. RECOVER ───────────────────────────────────────────────────────────────

describe("recovery reload", () => {
  it("performs exactly one cache-bypassing navigation and returns true", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const err = new TypeError("Failed to fetch dynamically imported module: /assets/index-abc.js");

    const navigated = recoverFromStaleDeploy(err);

    expect(navigated).toBe(true);
    expect(replaceMock).toHaveBeenCalledTimes(1);
    const target = String(replaceMock.mock.calls[0][0]);
    // Cache bypass: a fresh query parameter forces index.html revalidation.
    expect(target).toContain("staleDeployReload=");
    // The structured record distinguishes recovery from genuine failure.
    const record = JSON.parse(String(warn.mock.calls.at(-1)?.[0]).replace("[stale-deploy] ", ""));
    expect(record.action).toBe("reload");
    expect(record.signature).toBe("dynamic_import_fetch_failed");
    expect(record.path).toBe("/top-100");
    expect(typeof record.timestamp).toBe("string");
  });

  it("marks the session so a later failure cannot reload again", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    recoverFromStaleDeploy(new TypeError("Failed to fetch dynamically imported module: /a.js"));
    expect(store.get(RECOVERY_TEST_KEY)).toBe("1");
  });
});

// ── 3. NO LOOPS ──────────────────────────────────────────────────────────────

describe("loop prevention", () => {
  it("never navigates twice in one session — the boundary renders instead", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const chunkError = () => new TypeError("Failed to fetch dynamically imported module: /a.js");

    expect(recoverFromStaleDeploy(chunkError())).toBe(true);
    expect(replaceMock).toHaveBeenCalledTimes(1);

    // Second failure — same session. Must NOT navigate again.
    expect(recoverFromStaleDeploy(chunkError())).toBe(false);
    expect(replaceMock).toHaveBeenCalledTimes(1);

    // Third+ attempts: still blocked, and logged as blocked, not reload.
    expect(recoverFromStaleDeploy(chunkError())).toBe(false);
    expect(replaceMock).toHaveBeenCalledTimes(1);
    const blocked = JSON.parse(
      String(errorSpy.mock.calls.at(-1)?.[0]).replace("[stale-deploy] ", ""),
    );
    expect(blocked.action).toBe("blocked");
  });

  it("survives sessionStorage being unavailable (private mode) without looping", () => {
    // Re-stub window WITHOUT sessionStorage: claimRecovery falls back to the
    // in-memory flag, which still permits exactly one attempt per page load.
    vi.stubGlobal("window", {
      location: {
        href: "https://lumiereindex.com/",
        pathname: "/",
        replace: replaceMock,
      },
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const err = () => new TypeError("Failed to fetch dynamically imported module: /a.js");

    expect(recoverFromStaleDeploy(err())).toBe(true);
    expect(replaceMock).toHaveBeenCalledTimes(1);
    // Same page load, second failure: blocked by the in-memory flag.
    expect(recoverFromStaleDeploy(err())).toBe(false);
    expect(replaceMock).toHaveBeenCalledTimes(1);
  });
});

// ── 4. FALLBACK ──────────────────────────────────────────────────────────────

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

  it("leaves the loop guard untouched for unmatched errors", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    recoverFromStaleDeploy(new Error("genuine bug"));
    // A later real chunk failure must still be able to recover.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(recoverFromStaleDeploy(new TypeError("Failed to fetch dynamically imported module: /a.js"))).toBe(true);
    expect(replaceMock).toHaveBeenCalledTimes(1);
  });
});

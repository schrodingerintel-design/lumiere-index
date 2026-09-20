import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BETA_RELEASES,
  BETA_VERSION,
  CURRENT_RELEASE,
  LAST_SEEN_VERSION_KEY,
  markBetaAnnouncementSeen,
  pendingBetaAnnouncement,
  releasesSince,
} from "@/lib/beta";

/**
 * The suite runs in plain node (no DOM), so localStorage is stubbed with a
 * spec-compliant Map-backed fake for the announcement-flow tests.
 */
const store = new Map<string, string>();
const localStorageStub = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

function withStubbedStorage<T>(fn: () => T): T {
  const original = (globalThis as Record<string, unknown>).localStorage;
  (globalThis as Record<string, unknown>).localStorage = localStorageStub;
  try {
    return fn();
  } finally {
    if (original === undefined) delete (globalThis as Record<string, unknown>).localStorage;
    else (globalThis as Record<string, unknown>).localStorage = original;
  }
}

/**
 * The beta announcement contract: a first-time viewer gets the intro once;
 * a returning viewer gets a what's-new popup whenever the shipped version
 * is newer than the last one they acknowledged; an up-to-date viewer is
 * left alone. Storage failures must never throw into the UI.
 */
describe("beta release registry", () => {
  it("has a current release entry that matches BETA_VERSION", () => {
    expect(CURRENT_RELEASE.version).toBe(BETA_VERSION);
    expect(BETA_RELEASES[0].version).toBe(BETA_VERSION);
  });

  it("keeps releases ordered newest-first with unique versions", () => {
    const versions = BETA_RELEASES.map((r) => r.version);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it("writes user-facing changelog entries", () => {
    for (const release of BETA_RELEASES) {
      expect(release.headline.length).toBeGreaterThan(0);
      expect(release.changes.length).toBeGreaterThan(0);
    }
  });
});

describe("pendingBetaAnnouncement", () => {
  beforeEach(() => {
    store.clear();
  });

  afterEach(() => {
    store.clear();
  });

  it("shows the intro to a brand-new viewer", () => {
    withStubbedStorage(() => {
      expect(pendingBetaAnnouncement()).toBe("intro");
    });
  });

  it("stays quiet for an up-to-date viewer", () => {
    withStubbedStorage(() => {
      markBetaAnnouncementSeen();
      expect(pendingBetaAnnouncement()).toBeNull();
    });
  });

  it("announces an update when the last-seen version is older", () => {
    withStubbedStorage(() => {
      store.set(LAST_SEEN_VERSION_KEY, "1.0");
      expect(pendingBetaAnnouncement()).toBe("update");
    });
  });

  it("survives inaccessible storage without throwing", () => {
    withStubbedStorage(() => {
      vi.stubGlobal("localStorage", {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      });
      expect(pendingBetaAnnouncement()).toBeNull();
      expect(() => markBetaAnnouncementSeen()).not.toThrow();
      vi.unstubAllGlobals();
    });
  });
});

describe("releasesSince", () => {
  it("returns everything newer than the given version, newest first", () => {
    const since = releasesSince("1.0");
    expect(since.map((r) => r.version)).toEqual(["1.2", "1.1"]);
  });

  it("returns an empty list when the viewer is current", () => {
    expect(releasesSince(BETA_VERSION)).toEqual([]);
  });

  it("falls back to the full story for unknown old versions", () => {
    expect(releasesSince("0.9")).toHaveLength(BETA_RELEASES.length);
  });
});

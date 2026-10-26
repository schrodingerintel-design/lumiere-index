import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readWatchlist, writeWatchlist } from "@/lib/watchlist";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

describe("shared watchlist persistence", () => {
  let storage: Map<string, string>;
  let events: EventTarget;

  beforeEach(() => {
    storage = new Map();
    events = new EventTarget();
    vi.stubGlobal("window", events);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    // Give the store a distinct value to invalidate its cache between tests.
    storage.set("lumiere_watchlist", "[]");
    readWatchlist();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("preserves movie and TV identities and notifies other mounted controls", () => {
    const changed = vi.fn();
    events.addEventListener("lumiere:watchlist", changed);
    expect(writeWatchlist(["movie-2026", "tv-series", "movie-2026"])).toBe(true);
    expect(readWatchlist()).toEqual(["movie-2026", "tv-series"]);
    expect(changed).toHaveBeenCalledOnce();
    expect(readWatchlist()).toBe(readWatchlist());
  });

  it("recovers safely from malformed storage and invalid entries", () => {
    storage.set("lumiere_watchlist", "not json");
    expect(readWatchlist()).toEqual([]);
    storage.set("lumiere_watchlist", '["valid-film",17,null]');
    expect(readWatchlist()).toEqual(["valid-film"]);
  });

  it("does not report success when browser storage rejects a save", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("Storage blocked");
      },
    });
    expect(writeWatchlist(["film"])).toBe(false);
  });

  it("resets the snapshot when storage is cleared in another tab", () => {
    writeWatchlist(["saved-film"]);
    expect(readWatchlist()).toEqual(["saved-film"]);
    storage.clear();
    expect(readWatchlist()).toEqual([]);
  });
});

import { useSyncExternalStore } from "react";
import { toast } from "sonner";

const KEY = "lumiere_watchlist";
const EVENT = "lumiere:watchlist";
const EMPTY: string[] = [];
let cachedRaw: string | null = null;
let cachedList = EMPTY;

export function readWatchlist(): string[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== cachedRaw) {
      const parsed: unknown = JSON.parse(raw ?? "[]");
      cachedList = Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === "string")
        : EMPTY;
      cachedRaw = raw;
    }
    return cachedList;
  } catch {
    return EMPTY;
  }
}

export function writeWatchlist(slugs: string[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set(slugs)]));
    window.dispatchEvent(new Event(EVENT));
    return true;
  } catch {
    toast.error(
      "Your browser couldn't save this watchlist. Please enable local storage and try again.",
    );
    return false;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT, callback);
  };
}

export function useWatchlist(slug = "") {
  const slugs = useSyncExternalStore(subscribe, readWatchlist, () => EMPTY);
  return {
    slugs,
    saved: slugs.includes(slug),
    toggle: () =>
      writeWatchlist(
        readWatchlist().includes(slug)
          ? readWatchlist().filter((item) => item !== slug)
          : [...readWatchlist(), slug],
      ),
  };
}

import { useSyncExternalStore } from "react";
import { toast } from "sonner";

export interface LibraryItem {
  key: string;
  title: string;
  path: string;
  image?: string;
  category: string;
  subtitle?: string;
}
const KEY = "lumiere_library_v1";
const EVENT = "lumiere:library";
const EMPTY: LibraryItem[] = [];
let raw: string | null = null;
let snapshot = EMPTY;
export function parseLibrary(value: string | null): LibraryItem[] {
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed.filter((entry): entry is LibraryItem => {
      if (
        !entry ||
        typeof entry.key !== "string" ||
        typeof entry.title !== "string" ||
        typeof entry.category !== "string" ||
        typeof entry.path !== "string"
      )
        return false;
      if (!/^\/(screen\/(movie|tv)\/\d+|people\/\d+|culture\/[a-z0-9-]+)$/.test(entry.path))
        return false;
      if (entry.subtitle !== undefined && typeof entry.subtitle !== "string") return false;
      if (
        entry.image !== undefined &&
        (typeof entry.image !== "string" ||
          !/^https:\/\/(image\.tmdb\.org|upload\.wikimedia\.org|thumb\.wikimedia\.org)\//.test(
            entry.image,
          ))
      )
        return false;
      return true;
    });
  } catch {
    return EMPTY;
  }
}
function read() {
  if (typeof window === "undefined") return EMPTY;
  try {
    const next = localStorage.getItem(KEY);
    if (next !== raw) {
      snapshot = parseLibrary(next);
      raw = next;
    }
    return snapshot;
  } catch {
    return EMPTY;
  }
}
function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
export function useLibrary() {
  const items = useSyncExternalStore(subscribe, read, () => EMPTY);
  function toggle(item: LibraryItem) {
    const current = read();
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify(
          current.some((saved) => saved.key === item.key)
            ? current.filter((saved) => saved.key !== item.key)
            : [...current, item],
        ),
      );
      window.dispatchEvent(new Event(EVENT));
    } catch {
      toast.error("Couldn't save on this device. Check your browser storage settings.");
    }
  }
  return { items, toggle };
}

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Film, Loader2, Search, Sparkles, X } from "lucide-react";
import { searchFilms, getTopFilms } from "@/lib/apiClient";
import { FilmPosterThumbnail } from "./FilmPosterThumbnail";

/** Returns `value` only after it has been stable for `delay` ms. */
function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** True when any result title contains the query — mirrors the backend's
 *  ilike direct-match. When false, the results came from the fuzzy fallback,
 *  so the UI tells the user there was no exact match. */
function hasExactMatch(results: { title: string }[], query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return results.some((f) => f.title.toLowerCase().includes(q));
}

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const debounced = useDebouncedValue(query.trim(), 250);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["films", "search", debounced],
    queryFn: () => searchFilms(debounced),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  // Popular searches — surfaced as clickable chips when the box is empty so
  // users never face a blank modal.
  const { data: popular = [] } = useQuery({
    queryKey: ["films", "top", 10],
    queryFn: () => getTopFilms(10),
    staleTime: 5 * 60 * 1000,
  });

  const results = data ?? [];
  const exact = hasExactMatch(results, debounced);
  const showFuzzyNote = debounced.length >= 2 && results.length > 0 && !exact;

  const closeAndClear = () => {
    setQuery("");
    setHighlighted(0);
    onClose();
  };

  const pickSuggestion = (title: string) => {
    setQuery(title);
    setHighlighted(0);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      const target = results[Math.min(highlighted, results.length - 1)];
      if (target) {
        e.preventDefault();
        navigate({ to: "/films/$slug", params: { slug: target.slug } });
        closeAndClear();
      }
    }
  };

  // Reset state when the modal closes.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setHighlighted(0);
    }
  }, [open]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/10 backdrop-blur-sm" />
        <Dialog.Content
          aria-label="Search films"
          className="fixed left-1/2 top-[15vh] z-50 w-full max-w-xl -translate-x-1/2 px-4 outline-none animate-fade-up"
        >
          <div className="glass rounded-2xl border border-foreground/10 shadow-2xl">
            {/* ── Search input ── */}
            <div className="relative border-b border-foreground/10">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlighted(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search films…"
                aria-label="Search films"
                className="w-full rounded-t-2xl border-0 bg-transparent py-4 pl-12 pr-12 text-base outline-none placeholder:text-muted-foreground"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setHighlighted(0);
                    inputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {/* ── Results ── */}
            <div className="max-h-80 overflow-y-auto">
              {debounced.length >= 2 ? (
                isFetching && results.length === 0 ? (
                  <div className="flex items-center gap-2 px-5 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching…
                  </div>
                ) : isError ? (
                  <div className="px-5 py-4 text-sm text-down">
                    Search failed — please try again.
                  </div>
                ) : results.length === 0 ? (
                  <div className="px-5 py-6 text-center">
                    <Film className="mx-auto h-6 w-6 opacity-30" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      No films match &ldquo;{debounced}&rdquo;.
                    </p>
                    {popular.length > 0 && (
                      <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                        Try one of these instead
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    {showFuzzyNote && (
                      <div className="border-b border-foreground/10 bg-primary/5 px-5 py-3">
                        <p className="text-xs text-primary">
                          No exact match for &ldquo;{debounced}&rdquo; — showing similar
                          results.
                        </p>
                      </div>
                    )}
                    <ul className="py-1" role="listbox">
                      {results.map((film, i) => (
                        <li
                          key={film.id}
                          role="option"
                          aria-selected={i === highlighted}
                          onMouseEnter={() => setHighlighted(i)}
                        >
                          <Link
                            to="/films/$slug"
                            params={{ slug: film.slug }}
                            onClick={closeAndClear}
                            className={`flex items-center gap-3 px-5 py-2.5 transition ${
                              i === highlighted ? "bg-foreground/5" : ""
                            }`}
                          >
                            <FilmPosterThumbnail film={film} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{film.title}</div>
                              <div className="truncate text-xs text-muted-foreground">
                                {film.year ?? "Year TBA"}
                                {film.rank > 0 && <> &middot; #{film.rank} on The Index</>}
                              </div>
                            </div>
                            {film.score > 0 && (
                              <span className="shrink-0 font-mono text-xs tabular text-primary">
                                {film.score.toFixed(1)}
                              </span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )
              ) : (
                <div className="px-5 py-4">
                  <p className="text-sm text-muted-foreground">
                    {debounced.length === 1
                      ? "Type at least 2 characters to search."
                      : "Start typing to search the index."}
                  </p>

                  {/* Keyword suggestions — clickable chips from the top films */}
                  {debounced.length === 0 && popular.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                        <Sparkles className="h-3 w-3" />
                        Popular searches
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {popular.slice(0, 8).map((film) => (
                          <button
                            key={film.slug}
                            type="button"
                            onClick={() => pickSuggestion(film.title)}
                            className="rounded-full border border-foreground/15 bg-foreground/5 px-3 py-1.5 text-xs text-foreground/90 transition hover:border-primary/50 hover:text-primary"
                          >
                            {film.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Footer hints ── */}
            <div className="flex items-center justify-between border-t border-foreground/10 px-5 py-3">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Search the Lumière Index
              </span>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <kbd className="rounded border border-foreground/15 bg-foreground/5 px-1.5 py-0.5 font-mono">
                  &uarr;&darr;
                </kbd>
                <span>Navigate</span>
                <kbd className="rounded border border-foreground/15 bg-foreground/5 px-1.5 py-0.5 font-mono">
                  &crarr;
                </kbd>
                <span>Select</span>
                <kbd className="rounded border border-foreground/15 bg-foreground/5 px-1.5 py-0.5 font-mono">
                  Esc
                </kbd>
                <span>Close</span>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

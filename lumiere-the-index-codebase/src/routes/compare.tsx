import { useState, useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { canonicalLink, ogUrlMeta } from "@/lib/site";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { PagePlane } from "@/components/lumiere/PagePlane";
import { PageHead } from "@/components/lumiere/PageHead";
import {
  getTopFilms,
  searchFilms,
  searchTmdbMovie,
  getTmdbMovieDetails,
  tmdbPosterUrl,
  type RankedFilm,
} from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
import { Skeleton } from "@/components/lumiere/Skeletons";
import {
  Scale,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  RefreshCw,
  Search,
  X,
  ShieldCheck,
  Info,
} from "lucide-react";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare Films · The Index" },
      {
        name: "description",
        content:
          "Head-to-head comparison of two films across chart position, sentiment, and box office.",
      },
      ogUrlMeta("/compare"),
    ],
    links: [canonicalLink("/compare")],
  }),
  component: ComparePage,
  errorComponent: RouteError,
});

// ── Film Search Combobox ────────────────────────────────────────────────────────
// A slot is in exactly one of two states: resolved (poster card only — the
// search UI is fully unmounted) or empty (a placeholder card with the search
// input inside it). Selecting a film closes and unmounts the dropdown, clears
// the query, and blurs the input so the poster is the only visible state.
function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function FilmPicker({
  value,
  onSelect,
  placeholder,
  films,
}: {
  value: RankedFilm | null;
  onSelect: (f: RankedFilm | null) => void;
  placeholder: string;
  films: RankedFilm[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Server-backed search for real queries — the top-100 starter list only
  // covers the chart head, so filtering it client-side hid most of the
  // catalog from compare. Two characters trigger the API; shorter queries
  // (or cleared input) fall back to the starter list.
  const debounced = useDebouncedValue(query.trim(), 250);
  const serverSearching = debounced.length >= 2;
  const { data: serverResults = [] } = useQuery({
    queryKey: ["films", "search", "compare", debounced],
    queryFn: () => searchFilms(debounced, 20),
    enabled: serverSearching,
    staleTime: 30 * 1000,
  });

  const filtered = serverSearching
    ? serverResults
    : films;

  const { data: tmdb } = useQuery({
    queryKey: ["tmdb", value?.title, value?.year],
    queryFn: () => searchTmdbMovie(value!.title, value?.year ?? undefined),
    enabled: !!value,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const poster = tmdbPosterUrl(tmdb?.results?.[0]?.poster_path, "w342");

  // Dismiss the dropdown on outside clicks and Escape while it is open.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      const inInput = inputRef.current?.contains(t) ?? false;
      const inDropdown = dropdownRef.current?.contains(t) ?? false;
      if (!inInput && !inDropdown) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // After "Change" clears the slot, focus the freshly mounted empty input.
  useEffect(() => {
    if (focusRequest > 0 && !value) inputRef.current?.focus();
  }, [focusRequest, value]);

  const handleSelect = (f: RankedFilm) => {
    onSelect(f);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleChange = () => {
    onSelect(null);
    setQuery("");
    setOpen(true);
    setFocusRequest((n) => n + 1);
  };

  return (
    <div className="flex flex-col gap-3">
      {value ? (
        <div className="relative mx-auto w-36 aspect-[2/3] overflow-hidden bg-ink">
          {poster ? (
            <img src={poster} alt={value.title} className="h-full w-full object-cover" />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background: `linear-gradient(155deg, ${value.gradient_from ?? "#333"}, ${value.gradient_to ?? "#111"})`,
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />

          {/* Change — re-opens a fresh, empty search for this slot. */}
          <button
            onClick={handleChange}
            className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur transition hover:bg-black/80"
          >
            Change
          </button>

          {/* Remove */}
          <button
            onClick={() => onSelect(null)}
            aria-label={`Remove ${value.title}`}
            className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white backdrop-blur transition hover:bg-black/80"
          >
            <X className="h-3 w-3" />
          </button>

          <div className="absolute inset-x-2 bottom-2 text-white">
            <div className="font-serif text-sm leading-tight">{value.title}</div>
            <div className="font-mono text-[10px] text-white/70">
              {value.director ? `${value.director} · ${value.year}` : String(value.year)}
            </div>
          </div>
        </div>
      ) : (
        /* Empty slot: the search input lives inside the placeholder card. */
        <div className="ix-pick__slot">
          <Scale className="ix-pick__mark" aria-hidden />
          <span className="ix-pick__hint">Choose a film</span>
          <div className="relative w-[80%]">
            <Search className="ix-pick__search" aria-hidden />
            <input
              ref={inputRef}
              type="text"
              value={query}
              placeholder={placeholder}
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              className="ix-input"
            />
          </div>
        </div>
      )}

      {/* Dropdown — in-flow (not absolute) so it can't be trapped behind the
          next card/section: each picker card uses backdrop-filter, which creates
          a stacking context that would hide an absolutely-positioned dropdown. */}
      {open && (
        <div ref={dropdownRef} className="ix-menu">
          {filtered.length === 0 ? (
            <div className="ix-menu__empty">
              {serverSearching ? `No titles match “${debounced}”.` : "No films found"}
            </div>
          ) : (
            filtered.slice(0, 20).map((f) => (
              <button key={f.slug} className="ix-menu__row" onClick={() => handleSelect(f)}>
                <span
                  className="ix-menu__art"
                  style={{
                    background: `linear-gradient(155deg, ${f.gradient_from ?? "#2a3140"}, ${f.gradient_to ?? "#131720"})`,
                  }}
                />
                <span className="min-w-0">
                  <span className="ix-menu__t">{f.title}</span>
                  <span className="ix-menu__m">
                    {f.director ? `${f.director} · ${f.year}` : String(f.year)}
                  </span>
                </span>
                <span className="ml-auto shrink-0 text-right">
                  <span className="ix-menu__rk">{f.rank > 0 ? `#${f.rank}` : "-"}</span>
                  {f.rank > 0 ? <span className="ix-menu__m">on The Index</span> : null}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Comparison Row ────────────────────────────────────────────────────────────
function CompareRow({
  label,
  a,
  b,
  format = (v: number) => v.toFixed(1),
  higher = "better",
}: {
  label: string;
  a: number | null;
  b: number | null;
  format?: (v: number) => string;
  higher?: "better" | "worse";
}) {
  const aWins = a !== null && b !== null && (higher === "better" ? a > b : a < b);
  const bWins = a !== null && b !== null && (higher === "better" ? b > a : b < a);

  // Mobile stacks the label on top with the two values side-by-side below, so
  // long labels / values never get clipped; sm+ returns to the 3-column table.
  return (
    <div className="ix-vs__row">
      <div className="ix-vs__label">{label}</div>
      <div className={aWins ? "ix-vs__val is-win ix-vs__val--a" : "ix-vs__val ix-vs__val--a"}>
        {a !== null ? format(a) : "-"}
        {aWins ? <span className="ix-vs__win">▲</span> : null}
      </div>
      <div className={bWins ? "ix-vs__val is-win ix-vs__val--b" : "ix-vs__val ix-vs__val--b"}>
        {b !== null ? format(b) : "-"}
        {bWins ? <span className="ix-vs__win">▲</span> : null}
      </div>
    </div>
  );
}

// ── Main Compare Page ─────────────────────────────────────────────────────────
function ComparePage() {
  const [filmA, setFilmA] = useState<RankedFilm | null>(null);
  const [filmB, setFilmB] = useState<RankedFilm | null>(null);

  const { data: allFilms = [], isLoading } = useQuery({
    queryKey: ["films", "top", 100],
    queryFn: () => getTopFilms(100),
    staleTime: 5 * 60 * 1000,
  });

  // Auto-populate #1 vs #2 films when loaded if not selected yet
  useEffect(() => {
    if (allFilms.length >= 2 && !filmA && !filmB) {
      setFilmA(allFilms[0]);
      setFilmB(allFilms[1]);
    }
  }, [allFilms, filmA, filmB]);

  // TMDB details for each film
  const { data: tmdbA } = useQuery({
    queryKey: ["tmdb", "details-compare", filmA?.id],
    queryFn: async () => {
      const searchRes = await searchTmdbMovie(filmA!.title, filmA?.year ?? undefined);
      const id = searchRes.results?.[0]?.id;
      if (!id) return null;
      return getTmdbMovieDetails(id) as Promise<{
        vote_average: number;
        vote_count: number;
        revenue: number;
        popularity: number;
        runtime: number;
      }>;
    },
    enabled: !!filmA,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const { data: tmdbB } = useQuery({
    queryKey: ["tmdb", "details-compare", filmB?.id],
    queryFn: async () => {
      const searchRes = await searchTmdbMovie(filmB!.title, filmB?.year ?? undefined);
      const id = searchRes.results?.[0]?.id;
      if (!id) return null;
      return getTmdbMovieDetails(id) as Promise<{
        vote_average: number;
        vote_count: number;
        revenue: number;
        popularity: number;
        runtime: number;
      }>;
    },
    enabled: !!filmB,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const canCompare = !!filmA && !!filmB;

  return (
    <Layout>
      <PagePlane lead={filmA} wide>
        <PageHead
          kicker="Head to Head"
          title="Compare Films"
          lede="Head-to-head analysis comparing chart positions, viewer sentiment, and box office."
        >
          <p className="ix-callout">
            <ShieldCheck aria-hidden />
            <span>
              Chart positions come from measured audience attention; comparisons stay editorial.
            </span>
          </p>
        </PageHead>

        {/* Film Pickers */}
        <div className="ix-sec">
          <div className="ix-picks">
            <div className="ix-pick">
              <div className="ix-pick__label">Film A</div>
              {isLoading ? (
                <Skeleton className="h-40 w-full" style={{ borderRadius: 12 }} />
              ) : (
                <FilmPicker
                  value={filmA}
                  onSelect={setFilmA}
                  placeholder="Search films…"
                  films={allFilms}
                />
              )}
            </div>
            <div className="ix-pick">
              <div className="ix-pick__label">Film B</div>
              {isLoading ? (
                <Skeleton className="h-40 w-full" style={{ borderRadius: 12 }} />
              ) : (
                <FilmPicker
                  value={filmB}
                  onSelect={setFilmB}
                  placeholder="Search films…"
                  films={allFilms}
                />
              )}
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        {!canCompare ? (
          <div className="ix-sec">
            <div className="ix-note">
              <Scale className="ix-note__mark" aria-hidden />
              <p className="ix-note__title">Nothing to compare yet</p>
              <p className="ix-note__body">
                Select two films to compare. Search in either card above.
              </p>
            </div>
          </div>
        ) : (
          <div className="ix-sec">
            <div className="ix-vs">
              <div className="ix-vs__hd">
                <Link to="/films/$slug" params={{ slug: filmA!.slug }} className="ix-vs__title">
                  {filmA!.title}
                </Link>
                <Scale className="ix-vs__scale" aria-hidden />
                <Link to="/films/$slug" params={{ slug: filmB!.slug }} className="ix-vs__title">
                  {filmB!.title}
                </Link>
              </div>

              <div className="ix-vs__body">
              <CompareRow
                label="Chart position"
                a={filmA!.rank > 0 ? filmA!.rank : null}
                b={filmB!.rank > 0 ? filmB!.rank : null}
                format={(v) => `#${v}`}
                higher="worse"
              />
              <CompareRow
                label="Weeks on chart"
                a={filmA!.weeks_on_chart ?? null}
                b={filmB!.weeks_on_chart ?? null}
                format={(v) => `${v}`}
              />
              <CompareRow
                label="Audience Review Volume"
                a={tmdbA?.vote_count ?? null}
                b={tmdbB?.vote_count ?? null}
                format={(v) => v.toLocaleString()}
              />
              <CompareRow
                label="Popularity"
                a={tmdbA?.popularity ?? null}
                b={tmdbB?.popularity ?? null}
                format={(v) => v.toFixed(0)}
              />
              <CompareRow
                label="Index Rank"
                a={filmA!.rank}
                b={filmB!.rank}
                format={(v) => `#${v}`}
                higher="worse"
              />
              <CompareRow
                label="Rank Movement"
                a={filmA!.movement ?? 0}
                b={filmB!.movement ?? 0}
                format={(v) => (v > 0 ? `+${v}` : String(v))}
              />
              <CompareRow
                label="Days on Chart"
                a={filmA!.days_on_chart ?? 1}
                b={filmB!.days_on_chart ?? 1}
                format={(v) => `${v} ${v === 1 ? "day" : "days"}`}
              />
              <CompareRow
                label="Box Office Revenue"
                a={tmdbA?.revenue && tmdbA.revenue > 0 ? tmdbA.revenue : null}
                b={tmdbB?.revenue && tmdbB.revenue > 0 ? tmdbB.revenue : null}
                format={(v) => {
                  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
                  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(0)}M`;
                  return `$${v.toLocaleString()}`;
                }}
              />
            </div>

              {/* Bottom CTA — stacks full-width on mobile, side-by-side on sm+. */}
              <div className="ix-vs__foot">
                <Link
                  to="/films/$slug"
                  params={{ slug: filmA!.slug }}
                  className="ix-more ix-more--wide"
                >
                  {filmA!.title} Deep Dive →
                </Link>
                <Link
                  to="/films/$slug"
                  params={{ slug: filmB!.slug }}
                  className="ix-more ix-more--wide"
                >
                  {filmB!.title} Deep Dive →
                </Link>
              </div>
            </div>
          </div>
        )}
      </PagePlane>
    </Layout>
  );
}

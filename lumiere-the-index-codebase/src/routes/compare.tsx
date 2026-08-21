import { useState, useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import {
  getTopFilms,
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
      { title: "Compare Films — Lumière The Index" },
      {
        name: "description",
        content:
          "Head-to-head comparison of two films across cultural scores, sentiment, and engagement signals.",
      },
    ],
  }),
  component: ComparePage,
  errorComponent: RouteError,
});

// ── Film Search Combobox ────────────────────────────────────────────────────────
// A slot is in exactly one of two states: resolved (poster card only — the
// search UI is fully unmounted) or empty (a placeholder card with the search
// input inside it). Selecting a film closes and unmounts the dropdown, clears
// the query, and blurs the input so the poster is the only visible state.
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

  const filtered = query.trim()
    ? films.filter((f) => f.title.toLowerCase().includes(query.toLowerCase()))
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
        <div className="relative mx-auto w-36 aspect-[2/3] overflow-hidden rounded-2xl bg-ink shadow-lg">
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
              {value.director || "Director TBA"} · {value.year}
            </div>
          </div>
        </div>
      ) : (
        /* Empty slot: the search input lives inside the placeholder card. */
        <div className="relative mx-auto flex aspect-[2/3] w-36 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-foreground/15 bg-foreground/[0.03] text-muted-foreground">
          <Scale className="h-6 w-6 opacity-40" />
          <span className="px-2 text-center text-xs">Choose a film</span>
          <div className="relative w-[80%]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
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
              className="w-full rounded-lg border border-foreground/15 bg-background/80 py-1.5 pl-7 pr-2 text-xs outline-none transition placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
        </div>
      )}

      {/* Dropdown — in-flow (not absolute) so it can't be trapped behind the
          next card/section: each picker card uses backdrop-filter, which creates
          a stacking context that would hide an absolutely-positioned dropdown. */}
      {open && (
        <div
          ref={dropdownRef}
          className="max-h-64 overflow-y-auto rounded-xl border border-foreground/15 bg-background shadow-2xl"
        >
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">No films found</div>
          ) : (
            filtered.slice(0, 20).map((f) => (
              <button
                key={f.slug}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-foreground/5"
                onClick={() => handleSelect(f)}
              >
                <div
                  className="h-10 w-7 shrink-0 overflow-hidden rounded-md"
                  style={{
                    background: `linear-gradient(155deg, ${f.gradient_from ?? "#333"}, ${f.gradient_to ?? "#111"})`,
                  }}
                />
                <div className="min-w-0">
                  <div className="truncate font-serif">{f.title}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {f.director || "Director TBA"} · {f.year}
                  </div>
                </div>
                <div className="ml-auto font-mono text-sm text-primary">{f.score?.toFixed(1)}</div>
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
    <div className="grid grid-cols-2 items-center gap-x-4 gap-y-1 border-b border-foreground/5 py-3 last:border-0 sm:grid-cols-[1fr_auto_1fr] sm:gap-y-0">
      <div className="col-span-2 text-center text-[10px] uppercase tracking-[0.15em] text-muted-foreground sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:whitespace-nowrap sm:px-2">
        {label}
      </div>
      <div
        className={`text-left font-mono text-lg tabular sm:col-start-1 sm:row-start-1 sm:text-right ${aWins ? "text-primary font-semibold" : "text-foreground/70"}`}
      >
        {a !== null ? format(a) : "—"}
        {aWins && <span className="ml-1.5 text-[10px] text-primary">▲</span>}
      </div>
      <div
        className={`text-right font-mono text-lg tabular sm:col-start-3 sm:row-start-1 sm:text-left ${bWins ? "text-primary font-semibold" : "text-foreground/70"}`}
      >
        {b !== null ? format(b) : "—"}
        {bWins && <span className="ml-1.5 text-[10px] text-primary">▲</span>}
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
      <section className="px-4 pt-6 lg:px-6">
        <div className="flex items-center gap-3">
          <Scale className="h-5 w-5 text-primary" />
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Head to Head
          </div>
        </div>
        <h1 className="mt-2 font-serif text-5xl lg:text-6xl">Compare Films</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Head-to-head analysis comparing Lumière Index Scores, viewer sentiment, audience signals,
          and box office.
        </p>

        {/* Methodology note */}
        <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs text-primary">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>
            All scores derived from audience sentiment & viewer engagement signals — 0% critic
            weight.
          </span>
        </div>
      </section>

      {/* Film Pickers */}
      <section className="mt-8 grid grid-cols-1 gap-6 px-4 sm:grid-cols-2 lg:px-6">
        <div className="glass rounded-2xl p-5">
          <div className="mb-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Film A
          </div>
          {isLoading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : (
            <FilmPicker
              value={filmA}
              onSelect={setFilmA}
              placeholder="Search films…"
              films={allFilms}
            />
          )}
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="mb-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Film B
          </div>
          {isLoading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : (
            <FilmPicker
              value={filmB}
              onSelect={setFilmB}
              placeholder="Search films…"
              films={allFilms}
            />
          )}
        </div>
      </section>

      {/* Comparison Table */}
      {!canCompare ? (
        <section className="mt-8 px-4 lg:px-6">
          <div className="glass rounded-2xl p-12 text-center">
            <Scale className="mx-auto h-12 w-12 opacity-20" />
            <p className="mt-4 text-sm text-muted-foreground">
              Select two films to compare — search in either card above.
            </p>
          </div>
        </section>
      ) : (
        <section className="mt-8 px-4 lg:px-6">
          <div className="glass rounded-2xl overflow-hidden">
            {/* Header row — two columns on mobile so full titles fit, the scale
                icon is hidden; three columns with truncated titles on sm+. */}
            <div className="grid grid-cols-2 items-center gap-2 border-b border-foreground/10 bg-foreground/[0.03] px-4 py-4 sm:grid-cols-[1fr_auto_1fr] sm:gap-4 sm:px-6">
              <Link
                to="/films/$slug"
                params={{ slug: filmA!.slug }}
                className="text-right font-serif text-lg leading-snug hover:text-primary transition sm:truncate sm:text-xl"
              >
                {filmA!.title}
              </Link>
              <div className="hidden px-2 text-center sm:block">
                <Scale className="mx-auto h-5 w-5 text-muted-foreground" />
              </div>
              <Link
                to="/films/$slug"
                params={{ slug: filmB!.slug }}
                className="text-left font-serif text-lg leading-snug hover:text-primary transition sm:truncate sm:text-xl"
              >
                {filmB!.title}
              </Link>
            </div>

            <div className="px-6 py-2">
              <CompareRow
                label="Lumière Index Score"
                a={filmA!.score}
                b={filmB!.score}
                format={(v) => v.toFixed(1)}
              />
              <CompareRow
                label="Audience Mentions (48h)"
                a={filmA!.mentions_total}
                b={filmB!.mentions_total}
                format={(v) => v.toLocaleString()}
              />
              <CompareRow
                label="Audience Review Volume"
                a={tmdbA?.vote_count ?? null}
                b={tmdbB?.vote_count ?? null}
                format={(v) => v.toLocaleString()}
              />
              <CompareRow
                label="Cultural Velocity"
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
                label="Weeks on Chart"
                a={filmA!.weeks_on_chart ?? 1}
                b={filmB!.weeks_on_chart ?? 1}
                format={(v) => `${v} ${v === 1 ? "week" : "weeks"}`}
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
            <div className="flex flex-col gap-3 border-t border-foreground/10 bg-foreground/[0.02] px-4 py-4 sm:flex-row sm:px-6">
              <Link
                to="/films/$slug"
                params={{ slug: filmA!.slug }}
                className="flex-1 rounded-xl border border-foreground/10 py-2.5 text-center text-sm text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground font-mono"
              >
                {filmA!.title} Deep Dive →
              </Link>
              <Link
                to="/films/$slug"
                params={{ slug: filmB!.slug }}
                className="flex-1 rounded-xl border border-foreground/10 py-2.5 text-center text-sm text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground font-mono"
              >
                {filmB!.title} Deep Dive →
              </Link>
            </div>
          </div>
        </section>
      )}
    </Layout>
  );
}

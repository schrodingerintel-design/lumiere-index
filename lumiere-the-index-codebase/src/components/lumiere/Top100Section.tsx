import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import { getTopFilms, type RankedFilm } from "@/lib/apiClient";
import { filmTrend } from "@/lib/trend";
import { PosterCard } from "./PosterCard";
import { FilmCardSkeleton, FilmRowSkeleton } from "./Skeletons";
import { FilmPosterThumbnail } from "./FilmPosterThumbnail";

/** Compact trend symbol shared by desktop and mobile rows: ↑3 / ↓1 / — / NEW */
function MovementBadge({ film }: { film: RankedFilm }) {
  const trend = filmTrend(film);
  const change = film.movement ?? 0;
  if (trend === "new") {
    return (
      <span className="bg-live px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-ink">
        New
      </span>
    );
  }
  if (trend === "rise") {
    return (
      <span className="flex items-center gap-0.5 font-mono text-xs tabular text-up" title={`Up ${change} since last week`}>
        <ArrowUp className="h-3 w-3" />
        {Math.abs(change)}
      </span>
    );
  }
  if (trend === "fall") {
    return (
      <span className="flex items-center gap-0.5 font-mono text-xs tabular text-down" title={`Down ${Math.abs(change)} since last week`}>
        <ArrowDown className="h-3 w-3" />
        {Math.abs(change)}
      </span>
    );
  }
  return (
    <span className="font-mono text-sm text-yellow-300/90" title="Held its rank">
      —
    </span>
  );
}

export function Top100Section() {
  const stripRef = useRef<HTMLDivElement>(null);

  const scrollStrip = (direction: "left" | "right") => {
    if (!stripRef.current) return;
    const distance = stripRef.current.clientWidth * 0.75;
    stripRef.current.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  };

  // Canonical ranking feed — the same rows every other page reads, so the
  // homepage chart always agrees with /top-100 and the film pages.
  const {
    data: films,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["films", "top", 100],
    queryFn: () => getTopFilms(100),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <section className="mt-12 px-4 lg:px-6">
      {/* Section header — publication style: kicker, title, rule */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
              The Index
            </span>
            <span className="h-px flex-1 bg-foreground/10" />
          </div>
          <h2 className="mt-2 font-display text-3xl font-semibold">The Top 100</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            The 100 films currently generating the strongest cultural momentum across audience
            conversation, attention and visibility.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="hidden gap-1.5 sm:flex">
            <button
              onClick={() => scrollStrip("left")}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/15 text-muted-foreground transition hover:border-foreground/35 hover:text-foreground"
              aria-label="Scroll posters left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => scrollStrip("right")}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/15 text-muted-foreground transition hover:border-foreground/35 hover:text-foreground"
              aria-label="Scroll posters right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Link
            to="/top-100"
            className="shrink-0 font-mono text-xs text-muted-foreground transition hover:text-foreground"
          >
            Full list →
          </Link>
        </div>
      </div>

      {error && (
        <div className="glass-soft p-6 text-center text-sm text-muted-foreground">
          Unable to load rankings. Please try again later.
        </div>
      )}

      {/* ── Mobile: editorial ranked rows — no horizontal scroll, no cards ── */}
      <ul className="divide-y divide-foreground/[0.07] border-y border-foreground/10 lg:hidden">
        {isLoading
          ? [...Array(6)].map((_, i) => (
              <li key={i} className="flex items-center gap-3 py-3">
                <div className="h-7 w-7 animate-pulse bg-foreground/10" />
                <div className="h-16 w-11 animate-pulse bg-foreground/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 animate-pulse bg-foreground/10" />
                  <div className="h-3 w-24 animate-pulse bg-foreground/10" />
                </div>
              </li>
            ))
          : films?.slice(0, 10).map((f) => {
              const director =
                f.director && f.director !== "Unknown" ? f.director : "Director TBA";
              // NEW entries have no previous snapshot — a week count would be
              // meaningless (and contradictory) next to the NEW badge.
              const weeks = f.prev_rank == null ? null : (f.weeks_on_chart ?? 1);
              return (
                <li key={f.slug}>
                  <Link
                    to="/films/$slug"
                    params={{ slug: f.slug }}
                    className="flex items-center gap-3 py-3"
                  >
                    <div className="flex w-10 shrink-0 flex-col items-center gap-0.5">
                      <span className="font-mono text-lg font-semibold tabular text-foreground">
                        {String(f.rank).padStart(2, "0")}
                      </span>
                      <MovementBadge film={f} />
                    </div>
                    <FilmPosterThumbnail film={f} className="h-16 w-11" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-[15px] font-medium leading-snug">
                        {f.title}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {director} · {f.year}
                        {weeks != null ? ` · ${weeks} ${weeks === 1 ? "wk" : "wks"}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="index-score text-xl leading-none">
                        {f.score?.toFixed(1)}
                      </div>
                      <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground">
                        Index
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
      </ul>

      {/* ── Desktop: top 10 poster strip + authoritative ranked chart ── */}
      <div className="hidden lg:block">
        <div ref={stripRef} className="no-scrollbar -mx-4 overflow-x-auto px-4">
          <div className="flex gap-4 pb-6">
            {isLoading
              ? [...Array(10)].map((_, i) => (
                  <div key={i} style={{ width: 140 }}>
                    <FilmCardSkeleton />
                  </div>
                ))
              : films?.slice(0, 10).map((f) => <PosterCard key={f.slug} film={f} />)}
          </div>
        </div>

        {/* The chart — strong numbering, hairline rules, zero decoration */}
        <div className="border-t-2 border-foreground/20">
          <div className="sticky top-14 z-10 grid grid-cols-[72px_64px_1fr_90px_110px] items-center gap-3 border-b border-foreground/10 bg-background/95 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
            <div>Rank</div>
            <div>Mvmt</div>
            <div>Title</div>
            <div>Weeks</div>
            <div className="text-right">Index Score</div>
          </div>
          <ul className="divide-y divide-foreground/[0.06]">
            {isLoading
              ? [...Array(10)].map((_, i) => <FilmRowSkeleton key={i} />)
              : films?.slice(0, 10).map((f) => {
                  const director =
                    f.director && f.director !== "Unknown" ? f.director : "Director TBA";
                  const weeks = f.prev_rank == null ? null : (f.weeks_on_chart ?? 1);

                  return (
                    <li key={f.slug}>
                      <Link
                        to="/films/$slug"
                        params={{ slug: f.slug }}
                        className="grid grid-cols-[72px_64px_1fr_90px_110px] items-center gap-3 px-5 py-3.5 transition-colors hover:bg-foreground/[0.035]"
                      >
                        <div className="font-mono text-2xl font-semibold tabular text-foreground">
                          {String(f.rank).padStart(2, "0")}
                        </div>
                        <div>
                          <MovementBadge film={f} />
                        </div>
                        <div className="flex min-w-0 items-center gap-3">
                          <FilmPosterThumbnail film={f} className="h-12 w-9" />
                          <div className="min-w-0">
                            <div className="truncate font-display text-base font-medium">
                              {f.title}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {director} · {f.year}
                            </div>
                          </div>
                        </div>
                        <div className="font-mono text-xs tabular text-muted-foreground">
                          {weeks != null ? `${weeks} ${weeks === 1 ? "wk" : "wks"}` : "—"}
                        </div>
                        <div className="text-right">
                          <span className="index-score text-xl">
                            {f.score?.toFixed(1)}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
          </ul>
        </div>
      </div>

      {!isLoading && films?.length === 0 && (
        <div className="glass-soft p-10 text-center text-sm text-muted-foreground">
          No films charted yet. Rankings will appear after the next ingest cycle.
        </div>
      )}
    </section>
  );
}

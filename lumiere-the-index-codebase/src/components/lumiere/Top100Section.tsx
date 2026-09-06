import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import { getNewReleaseFilms, type RankedFilm } from "@/lib/apiClient";
import { isNewRelease } from "@/lib/filmUtils";
import { PosterCard } from "./PosterCard";
import { FilmCardSkeleton, FilmRowSkeleton } from "./Skeletons";
import { FilmPosterThumbnail } from "./FilmPosterThumbnail";

/** Rank + movement cell shared by desktop and mobile rows. */
function MovementBadge({ film }: { film: RankedFilm }) {
  const change = film.movement ?? null;
  if (film.prev_rank == null && isNewRelease(film)) {
    return (
      <span className="rounded bg-live px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-ink">
        New
      </span>
    );
  }
  if (change !== null && change !== 0) {
    return (
      <span
        className={`flex items-center gap-0.5 font-mono text-xs tabular ${
          change > 0 ? "text-forest-deep" : "text-down"
        }`}
      >
        {change > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        {Math.abs(change)}
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">—</span>;
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

  const {
    data: films,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["films", "new-releases", 100],
    queryFn: () => getNewReleaseFilms(100),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <section className="mt-10 px-4 lg:px-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            The Index · Daily Ranking
          </div>
          <h2 className="mt-1 font-display text-3xl">The Top 100</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            The 100 films currently generating the strongest cultural momentum across audience
            conversation, attention and visibility.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="hidden gap-1.5 sm:flex">
            <button
              onClick={() => scrollStrip("left")}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/10 bg-background/60 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
              aria-label="Scroll posters left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => scrollStrip("right")}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/10 bg-background/60 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
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
        <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
          Unable to load rankings. Please try again later.
        </div>
      )}

      {/* ── Mobile: stacked ranked cards — rank + movement + title + score,
             with director/year/weeks underneath. No horizontal scrolling. ── */}
      <ul className="space-y-2.5 lg:hidden">
        {isLoading
          ? [...Array(6)].map((_, i) => (
              <li key={i} className="glass-soft rounded-xl p-3 flex items-center gap-3">
                <div className="h-9 w-9 bg-foreground/10 animate-pulse rounded" />
                <div className="h-16 w-11 bg-foreground/10 animate-pulse rounded-md" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-foreground/10 animate-pulse rounded" />
                  <div className="h-3 w-24 bg-foreground/10 animate-pulse rounded" />
                </div>
              </li>
            ))
          : films?.slice(0, 10).map((f) => {
              const director =
                f.director && f.director !== "Unknown" ? f.director : "Director TBA";
              const weeks = f.weeks_on_chart ?? 1;
              return (
                <li key={f.slug}>
                  <Link
                    to="/films/$slug"
                    params={{ slug: f.slug }}
                    className="glass-soft card-lift flex items-center gap-3 rounded-xl p-3"
                  >
                    <div className="flex w-9 shrink-0 flex-col items-center gap-1">
                      <span className="index-score text-xl font-semibold">
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
                        {director} · {f.year} · {weeks} {weeks === 1 ? "wk" : "wks"}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="index-score text-2xl font-semibold leading-none">
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

      {/* ── Desktop: top 10 poster strip + high-readability ranked table ── */}
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

        <div className="glass-solid rounded-2xl">
          <div className="sticky top-0 z-10 grid grid-cols-[70px_64px_1fr_90px_110px] items-center gap-3 rounded-t-2xl border-b border-foreground/10 bg-background/95 px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
            <div>Rank</div>
            <div>Mvmt</div>
            <div>Title</div>
            <div>Weeks</div>
            <div className="text-right">Index Score</div>
          </div>
          {/* Capped height — ~5 rows visible, the rest scroll */}
          <ul className="max-h-[480px] overflow-y-auto">
            {isLoading
              ? [...Array(10)].map((_, i) => <FilmRowSkeleton key={i} />)
              : films?.slice(0, 10).map((f) => {
                  const director =
                    f.director && f.director !== "Unknown" ? f.director : "Director TBA";
                  const weeks = f.weeks_on_chart ?? 1;

                  return (
                    <li key={f.slug}>
                      <Link
                        to="/films/$slug"
                        params={{ slug: f.slug }}
                        className="grid grid-cols-[70px_64px_1fr_90px_110px] items-center gap-3 border-b border-foreground/5 px-5 py-3.5 transition hover:bg-foreground/[0.04]"
                      >
                        <div className="index-score text-2xl font-semibold">
                          {String(f.rank).padStart(2, "0")}
                        </div>
                        <div>
                          <MovementBadge film={f} />
                        </div>
                        <div className="min-w-0 flex items-center gap-3">
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
                          {weeks} {weeks === 1 ? "wk" : "wks"}
                        </div>
                        <div className="text-right">
                          <span className="index-score text-xl font-semibold">
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
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          No new releases charted yet. Films will appear after the next ingest cycle.
        </div>
      )}
    </section>
  );
}

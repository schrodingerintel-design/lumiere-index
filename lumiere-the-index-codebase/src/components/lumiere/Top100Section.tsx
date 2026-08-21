import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import { getNewReleaseFilms } from "@/lib/apiClient";
import { isNewRelease } from "@/lib/filmUtils";
import { PosterCard } from "./PosterCard";
import { FilmCardSkeleton, FilmRowSkeleton } from "./Skeletons";
import { FilmPosterThumbnail } from "./FilmPosterThumbnail";

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
    <section className="mt-12 px-4 lg:px-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            New Releases
          </div>
          <h2 className="mt-1 font-serif text-3xl">The Top 100</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Highest-rated newly released films on the Index, ranked by audience score and viewer
            sentiment.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="hidden gap-1.5 sm:flex">
            <button
              onClick={() => scrollStrip("left")}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground/10 bg-background/60 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
              aria-label="Scroll posters left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => scrollStrip("right")}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground/10 bg-background/60 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
              aria-label="Scroll posters right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Link
            to="/top-100"
            className="shrink-0 font-mono text-xs text-muted-foreground hover:text-foreground"
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

      {/* Mobile: ranked list — capped height, scroll for the rest */}
      <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1 lg:hidden">
        {isLoading
          ? [...Array(10)].map((_, i) => (
              <li key={i} className="glass rounded-xl p-2 flex items-center gap-3">
                <div className="h-8 w-8 bg-foreground/10 animate-pulse rounded" />
                <div className="h-14 w-10 bg-foreground/10 animate-pulse rounded-md" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-foreground/10 animate-pulse rounded" />
                  <div className="h-3 w-24 bg-foreground/10 animate-pulse rounded" />
                </div>
              </li>
            ))
          : films?.slice(0, 10).map((f) => {
              const director = f.director && f.director !== "Unknown" ? f.director : "Director TBA";
              return (
                <li key={f.slug}>
                  <Link
                    to="/films/$slug"
                    params={{ slug: f.slug }}
                    className="glass card-lift flex items-center gap-3 rounded-xl p-2"
                  >
                    <div className="grid h-8 w-8 shrink-0 place-items-center font-mono text-sm tabular">
                      {String(f.rank).padStart(2, "0")}
                    </div>
                    <FilmPosterThumbnail film={f} className="h-14 w-10" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-serif text-base">{f.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{director}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm tabular text-primary">
                        {f.score?.toFixed(1)}
                      </div>
                      {f.prev_rank == null && isNewRelease(f) ? (
                        <span className="rounded-md bg-live px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-ink">
                          New
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
      </ul>

      {/* Desktop: top 10 poster strip + scrollable ranked table */}
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

        <div className="glass rounded-2xl border border-foreground/10">
          <div className="sticky top-0 z-10 grid grid-cols-[60px_60px_1fr_90px_90px] items-center gap-3 border-b border-foreground/10 bg-background/95 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
            <div>Rank</div>
            <div>Mvmt</div>
            <div>Title</div>
            <div>Weeks</div>
            <div className="text-right">Score</div>
          </div>
          {/* Capped height — ~5 rows visible, the rest scroll */}
          <ul className="max-h-[460px] overflow-y-auto">
            {isLoading
              ? [...Array(10)].map((_, i) => <FilmRowSkeleton key={i} />)
              : films?.slice(0, 10).map((f) => {
                  const change = f.movement ?? null;
                  const director =
                    f.director && f.director !== "Unknown" ? f.director : "Director TBA";
                  const weeks = f.weeks_on_chart ?? 1;

                  return (
                    <li key={f.slug}>
                      <Link
                        to="/films/$slug"
                        params={{ slug: f.slug }}
                        className="grid grid-cols-[60px_60px_1fr_90px_90px] items-center gap-3 border-b border-foreground/5 px-4 py-3 transition hover:bg-foreground/[0.03]"
                      >
                        <div className="font-mono text-xl tabular">
                          {String(f.rank).padStart(2, "0")}
                        </div>
                        <div>
                          {f.prev_rank == null && isNewRelease(f) ? (
                            <span className="rounded bg-live px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-ink">
                              New
                            </span>
                          ) : change !== null && change !== 0 ? (
                            <span
                              className={`flex items-center gap-0.5 font-mono text-xs tabular ${change > 0 ? "text-forest-deep" : "text-down"}`}
                            >
                              {change > 0 ? (
                                <ArrowUp className="h-3 w-3" />
                              ) : (
                                <ArrowDown className="h-3 w-3" />
                              )}
                              {Math.abs(change)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                        <div className="min-w-0 flex items-center gap-3">
                          <FilmPosterThumbnail film={f} className="h-12 w-9" />
                          <div className="min-w-0">
                            <div className="truncate font-serif text-base">{f.title}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {director} · {f.year}
                            </div>
                          </div>
                        </div>
                        <div className="font-mono text-xs tabular text-muted-foreground">
                          {weeks} {weeks === 1 ? "wk" : "wks"}
                        </div>
                        <div className="text-right font-mono text-sm tabular text-primary font-semibold">
                          {f.score?.toFixed(1)}
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

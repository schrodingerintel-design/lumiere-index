import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp } from "lucide-react";
import {
  getBiggestMovers,
  getIndexNewEntries,
  getTrendingFilms,
  type MoverFilm,
  type NewEntryFilm,
  type TrendingFilmOut,
} from "@/lib/apiClient";
import { FilmPosterThumbnail } from "./FilmPosterThumbnail";
import { MomentumInline } from "./Momentum";

/**
 * Editorial pulse — Biggest Movers and New Entries (and optionally the
 * trending list). The homepage's poster-rail carries trending artwork, so the
 * homepage rail passes showTrending={false} to avoid the duplicate column.
 */

/** Honest degraded state when the live charts can't be reached (backend down,
 *  network failure). An eternal skeleton reads as a broken site; this says
 *  what's happening and recovers the moment the chart engine is back. */
export function ChartsUnavailable({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="border border-foreground/10 bg-surface px-6 py-14 text-center">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        The Index · Live
      </div>
      <h2 className="mt-3 font-display text-2xl">Charts reconnecting</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Live rankings are temporarily unavailable. The Index refreshes every 12
        hours; this section recovers automatically once the chart engine is
        back.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 border border-foreground/25 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-foreground transition-colors hover:border-foreground/50 hover:bg-foreground/5"
        >
          Retry now
        </button>
      )}
    </div>
  );
}

function MoverRow({ film }: { film: MoverFilm }) {
  const up = film.direction === "up";
  return (
    <li>
      <Link
        to="/films/$slug"
        params={{ slug: film.slug }}
        className="group flex items-center gap-3 py-2.5"
      >
        <FilmPosterThumbnail film={film} className="h-14 w-10" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium transition-colors group-hover:text-primary">
            {film.title}
          </div>
          {/* Rank movement between published charts — never a score change. */}
          <div className="mt-0.5 font-mono text-[11px] tabular text-muted-foreground">
            {film.previous_rank != null
              ? `#${film.previous_rank} → #${film.current_rank}`
              : `#${film.current_rank}`}
          </div>
        </div>
        <span
          className={`flex items-center gap-0.5 font-mono text-xs font-semibold tabular ${
            up ? "text-up" : "text-down"
          }`}
        >
          {up ? (
            <ArrowUp className="h-3 w-3" aria-hidden />
          ) : (
            <ArrowDown className="h-3 w-3" aria-hidden />
          )}
          {film.movement}
        </span>
      </Link>
    </li>
  );
}

function NewEntryRow({ film }: { film: NewEntryFilm }) {
  return (
    <li>
      <Link
        to="/films/$slug"
        params={{ slug: film.slug }}
        className="group flex items-center gap-3 py-2.5"
      >
        <FilmPosterThumbnail film={film} className="h-14 w-10" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium transition-colors group-hover:text-primary">
            {film.title}
          </div>
          <div className="mt-0.5 font-mono text-[11px] tabular text-muted-foreground">
            Debuted at #{film.debut_rank}
          </div>
        </div>
        {/* New entries have no trajectory yet: the debut strength is the
            only honest signal, mirroring the backend's NEW-entry rule. */}
        <MomentumInline state={film.debut_rank <= 10 ? "SURGING" : "STEADY"} />
      </Link>
    </li>
  );
}

function TrendingRow({ film }: { film: TrendingFilmOut }) {
  return (
    <li>
      <Link
        to="/films/$slug"
        params={{ slug: film.film_slug }}
        className="group flex items-center gap-3 py-2.5"
      >
        <FilmPosterThumbnail film={film} className="h-14 w-10" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium transition-colors group-hover:text-primary">
            {film.title}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">Drawing attention across the Index</div>
        </div>
      </Link>
    </li>
  );
}

export function PulseRow({
  rail = false,
  showTrending = true,
}: {
  rail?: boolean;
  showTrending?: boolean;
}) {
  const { data: movers, isLoading: moversLoading, error: moversError } = useQuery({
    queryKey: ["index", "movers"],
    queryFn: () => getBiggestMovers(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: newEntries, isLoading: entriesLoading, error: entriesError } = useQuery({
    queryKey: ["index", "new-entries"],
    queryFn: () => getIndexNewEntries(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: trendingFilms, isLoading: trendingLoading, error: trendingError } = useQuery({
    queryKey: ["trending", "films"],
    queryFn: () => getTrendingFilms(6),
    staleTime: 5 * 60 * 1000,
    enabled: showTrending,
  });

  const gainers = (movers?.gainers ?? []).slice(0, 4);
  const topEntries = (newEntries ?? []).slice(0, 4);
  const topTrending = (trendingFilms ?? []).slice(0, 4);

  const loading = moversLoading || entriesLoading || (showTrending && trendingLoading);

  return (
    <section className={`${rail ? "home-pulse-rail mt-14 lg:mt-0" : "mt-14"} px-4 sm:px-6`}>
      <div className={`mx-auto grid max-w-6xl grid-cols-1 gap-10 ${rail ? "home-pulse-grid" : showTrending ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Biggest Movers
          </div>
          {moversLoading ? (
            <div className="space-y-4 py-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-14 w-10 animate-pulse rounded-sm bg-foreground/10" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-28 animate-pulse rounded bg-foreground/10" />
                    <div className="h-2.5 w-20 animate-pulse rounded bg-foreground/10" />
                  </div>
                </div>
              ))}
            </div>
          ) : gainers.length > 0 ? (
            <ul className="divide-y divide-foreground/[0.06]">
              {gainers.map((f) => (
                <MoverRow key={f.slug} film={f} />
              ))}
            </ul>
          ) : (
            <p className="py-3 text-sm text-muted-foreground">
              {moversError
                ? "Live pulse is reconnecting…"
                : "No movement in the latest Index yet."}
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            New Entries
          </div>
          {entriesLoading ? (
            <div className="space-y-4 py-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-14 w-10 animate-pulse rounded-sm bg-foreground/10" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-28 animate-pulse rounded bg-foreground/10" />
                    <div className="h-2.5 w-20 animate-pulse rounded bg-foreground/10" />
                  </div>
                </div>
              ))}
            </div>
          ) : topEntries.length > 0 ? (
            <ul className="divide-y divide-foreground/[0.06]">
              {topEntries.map((f) => (
                <NewEntryRow key={f.slug} film={f} />
              ))}
            </ul>
          ) : (
            <p className="py-3 text-sm text-muted-foreground">
              {entriesError ? "Live pulse is reconnecting…" : "No new entries this cycle."}
            </p>
          )}
        </div>

        {showTrending && (
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Trending
            </div>
            {trendingLoading ? (
              <div className="space-y-4 py-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-14 w-10 animate-pulse rounded-sm bg-foreground/10" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-28 animate-pulse rounded bg-foreground/10" />
                      <div className="h-2.5 w-20 animate-pulse rounded bg-foreground/10" />
                    </div>
                  </div>
                ))}
              </div>
            ) : topTrending.length > 0 ? (
              <ul className="divide-y divide-foreground/[0.06]">
                {topTrending.map((f) => (
                  <TrendingRow key={f.film_slug} film={f} />
                ))}
              </ul>
            ) : (
              <p className="py-3 text-sm text-muted-foreground">
                {trendingError ? "Live pulse is reconnecting…" : "Nothing is trending yet."}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ArrowRight } from "lucide-react";
import {
  getTopFilms,
  getBiggestMovers,
  getIndexNewEntries,
  getTrendingFilms,
  type RankedFilm,
  type MoverFilm,
  type NewEntryFilm,
  type TrendingFilmOut,
} from "@/lib/apiClient";
import { filmTrend } from "@/lib/trend";
import { RankRow, SectionHeading } from "./Ranking";
import { FilmPosterThumbnail } from "./FilmPosterThumbnail";
import { TopTenSkeleton } from "./Skeletons";
import { ShareCardButton } from "./ShareCardButton";
import { MomentumMark, MomentumInline } from "./Momentum";

/** Preload the next mobile hero artwork so touch transitions stay instant. */
function useBackdropPreload(films: RankedFilm[], index: number) {
  useEffect(() => {
    if (films.length < 2) return;
    const next = films[(index + 1) % films.length];
    const url = next?.backdrop_url ?? null;
    if (url) {
      const img = new Image();
      img.src = url;
    }
  }, [films, index]);
}

function MovementInline({ film }: { film: RankedFilm }) {
  const trend = filmTrend(film);
  const move = film.movement ?? 0;
  if (trend === "new") {
    return (
      <span className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-foreground">
        New
      </span>
    );
  }
  if (trend === "rise") {
    return (
      <span className="flex items-center gap-1 font-mono text-xs font-semibold tabular text-up">
        <ArrowUp className="h-3.5 w-3.5" aria-hidden /> {move}
      </span>
    );
  }
  if (trend === "fall") {
    return (
      <span className="flex items-center gap-1 font-mono text-xs font-semibold tabular text-down">
        <ArrowDown className="h-3.5 w-3.5" aria-hidden /> {Math.abs(move)}
      </span>
    );
  }
  return <span className="font-mono text-xs text-muted-foreground">-</span>;
}

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
        Live rankings are temporarily unavailable. The Index refreshes every 15
        minutes; this page recovers automatically once the chart engine is
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

export function Hero() {
  // Prefetch the supporting queries so the rhythm below the masthead is instant.
  useQuery({ queryKey: ["index", "movers"], queryFn: () => getBiggestMovers(), staleTime: 5 * 60 * 1000 });
  useQuery({ queryKey: ["index", "new-entries"], queryFn: () => getIndexNewEntries(), staleTime: 5 * 60 * 1000 });
  useQuery({ queryKey: ["trending", "films"], queryFn: () => getTrendingFilms(6), staleTime: 5 * 60 * 1000 });

  const { data: films, isLoading, error, refetch } = useQuery({
    queryKey: ["films", "top", 100],
    queryFn: () => getTopFilms(100),
    staleTime: 5 * 60 * 1000,
  });

  // Desktop is intentionally anchored to the current #1. The compact layout
  // keeps the established touch carousel, so mobile behavior is not rewritten
  // just to make the desktop composition more spatial.
  const [index, setIndex] = useState(0);
  const heroRef = useRef<HTMLElement>(null);
  const [isCompact, setIsCompact] = useState(false);
  const [manualSelection, setManualSelection] = useState(false);
  const topFive = films?.slice(0, 5) ?? [];
  const leader = films?.[0] ?? null;
  const activeFilm = isCompact || manualSelection ? topFive[index] ?? leader : leader;

  useBackdropPreload(topFive, index);

  useEffect(() => {
    const compact = window.matchMedia("(max-width: 1023px)");
    let timer: number | undefined;
    const sync = () => {
      if (timer !== undefined) window.clearInterval(timer);
      setIsCompact(compact.matches);
      if (!compact.matches || topFive.length < 2) {
        setIndex(0);
        if (!compact.matches) setManualSelection(false);
        return;
      }
      timer = window.setInterval(() => {
        setIndex((current) => (current + 1) % topFive.length);
      }, 8000);
    };
    sync();
    compact.addEventListener("change", sync);
    return () => {
      if (timer !== undefined) window.clearInterval(timer);
      compact.removeEventListener("change", sync);
    };
  }, [topFive.length]);

  // A new live leader always resets manual exploration, keeping the default
  // desktop state honest without discarding the carousel implementation.
  useEffect(() => {
    setIndex(0);
    setManualSelection(false);
  }, [leader?.slug]);

  // The slideshow is also controllable without first tabbing into the hero.
  // Ignore form fields, editable content, dialogs, and modified shortcuts so
  // global arrow support never steals normal keyboard interaction.
  useEffect(() => {
    const handleDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (topFive.length < 2 || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.target instanceof HTMLElement) {
        if (heroRef.current?.contains(event.target)) return;
        if (event.target.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) {
          return;
        }
      }
      event.preventDefault();
      setManualSelection(true);
      setIndex((current) =>
        event.key === "ArrowLeft"
          ? (current - 1 + topFive.length) % topFive.length
          : (current + 1) % topFive.length,
      );
    };
    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => document.removeEventListener("keydown", handleDocumentKeyDown);
  }, [topFive.length]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (topFive.length < 2 || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setManualSelection(true);
    setIndex((current) =>
      event.key === "ArrowLeft"
        ? (current - 1 + topFive.length) % topFive.length
        : (current + 1) % topFive.length,
    );
  };

  if (isLoading || !films) {
    // A failed fetch must never masquerade as "loading" forever — say so and
    // offer a retry instead of an infinite skeleton.
    if (error) {
      return (
        <section className="px-4 pt-10 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <ChartsUnavailable onRetry={() => void refetch()} />
          </div>
        </section>
      );
    }
    return (
      <section className="px-4 pt-10 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <TopTenSkeleton />
        </div>
      </section>
    );
  }

  const director =
    activeFilm?.director && activeFilm.director !== "Unknown" ? activeFilm.director : null;
  const backdropUrl = activeFilm?.backdrop_url ?? null;
  const daysOnChart = activeFilm?.days_on_chart ?? 1;

  return (
    <section
      ref={heroRef}
      className="relative scroll-mt-14 outline-none max-sm:min-h-[78svh] sm:flex sm:min-h-[500px] lg:min-h-[600px] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary/70"
      role="region"
      aria-roledescription="carousel"
      aria-label="Movie 100 featured titles. Use the left and right arrow keys to explore."
      tabIndex={topFive.length > 1 ? 0 : -1}
      onKeyDown={handleKeyDown}
    >
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {activeFilm
          ? `${activeFilm.title}, ranked number ${activeFilm.rank} on Movie 100.`
          : "Loading Movie 100 featured titles."}
      </span>
      {/* Backdrop — very visible at the top, then dissolving continuously into
          blur and the page canvas toward the bottom. Two masked copies of the
          same still create the sharp→blur crossfade; no banding, no hard edge. */}
      {backdropUrl && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <img
            key={backdropUrl}
            src={backdropUrl}
            alt=""
            className="hero-fade-sharp absolute inset-0 h-full w-full object-cover object-[50%_30%]"
            fetchPriority="high"
            decoding="async"
          />
          <img
            key={`${backdropUrl}-blur`}
            src={backdropUrl}
            alt=""
            className="hero-fade-blur absolute inset-0 h-full w-full scale-110 object-cover object-[50%_30%] blur-2xl"
            fetchPriority="high"
            decoding="async"
          />
          {/* Color management only — keeps the top bright while the dissolve lands on the canvas */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ink/55 to-ink" />
          {/* Desktop boundary — slight blur + fade at the bottom edge so the
              header melts into the page with no visible seam. */}
          <div className="hero-boundary-blur absolute inset-x-0 bottom-0 h-28 hidden lg:block" />
          <div className="absolute inset-x-0 bottom-0 h-24 hidden lg:block bg-gradient-to-b from-transparent to-ink" />
        </div>
      )}

      {/* Compact touch navigation preserves the existing mobile hero rhythm.
          It sits below the content layer and disappears on the desktop anchor. */}
      {topFive.length > 1 && (
        <div className="absolute inset-0 grid grid-cols-3 lg:hidden">
          <button
            type="button"
            onClick={() => setIndex((current) => (current - 1 + topFive.length) % topFive.length)}
            aria-label="Previous title"
            className="h-full w-full"
          />
          <Link
            to="/films/$slug"
            params={{ slug: activeFilm?.slug ?? "" }}
            aria-label={`Open ${activeFilm?.title ?? "film"}`}
            className="h-full w-full"
          />
          <button
            type="button"
            onClick={() => setIndex((current) => (current + 1) % topFive.length)}
            aria-label="Next title"
            className="h-full w-full"
          />
        </div>
      )}

      {/* The leader is the focal point. The rank, movement, and tenure lockup
          stays deliberately sparse so the artwork carries the atmosphere. */}
      <div className="pointer-events-none relative px-4 pt-10 sm:px-8 sm:pt-14 lg:px-16 lg:pt-12 xl:px-20">
        <div className="mx-auto max-w-7xl lg:flex lg:min-h-[520px] lg:flex-col xl:min-h-[600px]">
          <div className="flex flex-wrap items-center justify-between gap-3 self-start">
            <div className="inline-flex flex-wrap items-center border border-foreground/15 bg-ink/45 px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground backdrop-blur-sm">
              <span className="mr-2 inline-flex items-center gap-1.5 text-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                Live
              </span>
              <span className="text-primary">#{activeFilm?.rank ?? 1}</span>
              <span aria-hidden className="mx-2.5">·</span>
              {activeFilm && <MovementInline film={activeFilm} />}
              <span aria-hidden className="mx-2.5">·</span>
              <span>{daysOnChart} {daysOnChart === 1 ? "day" : "days"} on chart</span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/60">
              Movie 100 · Updated every 15 min
              <span className="hidden sm:inline"> · ← → to explore</span>
            </span>
          </div>

          {/* Everything else sits at the bottom of the hero */}
          <div key={activeFilm?.slug} className="hero-leader-transition lg:mt-auto lg:flex lg:items-end lg:justify-between lg:gap-14">
            {/* Left — title, metadata, synopsis, actions */}
            <div className="min-w-0 max-w-2xl lg:pb-4">
              {/* Title — the film stays the hero */}
              <h1 className="mt-5 font-display text-4xl font-medium leading-[1.02] sm:text-5xl md:text-6xl lg:mt-0 lg:text-[72px] lg:leading-[0.98] xl:text-[80px]">
                <Link
                  to="/films/$slug"
                  params={{ slug: activeFilm?.slug ?? "" }}
                  className="pointer-events-auto inline-block transition-colors hover:text-primary"
                >
                  {activeFilm?.title ?? "The Index"}
                </Link>
              </h1>

              {/* One line of metadata, quietly */}
              <p className="mt-4 text-sm text-muted-foreground sm:text-[15px]">
                {[director, activeFilm?.year, `${daysOnChart} ${daysOnChart === 1 ? "day" : "days"} on chart`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>

              {/* Synopsis — a short taste on desktop */}
              {activeFilm?.synopsis && (
                <p className="mt-4 hidden max-w-xl text-sm leading-relaxed text-foreground/70 line-clamp-3 lg:block">
                  {activeFilm.synopsis}
                </p>
              )}

              {/* Desktop actions */}
              <div className="pointer-events-auto mt-7 hidden items-center gap-3 lg:flex">
                <Link
                  to="/films/$slug"
                  params={{ slug: activeFilm?.slug ?? "" }}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-primary/90"
                >
                  View film details
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>

              {/* Momentum (mobile / tablet) — the state of change, editorial */}
              {activeFilm && (
                <div className="mt-6 lg:hidden">
                  <MomentumMark state={activeFilm.momentum} />
                  {activeFilm.peak_rank ? (
                    <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                      Peak #{activeFilm.peak_rank}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Right — poster card + movement lockup, pinned to the far right edge */}
            {activeFilm && (
              <div className="pointer-events-auto hidden shrink-0 items-center gap-7 lg:flex lg:pb-2">
                <Link
                  to="/films/$slug"
                  params={{ slug: activeFilm.slug }}
                  className="group relative block w-52 overflow-hidden rounded-xl shadow-2xl ring-1 ring-foreground/20"
                >
                  <FilmPosterThumbnail film={activeFilm} className="aspect-[2/3] w-full" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/85 to-transparent px-3.5 pb-3 pt-8">
                    <div className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">
                      {activeFilm.title}
                    </div>
                    <div className="mt-1">
                      <MomentumInline state={activeFilm.momentum} />
                    </div>
                  </div>
                </Link>

                {/* Momentum — the hero's state of change, editorial lockup.
                    Peak and tenure ground it in the chart's history. */}
                <div className="flex h-36 w-36 flex-col items-center justify-center border border-foreground/10 bg-foreground/[0.02] text-center">
                  <MomentumMark state={activeFilm.momentum} className="!text-[11px]" />
                  {activeFilm.peak_rank ? (
                    <span className="mt-2 font-mono text-sm tabular text-foreground">
                      Peak #{activeFilm.peak_rank}
                    </span>
                  ) : null}
                  <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                    {(activeFilm.days_on_chart ?? 1)} {activeFilm.days_on_chart === 1 ? "day" : "days"} on chart
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </section>
  );
}

/** Homepage Movie 100 Top 10 — charts are the primary content (§21). */
export function TopTen() {
  const { data: films, isLoading, error, refetch } = useQuery({
    queryKey: ["films", "top", 100],
    queryFn: () => getTopFilms(100),
    staleTime: 5 * 60 * 1000,
  });

  const top10 = films?.slice(0, 10) ?? [];

  return (
    <section className="px-4 pt-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          kicker="The Index · Movie 100"
          title="Movie 100 · Top 10"
          copy="The ten films generating the strongest measured cultural momentum today."
          seeAllHref="/top-100"
          seeAllLabel="Full Movie 100"
          action={
            <ShareCardButton
              variant="chart"
              card={{
                title: "Movie 100 · Top 10",
                subtitle: "The films generating the strongest measured cultural momentum today.",
                films: top10,
              }}
            />
          }
        />
        <ul className="divide-y divide-foreground/[0.07] border-y border-foreground/10">
          {isLoading ? (
            <TopTenSkeleton />
          ) : error ? (
            <li className="py-6">
              <ChartsUnavailable onRetry={() => void refetch()} />
            </li>
          ) : (
            top10.map((f) => (
              <li key={f.slug}>
                <RankRow film={f} />
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}

/** Homepage TV 100 Top 5 — the television chart, front and center. */
export function TvTopFive() {
  const { data: films, isLoading, error, refetch } = useQuery({
    queryKey: ["films", "tv100", 5],
    queryFn: () => getTopFilms(5, 0, "TV_100"),
    staleTime: 5 * 60 * 1000,
  });

  const top5 = films ?? [];

  return (
    <section className="px-4 pt-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          kicker="The Index · TV 100"
          title="TV 100 · Top 5"
          copy="The series generating the strongest measured cultural momentum today."
          seeAllHref="/tv-100"
          seeAllLabel="Full TV 100"
          action={
            <ShareCardButton
              variant="chart"
              card={{
                title: "TV 100 · Top 5",
                subtitle: "The series generating the strongest measured cultural momentum today.",
                films: top5,
              }}
            />
          }
        />
        <ul className="divide-y divide-foreground/[0.07] border-y border-foreground/10">
          {isLoading ? (
            <TopTenSkeleton />
          ) : error ? (
            <li className="py-6">
              <ChartsUnavailable onRetry={() => void refetch()} />
            </li>
          ) : (
            top5.map((f) => (
              <li key={f.slug}>
                <RankRow film={f} />
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
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

/** Homepage rhythm — What's moving → What's new → What's being discussed. */
export function PulseRow({ rail = false }: { rail?: boolean }) {
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
  });

  const gainers = (movers?.gainers ?? []).slice(0, 4);
  const topEntries = (newEntries ?? []).slice(0, 4);
  const topTrending = (trendingFilms ?? []).slice(0, 4);

  const loading = moversLoading || entriesLoading || trendingLoading;

  return (
    <section className={`${rail ? "home-pulse-rail mt-14 lg:mt-0" : "mt-14"} px-4 sm:px-6`}>
      <div className={`mx-auto grid max-w-6xl grid-cols-1 gap-10 ${rail ? "home-pulse-grid" : "md:grid-cols-3"}`}>
        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Biggest Movers
          </div>
          {loading ? (
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
          {loading ? (
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

        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Trending
          </div>
          {loading ? (
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
      </div>
    </section>
  );
}

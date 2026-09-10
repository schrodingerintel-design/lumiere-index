import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp } from "lucide-react";
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

/** Preload the next slide's backdrop image so swaps are instant. */
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
  return <span className="font-mono text-xs text-muted-foreground">—</span>;
}

export function Hero() {
  // Prefetch the supporting queries so the rhythm below the masthead is instant.
  useQuery({ queryKey: ["index", "movers"], queryFn: () => getBiggestMovers(), staleTime: 5 * 60 * 1000 });
  useQuery({ queryKey: ["index", "new-entries"], queryFn: () => getIndexNewEntries(), staleTime: 5 * 60 * 1000 });
  useQuery({ queryKey: ["trending", "films"], queryFn: () => getTrendingFilms(6), staleTime: 5 * 60 * 1000 });

  const { data: films, isLoading } = useQuery({
    queryKey: ["films", "top", 100],
    queryFn: () => getTopFilms(100),
    staleTime: 5 * 60 * 1000,
  });

  const [index, setIndex] = useState(0);
  const topFive = films?.slice(0, 5) ?? [];
  const activeFilm = topFive[index] ?? null;

  useBackdropPreload(topFive, index);

  useEffect(() => {
    if (topFive.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % topFive.length), 8000);
    return () => clearInterval(t);
  }, [topFive.length]);

  if (isLoading || !films) {
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
    <section className="relative">
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
        </div>
      )}

      {/* Mobile: invisible tap zones over the backdrop — tap left third for the
          previous title, right third for the next, middle to open the film.
          Desktop keeps the visible dots. Sits below the content layer, so the
          title link and dots are never blocked. */}
      {topFive.length > 1 && (
        <div className="absolute inset-0 grid grid-cols-3 sm:hidden">
          <button
            type="button"
            onClick={() => setIndex((i) => (i - 1 + topFive.length) % topFive.length)}
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
            onClick={() => setIndex((i) => (i + 1) % topFive.length)}
            aria-label="Next title"
            className="h-full w-full"
          />
        </div>
      )}

      {/* Content layer — transparent to taps so the zones beneath receive them;
          interactive children re-enable pointer events explicitly. */}
      <div className="pointer-events-none relative px-4 pt-10 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-2xl">
              {/* Kicker — where this title stands today */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                <span className="font-semibold text-primary">
                  #{activeFilm?.rank ?? 1} on the Index
                </span>
                <span aria-hidden>·</span>
                {activeFilm && <MovementInline film={activeFilm} />}
                <span aria-hidden>·</span>
                <span>{daysOnChart} {daysOnChart === 1 ? "day" : "days"} on chart</span>
              </div>

              {/* Title — the film stays the hero */}
              <h1 className="mt-4 font-display text-4xl font-medium leading-[1.02] sm:text-5xl md:text-6xl">
                <Link
                  to="/films/$slug"
                  params={{ slug: activeFilm?.slug ?? "" }}
                  className="pointer-events-auto inline-block transition-colors hover:text-primary"
                >
                  {activeFilm?.title ?? "The Index"}
                </Link>
              </h1>

              {/* One line of metadata, quietly */}
              <p className="mt-3 text-sm text-muted-foreground sm:text-[15px]">
                {[director, activeFilm?.year, `${daysOnChart} ${daysOnChart === 1 ? "day" : "days"} on chart`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>

            {/* Index Score — the defining number. Big, ivory, calm. */}
            <div className="shrink-0">
              <div className="index-score text-7xl sm:text-8xl">
                {activeFilm?.score?.toFixed(1) ?? "—"}
              </div>
              <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
                Index Score
              </div>
            </div>
          </div>

          {/* Slide position — desktop only. Mobile navigates by tapping the
              backdrop: left/right to move, middle to open the film. */}
          {topFive.length > 1 && (
            <div className="pointer-events-auto mt-8 hidden gap-2 sm:flex">
              {topFive.map((f, i) => (
                <button
                  key={f.slug}
                  onClick={() => setIndex(i)}
                  aria-label={`Show #${f.rank}: ${f.title}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === index ? "w-6 bg-foreground/80" : "w-1.5 bg-foreground/25 hover:bg-foreground/40"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Homepage Top 10 — the chart IS the hero of the page. */
export function TopTen() {
  const { data: films, isLoading, error } = useQuery({
    queryKey: ["films", "top", 100],
    queryFn: () => getTopFilms(100),
    staleTime: 5 * 60 * 1000,
  });

  const top10 = films?.slice(0, 10) ?? [];

  return (
    <section className="px-4 pt-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          kicker="The Index"
          title="The Top 10"
          copy="The ten titles capturing the most cultural attention today, ranked by audience signal alone."
          seeAllHref="/top-100"
          seeAllLabel="Full Top 100"
        />
        <ul className="divide-y divide-foreground/[0.07] border-y border-foreground/10">
          {isLoading ? (
            <TopTenSkeleton />
          ) : error ? (
            <li className="py-12 text-center text-sm text-muted-foreground">
              Something went wrong. Please try again.
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
        <span className="index-score text-base">{film.debut_score?.toFixed(1)}</span>
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
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{film.trend_reason}</div>
        </div>
      </Link>
    </li>
  );
}

/** Homepage rhythm — What's moving → What's new → What's being discussed. */
export function PulseRow() {
  const { data: movers, isLoading: moversLoading } = useQuery({
    queryKey: ["index", "movers"],
    queryFn: () => getBiggestMovers(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: newEntries, isLoading: entriesLoading } = useQuery({
    queryKey: ["index", "new-entries"],
    queryFn: () => getIndexNewEntries(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: trendingFilms, isLoading: trendingLoading } = useQuery({
    queryKey: ["trending", "films"],
    queryFn: () => getTrendingFilms(6),
    staleTime: 5 * 60 * 1000,
  });

  const gainers = (movers?.gainers ?? []).slice(0, 4);
  const topEntries = (newEntries ?? []).slice(0, 4);
  const topTrending = (trendingFilms ?? []).slice(0, 4);

  const loading = moversLoading || entriesLoading || trendingLoading;

  return (
    <section className="mt-14 px-4 sm:px-6">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 md:grid-cols-3">
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
              No movement in the latest Index yet.
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
            <p className="py-3 text-sm text-muted-foreground">No new entries this cycle.</p>
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
              Nothing is trending yet — titles appear once enough audience signal accumulates.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

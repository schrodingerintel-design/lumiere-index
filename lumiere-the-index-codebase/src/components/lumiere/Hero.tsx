import { useState, useEffect, type MouseEvent as ReactMouseEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, Play, Scale, ArrowUp, ArrowDown } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  getTopFilms,
  searchTmdbMovie,
  getTmdbMovieVideos,
  tmdbPosterUrl,
  tmdbBackdropUrl,
  type RankedFilm,
} from "@/lib/apiClient";
import { HeroSkeleton } from "./Skeletons";
import { filmTrend } from "@/lib/trend";

function gradientStyle(film: RankedFilm | null) {
  if (!film) return "#333";
  const from = film.gradient_from ?? "#333";
  const to = film.gradient_to ?? "#111";
  return `linear-gradient(155deg, ${from}, ${to})`;
}

export function Hero() {
  const { data: films, isLoading: filmsLoading } = useQuery({
    queryKey: ["films", "top", 10],
    queryFn: () => getTopFilms(10),
    staleTime: 5 * 60 * 1000,
  });

  const [activeIndex, setActiveIndex] = useState(0);

  const queryClient = useQueryClient();
  const carouselFilms = films?.slice(0, 5) ?? [];
  const activeFilm = carouselFilms[activeIndex] ?? null;

  // Prefetch TMDB + videos for all carousel films so every slide's data is ready instantly.
  useEffect(() => {
    if (!carouselFilms.length) return;
    for (const film of carouselFilms) {
      const tmdbKey = ["tmdb", film.title, film.year] as const;
      queryClient
        .ensureQueryData({
          queryKey: tmdbKey,
          queryFn: () => searchTmdbMovie(film.title, film.year ?? undefined),
          staleTime: 24 * 60 * 60 * 1000,
        })
        .then((tmdbData) => {
          const id = tmdbData?.results?.[0]?.id;
          if (id) {
            queryClient.prefetchQuery({
              queryKey: ["tmdb-videos", id],
              queryFn: () => getTmdbMovieVideos(id),
              staleTime: 24 * 60 * 60 * 1000,
            });
          }
        })
        .catch(() => {});
    }
  }, [carouselFilms, queryClient]);

  const { data: tmdb } = useQuery({
    queryKey: ["tmdb", activeFilm?.title, activeFilm?.year],
    queryFn: () => searchTmdbMovie(activeFilm!.title, activeFilm?.year ?? undefined),
    enabled: !!activeFilm,
    staleTime: 24 * 60 * 60 * 1000,
  });

  // Derive tmdbFilm early so we can chain the videos query on its id.
  const tmdbFilm = tmdb?.results?.[0];

  const { data: videos } = useQuery({
    queryKey: ["tmdb-videos", tmdbFilm?.id],
    queryFn: () => getTmdbMovieVideos(tmdbFilm!.id),
    enabled: !!tmdbFilm?.id,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const trailer =
    videos?.results?.find((v) => v.type === "Trailer" && v.site === "YouTube") ??
    videos?.results?.find((v) => v.site === "YouTube");

  useEffect(() => {
    if (carouselFilms.length < 2) return;
    const interval = setInterval(() => {
      setActiveIndex((current) => (current + 1) % carouselFilms.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [carouselFilms.length]);

  // Tap zones: tapping the left/right half of the hero flips the slide.
  // Links and buttons opt out so CTAs (compare, trailer, poster) keep working.
  const handleHeroTap = (e: ReactMouseEvent<HTMLElement>) => {
    if (carouselFilms.length < 2) return;
    if ((e.target as HTMLElement | null)?.closest("a, button, input, [role='button']")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const goPrev = e.clientX - rect.left < rect.width / 2;
    setActiveIndex((curr) =>
      goPrev
        ? (curr - 1 + carouselFilms.length) % carouselFilms.length
        : (curr + 1) % carouselFilms.length,
    );
  };

  if (filmsLoading || !films) return <HeroSkeleton />;

  const posterUrl = activeFilm?.poster_url || tmdbPosterUrl(tmdbFilm?.poster_path, "w500");
  const backdropUrl = activeFilm?.backdrop_url || tmdbBackdropUrl(tmdbFilm?.backdrop_path, "w1280");

  const director =
    activeFilm?.director && activeFilm.director !== "Unknown"
      ? activeFilm.director
      : "Director TBA";
  const eyebrow = director === "Director TBA" ? "Director TBA" : `A film by ${director}`;
  const score = activeFilm?.score ?? null;
  const move = activeFilm?.movement ?? 0;
  const isNew = activeFilm?.prev_rank == null;
  const weeks = activeFilm?.weeks_on_chart ?? 0;
  const trend = filmTrend(activeFilm);

  // "Why it's here" — an honest, evidence-gated line. The claim strength is
  // capped by the confidence tier the ranking engine computed for this title.
  const sample = activeFilm?.sample_size ?? 0;
  const confidence = activeFilm?.confidence ?? "insufficient";
  const whyItsHere =
    confidence === "insufficient"
      ? "Just entered tracking — not enough signal yet"
      : confidence === "low"
        ? `Limited early signal — ${sample.toLocaleString()} audience ${sample === 1 ? "mention" : "mentions"} tracked so far`
        : `Backed by ${sample.toLocaleString()} tracked audience signals this cycle`;

  return (
    <section
      onClick={handleHeroTap}
      className="relative w-full select-none overflow-hidden rounded-2xl px-4 lg:px-6 mt-4 max-w-full"
    >
      {/* ── Backdrop: cover-crop with an elevated focus point ── */}
      <div className="absolute inset-0">
        {backdropUrl ? (
          <img
            key={backdropUrl}
            src={backdropUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[50%_35%]"
            fetchPriority="high"
            decoding="async"
          />
        ) : (
          <div
            key={activeFilm?.slug}
            className="absolute inset-0"
            style={{ background: gradientStyle(activeFilm) }}
          />
        )}
        {/* Readability gradients — text on the left, buttons along the bottom. */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
      </div>

      {/* ── Content: badges pinned top, text centered, buttons pinned bottom ── */}
      <div className="relative z-10 flex min-h-[460px] flex-col px-5 py-6 sm:px-8 sm:py-7 lg:min-h-[540px] lg:px-10 lg:py-8 lg:pr-72">
        {/* ── Top: rank badge only — the score gets its own dominant block ── */}
        <div className="flex flex-wrap items-center gap-2 animate-fade-up">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-live px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-ink sm:text-[11px]">
            <Trophy className="h-3 w-3" />
            #{activeFilm?.rank ?? 1} ON THE INDEX
          </span>
          {!isNew && weeks > 0 && (
            <span className="inline-flex items-center rounded-full border border-white/15 bg-black/45 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-white/70 backdrop-blur-sm sm:text-[11px]">
              {weeks} {weeks === 1 ? "week" : "weeks"} on chart
            </span>
          )}
        </div>

        {/* ── Middle: eyebrow → title → score, vertically centered ── */}
        <div className="flex flex-1 flex-col justify-center py-6 animate-fade-up delay-100">
          {/* Director eyebrow */}
          <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/70">
            {eyebrow}
          </div>

          {/* Title */}
          <h1 className="mt-2 font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold leading-[0.98] text-white drop-shadow-lg line-clamp-3">
            {activeFilm?.title}
          </h1>

          {/* Index Score — THE product. Visually dominant: oversized number,
              explicit label, movement symbol. Secondary info sits underneath. */}
          <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-3">
            <div>
              <div
                className="font-mono text-6xl font-bold leading-none tracking-tight text-primary tabular-nums sm:text-7xl lg:text-8xl"
                style={{ textShadow: "0 2px 12px rgba(0,0,0,0.55), 0 1px 0 rgba(0,0,0,0.4)" }}
              >
                {score?.toFixed(1) ?? "—"}
              </div>
              <div className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.28em] text-white/80">
                Index Score
              </div>
            </div>

            {/* Movement — rank-anchored symbols: #3 ↑ 3 / #2 ↓ 1 / #3 — */}
            <div className="pb-1.5">
              {trend === "new" ? (
                <span className="flex items-center gap-1.5 font-mono text-base font-medium text-live">
                  <ArrowUp className="h-5 w-5" /> New
                </span>
              ) : trend === "rise" ? (
                <span className="flex items-center gap-1.5 font-mono text-base">
                  <ArrowUp className="h-5 w-5 text-up" />
                  <span className="font-semibold text-up">{move}</span>
                </span>
              ) : trend === "fall" ? (
                <span className="flex items-center gap-1.5 font-mono text-base">
                  <ArrowDown className="h-5 w-5 text-down" />
                  <span className="font-semibold text-down">{Math.abs(move)}</span>
                </span>
              ) : (
                <span className="flex items-center font-mono text-base font-medium text-yellow-300/90" title="Held its rank">
                  —
                </span>
              )}
            </div>
          </div>

          {/* Why it's here — evidence-gated, honest */}
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/75">
            {whyItsHere}
          </p>
        </div>

        {/* ── Bottom: action buttons pinned to the base of the card ── */}
        <div className="flex flex-wrap items-center gap-3 animate-fade-up delay-200">
          <Link
            to="/films/$slug"
            params={{ slug: activeFilm?.slug ?? "" }}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-cream px-5 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            <Scale className="h-4 w-4" />
            Compare
          </Link>
          {trailer && (
            <a
              href={`https://www.youtube.com/watch?v=${trailer.key}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 bg-black/45 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-black/65"
            >
              <Play className="h-4 w-4" />
              Trailer
            </a>
          )}
        </div>
      </div>

      {/* ── Right: poster card (desktop only, floats over the backdrop) ── */}
      <div className="absolute right-10 top-1/2 z-10 hidden -translate-y-1/2 lg:block animate-fade-up delay-100">
        <Link
          to="/films/$slug"
          params={{ slug: activeFilm?.slug ?? "" }}
          className="card-lift relative block w-56 overflow-hidden rounded-xl shadow-2xl"
        >
          {posterUrl ? (
            <img
              key={posterUrl}
              src={posterUrl}
              alt={activeFilm?.title}
              className="h-full w-full object-cover aspect-[2/3]"
              fetchPriority="high"
              decoding="async"
            />
          ) : (
            <div className="aspect-[2/3]" style={{ background: gradientStyle(activeFilm) }} />
          )}
          {/* Bottom overlay */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 pt-12">
            <div className="font-display text-base font-semibold leading-tight text-white drop-shadow">
              {activeFilm?.title}
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, Play, ChevronRight, ChevronLeft, ExternalLink, ArrowUp, ArrowDown } from "lucide-react";
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

  if (filmsLoading || !films) return <HeroSkeleton />;

  const posterUrl = activeFilm?.poster_url || tmdbPosterUrl(tmdbFilm?.poster_path, "w500");
  const backdropUrl = activeFilm?.backdrop_url || tmdbBackdropUrl(tmdbFilm?.backdrop_path, "w1280");

  const director =
    activeFilm?.director && activeFilm.director !== "Unknown"
      ? activeFilm.director
      : "Director TBA";
  const score = activeFilm?.score ?? null;
  const move = activeFilm?.movement ?? 0;
  const isNew = activeFilm?.prev_rank == null;
  const hasMovement = isNew || move !== 0;

  return (
    <section className="relative w-full overflow-hidden rounded-2xl px-4 lg:px-6 mt-4 max-w-full">
      {/* ── Backdrop image ── */}
      <div className="absolute inset-0">
        {backdropUrl ? (
          <img
            key={backdropUrl}
            src={backdropUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
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
        {/* Dark gradient overlay — strong on the left, fading to transparent on the right.
            Kept dark enough that all hero text clears contrast even over bright posters. */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
      </div>

      {/* ── Content grid (fixed min-height prevents jumps between slides) ── */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 py-8 pb-20 sm:p-8 lg:p-10 lg:pb-16 min-h-[460px] lg:min-h-[540px]">
        {/* ── Left: Text content ── */}
        <div className="flex flex-col justify-center lg:col-span-7 animate-fade-up">
          {/* Eyebrow: rank on the Index */}
          <div className="flex flex-wrap items-center gap-2.5 mb-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-primary-foreground">
              <Trophy className="h-3.5 w-3.5" />
              #{activeFilm?.rank ?? 1} on the Index
            </span>
          </div>

          {/* Title */}
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold leading-[0.98] text-white drop-shadow-lg line-clamp-3">
            {activeFilm?.title}
          </h1>

          {/* ── The Index Score — the product, visually dominant ── */}
          <div className="mt-5 flex items-center gap-4 sm:gap-5">
            <div className="flex items-baseline gap-2">
              <span className="index-score text-6xl sm:text-7xl lg:text-8xl font-medium leading-none drop-shadow-md">
                {score?.toFixed(1) ?? "—"}
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.22em] text-white/75">
                  Index
                </span>
                <span className="font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.22em] text-white/75">
                  Score
                </span>
              </div>
            </div>
            {score != null && hasMovement && (
              <span
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1.5 font-mono text-xs font-medium ${
                  isNew
                    ? "border-live/50 bg-live/15 text-live"
                    : move > 0
                      ? "border-up/50 bg-up/15 text-up"
                      : "border-down/50 bg-down/15 text-down"
                }`}
              >
                {isNew ? (
                  "NEW"
                ) : move > 0 ? (
                  <>
                    <ArrowUp className="h-3.5 w-3.5" /> +{move}
                  </>
                ) : (
                  <>
                    <ArrowDown className="h-3.5 w-3.5" /> {move}
                  </>
                )}
              </span>
            )}
          </div>          {/* Secondary metadata — deliberately quiet, beneath the score */}
          <div className="mt-3 flex flex-wrap items-center gap-x-2 text-[13px] text-white/60 font-mono">
            <span>{director}</span>
            <span className="text-white/30">·</span>
            <span>{activeFilm?.year ?? "—"}</span>
            {activeFilm?.country_origin && (
              <>
                <span className="text-white/30">·</span>
                <span>{activeFilm.country_origin}</span>
              </>
            )}
            {(activeFilm?.weeks_on_chart ?? 0) > 0 && (
              <>
                <span className="text-white/30">·</span>
                <span>{activeFilm?.weeks_on_chart} {activeFilm?.weeks_on_chart === 1 ? "week" : "weeks"} on chart</span>
              </>
            )
            }
          </div>

          {/* Action buttons — 44px tap targets */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/films/$slug"
              params={{ slug: activeFilm?.slug ?? "" }}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Compare this title
              <ChevronRight className="h-4 w-4" />
            </Link>
            {trailer && (
              <a
                href={`https://www.youtube.com/watch?v=${trailer.key}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 bg-black/40 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-black/60"
              >
                <Play className="h-4 w-4" />
                Watch Trailer
                <ExternalLink className="h-3 w-3 opacity-50" />
              </a>
            )}
          </div>

          {/* Carousel navigation */}
          <div className="mt-8 flex items-center gap-3">
            <button
              onClick={() =>
                setActiveIndex((curr) => (curr - 1 + carouselFilms.length) % carouselFilms.length)
              }
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/70 hover:text-white hover:bg-black/60 transition-all"
              aria-label="Previous film"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => setActiveIndex((curr) => (curr + 1) % carouselFilms.length)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/70 hover:text-white hover:bg-black/60 transition-all"
              aria-label="Next film"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── Right: Poster card + score block ── */}
        <div className="hidden lg:flex lg:col-span-5 items-center justify-end animate-fade-up delay-100">
          <div className="relative flex items-end gap-5">
            {/* Score column beside the poster — echoes the hero's dominant score */}
            <div className="flex flex-col items-end gap-1 pb-2">
              <span className="index-score text-5xl font-medium leading-none">
                {score?.toFixed(1) ?? "—"}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/70">
                Index Score
              </span>
              <span className="font-mono text-[11px] text-white/60">
                #{activeFilm?.rank} of the daily Top 100
              </span>
            </div>
            {/* Poster card */}
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
        </div>
      </div>

      {/* ── Slide indicator — compact capsule dots overlaid on the backdrop ── */}
      {carouselFilms.length > 1 && (
        <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/20 px-2 py-1 ring-1 ring-white/5 backdrop-blur-sm">
          {carouselFilms.map((f, i) => (
            <button
              key={f.slug}
              onClick={() => setActiveIndex(i)}
              className={`group relative flex h-5 w-5 items-center justify-center rounded-full transition-all duration-300 ${
                i === activeIndex ? "bg-white/40" : "bg-white/10"
              }`}
              aria-label={`View ${f.title}`}
            >
              <span
                className={`block h-[2px] w-2 rounded-full transition-all duration-300 ${
                  i === activeIndex ? "bg-white/90 w-2" : "bg-white/40 group-hover:bg-white/60 w-2"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

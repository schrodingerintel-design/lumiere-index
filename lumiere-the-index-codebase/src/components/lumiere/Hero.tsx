import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, Play, ChevronRight, ChevronLeft, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  getTopFilms,
  getLiveStats,
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

  const { data: stats } = useQuery({
    queryKey: ["stats", "live"],
    queryFn: getLiveStats,
    staleTime: 60 * 1000,
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
        {/* Dark gradient overlay — strong on the left, fading to transparent on the right */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-black/20" />
        {/* Bottom gradient for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      {/* ── Content grid (fixed min-height prevents jumps between slides) ── */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 lg:p-10 min-h-[420px] lg:min-h-[520px]">
        {/* ── Left: Text content ── */}
        <div className="flex flex-col justify-center lg:col-span-7 animate-fade-up">
          {/* Badges */}
          <div className="flex items-center gap-3 mb-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/90 px-3 py-1.5 text-xs font-semibold text-primary-foreground">
              <Trophy className="h-3.5 w-3.5" />
              Today's #1 Movie
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm px-3 py-1.5 text-xs text-white/90">
              <span className="relative inline-flex h-2 w-2">
                <span className="live-dot block h-full w-full rounded-full bg-live" />
              </span>
              Index updating live
            </span>
          </div>

          {/* Title */}
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold leading-[0.95] text-white drop-shadow-lg line-clamp-3">
            {activeFilm?.title}
          </h1>

          {/* Metadata */}
          <div className="mt-4 flex flex-wrap items-center gap-x-2 text-sm text-white/70 font-mono">
            <span>{activeFilm?.year ?? "—"}</span>
            <span className="text-white/30">·</span>
            {tmdbFilm?.release_date && (
              <>
                <span>1h 45m</span>
                <span className="text-white/30">·</span>
              </>
            )}
            <span>{activeFilm?.country_origin ?? ""}</span>
          </div>

          {/* Synopsis */}
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/70 line-clamp-3">
            {activeFilm?.synopsis || tmdbFilm?.overview || "No synopsis available."}
          </p>

          {/* Action buttons */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {trailer && (
              <a
                href={`https://www.youtube.com/watch?v=${trailer.key}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-2.5 text-sm font-medium text-white border border-white/20 transition hover:bg-white/25"
              >
                <Play className="h-4 w-4" />
                Watch Trailer
                <ExternalLink className="h-3 w-3 opacity-50" />
              </a>
            )}
            <Link
              to="/films/$slug"
              params={{ slug: activeFilm?.slug ?? "" }}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/20"
            >
              <Play className="h-4 w-4" />
              Compare this title
            </Link>
          </div>

          {/* Carousel navigation */}
          <div className="mt-8 flex items-center gap-3">
            <button
              onClick={() =>
                setActiveIndex((curr) => (curr - 1 + carouselFilms.length) % carouselFilms.length)
              }
              className="p-2 rounded-full bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-all"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex gap-2">
              {carouselFilms.map((f, i) => (
                <button
                  key={f.slug}
                  onClick={() => setActiveIndex(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === activeIndex ? "w-6 bg-primary" : "w-1.5 bg-white/30 hover:bg-white/50"
                  }`}
                  aria-label={`View ${f.title}`}
                />
              ))}
            </div>
            <button
              onClick={() => setActiveIndex((curr) => (curr + 1) % carouselFilms.length)}
              className="p-2 rounded-full bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-all"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── Right: Poster card + score ── */}
        <div className="hidden lg:flex lg:col-span-5 items-center justify-end animate-fade-up delay-100">
          <div className="relative flex items-end gap-5">
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
                <div className="font-serif text-base font-semibold leading-tight text-white drop-shadow">
                  {activeFilm?.title}
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

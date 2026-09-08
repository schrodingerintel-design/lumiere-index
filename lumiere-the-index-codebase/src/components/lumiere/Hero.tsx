import { useState, useEffect, type MouseEvent as ReactMouseEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Scale, ArrowUp, ArrowDown } from "lucide-react";
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
  if (!film) return "#1a1a1a";
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
      className="relative w-full select-none overflow-hidden mt-4 max-w-full"
    >
      {/* ── Backdrop: cover-crop, quiet dark gradient for readability ── */}
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
        <div className="absolute inset-0 bg-gradient-to-r from-black/92 via-black/60 to-black/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30" />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 flex min-h-[460px] flex-col px-5 py-7 sm:px-8 sm:py-8 lg:min-h-[540px] lg:px-12 lg:py-10 lg:pr-80">
        {/* Masthead strip — rank, movement, weeks, date. Editorial, not badges. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.2em] text-white/75">
          <span className="font-semibold text-primary">#{activeFilm?.rank ?? 1} on the Index</span>
          {trend === "new" ? (
            <span className="font-semibold text-live">New entry</span>
          ) : trend === "rise" ? (
            <span className="flex items-center gap-1 font-semibold text-up">
              <ArrowUp className="h-3.5 w-3.5" /> {move}
            </span>
          ) : trend === "fall" ? (
            <span className="flex items-center gap-1 font-semibold text-down">
              <ArrowDown className="h-3.5 w-3.5" /> {Math.abs(move)}
            </span>
          ) : (
            <span className="text-yellow-300/90" title="Held its rank">—</span>
          )}
          {!isNew && weeks > 0 && <span>{weeks} {weeks === 1 ? "week" : "weeks"} on chart</span>}
          <span className="hidden sm:inline">{todayLabel()}</span>
        </div>

        {/* Title + score, vertically centered */}
        <div className="flex flex-1 flex-col justify-center py-6">
          <div className="font-mono text-[11px] uppercase tracking-[0.26em] text-white/70">
            A film by {director}
          </div>

          <h1 className="mt-3 font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold leading-[0.98] text-white line-clamp-3">
            {activeFilm?.title}
          </h1>

          {/* Index Score — the product. Big number in brand gold, label underneath. */}
          <div className="mt-6 flex items-end gap-4">
            <div>
              <div className="font-mono text-6xl font-bold leading-none tracking-tight text-primary sm:text-7xl lg:text-8xl">
                {score?.toFixed(1) ?? "—"}
              </div>
              <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.3em] text-white/80">
                Index Score
              </div>
            </div>
          </div>

          <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/70">
            {whyItsHere}
          </p>
        </div>

        {/* Bottom: text CTAs — confident, not pill badges */}
        <div className="flex flex-wrap items-center gap-5">
          <Link
            to="/films/$slug"
            params={{ slug: activeFilm?.slug ?? "" }}
            className="inline-flex min-h-11 items-center gap-2 bg-cream px-5 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            <Scale className="h-4 w-4" />
            Compare
          </Link>
          {trailer && (
            <a
              href={`https://www.youtube.com/watch?v=${trailer.key}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 border border-white/35 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              <Play className="h-4 w-4" />
              Trailer
            </a>
          )}
        </div>
      </div>

      {/* ── Right: poster (desktop only) — the artwork does the talking ── */}
      <div className="absolute right-12 top-1/2 z-10 hidden -translate-y-1/2 lg:block">
        <Link
          to="/films/$slug"
          params={{ slug: activeFilm?.slug ?? "" }}
          className="group relative block w-56 shadow-2xl"
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
        </Link>
      </div>
    </section>
  );
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

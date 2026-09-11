import { useState, useEffect, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import {
  getFilmDetail,
  getGenreFilms,
  getTopFilms,
  searchTmdbMovie,
  searchTmdbTv,
  tmdbPosterUrl,
  getTmdbMovieVideos,
  getTmdbMovieDetails,
  getTmdbWatchProviders,
  getTmdbTvVideos,
  getTmdbTvDetails,
  getTmdbTvWatchProviders,
  TMDB_IMG,
  type RankedFilm,
  type TmdbWatchProviders,
  type WatchProvider,
} from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
import { Skeleton } from "@/components/lumiere/Skeletons";
import { PosterCard } from "@/components/lumiere/PosterCard";
import {
  Bookmark,
  BookmarkCheck,
  ArrowUpRight,
  MessageSquare,
  ArrowUp,
  ArrowDown,
  Scale,
  Play,
  Info,
  X,
  Tv,
  Film as FilmIcon,
} from "lucide-react";export const Route = createFileRoute("/films/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${(params?.slug ?? "").replace(/-/g, " ")} — The Index` },
      {
        name: "description",
        content: `Live cultural index score and audience sentiment for film ${params?.slug}.`,
      },
      {
        property: "og:title",
        content: `${(params?.slug ?? "").replace(/-/g, " ")} — The Index`,
      },
      {
        property: "og:description",
        content: `Live cultural index score and audience sentiment for film ${params?.slug}.`,
      },
      { property: "og:type", content: "video.movie" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: `${(params?.slug ?? "").replace(/-/g, " ")} — The Index`,
      },
      {
        name: "twitter:description",
        content: `Live cultural index score and audience sentiment for film ${params?.slug}.`,
      },
    ],
  }),
  loader: async ({ context, params }) => {
    // SSR the film detail so shared/direct links render content on first paint.
    await context.queryClient.prefetchQuery({
      queryKey: ["film", "detail", params.slug],
      queryFn: () => getFilmDetail(params.slug),
    });
  },
  component: FilmDetailView,
  errorComponent: RouteError,
});

function gradientStyle(film: RankedFilm | null | undefined) {
  const from = film?.gradient_from ?? "#333";
  const to = film?.gradient_to ?? "#111";
  return `linear-gradient(155deg, ${from}, ${to})`;
}

// ── Watchlist hook (localStorage) ────────────────────────────────────────────
function useWatchlist(slug: string) {
  const key = "lumiere_watchlist";
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const list: string[] = JSON.parse(localStorage.getItem(key) ?? "[]");
    setSaved(list.includes(slug));
  }, [slug]);

  const toggle = () => {
    const list: string[] = JSON.parse(localStorage.getItem(key) ?? "[]");
    const next = list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug];
    localStorage.setItem(key, JSON.stringify(next));
    setSaved(next.includes(slug));
  };

  return { saved, toggle };
}

// ── Where to Watch ───────────────────────────────────────────────────────
const WATCH_REGIONS: { code: string; label: string }[] = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "IN", label: "India" },
  { code: "FR", label: "France" },
  { code: "DE", label: "Germany" },
  { code: "BR", label: "Brazil" },
  { code: "JP", label: "Japan" },
  { code: "KR", label: "South Korea" },
];

function ProviderGroup({
  label,
  providers,
  link,
}: {
  label: string;
  providers: WatchProvider[] | undefined;
  link?: string;
}) {
  if (!providers || providers.length === 0) return null;
  return (
    <div>
      <div className="mt-4 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {providers.map((p) => (
          <a
            key={p.provider_id}
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            title={`${p.provider_name} — ${label}`}
            className="flex items-center gap-1.5 border border-foreground/10 bg-foreground/5 px-1.5 py-1 transition hover:border-foreground/25 hover:bg-foreground/10"
          >
            {p.logo_path ? (
              <img
                src={`${TMDB_IMG}/w92${p.logo_path}`}
                alt={p.provider_name}
                className="h-7 w-7 bg-white object-contain"
                loading="lazy"
              />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center bg-foreground/10 text-[8px] font-bold">
                {p.provider_name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <span className="pr-0.5 text-[10px] font-medium text-foreground/80">
              {p.provider_name}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

function FilmDetailView() {
  const { slug } = Route.useParams();
  const { saved, toggle } = useWatchlist(slug);
  const [showMethodology, setShowMethodology] = useState(false);
  const [watchRegion, setWatchRegion] = useState("US");
  const [toast, setToast] = useState<string | null>(null);

  // The trailer plays inline on the page — this action just brings it into view.
  const scrollToTrailer = useCallback(() => {
    document.getElementById("trailer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleToggleSave = () => {
    toggle();
    setToast(!saved ? "Saved to your Watchlist" : "Removed from Watchlist");
    setTimeout(() => setToast(null), 3500);
  };

  // ── Queries ────────────────────────────────────────────────────────────────
  const {
    data: film,
    isLoading: filmLoading,
    error: filmError,
  } = useQuery({
    queryKey: ["film", "detail", slug],
    queryFn: () => getFilmDetail(slug),
    staleTime: 5 * 60 * 1000,
  });

  // TV shows are first-class content: their TMDB identity lives in the /tv
  // endpoints with name/first_air_date shapes. Movies use /movie endpoints.
  // Explicit generics: movie and TV endpoints return different result shapes,
  // so the query is typed by the fields this page actually consumes.
  const isTvShow = film?.content_type === "TV_SHOW";
  const { data: tmdb } = useQuery<{
    results: { id: number; poster_path: string | null; overview?: string }[];
  }>({
    queryKey: ["tmdb", isTvShow ? "tv" : "movie", film?.title, film?.year],
    queryFn: () =>
      isTvShow
        ? searchTmdbTv(film!.title, film?.year ?? undefined)
        : searchTmdbMovie(film!.title, film?.year ?? undefined),
    enabled: !!film,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const tmdbId = tmdb?.results?.[0]?.id;
  const tmdbFilm = tmdb?.results?.[0];

  // Dynamic OG image — declared before the early returns below so the hook order
  // stays stable once film data arrives (which flips `filmLoading` off).
  // Prefer the backend-provided poster so the hero renders instantly; the TMDB
  // search still runs for trailers and details.
  const posterUrl = film?.poster_url || tmdbPosterUrl(tmdbFilm?.poster_path, "w500");
  useEffect(() => {
    if (posterUrl) {
      let meta = document.querySelector('meta[property="og:image"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("property", "og:image");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", posterUrl);
    }
  }, [posterUrl]);

  const { data: videos } = useQuery<
    { results: { key: string; site: string; type: string }[] } | null
  >({
    queryKey: ["tmdb", "videos", isTvShow ? "tv" : "movie", tmdbId],
    queryFn: () =>
      tmdbId
        ? isTvShow
          ? getTmdbTvVideos(tmdbId)
          : getTmdbMovieVideos(tmdbId)
        : null,
    enabled: !!tmdbId,
    staleTime: 24 * 60 * 60 * 1000,
  });

  // Normalized across both content types — per-type fields are optional.
  type TmdbDetailsUnion = {
    vote_count?: number;
    popularity?: number;
    genres?: { id: number; name: string }[];
    // Movie-only
    runtime?: number;
    budget?: number;
    revenue?: number;
    // TV-only
    episode_run_time?: number[];
    number_of_seasons?: number;
    number_of_episodes?: number;
  };
  const { data: tmdbDetails } = useQuery<TmdbDetailsUnion | null>({
    queryKey: ["tmdb", "details", isTvShow ? "tv" : "movie", tmdbId],
    queryFn: () =>
      tmdbId
        ? isTvShow
          ? getTmdbTvDetails(tmdbId)
          : getTmdbMovieDetails(tmdbId)
        : null,
    enabled: !!tmdbId,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const { data: watchData } = useQuery<TmdbWatchProviders | null>({
    queryKey: ["tmdb", "watch-providers", isTvShow ? "tv" : "movie", tmdbId],
    queryFn: () =>
      tmdbId
        ? isTvShow
          ? getTmdbTvWatchProviders(tmdbId)
          : getTmdbWatchProviders(tmdbId)
        : null,
    enabled: !!tmdbId,
    staleTime: 24 * 60 * 60 * 1000,
  });

  // More Like This — the film's genre shelf (the backend catalog's genre_tag is
  // the single source of truth), excluding the film itself; falls back to the
  // current Top 100 for titles without a tag.
  const { data: similarFilms } = useQuery({
    queryKey: ["films", "similar", film?.genre_tag ?? "top"],
    queryFn: () =>
      film?.genre_tag ? getGenreFilms(film.genre_tag, 8) : getTopFilms(8),
    enabled: !!film,
    staleTime: 5 * 60 * 1000,
  });

  if (filmLoading) {
    return (
      <Layout>
        <section className="grid grid-cols-1 gap-6 px-4 pt-6 lg:grid-cols-12 lg:px-6">
          <div className="lg:col-span-8 space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-20 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-2 gap-4 mt-6">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
            <Skeleton className="h-48 w-full mt-4" />
          </div>
          <aside className="lg:col-span-4 space-y-4">
            <Skeleton className="aspect-[2/3] w-full" />
            <Skeleton className="h-52 w-full" />
          </aside>
        </section>
      </Layout>
    );
  }

  if (filmError || !film) {
    return (
      <Layout>
        <div className="px-6 py-20 text-center font-display text-3xl font-medium">
          {filmError ? `Failed to load film: ${filmError.message}` : "Film not found."}
        </div>
      </Layout>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const director = film.director && film.director !== "Unknown" ? film.director : null;
  const synopsis = tmdbFilm?.overview || film.synopsis || "No synopsis available.";
  const trailerKey =
    videos?.results?.find((v) => v.site === "YouTube" && v.type === "Trailer")?.key ??
    videos?.results?.find((v) => v.site === "YouTube")?.key ??
    null;

  // Real backend sentiment signals, with calibrated fallback from Index score if early in tracking
  const rawSentiment = film.sentiment;
  const hasBackendSentiment = rawSentiment?.sufficient_data === true && rawSentiment.positive != null;

  // Real backend sentiment only — a fabricated breakdown would erode trust, so
  // titles without sufficient signals show the honest empty state instead.
  const sentiment = {
    positive: rawSentiment?.positive ?? null,
    neutral: rawSentiment?.neutral ?? null,
    negative: rawSentiment?.negative ?? null,
  };
  const hasSentimentData = hasBackendSentiment;

  // TMDB derived metrics
  // Runtime/length differs per content type: movies have a single runtime,
  // shows have per-episode runtimes (first value) — plus season/episode counts.
  const runtime = isTvShow ? tmdbDetails?.episode_run_time?.[0] : tmdbDetails?.runtime;
  const seasonCount = isTvShow ? tmdbDetails?.number_of_seasons : undefined;
  const episodeCount = isTvShow ? tmdbDetails?.number_of_episodes : undefined;
  const genres = tmdbDetails?.genres ?? [];
  const tmdbMovieUrl = tmdbId ? `https://www.themoviedb.org/${isTvShow ? "tv" : "movie"}/${tmdbId}` : undefined;
  const watchRegionData = watchData?.results?.[watchRegion];
  const watchLink = tmdbId
    ? `https://www.themoviedb.org/${isTvShow ? "tv" : "movie"}/${tmdbId}/watch?locale=${watchRegion}`
    : undefined;
  const regionLabel = WATCH_REGIONS.find((r) => r.code === watchRegion)?.label ?? watchRegion;
  const hasWatchOptions =
    !!watchRegionData &&
    (watchRegionData.flatrate?.length ?? 0) +
      (watchRegionData.free?.length ?? 0) +
      (watchRegionData.ads?.length ?? 0) +
      (watchRegionData.rent?.length ?? 0) +
      (watchRegionData.buy?.length ?? 0) >
      0;

  // Chart tenure in days — the chart refreshes every 15 minutes, so days is
  // the honest unit. A NEW entry (no previous snapshot) is on day 1.
  const isNewEntry = film.prev_rank == null;
  const daysOnChart = film.days_on_chart ?? 1;

  // Index résumé — days on chart, days at #1, peak rank. The chart's own
  // history presented as editorial fact; the résumé's first entry carries the
  // emphasis (dominance streak for a current #1, peak crown for a former one).
  const daysAtOne = film.days_at_one ?? 0;
  const peakRank = film.peak_rank ?? film.rank;
  const day = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
  const resumeBits: string[] = [];
  if (film.rank === 1) {
    if (daysAtOne > 0) resumeBits.push(`${day(daysAtOne)} at #1`);
    resumeBits.push(`${day(daysOnChart)} on chart`);
  } else if (peakRank === 1) {
    resumeBits.push("Peak #1");
    if (daysAtOne > 0) resumeBits.push(`${day(daysAtOne)} at #1`);
    resumeBits.push(`${day(daysOnChart)} on chart`);
  } else {
    resumeBits.push(`${day(daysOnChart)} on chart`);
    resumeBits.push(`Peak #${peakRank}`);
  }

  // Index Total — one unified observation volume (raw upstream observations
  // over the last 30 days, falling back to the tracked record count early in
  // a title's life).
  const indexTotalObs =
    film.signal_funnel?.raw_observations_30d ?? film.mentions_total ?? 0;
  const indexTotalLabel =
    indexTotalObs > 0
      ? indexTotalObs >= 1_000_000
        ? `${(indexTotalObs / 1_000_000).toFixed(1)}M`
        : indexTotalObs >= 1_000
          ? `${(indexTotalObs / 1_000).toFixed(1)}k`
          : indexTotalObs.toLocaleString()
      : "—";

  const similar = (similarFilms ?? []).filter((f) => f.slug !== slug).slice(0, 6);

  return (
    <Layout>
      <section className="px-4 pt-6 lg:px-6">
        <div className="mx-auto max-w-5xl animate-fade-up space-y-6">
          {/* Breadcrumb + Actions — editorial metadata row, no badges */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/10 pb-4">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              The Index · #{film.rank || "—"} · 0% critic weight
            </div>
            <div className="flex items-center gap-4">
              {trailerKey && (
                <button
                  onClick={scrollToTrailer}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                >
                  <Play className="h-3.5 w-3.5" />
                  Trailer
                </button>
              )}
              <Link
                to="/compare"
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
              >
                <Scale className="h-3.5 w-3.5" />
                Compare
              </Link>
              <button
                onClick={handleToggleSave}
                className={`flex items-center gap-1.5 text-xs font-medium transition ${
                  saved ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {saved ? (
                  <BookmarkCheck className="h-3.5 w-3.5" />
                ) : (
                  <Bookmark className="h-3.5 w-3.5" />
                )}
                {saved ? "Saved" : "Watchlist"}
              </button>
            </div>
          </div>

          {/* Poster — a clean window onto the artwork. No glow, no frame. */}
          <figure className="float-right ml-5 mb-3 w-[34%] max-w-[210px] sm:ml-8 sm:mb-4 sm:w-[30%] sm:max-w-[280px] lg:max-w-[320px]">
            <div
              className="relative aspect-[2/3] overflow-hidden bg-ink"
              style={{ background: gradientStyle(film) }}
            >
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt={film.title}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="eager"
                />
              ) : (
                <div
                  className="absolute inset-0 opacity-40 mix-blend-overlay"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 30% 30%, rgba(255,255,255,.3), transparent 60%)",
                  }}
                />
              )}
            </div>
          </figure>

          {/* Title */}
          <div>
            <h1 className="font-serif text-5xl leading-[0.95] sm:text-6xl lg:text-7xl">
              {film.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-lg text-muted-foreground">
              {director && (
                <span>
                  {isTvShow ? (
                    <>
                      Created by <span className="text-foreground">{director}</span>
                    </>
                  ) : (
                    <>
                      Directed by <span className="text-foreground">{director}</span>
                    </>
                  )}
                </span>
              )}
              {director && <span>·</span>}
              <span>{film.year || "—"}</span>
              {runtime && (
                <>
                  <span>·</span>
                  <span>{runtime} min</span>
                </>
              )}
              {seasonCount != null && (
                <>
                  <span>·</span>
                  <span>
                    {seasonCount} season{seasonCount === 1 ? "" : "s"}
                    {episodeCount != null ? ` · ${episodeCount} episodes` : ""}
                  </span>
                </>
              )}
            </div>
            {/* Genres — quiet editorial metadata, not pills */}
            {genres.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-x-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {genres.map((g, i) => (
                  <span key={g.id} className="flex items-center gap-2">
                    {i > 0 && <span className="text-foreground/25">·</span>}
                    {g.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Synopsis */}
          <p className="text-base leading-relaxed text-foreground/80">{synopsis}</p>
          <div className="clear-both" />

          {/* Trailer — embedded and ready on arrival; pressing play runs right
              here on the page. No navigation, no separate player view. */}
          <div id="trailer" className="scroll-mt-24">
            {trailerKey ? (
              <div className="relative">
                <div className="aspect-video w-full overflow-hidden bg-black/40">
                  <iframe
                    src={`https://www.youtube.com/embed/${trailerKey}?rel=0&modestbranding=1&playsinline=1`}
                    title={`${film.title} — Official Trailer`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full"
                  />
                </div>
                <div className="flex items-center justify-between px-1 pt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  <span>Official Trailer · YouTube</span>
                  <span className="hidden sm:inline">Plays on this page</span>
                </div>
              </div>
            ) : videos === undefined ? (
              <div className="relative aspect-video w-full bg-surface">
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/50">
                    Loading trailer…
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-full border border-foreground/10 bg-surface px-4 py-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Official Trailer
                </span>
                <span className="text-xs text-muted-foreground">Not yet available</span>
              </div>
            )}
          </div>

          {/* ── Index Score block — the measurement, treated as one ── */}
          <div className="relative border-y border-foreground/10 bg-surface p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
                Index Score
              </div>
              <button
                onClick={() => setShowMethodology(!showMethodology)}
                className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
              >
                <Info className="h-3 w-3" />
                <span>How is this calculated?</span>
              </button>
            </div>

            {/* Methodology popover */}
            {showMethodology && (
              <div className="mb-5 border border-foreground/15 bg-background p-4 text-xs leading-relaxed text-foreground animate-fade-up">
                <div className="flex items-center justify-between font-bold text-primary mb-1">
                  <span>Methodology & Transparency</span>
                  <button onClick={() => setShowMethodology(false)}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p>
                  The Index Score measures a title's current cultural momentum on a 0–100 scale,
                  computed from real audience attention across the web and normalized within the
                  active pool. It is not a review score — it never grades quality.{" "}
                  <a href="/methodology" className="font-medium text-primary underline">
                    Full methodology →
                  </a>
                </p>
              </div>
            )}

            {/* Score + movement — the number is the hero, no ring theatrics */}
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <div className="index-score text-6xl font-bold lg:text-7xl">
                  {film.score?.toFixed(1) || "—"}
                </div>
                <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                  of 100 · audience-driven
                </div>
              </div>
              {/* Index résumé — the title's chart history, one quiet line */}
              <div className="pb-1.5 text-xs leading-relaxed text-muted-foreground">
                {resumeBits.map((bit, i) => (
                  <span key={bit}>
                    {i > 0 && <span className="mx-1.5 text-foreground/25">·</span>}
                    <span className={i === 0 ? "font-medium text-foreground" : undefined}>{bit}</span>
                  </span>
                ))}
              </div>
              <div className="pb-1.5 font-mono text-base">
                {(film.movement ?? 0) > 0 ? (
                  <span className="flex items-center gap-1 font-semibold text-up">
                    <ArrowUp className="h-5 w-5" /> {film.movement}
                  </span>
                ) : (film.movement ?? 0) < 0 ? (
                  <span className="flex items-center gap-1 font-semibold text-down">
                    <ArrowDown className="h-5 w-5" /> {Math.abs(film.movement ?? 0)}
                  </span>
                ) : (
                  <span className="font-medium text-muted-foreground" title="Held its rank">—</span>
                )}
              </div>
            </div>
          </div>

          {/* ── Index Total — one unified number ── */}
          <div className="border-y border-foreground/10 bg-surface p-6">
            <div className="flex items-baseline gap-3">
              <div className="index-score text-5xl font-bold lg:text-6xl">{indexTotalLabel}</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                Index Total
              </div>
            </div>
          </div>

          {/* Audience Sentiment — real backend data, or an honest empty state */}
          <div className="border-y border-foreground/10 bg-surface p-6">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Audience Sentiment Breakdown
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                {hasBackendSentiment ? "Verified" : "Awaiting Data"}
              </span>
            </div>
            {hasSentimentData && sentiment.positive != null ? (
              <>
                <div className="mt-4 flex h-1.5">
                  <div style={{ width: `${sentiment.positive}%` }} className="bg-up" />
                  <div style={{ width: `${sentiment.neutral}%` }} className="bg-foreground/20" />
                  <div style={{ width: `${sentiment.negative}%` }} className="bg-down" />
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="font-mono text-2xl tabular text-forest-deep">
                      {sentiment.positive}%
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Positive
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-2xl tabular">{sentiment.neutral}%</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Neutral
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-2xl tabular text-down">
                      {sentiment.negative}%
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Negative
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-4 flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 opacity-30" />
                <p className="text-xs">
                  Not enough data yet.
                </p>
              </div>
            )}
          </div>

          {/* Chart stats — one quiet line, print-facts style */}
          <div className="flex flex-wrap gap-x-8 gap-y-3 border-y border-foreground/10 bg-surface px-6 py-4">
            {[
              { label: "Days on chart", value: `${daysOnChart}` },
              { label: "Days at #1", value: `${daysAtOne}` },
              { label: "Peak rank", value: `#${peakRank}` },
              { label: "Index Total", value: indexTotalLabel },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="font-mono text-sm tabular text-foreground">{stat.value}</div>
                <div className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right aside — More Like This + Where to Watch ── */}
        <aside className="mx-auto mt-10 w-full max-w-5xl animate-fade-up delay-100 space-y-8 px-0 lg:mt-6">
          {/* More Like This — the genre shelf next to Where to Watch */}
          <div>
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                More Like This
              </div>
              {film.genre_tag && (
                <Link
                  to="/genres"
                  className="font-mono text-[10px] text-muted-foreground transition hover:text-foreground"
                >
                  {film.genre_tag} →
                </Link>
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {similar.map((f) => (
                <PosterCard key={f.slug} film={f} width="100%" />
              ))}
            </div>
            {similar.length === 0 && (
              <div className="mt-3 border border-foreground/10 bg-surface p-4 text-xs text-muted-foreground">
                Similar titles will appear as the catalog grows.
              </div>
            )}
          </div>

          {/* Where to Watch */}
          <div className="border-t border-foreground/10 pt-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                <Tv className="h-4 w-4 text-primary" />
                Where to Watch
              </div>
              <select
                value={watchRegion}
                onChange={(e) => setWatchRegion(e.target.value)}
                aria-label="Watch region"
                className="rounded-full border border-foreground/15 bg-foreground/5 px-3 py-1 font-mono text-[10px] text-muted-foreground outline-none focus:border-primary/40"
              >
                {WATCH_REGIONS.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            {watchData && hasWatchOptions ? (
              <>
                <ProviderGroup
                  label="Streaming"
                  providers={watchRegionData?.flatrate}
                  link={watchLink}
                />
                <ProviderGroup
                  label="Free"
                  providers={
                    watchRegionData?.free?.length
                      ? [...watchRegionData.free, ...(watchRegionData.ads ?? [])]
                      : watchRegionData?.ads
                  }
                  link={watchLink}
                />
                <ProviderGroup label="Rent" providers={watchRegionData?.rent} link={watchLink} />
                <ProviderGroup label="Buy" providers={watchRegionData?.buy} link={watchLink} />
              </>
            ) : null}

            {/* Universal Theater & Streaming Finder */}
            <div className="mt-4 pt-3 border-t border-foreground/10 space-y-2">
              {watchData && !hasWatchOptions && (
                <p className="pb-1 text-xs text-muted-foreground">
                  No streaming options listed for this region yet.
                </p>
              )}
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(`${film.title} showtimes tickets`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3 text-xs transition hover:bg-foreground/[0.08] hover:border-foreground/20"
              >
                <div className="flex items-center gap-2.5">
                  <FilmIcon className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <div className="font-medium text-foreground">Cinema & Theaters</div>
                    <div className="text-[10px] text-muted-foreground">Find local showtimes & tickets</div>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </a>

              <a
                href={`https://www.justwatch.com/us/search?q=${encodeURIComponent(film.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3 text-xs transition hover:bg-foreground/[0.08] hover:border-foreground/20"
              >
                <div className="flex items-center gap-2.5">
                  <Tv className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <div className="font-medium text-foreground">Streaming & Digital</div>
                    <div className="text-[10px] text-muted-foreground">Search streaming platforms & providers</div>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </a>
            </div>
          </div>
        </aside>
      </section>

      {/* Floating Save/Watchlist Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 border border-primary/30 bg-background p-4 shadow-2xl animate-fade-up">
          <BookmarkCheck className="h-5 w-5 text-primary shrink-0" />
          <div className="text-xs">
            <span className="font-medium text-foreground">{toast}</span>
            <Link to="/watchlist" className="ml-2 font-mono text-primary underline">
              View Watchlist →
            </Link>
          </div>
          <button onClick={() => setToast(null)} className="ml-1 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </Layout>
  );
}


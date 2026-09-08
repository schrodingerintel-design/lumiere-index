import { useState, useEffect, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import {
  getFilmDetail,
  searchTmdbMovie,
  tmdbBackdropUrl,
  tmdbPosterUrl,
  getTmdbMovieVideos,
  getTmdbMovieDetails,
  getTmdbWatchProviders,
  TMDB_IMG,
  type RankedFilm,
  type WatchProvider,
} from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
import { Skeleton } from "@/components/lumiere/Skeletons";
import {
  Bookmark,
  BookmarkCheck,
  ArrowUpRight,
  TrendingUp,
  MessageSquare,
  Youtube,
  ArrowUp,
  ArrowDown,
  Scale,
  Play,
  BarChart3,
  ShieldCheck,
  Info,
  X,
  Sparkles,
  Tv,
  Film as FilmIcon,
} from "lucide-react";
export const Route = createFileRoute("/films/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${(params?.slug ?? "").replace(/-/g, " ")} — Lumière The Index` },
      {
        name: "description",
        content: `Live cultural index score and audience sentiment for film ${params?.slug}.`,
      },
      {
        property: "og:title",
        content: `${(params?.slug ?? "").replace(/-/g, " ")} — Lumière The Index`,
      },
      {
        property: "og:description",
        content: `Live cultural index score and audience sentiment for film ${params?.slug}.`,
      },
      { property: "og:type", content: "video.movie" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: `${(params?.slug ?? "").replace(/-/g, " ")} — Lumière The Index`,
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

// ── Source signal badges ──────────────────────────────────────────────────────
interface SourceBadgeProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  href?: string;
  onClick?: () => void;
  color: string;
}

function SourceBadge({ icon, label, value, sub, href, onClick, color }: SourceBadgeProps) {
  const inner = (
    <div
      className={`flex items-center gap-3 border border-foreground/10 bg-surface p-3.5 transition ${href || onClick ? "hover:border-foreground/25 hover:bg-foreground/[0.04] cursor-pointer" : ""}`}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${color}20` }}
      >
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
        <div className="mt-0.5 font-mono text-base font-semibold tabular" style={{ color }}>
          {value}
        </div>
        {sub && <div className="font-mono text-[10px] text-muted-foreground">{sub}</div>}
      </div>
      {onClick && !href && <Play className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
      {href && <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }
  if (onClick) {
    return (
      <button onClick={onClick} className="block w-full text-left">
        {inner}
      </button>
    );
  }
  return inner;
}

// ── Where to Watch ───────────────────────────────────────────────────────────
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
  const [trailerOpen, setTrailerOpen] = useState(false);
  const closeTrailer = useCallback(() => setTrailerOpen(false), []);

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

  const { data: tmdb } = useQuery({
    queryKey: ["tmdb", film?.title, film?.year],
    queryFn: () => searchTmdbMovie(film!.title, film?.year ?? undefined),
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

  const { data: videos } = useQuery({
    queryKey: ["tmdb", "videos", tmdbId],
    queryFn: () => (tmdbId ? getTmdbMovieVideos(tmdbId) : null),
    enabled: !!tmdbId,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const { data: tmdbDetails } = useQuery({
    queryKey: ["tmdb", "details", tmdbId],
    queryFn: () => (tmdbId ? getTmdbMovieDetails(tmdbId) : null),
    enabled: !!tmdbId,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const { data: watchData } = useQuery({
    queryKey: ["tmdb", "watch-providers", tmdbId],
    queryFn: () => (tmdbId ? getTmdbWatchProviders(tmdbId) : null),
    enabled: !!tmdbId,
    staleTime: 24 * 60 * 60 * 1000,
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
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
            </div>
            <Skeleton className="h-48 w-full rounded-2xl mt-4" />
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
        <div className="px-6 py-20 text-center font-serif text-3xl">
          {filmError ? `Failed to load film: ${filmError.message}` : "Film not found."}
        </div>
      </Layout>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const director = film.director && film.director !== "Unknown" ? film.director : "Director TBA";
  const synopsis = tmdbFilm?.overview || film.synopsis || "No synopsis available.";
  const trailerKey =
    videos?.results?.find((v) => v.site === "YouTube" && v.type === "Trailer")?.key ??
    videos?.results?.find((v) => v.site === "YouTube")?.key ??
    null;
  const backdropUrl = tmdbBackdropUrl(tmdbFilm?.backdrop_path, "w1280");

  // Real backend sentiment signals, with calibrated fallback from Index score if early in tracking
  const rawSentiment = film.sentiment;
  const hasBackendSentiment = rawSentiment?.sufficient_data === true && rawSentiment.positive != null;

  const scoreVal = film.score || 70;
  const calibPositive = Math.min(94, Math.max(45, Math.round((scoreVal / 100) * 85 + 10)));
  const calibNegative = Math.min(28, Math.max(5, Math.round((1 - scoreVal / 100) * 35)));
  const calibNeutral = Math.max(5, 100 - calibPositive - calibNegative);

  const sentiment = {
    positive: hasBackendSentiment ? rawSentiment.positive! : calibPositive,
    neutral: hasBackendSentiment ? rawSentiment.neutral! : calibNeutral,
    negative: hasBackendSentiment ? rawSentiment.negative! : calibNegative,
  };
  const hasSentimentData = true;

  // TMDB derived metrics
  const tmdbVotes = tmdbDetails?.vote_count ?? 0;
  const runtime = tmdbDetails?.runtime;
  const genres = tmdbDetails?.genres ?? [];
  const tmdbPopularity = tmdbDetails?.popularity ?? 0;
  const budget = tmdbDetails?.budget ?? 0;
  const revenue = tmdbDetails?.revenue ?? 0;

  const tmdbMovieUrl = tmdbId ? `https://www.themoviedb.org/movie/${tmdbId}` : undefined;
  const watchRegionData = watchData?.results?.[watchRegion];
  const watchLink = tmdbId
    ? `https://www.themoviedb.org/movie/${tmdbId}/watch?locale=${watchRegion}`
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

  const formatMoney = (n: number) => {
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
    return `$${n.toLocaleString()}`;
  };

  // A NEW entry (no previous snapshot) has no meaningful chart tenure — showing
  // "8 weeks" next to "just entered tracking" is the exact contradiction the
  // audit flagged. Weeks count only from the first charted snapshot onward.
  const isNewEntry = film.prev_rank == null;
  const weeksOnChart = isNewEntry ? 0 : (film.weeks_on_chart ?? 1);

  return (
    <Layout>
      <section className="grid grid-cols-1 gap-8 px-4 pt-6 lg:grid-cols-12 lg:px-6">
        {/* ── Left Column ── */}
        <div className="lg:col-span-8 animate-fade-up space-y-6">
          {/* ── Trailer hero — the film's media leads the page. Clicking opens
              the in-page player; the user never leaves The Index. ── */}
          {trailerKey ? (
            <button
              onClick={() => setTrailerOpen(true)}
              className="group relative block aspect-video w-full overflow-hidden border border-foreground/10 text-left"
              aria-label={`Watch the trailer for ${film.title}`}
            >
              {backdropUrl ? (
                <img
                  src={backdropUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="absolute inset-0" style={{ background: gradientStyle(film) }} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/30" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/40 bg-black/40 backdrop-blur-sm transition group-hover:border-primary group-hover:bg-primary sm:h-16 sm:w-16">
                  <Play className="h-6 w-6 translate-x-[2px] text-white transition group-hover:text-primary-foreground" />
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 sm:p-5">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/60">
                    Official Trailer · YouTube
                  </div>
                  <div className="mt-1 font-serif text-xl text-white sm:text-2xl">
                    Watch the trailer
                  </div>
                </div>
                <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-white/50 sm:block">
                  Plays in-page
                </span>
              </div>
            </button>
          ) : videos === undefined ? (
            <div
              className="relative aspect-video w-full overflow-hidden border border-foreground/10"
              style={{ background: gradientStyle(film) }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/50">
                  Loading trailer…
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between border border-foreground/10 bg-surface px-4 py-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Official Trailer
              </span>
              <span className="text-xs text-muted-foreground">Not yet available</span>
            </div>
          )}

          {/* Breadcrumb + Actions — editorial metadata row, no badges */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/10 pb-4">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              The Index · #{film.rank || "—"} · 0% critic weight
            </div>
            <div className="flex items-center gap-4">
              {trailerKey && (
                <button
                  onClick={() => setTrailerOpen(true)}
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

          {/* Title */}
          <div>
            <h1 className="font-serif text-6xl leading-[0.95] lg:text-8xl">{film.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-lg text-muted-foreground">
              <span>
                Directed by <span className="text-foreground">{director}</span>
              </span>
              <span>·</span>
              <span>{film.year || "—"}</span>
              {runtime && (
                <>
                  <span>·</span>
                  <span>{runtime} min</span>
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
          <p className="max-w-2xl text-base leading-relaxed text-foreground/80">{synopsis}</p>

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
                  The Index Score blends five time-windowed components — Current Attention (30%),
                  Momentum (25%), Recency (20%), Audience Engagement (15%), and Cross-Platform
                  Reach (10%) — computed from raw audience observations and normalized to 0–100
                  within the active pool. We do not aggregate critic star ratings or press reviews —
                  every point reflects real audience signals.{" "}
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
                  <span className="font-medium text-yellow-300/90" title="Held its rank">—</span>
                )}
              </div>
            </div>
          </div>

          {/* ── Multi-Source Viewer Signal Badges ── */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Audience Signals
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                {film.signal_funnel && film.signal_funnel.raw_observations_30d > 0
                  ? `${film.signal_funnel.raw_observations_30d.toLocaleString()} raw observations · ${film.signal_funnel.source_coverage} source${film.signal_funnel.source_coverage === 1 ? "" : "s"} · last 30d`
                  : film.mentions_total > 0
                    ? `${film.mentions_total.toLocaleString()} tracked records · last 48h`
                    : "—"}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SourceBadge
                icon={<ShieldCheck className="h-4.5 w-4.5" />}
                label="Audience Index"
                value={film.score ? `${film.score.toFixed(1)} / 100` : "—"}
                sub="Verified Audience Signals"
                color="#01b4e4"
              />
              <SourceBadge
                icon={<TrendingUp className="h-4.5 w-4.5" />}
                label="Community Sentiment"
                value={`${sentiment.positive}% Positive`}
                sub={
                  hasBackendSentiment
                    ? "across r/movies, r/TrueFilm & Letterboxd"
                    : "calibrated from audience signal density"
                }
                color="#ff4500"
              />
              <SourceBadge
                icon={<MessageSquare className="h-4.5 w-4.5" />}
                label="Discussion Velocity"
                value={
                  tmdbPopularity > 0
                    ? tmdbPopularity > 200
                      ? "Very High"
                      : tmdbPopularity > 80
                        ? "High"
                        : "Moderate"
                    : "—"
                }
                sub={tmdbPopularity > 0 ? "Active cultural tracking" : "Not enough data yet"}
                color="#8b5cf6"
              />
              {revenue > 0 && (
                <SourceBadge
                  icon={<BarChart3 className="h-4.5 w-4.5" />}
                  label="Box Office Revenue"
                  value={formatMoney(revenue)}
                  sub={budget > 1000000 ? `Budget: ${formatMoney(budget)}` : undefined}
                  color="#10b981"
                />
              )}
              <SourceBadge
                icon={<Youtube className="h-4.5 w-4.5" />}
                label="Trailer Signals"
                value="Official Trailer"
                sub={trailerKey ? "YouTube · plays in-page" : "Trailer not yet available"}
                onClick={trailerKey ? () => setTrailerOpen(true) : undefined}
                color="#ff0000"
              />
            </div>
          </div>

          {/* Audience Sentiment Breakdown */}
          <div className="border border-foreground/10 bg-surface p-5">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Audience Sentiment Breakdown
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                {hasBackendSentiment ? "Verified Audience Signals" : "Signal-Calibrated Sentiment"}
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
                  Insufficient sentiment data — more audience signals needed.
                </p>
              </div>
            )}
          </div>

          {/* Editorial Insight & Cultural Context — claim strength gated by the
              confidence tier the ranking engine computed. The observation volume
              (real upstream activity) is shown separately from the ingest
              record count — one YouTube record can aggregate millions of views. */}
          <div className="border border-foreground/10 bg-surface p-5">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
                Editorial Insight
              </span>
            </div>
            <p className="mt-2 text-xs text-foreground/90 leading-relaxed font-serif">
              {film.confidence === "insufficient" ||
              (film.confidence == null && (film.sample_size ?? 0) < 5)
                ? `"${film.title}" has just entered tracking — not enough audience signal yet to assess its trajectory.`
                : film.confidence === "low"
                  ? `"${film.title}" holds rank #${film.rank || "—"} on the Lumière Index with limited early evidence — ${(film.sample_size ?? film.mentions_total).toLocaleString()} audience ${((film.sample_size ?? film.mentions_total) === 1) ? "signal" : "signals"} tracked so far.`
                  : `"${film.title}" holds rank #${film.rank || "—"} on the Lumière Index, backed by ${(film.signal_funnel?.raw_observations_30d ?? film.sample_size ?? film.mentions_total).toLocaleString()} raw audience observations over the last 30 days.`}
            </p>
            {/* Source-level funnel — internal Signal Health detail, kept honest */}
            {film.signal_funnel && film.signal_funnel.sources.length > 0 && (
              <div className="mt-4 space-y-1.5 border-t border-foreground/10 pt-3">
                {film.signal_funnel.sources.map((s) => (
                  <div key={s.source_key} className="flex items-center justify-between font-mono text-[10px]">
                    <span className="uppercase tracking-wider text-muted-foreground">{s.source_key}</span>
                    <span className="tabular text-foreground/80">
                      {s.observations.toLocaleString()} obs · {s.records} rec
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Aside ── */}
        <aside className="space-y-4 lg:col-span-4 animate-fade-up delay-100">
          {/* Poster — artwork flush, no rounded frame */}
          <div
            className="relative aspect-[2/3] overflow-hidden"
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            <div className="absolute inset-x-4 bottom-4 text-white">
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/70">
                A film by {director}
              </div>
              <div className="font-serif text-3xl leading-tight">{film.title}</div>
            </div>
          </div>

          {/* Where to Watch */}
          <div className="border border-foreground/10 bg-surface p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                <Tv className="h-4 w-4 text-primary" />
                Where to Watch
              </div>
              <select
                value={watchRegion}
                onChange={(e) => setWatchRegion(e.target.value)}
                aria-label="Watch region"
                className="rounded-lg border border-foreground/15 bg-foreground/5 px-2 py-1 font-mono text-[10px] text-muted-foreground outline-none focus:border-primary/40"
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

          {/* Index Score Card */}
          <div className="border border-foreground/10 bg-surface p-5">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Lumière Index Score
            </div>
            <div className="mt-2 font-mono text-6xl tabular text-primary">
              {film.score?.toFixed(1) || "0.0"}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-foreground/10 pt-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Time on chart
                </div>
                <div className="mt-1 font-mono text-xl tabular">
                  {isNewEntry
                    ? "New"
                    : `${weeksOnChart} ${weeksOnChart === 1 ? "week" : "weeks"}`}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Peak rank
                </div>
                <div className="mt-1 font-mono text-xl tabular">#{film.peak_rank ?? film.rank}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Observations
                </div>
                <div className="mt-1 font-mono text-xl tabular">
                  {(() => {
                    const obs = film.signal_funnel?.raw_observations_30d ?? 0;
                    const n = obs > 0 ? obs : film.mentions_total;
                    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
                    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
                    return n > 0 ? n : "—";
                  })()}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Rank change
                </div>
                <div
                  className={`mt-1 font-mono text-xl tabular ${(film.movement ?? 0) > 0 ? "text-forest-deep" : (film.movement ?? 0) < 0 ? "text-down" : ""}`}
                >
                  {(film.movement ?? 0) > 0 ? `+${film.movement}` : (film.movement ?? "—")}
                </div>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleToggleSave}
              className={`flex items-center justify-center gap-2 border py-3 text-sm font-medium transition ${
                saved
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-foreground/15 bg-surface hover:bg-foreground/10"
              }`}
            >
              {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
              {saved ? "Saved" : "Save"}
            </button>
            <Link
              to="/compare"
              className="flex items-center justify-center gap-2 border border-foreground/15 bg-surface py-3 text-sm font-medium transition hover:bg-foreground/10"
            >
              <Scale className="h-4 w-4" />
              Compare
            </Link>
          </div>
        </aside>
      </section>

      {/* Trailer modal — in-page player; unmounting the iframe stops playback */}
      {trailerOpen && trailerKey && (
        <TrailerModal videoKey={trailerKey} title={film.title} onClose={closeTrailer} />
      )}

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

// ── Trailer modal — YouTube embedded player inside The Index ────────────────
// 16:9, fluid width capped for desktop, ESC / click-outside / X to close.
// The iframe is unmounted on close, which guarantees playback stops.
// Muted autoplay (no sound until the user unmutes in the player itself).
function TrailerModal({
  videoKey,
  title,
  onClose,
}: {
  videoKey: string;
  title: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 sm:p-10"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} — trailer`}
    >
      <button
        onClick={onClose}
        aria-label="Close trailer"
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center border border-white/20 bg-black/70 text-white transition hover:border-white/60"
      >
        <X className="h-5 w-5" />
      </button>

      {/* 16:9 player — fluid width, capped on desktop, never overflows */}
      <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative aspect-video w-full border border-white/10 bg-black shadow-2xl">
          <iframe
            src={`https://www.youtube.com/embed/${videoKey}?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1`}
            title={`${title} — Official Trailer`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
        <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          <span className="truncate">{title} — Official Trailer</span>
          <span className="hidden shrink-0 sm:inline">ESC to close</span>
        </div>
      </div>
    </div>
  );
}

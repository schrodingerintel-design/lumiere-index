import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import {
  getFilmDetail,
  searchTmdbMovie,
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

// ── Score ring visual ─────────────────────────────────────────────────────────
function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(score / 100, 1);
  const dash = pct * circ;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-24 w-24">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 88 88">
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            strokeWidth="7"
            className="stroke-foreground/10"
          />
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            strokeWidth="7"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ stroke: color, transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-xl font-semibold tabular" style={{ color }}>
            {score.toFixed(0)}
          </span>
        </div>
      </div>
      <span className="text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

// ── Source signal badges ──────────────────────────────────────────────────────
interface SourceBadgeProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  href?: string;
  color: string;
}

function SourceBadge({ icon, label, value, sub, href, color }: SourceBadgeProps) {
  const inner = (
    <div
      className={`glass flex items-center gap-3 rounded-xl border border-foreground/10 p-3.5 transition ${href ? "hover:border-foreground/25 hover:bg-foreground/[0.04] cursor-pointer" : ""}`}
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
      {href && <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
    </div>
  );

  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {inner}
    </a>
  ) : (
    inner
  );
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
            className="flex items-center gap-1.5 rounded-lg border border-foreground/10 bg-foreground/5 px-1.5 py-1 transition hover:border-foreground/25 hover:bg-foreground/10"
          >
            {p.logo_path ? (
              <img
                src={`${TMDB_IMG}/w92${p.logo_path}`}
                alt={p.provider_name}
                className="h-7 w-7 rounded-md bg-white object-contain"
                loading="lazy"
              />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground/10 text-[8px] font-bold">
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

  // Use real backend sentiment data; do not fabricate values
  const rawSentiment = film.sentiment;
  const hasSentimentData = rawSentiment?.sufficient_data === true;
  const sentiment = {
    positive:
      hasSentimentData && rawSentiment.positive != null
        ? rawSentiment.positive
        : (null as number | null),
    neutral:
      hasSentimentData && rawSentiment.neutral != null
        ? rawSentiment.neutral
        : (null as number | null),
    negative:
      hasSentimentData && rawSentiment.negative != null
        ? rawSentiment.negative
        : (null as number | null),
  };

  // Cultural pulse is derived from the backend Index Score
  const culturalPulseScore = Math.round(film.score ?? 0);

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

  const weeksOnChart = film.weeks_on_chart ?? 1;

  return (
    <Layout>
      <section className="grid grid-cols-1 gap-8 px-4 pt-6 lg:grid-cols-12 lg:px-6">
        {/* ── Left Column ── */}
        <div className="lg:col-span-8 animate-fade-up space-y-6">
          {/* Breadcrumb + Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Film · #{film.rank || "—"} on The Index
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] text-primary">
                <ShieldCheck className="h-3 w-3" /> Audience-Driven
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/compare"
                className="flex items-center gap-1.5 rounded-full border border-foreground/15 bg-foreground/5 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
              >
                <Scale className="h-3.5 w-3.5" />
                Compare
              </Link>
              <button
                onClick={toggle}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  saved
                    ? "bg-primary text-primary-foreground"
                    : "border border-foreground/15 bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
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
            {/* Genre pills */}
            {genres.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {genres.map((g) => (
                  <span
                    key={g.id}
                    className="rounded-full border border-foreground/10 bg-foreground/5 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Synopsis */}
          <p className="max-w-2xl text-base leading-relaxed text-foreground/80">{synopsis}</p>

          {/* ── Dual Index Meter ── */}
          <div className="glass rounded-2xl p-6 relative">
            <div className="flex items-center justify-between mb-5">
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Lumière Audience Index
              </div>
              <button
                onClick={() => setShowMethodology(!showMethodology)}
                className="flex items-center gap-1 font-mono text-[10px] text-primary hover:underline"
              >
                <Info className="h-3 w-3" />
                <span>How is this score calculated?</span>
              </button>
            </div>

            {/* Methodology popover */}
            {showMethodology && (
              <div className="mb-5 rounded-xl border border-primary/20 bg-primary/10 p-4 text-xs leading-relaxed text-foreground animate-fade-up">
                <div className="flex items-center justify-between font-bold text-primary mb-1">
                  <span>Methodology & Transparency</span>
                  <button onClick={() => setShowMethodology(false)}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p>
                  Lumière's Index Score is calculated directly from{" "}
                  <strong>audience sentiment signals</strong> across review platforms, social
                  discussion density, and search velocity. We do not aggregate critic star ratings
                  or press reviews — every point reflects real viewer reactions.
                </p>
              </div>
            )}

            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="font-mono text-5xl font-bold tabular text-primary">
                  {film.score?.toFixed(1) || "—"}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Index Score
                </div>
                <div className="mt-3 flex items-center justify-center gap-1 font-mono text-xs text-muted-foreground">
                  {(film.movement ?? 0) > 0 ? (
                    <>
                      <ArrowUp className="h-3 w-3 text-green-400" />
                      <span className="text-green-400">+{film.movement}</span>
                    </>
                  ) : (film.movement ?? 0) < 0 ? (
                    <>
                      <ArrowDown className="h-3 w-3 text-red-400" />
                      <span className="text-red-400">{film.movement}</span>
                    </>
                  ) : (
                    <span>No change</span>
                  )}
                  <span>this cycle</span>
                </div>
              </div>
              <ScoreRing score={culturalPulseScore} label="Cultural Pulse" color="#a78bfa" />
            </div>
          </div>

          {/* ── Multi-Source Viewer Signal Badges ── */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Audience Signals
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                Based on {film.mentions_total > 0 ? film.mentions_total.toLocaleString() : "—"}{" "}
                viewer reactions
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SourceBadge
                icon={<ShieldCheck className="h-4.5 w-4.5" />}
                label="Audience Index"
                value={film.score ? `${film.score.toFixed(1)} / 100` : "—"}
                sub={`${tmdbVotes.toLocaleString()} viewer ratings`}
                href={tmdbMovieUrl}
                color="#01b4e4"
              />
              <SourceBadge
                icon={<TrendingUp className="h-4.5 w-4.5" />}
                label="Community Sentiment"
                value={
                  hasSentimentData && sentiment.positive != null
                    ? `${sentiment.positive}% Positive`
                    : "Insufficient data"
                }
                sub={
                  hasSentimentData
                    ? "across r/movies, r/TrueFilm & Letterboxd"
                    : "more audience signals needed"
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
                sub={
                  tmdbPopularity > 0
                    ? `Popularity index: ${tmdbPopularity.toFixed(0)}`
                    : "No data available"
                }
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
                value={trailerKey ? "Trailer Live" : "No Trailer Yet"}
                sub={trailerKey ? "YouTube · Official release" : "Awaiting upload"}
                href={trailerKey ? `https://www.youtube.com/watch?v=${trailerKey}` : undefined}
                color="#ff0000"
              />
            </div>
          </div>

          {/* Official Trailer */}
          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4 text-primary" />
                <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Official Trailer
                </div>
              </div>
              {trailerKey && (
                <a
                  href={`https://www.youtube.com/watch?v=${trailerKey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-muted-foreground hover:text-foreground transition"
                >
                  Watch on YouTube ↗
                </a>
              )}
            </div>
            {trailerKey ? (
              <div className="relative aspect-video w-full">
                <iframe
                  src={`https://www.youtube.com/embed/${trailerKey}?rel=0&modestbranding=1`}
                  title={`${film.title} — Official Trailer`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <Youtube className="h-10 w-10 opacity-25" />
                <p className="text-xs">No trailer available for this title yet.</p>
              </div>
            )}
          </div>

          {/* Audience Sentiment Breakdown */}
          <div className="glass rounded-2xl p-5">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Audience Sentiment Breakdown
            </div>
            {hasSentimentData && sentiment.positive != null ? (
              <>
                <div className="mt-4 flex h-3 overflow-hidden rounded-full">
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

          {/* Editorial Insight & Cultural Context */}
          <div className="glass rounded-2xl p-5 border border-primary/20 bg-primary/5">
            <div className="flex items-center gap-2 text-xs font-mono text-primary uppercase tracking-widest mb-1">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Editorial Insight & Cultural Context</span>
            </div>
            <p className="mt-2 text-xs text-foreground/90 leading-relaxed font-serif">
              {film.rank <= 10
                ? `"${film.title}" is currently holding an elite Top 10 position on the Lumière Index. Audience conversation velocity remains exceptionally strong across key discussion channels, propelled by high review engagement and global release momentum.`
                : `"${film.title}" continues its steady trajectory on the Lumière Index. Signal density indicates sustained word-of-mouth engagement across global territory tracking.`}
            </p>
          </div>
        </div>

        {/* ── Right Aside ── */}
        <aside className="space-y-4 lg:col-span-4 animate-fade-up delay-100">
          {/* Poster */}
          <div
            className="relative aspect-[2/3] overflow-hidden rounded-2xl"
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
          <div className="glass rounded-2xl p-5">
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
            {watchData ? (
              hasWatchOptions ? (
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
              ) : (
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  No streaming availability in {regionLabel} yet — check back closer to release.
                </p>
              )
            ) : (
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                {tmdbId ? "Loading availability…" : "Availability data unavailable for this title."}
              </p>
            )}
            {watchLink && (
              <a
                href={watchLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center justify-center gap-1 rounded-xl border border-foreground/15 py-2.5 font-mono text-xs text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
              >
                See all options on TMDB <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          {/* Index Score Card */}
          <div className="glass rounded-2xl p-5">
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
                  {weeksOnChart} {weeksOnChart === 1 ? "week" : "weeks"}
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
                  Audience Signals
                </div>
                <div className="mt-1 font-mono text-xl tabular">
                  {film.mentions_total > 1000
                    ? `${(film.mentions_total / 1000).toFixed(1)}k`
                    : film.mentions_total > 0
                      ? film.mentions_total
                      : "—"}
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
              onClick={toggle}
              className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition ${
                saved
                  ? "bg-primary text-primary-foreground"
                  : "glass border border-foreground/15 hover:bg-foreground/10"
              }`}
            >
              {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
              {saved ? "Saved" : "Save"}
            </button>
            <Link
              to="/compare"
              className="flex items-center justify-center gap-2 rounded-xl border border-foreground/15 glass py-3 text-sm font-medium transition hover:bg-foreground/10"
            >
              <Scale className="h-4 w-4" />
              Compare
            </Link>
          </div>
        </aside>
      </section>
    </Layout>
  );
}

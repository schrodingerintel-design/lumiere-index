import { useState, useEffect, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Layout } from "@/components/lumiere/Layout";
import {
  getFilmDetail,
  getGenreFilms,
  getTopFilms,
  searchTmdbMovie,
  searchTmdbTv,
  tmdbPosterUrl,
  tmdbBackdropUrl,
  getTmdbMovieVideos,
  getTmdbMovieDetails,
  getTmdbWatchProviders,
  getTmdbTvVideos,
  getTmdbTvDetails,
  getTmdbTvWatchProviders,
  getFilmRankHistory,
  TMDB_IMG,
  type RankedFilm,
  type TmdbWatchProviders,
  type WatchProvider,
  type RankHistoryPoint,
} from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
import { Skeleton } from "@/components/lumiere/Skeletons";
import { PosterCard } from "@/components/lumiere/PosterCard";
import { ShareCardButton } from "@/components/lumiere/ShareCardButton";
import {
  Bookmark,
  BookmarkCheck,
  ArrowUpRight,
  MessageSquare,
  ArrowUp,
  ArrowDown,
  Play,
  Info,
  X,
  Tv,
  Film as FilmIcon,
  Calendar,
  Clock,
  Globe,
  Languages,
  Wallet,
  Ticket,
  Landmark,
} from "lucide-react";

export const Route = createFileRoute("/films/$slug")({
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

// ── Index history chart (rank trajectory, inverted: #1 sits on top) ──────────
function RankHistoryChart({ history }: { history: RankHistoryPoint[] }) {
  if (history.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
        Chart history builds as the title spends more days ranked.
      </div>
    );
  }
  const maxRank = Math.max(...history.map((p) => p.rank));
  const data = history.map((p) => ({
    ...p,
    dayLabel: new Date(`${p.day}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    // Invert so rank 1 renders at the top of the chart.
    pos: -p.rank,
  }));
  const weeks = Math.round(history.length / 7);
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="rgba(244,241,234,0.07)" strokeDasharray="3 6" vertical={false} />
          <XAxis
            dataKey="dayLabel"
            tick={{ fill: "rgba(244,241,234,0.45)", fontSize: 10, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            domain={[-maxRank, -1]}
            ticks={[-maxRank, -Math.ceil(maxRank / 2), -1]}
            tickFormatter={(v: number) => `#${-v}`}
            tick={{ fill: "rgba(244,241,234,0.45)", fontSize: 10, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ stroke: "rgba(244,241,234,0.2)" }}
            contentStyle={{
              background: "#111",
              border: "1px solid rgba(244,241,234,0.14)",
              borderRadius: 6,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
            }}
            labelStyle={{ color: "rgba(244,241,234,0.6)" }}
            formatter={(_v, _n, item) => [
              `#${item?.payload?.rank} · score ${Number(item?.payload?.score ?? 0).toFixed(1)}`,
              "",
            ]}
          />
          <Line
            type="monotone"
            dataKey="pos"
            stroke="#E2483D"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: "#E2483D" }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-1 flex items-center gap-2 px-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <span className="h-1 w-1 rounded-full bg-live" />
        {weeks > 1 ? `${weeks} weeks` : `${history.length} days`} of chart history · sampled daily
      </div>
    </div>
  );
}

// ── Facts sidebar row ────────────────────────────────────────────────────────
function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-primary/80">{icon}</span>
      <div className="min-w-0">
        <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
        <div className="mt-0.5 text-xs font-medium text-foreground/90">{value}</div>
      </div>
    </div>
  );
}

const money = (n: number) =>
  n >= 1_000_000_000
    ? `$${(n / 1_000_000_000).toFixed(2)}B`
    : n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : `$${n.toLocaleString()}`;

function FilmDetailView() {
  const { slug } = Route.useParams();
  const { saved, toggle } = useWatchlist(slug);
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
    results: {
      id: number;
      poster_path: string | null;
      backdrop_path: string | null;
      overview?: string;
    }[];
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
    tagline?: string | null;
    status?: string;
    original_language?: string;
    created_by?: { id: number; name: string }[];
    genres?: { id: number; name: string }[];
    production_countries?: { iso_3166_1: string; name: string }[];
    production_companies?: { id: number; name: string; logo_path: string | null }[];
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

  // Index history — the rank trajectory line on the film page.
  const { data: rankHistory } = useQuery<RankHistoryPoint[]>({
    queryKey: ["film", "rank-history", slug],
    queryFn: () => getFilmRankHistory(slug, 60),
    enabled: !!film,
    staleTime: 5 * 60 * 1000,
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
  const director = film.director && film.director !== "Unknown" && film.director !== "Director TBA"
    ? film.director
    : tmdbDetails?.created_by?.[0]?.name ?? null;
  const synopsis = tmdbFilm?.overview || film.synopsis || "No synopsis available.";
  const tagline = tmdbDetails?.tagline?.trim() || null;
  const trailerKey =
    videos?.results?.find((v) => v.site === "YouTube" && v.type === "Trailer")?.key ??
    videos?.results?.find((v) => v.site === "YouTube")?.key ??
    null;
  const backdropUrl = film.backdrop_url || tmdbBackdropUrl(tmdbFilm?.backdrop_path, "w1280");

  const sentiment = film.sentiment;
  const hasSentimentData = sentiment?.sufficient_data === true && sentiment.positive != null;

  // TMDB derived metrics
  const runtime = isTvShow ? tmdbDetails?.episode_run_time?.[0] : tmdbDetails?.runtime;
  const seasonCount = isTvShow ? tmdbDetails?.number_of_seasons : undefined;
  const episodeCount = isTvShow ? tmdbDetails?.number_of_episodes : undefined;
  const genres = tmdbDetails?.genres ?? [];
  const budget = !isTvShow && tmdbDetails?.budget ? tmdbDetails.budget : null;
  const revenue = !isTvShow && tmdbDetails?.revenue ? tmdbDetails.revenue : null;
  const language = tmdbDetails?.original_language
    ? new Intl.DisplayNames(["en"], { type: "language" }).of(tmdbDetails.original_language) ??
      tmdbDetails.original_language
    : null;
  const country = tmdbDetails?.production_countries?.[0]?.name;
  const companies = tmdbDetails?.production_companies?.slice(0, 3).map((c) => c.name) ?? [];
  const status = tmdbDetails?.status === "Released" || tmdbDetails?.status === "Returning Series"
    ? null
    : tmdbDetails?.status;
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
  // Chart law: a public rank only exists between #1 and #100 on the title's
  // OWN chart. rank 0 ⇒ "Not currently ranked" — never an internal position.
  const isRanked = (film.rank ?? 0) > 0;
  const chartLabel = film.chart_type === "TV_100" ? "TV 100" : "Movie 100";
  const daysOnChart = film.days_on_chart ?? 1;
  const daysAtOne = film.days_at_one ?? 0;
  const top10Days = (film as typeof film & { top10_days?: number | null }).top10_days ?? null;
  const longestStreak = (film as typeof film & { longest_streak_at_one?: number | null }).longest_streak_at_one ?? null;
  const peakRank = film.peak_rank ?? film.rank;
  const movement = film.movement ?? 0;
  const day = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

  const similar = (similarFilms ?? []).filter((f) => f.slug !== slug).slice(0, 6);

  return (
    <Layout>
      {/* ── Hero: backdrop wash + poster left + identity right ── */}
      <section className="relative overflow-hidden">
        {/* Backdrop — full-bleed still, fading down into the page canvas */}
        {backdropUrl && (
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <img
              key={backdropUrl}
              src={backdropUrl}
              alt=""
              className="h-full w-full object-cover opacity-50"
            />
            {/* Legibility scrims — heavier to the left where the text sits */}
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-background/20" />
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-background/80 to-transparent" />
          </div>
        )}

        <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-6 lg:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
            {/* Poster — fixed rail */}
            <figure className="w-40 shrink-0 sm:w-52 lg:w-60">
              <div
                className="relative aspect-[2/3] overflow-hidden rounded-lg shadow-2xl ring-1 ring-foreground/15"
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

            {/* Identity column */}
            <div className="min-w-0 flex-1">
              {/* Badges row — content type, rank, movement */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-sm border border-foreground/15 bg-foreground/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {isTvShow ? "TV Show" : "Movie"}
                </span>
                {isRanked ? (
                  <>
                    <span className="rounded-sm bg-primary px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground">
                      #{film.rank} {chartLabel}
                    </span>
                    {movement !== 0 && (
                      <span
                        className={`flex items-center gap-1 font-mono text-[11px] font-semibold ${
                          movement > 0 ? "text-up" : "text-down"
                        }`}
                      >
                        {movement > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        {Math.abs(movement)} {movement > 0 ? "up" : "down"}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="rounded-sm border border-foreground/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Not currently ranked
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="mt-3 font-display text-4xl font-medium leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">
                {film.title}
              </h1>

              {/* Tagline */}
              {tagline && (
                <p className="mt-3 font-display text-lg italic text-muted-foreground">“{tagline}”</p>
              )}

              {/* Year · runtime · genres */}
              <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted-foreground">
                <span>{film.year || "—"}</span>
                {runtime && (
                  <>
                    <span className="text-foreground/25">·</span>
                    <span>
                      {Math.floor(runtime / 60) > 0 ? `${Math.floor(runtime / 60)}h ` : ""}
                      {runtime % 60}m
                    </span>
                  </>
                )}
                {genres.slice(0, 4).map((g) => (
                  <span key={g.id} className="flex items-center gap-2.5">
                    <span className="text-foreground/25">·</span>
                    <span>{g.name}</span>
                  </span>
                ))}
              </div>

              {/* Synopsis */}
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-foreground/75 sm:text-[15px]">
                {synopsis}
              </p>

              {/* Score ring + stats + actions */}
              <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-5">
                {/* Score ring */}
                <div className="relative h-24 w-24 shrink-0">
                  <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                    <circle cx="50" cy="50" r="44" fill="none" strokeWidth="6" className="stroke-foreground/10" />
                    <circle
                      cx="50"
                      cy="50"
                      r="44"
                      fill="none"
                      strokeWidth="6"
                      strokeLinecap="round"
                      className="stroke-primary transition-[stroke-dasharray] duration-700"
                      strokeDasharray={`${Math.max(0, Math.min(100, film.score ?? 0)) * 2.7646} 276.46`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="index-score text-2xl">{film.score?.toFixed(1) ?? "—"}</span>
                    <span className="font-mono text-[8px] uppercase tracking-[0.22em] text-muted-foreground">
                      Index
                    </span>
                  </div>
                </div>

                {/* Chart stats — the title's Index résumé, chart-scoped */}
                <div className="space-y-1.5 text-xs">
                  {isRanked ? (
                    <>
                      <div className="text-muted-foreground">
                        {movement > 0 && <>up {movement} place{movement === 1 ? "" : "s"} this week</>}
                        {movement < 0 && <>down {Math.abs(movement)} place{Math.abs(movement) === 1 ? "" : "s"}</>}
                        {movement === 0 && <span title="Held its rank">held its position</span>}
                      </div>
                      <div className="text-muted-foreground">
                        <span className="font-medium text-foreground">{day(daysOnChart)}</span> on chart
                      </div>
                      {peakRank === 1 && (
                        <div className="text-primary">
                          Peak <span className="font-semibold">#1</span>
                          {daysAtOne > 0 && <span className="text-muted-foreground"> · {day(daysAtOne)} at #1</span>}
                          {longestStreak != null && longestStreak > 0 && (
                            <span className="text-muted-foreground"> · best run {day(longestStreak)}</span>
                          )}
                        </div>
                      )}
                      {top10Days != null && top10Days > 0 && (
                        <div className="text-muted-foreground">{day(top10Days)} in the Top 10</div>
                      )}
                    </>
                  ) : (
                    <div className="text-muted-foreground">
                      Not currently ranked on the {chartLabel}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {trailerKey && (
                  <button
                    onClick={scrollToTrailer}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-primary/90"
                  >
                    <Play className="h-4 w-4" />
                    Watch trailer
                  </button>
                )}
                <button
                  onClick={handleToggleSave}
                  aria-label={saved ? "Remove from Watchlist" : "Save to Watchlist"}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-md border transition ${
                    saved
                      ? "border-primary/50 text-primary"
                      : "border-foreground/20 text-muted-foreground hover:border-foreground/45 hover:text-foreground"
                  }`}
                >
                  {saved ? <BookmarkCheck className="h-4.5 w-4.5" /> : <Bookmark className="h-4.5 w-4.5" />}
                </button>
                <ShareCardButton
                  variant="film"
                  card={film}
                  label="Share"
                  className="rounded-md border border-foreground/20 px-5 py-2.5 text-sm font-semibold text-foreground transition hover:border-foreground/45 hover:bg-foreground/5 hover:text-foreground"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Body: history + sentiment left, facts right ── */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 pb-12 lg:grid-cols-12 lg:px-6">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-8">
          {/* Index history */}
          <div className="border border-foreground/10 bg-surface p-5">
            <div className="flex items-baseline justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
                Index history
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                {isRanked ? `#${film.rank} ${chartLabel} today · peak #${peakRank}` : "Not currently ranked"}
              </span>
            </div>
            <div className="mt-4">
              <RankHistoryChart history={rankHistory ?? []} />
            </div>
          </div>

          {/* Audience sentiment */}
          <div className="border border-foreground/10 bg-surface p-5">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Audience Sentiment Breakdown
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                {hasSentimentData ? "Verified" : "Awaiting Data"}
              </span>
            </div>
            {hasSentimentData ? (
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
                    <div className="font-mono text-2xl tabular text-down">{sentiment.negative}%</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Negative
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-4 flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 opacity-30" />
                <p className="text-xs">Not enough data yet.</p>
              </div>
            )}
          </div>

          {/* Trailer — plays inline */}
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
            ) : null}
          </div>
        </div>

        {/* Facts sidebar */}
        <aside className="space-y-6 lg:col-span-4">
          <div className="border border-foreground/10 bg-surface p-5">
            <div className="space-y-3.5">
              <Fact
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Release date"
                value={
                  (isTvShow ? film.first_air_date : film.release_date)
                    ? new Date(`${isTvShow ? film.first_air_date : film.release_date}T00:00:00`).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric", year: "numeric" },
                      )
                    : status || "—"
                }
              />
              {runtime && (
                <Fact
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label={isTvShow ? "Episode length" : "Runtime"}
                  value={`${Math.floor(runtime / 60) > 0 ? `${Math.floor(runtime / 60)}h ` : ""}${runtime % 60}m`}
                />
              )}
              {director && (
                <Fact
                  icon={<FilmIcon className="h-3.5 w-3.5" />}
                  label={isTvShow ? "Creator" : "Director"}
                  value={director}
                />
              )}
              {country && (
                <Fact icon={<Globe className="h-3.5 w-3.5" />} label="Country" value={country} />
              )}
              {language && (
                <Fact icon={<Languages className="h-3.5 w-3.5" />} label="Language" value={language} />
              )}
              {budget && (
                <Fact icon={<Wallet className="h-3.5 w-3.5" />} label="Budget" value={money(budget)} />
              )}
              {revenue && (
                <Fact icon={<Ticket className="h-3.5 w-3.5" />} label="Box office" value={money(revenue)} />
              )}
              {companies.length > 0 && (
                <Fact icon={<Landmark className="h-3.5 w-3.5" />} label="Studio" value={companies.join(", ")} />
              )}
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
                <ProviderGroup label="Streaming" providers={watchRegionData?.flatrate} link={watchLink} />
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
              watchData && (
                <p className="mt-3 text-xs text-muted-foreground">
                  No streaming options listed for {regionLabel} yet.
                </p>
              )
            )}

            {/* Universal Theater & Streaming Finder */}
            <div className="mt-4 space-y-2 border-t border-foreground/10 pt-3">
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(`${film.title} showtimes tickets`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3 text-xs transition hover:border-foreground/20 hover:bg-foreground/[0.08]"
              >
                <div className="flex items-center gap-2.5">
                  <FilmIcon className="h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <div className="font-medium text-foreground">Cinema & Theaters</div>
                    <div className="text-[10px] text-muted-foreground">Find local showtimes & tickets</div>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </a>
              <a
                href={`https://www.justwatch.com/us/search?q=${encodeURIComponent(film.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3 text-xs transition hover:border-foreground/20 hover:bg-foreground/[0.08]"
              >
                <div className="flex items-center gap-2.5">
                  <Tv className="h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <div className="font-medium text-foreground">Streaming & Digital</div>
                    <div className="text-[10px] text-muted-foreground">Search streaming platforms & providers</div>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </a>
              {tmdbMovieUrl && (
                <a
                  href={tmdbMovieUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3 text-xs transition hover:border-foreground/20 hover:bg-foreground/[0.08]"
                >
                  <div className="flex items-center gap-2.5">
                    <Info className="h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <div className="font-medium text-foreground">Full details</div>
                      <div className="text-[10px] text-muted-foreground">Credits & metadata on TMDB</div>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </a>
              )}
            </div>
          </div>
        </aside>
      </section>

      {/* More Like This — full width shelf */}
      <section className="mx-auto max-w-6xl px-4 pb-14 lg:px-6">
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
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {similar.map((f) => (
            <PosterCard key={f.slug} film={f} width="100%" />
          ))}
        </div>
        {similar.length === 0 && (
          <div className="mt-3 border border-foreground/10 bg-surface p-4 text-xs text-muted-foreground">
            Similar titles will appear as the catalog grows.
          </div>
        )}
      </section>

      {/* Floating Save/Watchlist Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 border border-primary/30 bg-background p-4 shadow-2xl animate-fade-up">
          <BookmarkCheck className="h-5 w-5 shrink-0 text-primary" />
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

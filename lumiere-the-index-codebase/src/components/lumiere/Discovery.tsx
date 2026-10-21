import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import {
  getMetaRefresh,
  getTopFilms,
  getTrendingFilms,
  getWeeklyTop100,
  type RankedFilm,
  type TrendingFilmOut,
  type WeeklyEntry,
} from "@/lib/apiClient";
import { RankRow, SectionHeading } from "./Ranking";
import { FilmPosterThumbnail } from "./FilmPosterThumbnail";
import { ShareCardButton } from "./ShareCardButton";
import { MomentumInline, MomentumMark } from "./Momentum";
import { ListSkeleton, FilmCardSkeleton, Skeleton } from "./Skeletons";
import { ChartsUnavailable } from "./Hero";
import { ArrowRight, Film, Tv } from "lucide-react";

/* ── Discovery opening ──────────────────────────────────────────────────────
   A compact editorial strip that names the discovery context and carries the
   real live clock. It replaces the oversized hero: the first artwork appears
   immediately below it, not a full-viewport backdrop. */

export function HomeIntro() {
  const { data: refresh } = useQuery({
    queryKey: ["meta", "refresh"],
    queryFn: () => getMetaRefresh(),
    staleTime: 60 * 1000,
  });

  // The clock renders only after mount: a local-timezone format can differ
  // between server and browser, which would flash a hydration mismatch.
  const [clock, setClock] = useState(false);
  useEffect(() => {
    if (refresh?.next_refresh_at) setClock(true);
  }, [refresh?.next_refresh_at]);

  return (
    <section className="px-4 pt-5 sm:px-6" aria-label="What is happening on The Index">
      <div className="mx-auto flex max-w-[90rem] flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            The Index
          </div>
          <h1 className="mt-1.5 font-display text-2xl font-medium leading-tight sm:text-3xl lg:text-4xl">
            What&rsquo;s happening across film and TV
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Rankings, movers and new entries: what the culture is paying
            attention to right now.
          </p>
        </div>
        <span className="mb-1 inline-flex shrink-0 items-center gap-2 border border-foreground/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-forest-deep" aria-hidden />
          Live
          {clock && refresh?.next_refresh_at && (
            <span title="Next chart refresh">
              {new Date(refresh.next_refresh_at).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </span>
      </div>
    </section>
  );
}

/* ── Trending rail ──────────────────────────────────────────────────────────
   Horizontally scrollable, snap-to-grid poster cards straight from the same
   /trending endpoint /trending serves (title, year, measured rank, reason).
   Never-found data degrades to an honest empty line — no fake titles. */

function TrendingPosterCard({ film }: { film: TrendingFilmOut }) {
  const gradient = `linear-gradient(155deg, ${film.gradient_from ?? "#333"}, ${film.gradient_to ?? "#111"})`;
  return (
    <Link
      to="/films/$slug"
      params={{ slug: film.film_slug }}
      className="group relative block w-[124px] shrink-0 snap-start sm:w-[152px]"
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-ink" style={{ background: gradient }}>
        {film.poster_url && (
          <img
            src={film.poster_url}
            alt={film.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
            decoding="async"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
        {/* The trending rank is the same measured rank the /trending page shows. */}
        <div className="absolute left-1.5 top-1.5 bg-black/70 px-1.5 py-1 font-mono text-[11px] font-semibold leading-none text-cream/90">
          {String(film.rank).padStart(2, "0")}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-2.5">
          <div className="truncate font-display text-sm font-semibold text-white">
            {film.title}
          </div>
          <div className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.12em] text-white/70">
            {film.trend_reason}
          </div>
        </div>
      </div>
    </Link>
  );
}

function RailControls({ scrollLeft, scrollRight }: { scrollLeft: () => void; scrollRight: () => void }) {
  return (
    <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
      <button
        type="button"
        onClick={scrollLeft}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/15 text-muted-foreground transition hover:border-foreground/35 hover:text-foreground"
        aria-label="Scroll trending left"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={scrollRight}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/15 text-muted-foreground transition hover:border-foreground/35 hover:text-foreground"
        aria-label="Scroll trending right"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function TrendingRail() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["trending", "home", 12],
    queryFn: () => getTrendingFilms(12),
    staleTime: 5 * 60 * 1000,
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const distance = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({ left: direction === "left" ? -distance : distance, behavior: "smooth" });
  };

  const films = data ?? [];

  return (
    <section className="px-4 pt-8 lg:px-6">
      <div className="mx-auto max-w-[90rem]">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              In discussion
            </div>
            <h2 className="mt-0.5 font-display text-xl font-medium">Trending now</h2>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <Link
              to="/trending"
              className="text-[13px] font-medium text-muted-foreground transition hover:text-foreground"
            >
              All trending →
            </Link>
            <RailControls
              scrollLeft={() => scroll("left")}
              scrollRight={() => scroll("right")}
            />
          </div>
        </div>
        {error ? (
          <div className="border border-foreground/10 bg-surface px-4 py-6 text-center text-sm text-muted-foreground">
            Unable to load trending titles right now.{" "}
            <button
              type="button"
              onClick={() => void refetch()}
              className="underline underline-offset-2 hover:text-foreground"
            >
              Retry
            </button>
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 pt-1 scroll-smooth sm:-mx-6 sm:px-6"
          >
            {isLoading
              ? [...Array(8)].map((_, i) => <FilmCardSkeleton key={i} />)
              : films.map((film) => <TrendingPosterCard key={film.film_slug} film={film} />)}
            {!isLoading && films.length === 0 && (
              <div className="flex h-40 w-full items-center justify-center border border-dashed border-foreground/10 text-xs text-muted-foreground">
                Nothing is trending yet. Check back after the next chart refresh.
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Today's Index ──────────────────────────────────────────────────────────
   The official rankings stay central: one chart section with compact tabs —
   Movie 100 / TV 100 / Weekly 100 — and the leading titles of each. Every
   tab owns its query and its failure: a broken chart never takes the
   homepage down. Weekly may still be un-published while the backend backlog
   clears, so it carries its own honest empty state. */

type TabId = "movie" | "tv" | "weekly";

const TAB_META: Record<TabId, { label: string; href: string; fullLabel: string }> = {
  movie: { label: "Movie 100", href: "/top-100", fullLabel: "Full Movie 100" },
  tv: { label: "TV 100", href: "/tv-100", fullLabel: "Full TV 100" },
  weekly: { label: "Weekly 100", href: "/weekly-100", fullLabel: "Full Weekly 100" },
};

/** Render a published WeeklyEntry with the same RankRow language as the daily
 *  charts. Movement and "New" stay honest per-chart: rank_delta versus the
 *  previous week, previous_week_rank null = first week on the chart. */
function weeklyToRanked(entry: WeeklyEntry): RankedFilm {
  return {
    id: entry.film_id,
    slug: entry.slug,
    title: entry.title,
    content_type:
      entry.content_type === "TV_SHOW" ? ("TV_SHOW" as const) : ("MOVIE" as const),
    director: entry.director,
    year: entry.year,
    country_origin: null,
    poster_url: entry.poster_url,
    backdrop_url: entry.backdrop_url ?? null,
    synopsis: null,
    gradient_from: entry.gradient_from,
    gradient_to: entry.gradient_to,
    release_date: null,
    first_air_date: null,
    rank: entry.rank,
    score: entry.score,
    prev_rank: entry.previous_week_rank,
    movement: entry.rank_delta,
    peak_rank: entry.peak_daily_rank ?? null,
    weeks_on_chart: null,
    momentum: entry.momentum,
    chart_type: entry.content_type === "TV_SHOW" ? "TV_100" : "MOVIE_100",
    mentions_total: entry.total_signal_volume,
    genre_tag: null,
    tmdb_id: null,
    is_upcoming: undefined,
  };
}

function WeeklyTypeChip({ type }: { type: WeeklyEntry["content_type"] }) {
  const isTv = type === "TV_SHOW";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] ${
        isTv ? "bg-cream/15 text-cream" : "bg-cream text-ink"
      }`}
    >
      {isTv ? <Tv className="h-2.5 w-2.5" /> : <Film className="h-2.5 w-2.5" />}
      {isTv ? "TV" : "Movie"}
    </span>
  );
}

export function TodaysIndex() {
  const [tab, setTab] = useState<TabId>("movie");

  const movie = useQuery({
    // Same key + window the loader prefetches: the home page renders the top
    // of the chart only, so it fetches ten titles instead of the full 100.
    queryKey: ["films", "top", 10],
    queryFn: () => getTopFilms(10),
    staleTime: 5 * 60 * 1000,
  });
  const tv = useQuery({
    queryKey: ["films", "tv100", 10],
    queryFn: () => getTopFilms(10, 0, "TV_100"),
    staleTime: 5 * 60 * 1000,
  });
  const weekly = useQuery({
    queryKey: ["weekly", "top100"],
    queryFn: () => getWeeklyTop100(),
    staleTime: 10 * 60 * 1000,
  });

  const weeklyEntries = weekly.data?.entries ?? [];
  const top10 = (movie.data ?? []).slice(0, 10);
  const tvTop = (tv.data ?? []).slice(0, 10);

  const state = {
    movie: { isLoading: movie.isLoading, error: movie.error, refetch: movie.refetch },
    tv: { isLoading: tv.isLoading, error: tv.error, refetch: tv.refetch },
    weekly: { isLoading: weekly.isLoading, error: weekly.error, refetch: weekly.refetch },
  }[tab];

  const current = TAB_META[tab];

  return (
    <section className="px-4 pt-12 sm:px-6" id="todays-index">
      <div className="mx-auto max-w-[90rem]">
        <SectionHeading
          kicker="The Index · updated every 12 hours"
          title="Today&rsquo;s Index"
          copy={"The official rankings. Rank is position on the chart; movement is the change since the previous publish."}
          seeAllHref={current.href}
          seeAllLabel={current.fullLabel}
          action={
            tab !== "weekly" ? (
              <ShareCardButton
                variant="chart"
                card={{
                  title:
                    tab === "movie"
                      ? "Movie 100 · Top 10"
                      : "TV 100 · Top 10",
                  subtitle:
                    tab === "movie"
                      ? "The films generating the strongest measured cultural momentum today."
                      : "The series generating the strongest measured cultural momentum today.",
                  films: tab === "movie" ? top10 : tvTop,
                }}
              />
            ) : undefined
          }
        />

        {/* Compact chart tabs */}
        <div
          role="tablist"
          aria-label="Official charts"
          className="mb-4 flex items-center gap-1 border-b border-foreground/10"
        >
          {(Object.keys(TAB_META) as TabId[]).map((id) => {
            const active = tab === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={`relative -mb-px flex h-10 items-center gap-1.5 border-b-2 px-3.5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors sm:px-4 ${
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {TAB_META[id].label}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`panel-${tab}`}
          aria-label={`Today's Index · ${current.label}`}
          className="border-y border-foreground/10"
        >
          {state.isLoading ? (
            <ul className="divide-y divide-foreground/[0.06]">
              <ListSkeleton rows={8} />
            </ul>
          ) : state.error ? (
            <div className="p-1">
              <ChartsUnavailable onRetry={() => void state.refetch()} />
            </div>
          ) : tab === "weekly" ? (
            weeklyEntries.length > 0 ? (
              <ul className="divide-y divide-foreground/[0.06]">
                {weeklyEntries.slice(0, 8).map((entry) => (
                  <li key={entry.slug}>
                    <Link
                      to="/films/$slug"
                      params={{ slug: entry.slug }}
                      className="group flex items-center gap-3 py-3 transition-colors hover:bg-foreground/[0.03] sm:gap-4 sm:py-3.5"
                    >
                      <span className="w-7 shrink-0 font-mono text-lg tabular text-muted-foreground sm:w-8 sm:text-xl">
                        {String(entry.rank).padStart(2, "0")}
                      </span>
                      <FilmPosterThumbnail film={entry} className="h-16 w-11 sm:h-[72px] sm:w-12" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[15px] font-medium leading-snug text-foreground sm:text-base">
                            {entry.title}
                          </span>
                          <WeeklyTypeChip type={entry.content_type} />
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 truncate text-xs text-muted-foreground sm:text-[13px]">
                          <span className="truncate">
                            {[entry.director, entry.year].filter(Boolean).join(" · ")}
                          </span>
                          <MomentumInline state={entry.momentum} />
                        </div>
                      </div>
                      <div className="w-12 shrink-0 sm:w-14">
                        {entry.previous_week_rank == null ? (
                          <span
                            className="inline-block rounded-sm bg-foreground/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-foreground"
                            title="First week on the Weekly 100"
                          >
                            New
                          </span>
                        ) : entry.rank_delta !== 0 ? (
                          <span
                            className={`flex items-center gap-0.5 font-mono text-xs tabular ${
                              entry.rank_delta > 0 ? "text-up" : "text-down"
                            }`}
                            title={
                              entry.rank_delta > 0
                                ? `Up ${entry.rank_delta} since last week`
                                : `Down ${Math.abs(entry.rank_delta)} since last week`
                            }
                          >
                            {entry.rank_delta > 0 ? (
                              <ArrowUp className="h-3 w-3" aria-hidden />
                            ) : (
                              <ArrowDown className="h-3 w-3" aria-hidden />
                            )}
                            {Math.abs(entry.rank_delta)}
                          </span>
                        ) : (
                          <span className="font-mono text-sm text-muted-foreground" title="Held its rank">
                            —
                          </span>
                        )}
                      </div>
                      <div className="hidden w-24 shrink-0 text-right sm:block">
                        <MomentumMark state={entry.momentum} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-1 py-8 text-sm text-muted-foreground">
                The weekly chart is being prepared for this week. Past weeks are
                on the{" "}
                <Link to="/weekly-100" className="underline underline-offset-2 hover:text-foreground">
                  full Weekly 100
                </Link>{" "}
                page.
              </p>
            )
          ) : (
            <ul className="divide-y divide-foreground/[0.06]">
              {(tab === "movie" ? top10 : tvTop).map((f) => (
                <li key={f.slug}>
                  <RankRow film={f} />
                </li>
              ))}
              {(tab === "movie" ? top10 : tvTop).length === 0 && (
                <li className="px-1 py-8 text-sm text-muted-foreground">
                  The chart is being prepared. Check back after the next refresh.
                </li>
              )}
            </ul>
          )}
        </div>

        {/* The leader context line — one quiet sentence of editorial framing. */}
        <div className="mt-3 hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
          <ArrowRight className="h-3 w-3" aria-hidden />
          <span>
            {tab === "weekly"
              ? "Weekly 100 rewards sustained performance all week over a one-day spike."
              : tab === "movie"
                ? "A public rank exists only between #1 and #100."
                : "TV shows rank on their own chart, separate from films."}
          </span>
        </div>
      </div>
    </section>
  );
}

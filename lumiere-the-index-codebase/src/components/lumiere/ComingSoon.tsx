import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getNewEntries,
  getNowPlayingReleases,
  getUpcomingReleases,
  tmdbPosterUrl,
  type RankedFilm,
  type ReleaseMovie,
} from "@/lib/apiClient";
import { slugify } from "@/lib/utils";
import { Skeleton } from "./Skeletons";

/** TMDB pages to merge for the release calendar. Five pages cover the next
 *  few weeks of releases - the daily columns need that reach to read as a
 *  calendar rather than a single film. */
const UPCOMING_PAGES = 5;
const NOW_PLAYING_PAGES = 2;
/** How far ahead the day columns reach. */
const HORIZON_DAYS = 45;

type Tab = "coming" | "theaters" | "index";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Weekday and month/day for a "YYYY-MM-DD" release date.
 *
 * Pure calendar maths on the date parts - no Date parsing, no timezone - so
 * the server and the browser always render the same label. A local-timezone
 * parse would put a release on a different weekday for viewers in another
 * zone, which would break the hydrated markup.
 */
function formatDay(date: string): { weekday: string; label: string } {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return { weekday, label: `${MONTHS[month - 1]} ${day}` };
}

/** Today's calendar date, in UTC so the server and the browser agree. */
function utcTodayKey(): string {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}-${day}`;
}

/** Whole days between two "YYYY-MM-DD" dates. */
function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

interface DayColumn {
  date: string;
  weekday: string;
  label: string;
  movies: ReleaseMovie[];
}

/** A single release poster - poster first, title underneath, the way a
 *  release calendar reads. The footnote is optional: the day column already
 *  carries the date, so it only appears where the date adds something. */
function PosterTile({ movie, footnote }: { movie: ReleaseMovie; footnote?: string }) {
  const poster = tmdbPosterUrl(movie.poster_path, "w342");
  return (
    <Link
      to="/films/$slug"
      params={{ slug: slugify(movie.title) }}
      aria-label={footnote ? `${movie.title}, ${footnote}` : movie.title}
      className="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-ink ring-1 ring-foreground/10">
        {poster ? (
          <img
            src={poster}
            alt=""
            role="presentation"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transform-none"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-2 text-center font-display text-[10px] leading-tight text-cream/80">
            {movie.title}
          </div>
        )}
      </div>
      <div
        className="mt-1.5 truncate text-[13px] font-medium leading-snug transition-colors group-hover:text-primary"
        title={movie.title}
      >
        {movie.title}
      </div>
      {footnote ? (
        <div className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {footnote}
        </div>
      ) : null}
    </Link>
  );
}

/** A poster for a title the Index itself tracks - real slugs, real pages. */
function TrackedTile({ film }: { film: RankedFilm }) {
  return (
    <Link
      to="/films/$slug"
      params={{ slug: film.slug }}
      aria-label={`${film.title}, tracked on the Index`}
      className="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-ink ring-1 ring-foreground/10">
        {film.poster_url ? (
          <img
            src={film.poster_url}
            alt=""
            role="presentation"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transform-none"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-2 text-center font-display text-[10px] leading-tight text-cream/80">
            {film.title}
          </div>
        )}
      </div>
      <div
        className="mt-1.5 truncate text-[13px] font-medium leading-snug transition-colors group-hover:text-primary"
        title={film.title}
      >
        {film.title}
      </div>
      <div className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {film.release_date ? formatDay(film.release_date).label : "Date TBA"}
      </div>
    </Link>
  );
}

/**
 * Coming Soon - the release calendar, organised by day.
 *
 * Three tabs, all backed by real data:
 *   "Coming soon"  - the TMDB release calendar, grouped into day columns.
 *   "In theaters"   - what is playing right now.
 *   "On the Index"  - titles the Index is already tracking before release.
 */
export function ComingSoon() {
  const [tab, setTab] = useState<Tab>("coming");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const { data: upcoming, isLoading: upcomingLoading } = useQuery({
    queryKey: ["tmdb", "releases", "upcoming", UPCOMING_PAGES],
    queryFn: () => getUpcomingReleases(UPCOMING_PAGES),
    staleTime: 60 * 60 * 1000,
  });

  const { data: nowPlaying, isLoading: playingLoading } = useQuery({
    queryKey: ["tmdb", "releases", "now_playing", NOW_PLAYING_PAGES],
    queryFn: () => getNowPlayingReleases(NOW_PLAYING_PAGES),
    staleTime: 60 * 60 * 1000,
  });

  const { data: tracked, isLoading: trackedLoading } = useQuery({
    queryKey: ["films", "new-entries"],
    queryFn: () => getNewEntries(),
    staleTime: 5 * 60 * 1000,
  });

  const todayKey = useMemo(() => utcTodayKey(), []);

  /** The day columns: upcoming releases grouped by release date, soonest
   *  first, capped at the horizon. Days without a release never appear. */
  const columns = useMemo<DayColumn[]>(() => {
    const groups = new Map<string, ReleaseMovie[]>();
    for (const movie of upcoming ?? []) {
      if (!movie.release_date) continue;
      if (movie.release_date < todayKey) continue;
      if (daysBetween(todayKey, movie.release_date) > HORIZON_DAYS) continue;
      const bucket = groups.get(movie.release_date);
      if (bucket) bucket.push(movie);
      else groups.set(movie.release_date, [movie]);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, movies]) => ({
        date,
        ...formatDay(date),
        movies: movies.sort((a, b) => a.title.localeCompare(b.title)),
      }));
  }, [upcoming, todayKey]);

  // The active column follows the selection, but never points at a day that
  // no longer exists.
  const activeDate = columns.some((c) => c.date === selectedDate)
    ? (selectedDate as string)
    : (columns[0]?.date ?? null);

  // Bring a day column into view - horizontally only. scrollIntoView would
  // also move the page itself, which is never what a column pick wants.
  const scrollToDate = (date: string) => {
    const container = scrollerRef.current;
    const node = columnRefs.current[date];
    if (!container || !node) return;
    const target = node.offsetLeft - (container.clientWidth - node.clientWidth) / 2;
    container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  };

  const scrollColumns = (direction: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const distance = el.clientWidth * 0.8;
    el.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  };

  const theaters = useMemo(
    () =>
      (nowPlaying ?? [])
        .filter((m) => m.release_date)
        .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0)),
    [nowPlaying],
  );

  const trackedUpcoming = useMemo(
    () =>
      (tracked ?? [])
        .filter((f) => f.release_date && f.release_date >= todayKey)
        .sort((a, b) => (a.release_date ?? "").localeCompare(b.release_date ?? "")),
    [tracked, todayKey],
  );

  const isLoading =
    tab === "coming" ? upcomingLoading : tab === "theaters" ? playingLoading : trackedLoading;

  const tabs: { id: Tab; label: string }[] = [
    { id: "coming", label: "Coming soon" },
    { id: "theaters", label: "In theaters" },
    { id: "index", label: "On the Index" },
  ];

  /** A quiet count of what is actually on offer - honest scale, no hype. */
  const summary =
    tab === "coming"
      ? `${columns.reduce((sum, c) => sum + c.movies.length, 0)} releases across ${columns.length} ${
          columns.length === 1 ? "day" : "days"
        }`
      : tab === "theaters"
        ? `${theaters.length} titles in theaters`
        : `${trackedUpcoming.length} titles tracked before release`;

  return (
    <section className="px-4 pt-12 sm:px-6" aria-label="Coming soon">
      <div className="mx-auto max-w-6xl">
        {/* Section header - same editorial grammar as every other section. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
              Now &amp; Next
            </div>
            <h2 className="mt-1.5 font-display text-2xl font-medium leading-tight sm:text-3xl">
              Coming Soon
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The release calendar ahead - what lands, and when.
            </p>
          </div>
          <Link
            to="/calendar"
            className="shrink-0 text-[13px] font-medium text-muted-foreground transition hover:text-foreground"
          >
            Full calendar &rarr;
          </Link>
        </div>

        {/* Tabs */}
        <div
          className="mt-6 flex items-end gap-6 border-b border-foreground/10"
          role="tablist"
          aria-label="Release view"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`coming-soon-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`coming-soon-panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`relative -mb-px min-h-[44px] border-b-2 pb-2 pt-3 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                tab === t.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
          <span className="ml-auto hidden pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground lg:block">
            {summary}
          </span>
        </div>

        <div
          id={`coming-soon-panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`coming-soon-tab-${tab}`}
          className="pt-5"
        >
          {isLoading ? (
            <div className="space-y-4">
              <div className="flex gap-2 overflow-hidden">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-[104px] shrink-0" />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="aspect-[2/3] w-full" />
                ))}
              </div>
            </div>
          ) : tab === "coming" ? (
            columns.length > 0 ? (
              <div className="relative">
                <div
                  ref={scrollerRef}
                  className="no-scrollbar flex gap-2 overflow-x-auto pb-2 scroll-smooth motion-reduce:scroll-auto"
                >
                  {columns.map((column) => {
                    const isActive = column.date === activeDate;
                    return (
                      <div
                        key={column.date}
                        ref={(node) => {
                          columnRefs.current[column.date] = node;
                        }}
                        className="w-[132px] shrink-0 p-1.5"
                      >
                        {/* Day header - the selected day is the one red block. */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDate(column.date);
                            scrollToDate(column.date);
                          }}
                          aria-pressed={isActive}
                          aria-label={`${column.weekday} ${column.label}, ${column.movies.length} titles`}
                          className={`w-full rounded-sm px-2 py-2 text-left ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                            isActive
                              ? "bg-primary text-primary-foreground ring-primary"
                              : "bg-foreground/[0.03] text-foreground ring-foreground/10 hover:bg-foreground/[0.08] hover:ring-foreground/25"
                          }`}
                        >
                          <span className="block font-mono text-[10px] uppercase tracking-[0.16em] opacity-80">
                            {column.weekday}
                          </span>
                          <span className="mt-0.5 block font-display text-[15px] leading-none">
                            {column.label}
                          </span>
                          <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.14em] opacity-70">
                            {column.movies.length} {column.movies.length === 1 ? "title" : "titles"}
                          </span>
                        </button>

                        <div className="mt-2 space-y-3">
                          {column.movies.map((movie) => (
                            <PosterTile key={movie.id} movie={movie} footnote="" />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* A soft edge so the strip reads as continuing past the fold. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent"
                />

                {/* Scroll affordances for the day columns. They sit in the
                    page gutter on wide screens so they never cover a poster. */}
                <button
                  type="button"
                  onClick={() => scrollColumns("left")}
                  aria-label="Scroll earlier release dates"
                  className="absolute -left-3 top-0 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-foreground/15 bg-ink/90 text-muted-foreground transition hover:border-foreground/35 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:flex xl:-left-11"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => scrollColumns("right")}
                  aria-label="Scroll later release dates"
                  className="absolute -right-3 top-0 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-foreground/15 bg-ink/90 text-muted-foreground transition hover:border-foreground/35 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:flex xl:-right-11"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ) : (
              <p className="py-8 text-sm text-muted-foreground">
                The release calendar is being prepared. Check back shortly.
              </p>
            )
          ) : tab === "theaters" ? (
            theaters.length > 0 ? (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {theaters.map((movie) => (
                  <PosterTile key={movie.id} movie={movie} footnote="In theaters" />
                ))}
              </div>
            ) : (
              <p className="py-8 text-sm text-muted-foreground">
                No titles are listed in theaters right now.
              </p>
            )
          ) : trackedUpcoming.length > 0 ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {trackedUpcoming.map((film) => (
                <TrackedTile key={film.slug} film={film} />
              ))}
            </div>
          ) : (
            <p className="py-8 text-sm text-muted-foreground">
              No upcoming releases are tracked on the Index yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

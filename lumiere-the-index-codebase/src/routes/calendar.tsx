import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import {
  getTmdbUpcoming,
  getTmdbNowPlaying,
  getNewEntries,
  tmdbPosterUrl,
  type TmdbMovie,
} from "@/lib/apiClient";
import { slugify } from "@/lib/utils";
import { RouteError } from "@/lib/route-error";
import { Calendar as CalendarIcon, Filter, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/lumiere/Skeletons";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Now & Next — Lumière The Index" },
      {
        name: "description",
        content:
          "Movies in theaters and coming soon — films tracked on the Index, plus the full TMDB release calendar.",
      },
    ],
  }),
  component: CalendarPage,
  errorComponent: RouteError,
});

const UPCOMING_PAGES = 5;
const NOW_PLAYING_PAGES = 5;
/** "Now in theaters" only counts films released within this window — old re-releases never qualify. */
const THEATER_WINDOW_DAYS = 180;

function getDaysUntil(dateStr: string): { text: string; isPast: boolean } {
  if (!dateStr) return { text: "Date TBA", isPast: false };
  const target = new Date(dateStr).getTime();
  const today = new Date().setHours(0, 0, 0, 0);
  const diffTime = target - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: "Now In Theaters", isPast: true };
  if (diffDays === 0) return { text: "Releasing Today", isPast: false };
  if (diffDays === 1) return { text: "Tomorrow", isPast: false };
  if (diffDays <= 30)
    return { text: `In ${diffDays} ${diffDays === 1 ? "day" : "days"}`, isPast: false };
  const months = Math.round(diffDays / 30);
  return { text: `In ~${months} ${months === 1 ? "month" : "months"}`, isPast: false };
}

/** Fetch several TMDB pages and merge them into one deduped list. */
async function fetchPages<T>(
  fetchPage: (page: number) => Promise<{ results?: T[] }>,
  pages: number,
): Promise<T[]> {
  // Each page is fetched independently — a slow/failed page never empties the grid.
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      fetchPage(i + 1)
        .then((p) => p.results ?? [])
        .catch(() => [] as T[]),
    ),
  );
  return results.flat();
}

function CalendarPage() {
  const [filter, setFilter] = useState<"all" | "upcoming" | "theaters">("upcoming");

  const { data: upcoming, isLoading: upcomingLoading } = useQuery({
    queryKey: ["tmdb", "calendar", "upcoming", UPCOMING_PAGES],
    queryFn: () => fetchPages<TmdbMovie>((p) => getTmdbUpcoming(p), UPCOMING_PAGES),
    staleTime: 60 * 60 * 1000,
  });

  const { data: nowPlaying, isLoading: playingLoading } = useQuery({
    queryKey: ["tmdb", "calendar", "now_playing", NOW_PLAYING_PAGES],
    queryFn: () => fetchPages<TmdbMovie>((p) => getTmdbNowPlaying(p), NOW_PLAYING_PAGES),
    staleTime: 60 * 60 * 1000,
  });

  // Films the Index is tracking with a future release date (they link to real film pages).
  const { data: indexFilms } = useQuery({
    queryKey: ["films", "new-entries"],
    // Arrow wrapper — React Query passes its context object as the first arg.
    queryFn: () => getNewEntries(),
    staleTime: 5 * 60 * 1000,
  });
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - THEATER_WINDOW_DAYS);
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
  const indexUpcoming = (indexFilms ?? [])
    .filter((f) => f.release_date && f.release_date > todayStr)
    .sort((a, b) =>
      // Soonest release first, independent of the order the API returns them in.
      (a.release_date ?? "2099-01-01").localeCompare(b.release_date ?? "2099-01-01"),
    );

  // Date-driven buckets — classics and old re-releases never qualify for either tab.
  const upcomingMovies = (upcoming ?? []).filter(
    (m) => m.release_date && m.release_date >= todayStr,
  );
  const inTheatersMovies = (nowPlaying ?? []).filter(
    (m) => m.release_date && m.release_date < todayStr && m.release_date >= cutoffStr,
  );

  const sortedUpcoming = [...upcomingMovies].sort((a, b) =>
    (a.release_date ?? "2099-01-01").localeCompare(b.release_date ?? "2099-01-01"),
  );
  const sortedTheaters = Array.from(new Map(inTheatersMovies.map((m) => [m.id, m])).values()).sort(
    (a, b) => (b.release_date ?? "0000-01-01").localeCompare(a.release_date ?? "0000-01-01"),
  );
  const allMovies = Array.from(
    new Map([...upcomingMovies, ...inTheatersMovies].map((m) => [m.id, m])).values(),
  ).sort((a, b) => (a.release_date ?? "2099-01-01").localeCompare(b.release_date ?? "2099-01-01"));

  const displayMovies =
    filter === "theaters" ? sortedTheaters : filter === "upcoming" ? sortedUpcoming : allMovies;

  const isLoading = upcomingLoading || playingLoading;

  return (
    <Layout>
      <section className="px-4 pt-6 lg:px-6">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Release Radar
        </div>
        <h1 className="mt-2 font-serif text-5xl lg:text-6xl">Now &amp; Next</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Movies in theaters and coming soon — films tracked on the Index, plus the full TMDB
          release calendar.
        </p>

        {/* Filter Pills */}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-b border-foreground/10 pb-4">
          <Filter className="h-4 w-4 text-muted-foreground mr-1" />
          {[
            { id: "upcoming", label: "Upcoming Releases" },
            { id: "theaters", label: "Now In Theaters" },
            { id: "all", label: "All Releases" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as "all" | "upcoming" | "theaters")}
              className={`rounded-full px-4 py-1.5 font-mono text-xs font-medium transition ${
                filter === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {displayMovies.length} {displayMovies.length === 1 ? "title" : "titles"}
          </span>
        </div>
      </section>

      {/* Films the Index is tracking that haven't released yet — this curated
          section belongs to the "Upcoming Releases" tab only; "Now In Theaters"
          and "All Releases" show the raw TMDB calendar without it. */}
      {indexUpcoming.length > 0 && filter === "upcoming" && (
        <section className="mt-8 px-4 lg:px-6">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Tracked on the Index
              </div>
              <h2 className="mt-1 font-serif text-2xl">Coming Next</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {indexUpcoming.map((f) => {
              const countdown = getDaysUntil(f.release_date ?? "");
              const formattedDate = f.release_date
                ? new Date(f.release_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Release Date TBA";
              return (
                <Link
                  key={f.slug}
                  to="/films/$slug"
                  params={{ slug: f.slug }}
                  className="glass card-lift group flex gap-4 overflow-hidden rounded-2xl p-4"
                >
                  <div className="relative aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-xl bg-ink">
                    {f.poster_url ? (
                      <img
                        src={f.poster_url}
                        alt={f.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div
                        className="h-full w-full"
                        style={{
                          background: `linear-gradient(155deg, ${f.gradient_from ?? "#333"}, ${f.gradient_to ?? "#111"})`,
                        }}
                      />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${
                          countdown.isPast
                            ? "bg-forest-deep/20 text-forest-deep"
                            : "bg-primary/15 text-primary"
                        }`}
                      >
                        {countdown.text}
                      </span>
                      <div className="mt-2 truncate font-serif text-lg font-medium leading-tight transition group-hover:text-primary">
                        {f.title}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formattedDate} ·{" "}
                        {f.rank > 0 ? `#${f.rank} on the Index` : "Not charted yet"}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-foreground/10 pt-2 text-[10px] text-muted-foreground">
                      <span className="font-mono">Score {f.score?.toFixed(1) ?? "—"}</span>
                      <span className="font-mono text-primary">View Insights →</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-8 px-4 lg:px-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="glass rounded-2xl p-4 flex gap-4">
                <Skeleton className="h-36 w-24 rounded-xl shrink-0" />
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : displayMovies.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayMovies.map((m) => {
              const poster = tmdbPosterUrl(m.poster_path, "w342");
              const countdown = getDaysUntil(m.release_date);
              const formattedDate = m.release_date
                ? new Date(m.release_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Release Date TBA";

              return (
                <div
                  key={m.id}
                  className="glass card-lift rounded-2xl p-4 flex gap-4 overflow-hidden"
                >
                  <Link
                    to="/films/$slug"
                    params={{ slug: slugify(m.title) }}
                    className="relative aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-xl bg-ink"
                  >
                    {poster ? (
                      <img
                        src={poster}
                        alt={m.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center p-2 text-center text-[10px] text-muted-foreground">
                        {m.title}
                      </div>
                    )}
                  </Link>

                  <div className="flex flex-col justify-between min-w-0 flex-1">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${
                            countdown.isPast
                              ? "bg-forest-deep/20 text-forest-deep"
                              : "bg-primary/15 text-primary"
                          }`}
                        >
                          {countdown.text}
                        </span>
                      </div>

                      <Link
                        to="/films/$slug"
                        params={{ slug: slugify(m.title) }}
                        className="mt-2 block font-serif text-lg font-medium leading-tight hover:text-primary transition truncate"
                      >
                        {m.title}
                      </Link>

                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarIcon className="h-3 w-3" />
                        <span>{formattedDate}</span>
                      </div>

                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {m.overview || "Overview coming soon."}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-foreground/10 pt-2 text-[10px] text-muted-foreground">
                      <span className="font-mono">
                        {m.vote_count ? (
                          <>
                            ★ {m.vote_average?.toFixed(1) ?? "—"} · {m.vote_count.toLocaleString()}{" "}
                            votes
                          </>
                        ) : (
                          "No viewer votes yet"
                        )}
                      </span>
                      <Link
                        to="/films/$slug"
                        params={{ slug: slugify(m.title) }}
                        className="font-mono text-primary hover:underline"
                      >
                        View Insights →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
            No upcoming releases found matching the selected filter.
          </div>
        )}
      </section>
    </Layout>
  );
}

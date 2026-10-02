import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { canonicalLink, ogUrlMeta } from "@/lib/site";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { PagePlane } from "@/components/lumiere/PagePlane";
import { PageHead } from "@/components/lumiere/PageHead";
import {
  getTmdbUpcoming,
  getTmdbNowPlaying,
  getNewEntries,
  tmdbPosterUrl,
  type TmdbMovie,
} from "@/lib/apiClient";
import { slugify } from "@/lib/utils";
import { posterAt } from "@/lib/tmdbImage";
import { localDate } from "@/lib/filmUtils";
import { RouteError } from "@/lib/route-error";
import { Calendar as CalendarIcon, Filter, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/lumiere/Skeletons";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Now & Next · The Index" },
      {
        name: "description",
        content:
          "Movies in theaters and coming soon: films tracked on the Index, plus the full TMDB release calendar.",
      },
      ogUrlMeta("/calendar"),
    ],
    links: [canonicalLink("/calendar")],
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
  // Both sides anchored to local midnight — comparing a UTC-parsed target
  // against local midnight inflates the count by one in UTC-negative zones.
  const target = localDate(dateStr).getTime();
  const today = new Date().setHours(0, 0, 0, 0);
  const diffTime = target - today;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

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
      <PagePlane lead={indexUpcoming[0] ?? null} wide>
        <PageHead
          kicker="Release Radar"
          title="Now & Next"
          lede="Movies in theaters and coming soon: films tracked on the Index, plus the full TMDB release calendar."
          meta={
            <span className="ix-row__num">
              {displayMovies.length} {displayMovies.length === 1 ? "title" : "titles"}
            </span>
          }
        >
          <div className="ix-pills">
            <Filter aria-hidden />
            {[
              { id: "upcoming", label: "Upcoming Releases" },
              { id: "theaters", label: "Now In Theaters" },
              { id: "all", label: "All Releases" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as "all" | "upcoming" | "theaters")}
                className={filter === tab.id ? "ix-pill is-active" : "ix-pill"}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </PageHead>

        {/* Films the Index is tracking that haven't released yet — this curated
            section belongs to the "Upcoming Releases" tab only; "Now In Theaters"
            and "All Releases" show the raw TMDB calendar without it. */}
        {indexUpcoming.length > 0 && filter === "upcoming" ? (
          <div className="ix-sec">
            <div className="ix-shelf">
              <h2>Coming Next</h2>
              <span className="ix-row__num">Tracked on the Index</span>
            </div>
            <div className="ix-tiles">
              {indexUpcoming.map((f) => {
                const countdown = getDaysUntil(f.release_date ?? "");
                const formattedDate = f.release_date
                  ? localDate(f.release_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Release Date TBA";
                const poster = posterAt(f.poster_url, "w342") || undefined;
                return (
                  <Link key={f.slug} to="/films/$slug" params={{ slug: f.slug }} className="ix-tile">
                    <span className="ix-tile__art">
                      {poster ? (
                        <img src={poster} alt={`${f.title} poster`} loading="lazy" decoding="async" />
                      ) : null}
                    </span>
                    <span className="ix-tile__body">
                      <span className={countdown.isPast ? "ix-tag" : "ix-tag ix-tag--live"}>
                        {countdown.text}
                      </span>
                      <span className="ix-tile__t">{f.title}</span>
                      <span className="ix-tile__l">
                        {formattedDate} · {f.rank > 0 ? `#${f.rank} on the Index` : "Not charted yet"}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="ix-sec">
          {isLoading ? (
            <div className="ix-tiles">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="ix-tile ix-tile--static">
                  <Skeleton className="ix-tile__art-skel" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayMovies.length > 0 ? (
            <div className="ix-tiles">
              {displayMovies.map((m) => {
                const poster = tmdbPosterUrl(m.poster_path, "w342");
                const countdown = getDaysUntil(m.release_date);
                const formattedDate = m.release_date
                  ? localDate(m.release_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Release Date TBA";

                return (
                  <div key={m.id} className="ix-tile ix-tile--static">
                    <Link
                      to="/films/$slug"
                      params={{ slug: slugify(m.title) }}
                      className="ix-tile__art"
                    >
                      {poster ? (
                        <img src={poster} alt={`${m.title} poster`} loading="lazy" />
                      ) : null}
                    </Link>

                    <div className="ix-tile__body">
                      <span className={countdown.isPast ? "ix-tag" : "ix-tag ix-tag--live"}>
                        {countdown.text}
                      </span>
                      <Link
                        to="/films/$slug"
                        params={{ slug: slugify(m.title) }}
                        className="ix-tile__t"
                      >
                        {m.title}
                      </Link>
                      <span className="ix-tile__l">
                        <CalendarIcon aria-hidden />
                        {formattedDate}
                      </span>
                      <span className="ix-tile__l ix-tile__l--clamp">
                        {m.overview || "Synopsis not yet available."}
                      </span>
                      <span className="ix-tile__foot">
                        <span className="ix-row__num">
                          {m.vote_count
                            ? `★ ${m.vote_average?.toFixed(1) ?? "-"} · ${m.vote_count.toLocaleString()} votes`
                            : "No viewer votes yet"}
                        </span>
                        <Link
                          to="/films/$slug"
                          params={{ slug: slugify(m.title) }}
                          className="ix-tile__go"
                        >
                          View Insights →
                        </Link>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="ix-note">
              <p className="ix-note__title">Nothing on the calendar</p>
              <p className="ix-note__body">
                No upcoming releases found matching the selected filter.
              </p>
            </div>
          )}
        </div>
      </PagePlane>
    </Layout>
  );
}

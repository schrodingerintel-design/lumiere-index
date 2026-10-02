import { createFileRoute, Link } from "@tanstack/react-router";
import { canonicalLink, ogUrlMeta } from "@/lib/site";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { PagePlane } from "@/components/lumiere/PagePlane";
import { PageHead, LiveStamp } from "@/components/lumiere/PageHead";
import { getIndexNewEntries } from "@/lib/apiClient";
import { posterAt } from "@/lib/tmdbImage";
import { localDate } from "@/lib/filmUtils";
import { RouteError } from "@/lib/route-error";
import { FilmCardSkeleton } from "@/components/lumiere/Skeletons";

export const Route = createFileRoute("/new-entries")({
  head: () => ({
    meta: [
      { title: "New Entries · The Index" },
      {
        name: "description",
        content:
          "Titles entering The Index for the first time: their official debut rank and date.",
      },
      ogUrlMeta("/new-entries"),
    ],
    links: [canonicalLink("/new-entries")],
  }),
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery({
      queryKey: ["index", "new-entries"],
      queryFn: () => getIndexNewEntries(),
    });
  },
  component: NewEntriesPage,
  errorComponent: RouteError,
});

function formatDate(iso: string | null): string {
  if (!iso) return "Date TBA";
  return localDate(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function FilmCard({ film }: { film: import("@/lib/apiClient").NewEntryFilm }) {
  const director = film.director && film.director !== "Unknown" ? film.director : null;
  const poster = posterAt(film.poster_url, "w342") || undefined;
  return (
    <Link to="/films/$slug" params={{ slug: film.slug }} className="ix-card">
      <div
        className="ix-card__art"
        style={{
          background: `linear-gradient(155deg, ${film.gradient_from ?? "#2a3140"}, ${film.gradient_to ?? "#131720"})`,
        }}
      >
        {poster ? (
          <img src={poster} alt={`${film.title} poster`} loading="lazy" decoding="async" />
        ) : (
          <div className="ix-card__fallback">{film.title}</div>
        )}

        {/* Debut rank + debut score — the measurement on the artwork */}
        <span className="ix-card__mom ix-card__mom--num">
          {film.debut_score?.toFixed(1)}
        </span>
        <span className="ix-card__new">New</span>
      </div>

      <div className="ix-card__cap">
        <div className="ix-card__t">{film.title}</div>
        <div className="ix-card__line">
          Debuted #{film.debut_rank} · {formatDate(film.debut_date)}
        </div>
        <div className="ix-card__line">
          {[director, film.year].filter(Boolean).join(" · ")}
        </div>
      </div>
    </Link>
  );
}

function NewEntriesPage() {
  const { data: films, isLoading, error } = useQuery({
    queryKey: ["index", "new-entries"],
    // Arrow wrapper — React Query passes its context object as the first arg,
    // which would otherwise become `limit=[object Object]` → 422.
    queryFn: () => getIndexNewEntries(),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Layout>
      <PagePlane lead={films?.[0] ?? null} wide>
        <PageHead
          kicker="Debuts"
          title="New Entries"
          lede="Titles entering The Index for the first time: where they debuted and when. Each entry appears here once, at its debut."
          meta={<LiveStamp>Updated every 15 minutes</LiveStamp>}
        >
          <Link to="/calendar" className="ix-more">
            What’s coming next
          </Link>
        </PageHead>

        <div className="ix-sec">
          {error ? (
            <div className="ix-note">
              <p className="ix-note__title">Unable to load data</p>
              <p className="ix-note__body">
                The chart engine did not answer. Please try again shortly.
              </p>
            </div>
          ) : (
            <>
              <div className="ix-grid">
                {isLoading
                  ? [...Array(10)].map((_, i) => <FilmCardSkeleton key={i} />)
                  : films?.map((f) => <FilmCard key={f.slug} film={f} />)}
              </div>

              {!isLoading && films?.length === 0 ? (
                <div className="ix-note">
                  <p className="ix-note__title">No debuts yet</p>
                  <p className="ix-note__body">
                    New Entries appear after the next refresh once films chart for the
                    first time.
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </PagePlane>
    </Layout>
  );
}

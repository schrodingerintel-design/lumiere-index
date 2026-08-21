import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, MessageCircle } from "lucide-react";
import { Layout } from "@/components/lumiere/Layout";
import { getTrendingFilms, searchTmdbMovie, tmdbPosterUrl } from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";

export const Route = createFileRoute("/trending")({
  head: () => ({
    meta: [
      { title: "Trending Topics — Lumière The Index" },
      {
        name: "description",
        content:
          "Films generating the most audience conversation right now — ranked by real viewer signal velocity.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery({
      queryKey: ["trending", "films"],
      queryFn: () => getTrendingFilms(20),
    });
  },
  component: TrendingPage,
  errorComponent: RouteError,
});

function FilmPosterCell({
  title,
  year,
  gradientFrom,
  gradientTo,
}: {
  title: string;
  year: number | null;
  gradientFrom: string | null;
  gradientTo: string | null;
}) {
  const { data: tmdb } = useQuery({
    queryKey: ["tmdb", title, year],
    queryFn: () => searchTmdbMovie(title, year ?? undefined),
    enabled: !!title,
    staleTime: 24 * 60 * 60 * 1000,
  });
  const posterUrl = tmdbPosterUrl(tmdb?.results?.[0]?.poster_path, "w185");
  const bg = `linear-gradient(155deg, ${gradientFrom ?? "#2a2a2a"}, ${gradientTo ?? "#111"})`;

  return (
    <div
      className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg"
      style={{ background: bg }}
    >
      {posterUrl && (
        <img
          src={posterUrl}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      )}
    </div>
  );
}

function TrendingPage() {
  const {
    data: films,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["trending", "films"],
    queryFn: () => getTrendingFilms(20),
    staleTime: 5 * 60 * 1000,
  });

  const maxMentions = Math.max(...(films?.map((f) => f.mentions_24h) ?? [1]), 1);

  return (
    <Layout>
      {/* Page header */}
      <section className="px-4 pt-6 lg:px-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Conversations
          </span>
        </div>
        <h1 className="mt-2 font-serif text-5xl lg:text-6xl">Trending Now</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Films the world is actively discussing — ranked by audience engagement velocity across
          reviews, social media, and viewer communities.
        </p>
      </section>

      {error && (
        <div className="mt-10 mx-4 lg:mx-6 glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
          Unable to load trending films. Please try again later.
        </div>
      )}

      {/* Film list */}
      <section className="mt-10 px-4 lg:px-6">
        {isLoading ? (
          <ul className="space-y-3">
            {[...Array(10)].map((_, i) => (
              <li key={i} className="glass rounded-2xl p-4 flex items-center gap-4 animate-pulse">
                <div className="h-20 w-14 rounded-lg bg-foreground/10 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-48 rounded bg-foreground/10" />
                  <div className="h-3 w-32 rounded bg-foreground/10" />
                  <div className="h-2 w-full rounded-full bg-foreground/10" />
                </div>
              </li>
            ))}
          </ul>
        ) : films && films.length > 0 ? (
          <ul className="space-y-3">
            {films.map((film, i) => {
              const mentions = film.mentions_24h;
              const mentionsLabel =
                mentions >= 1000 ? `${(mentions / 1000).toFixed(1)}k` : String(mentions);
              return (
                <li key={film.film_slug}>
                  <Link
                    to="/films/$slug"
                    params={{ slug: film.film_slug }}
                    className="glass card-lift flex items-start gap-4 rounded-2xl p-4 transition-all hover:ring-1 hover:ring-primary/30"
                  >
                    {/* Rank badge */}
                    <div className="hidden sm:grid h-8 w-8 shrink-0 place-items-center font-mono text-lg tabular text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </div>

                    {/* Poster thumbnail */}
                    <FilmPosterCell
                      title={film.title}
                      year={film.year}
                      gradientFrom={film.gradient_from}
                      gradientTo={film.gradient_to}
                    />

                    {/* Main content */}
                    <div className="min-w-0 flex-1">
                      <h2 className="font-serif text-xl leading-tight">{film.title}</h2>

                      {film.director && (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {film.director}
                          {film.year ? ` · ${film.year}` : ""}
                        </div>
                      )}

                      {/* Trend reason */}
                      <div className="mt-2 flex items-start gap-1.5 text-[11px] font-medium leading-snug text-primary">
                        <TrendingUp className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>{film.trend_reason}</span>
                      </div>

                      {/* Sub-tags */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {film.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-foreground/[0.06] px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Engagement bar */}
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-700"
                            style={{ width: `${(mentions / maxMentions) * 100}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground shrink-0">
                          <MessageCircle className="h-3 w-3" />
                          {mentionsLabel} signals
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
            No trending films yet. They'll appear after the first audience signal pass.
          </div>
        )}
      </section>
    </Layout>
  );
}

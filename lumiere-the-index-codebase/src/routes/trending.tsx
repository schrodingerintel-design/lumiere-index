import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { getTrendingFilms, type TrendingFilmOut } from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";

export const Route = createFileRoute("/trending")({
  head: () => ({
    meta: [
      { title: "Trending — The Index" },
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

function signalLabel(volume: number): string {
  return volume >= 1000 ? `${(volume / 1000).toFixed(1)}k` : String(volume);
}

function TrendingRow({ film, position }: { film: TrendingFilmOut; position: number }) {
  return (
    <li>
      <Link
        to="/films/$slug"
        params={{ slug: film.film_slug }}
        className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-foreground/[0.03] sm:gap-4 sm:px-5"
      >
        <span className="w-8 shrink-0 font-mono text-xl tabular text-muted-foreground sm:text-2xl">
          {String(position).padStart(2, "0")}
        </span>
        <div
          className="relative h-16 w-11 shrink-0 overflow-hidden bg-ink sm:h-[72px] sm:w-12"
          style={{
            background: `linear-gradient(155deg, ${film.gradient_from ?? "#333"}, ${film.gradient_to ?? "#111"})`,
          }}
        >
          {film.poster_url && (
            <img
              src={film.poster_url}
              alt={film.title}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium leading-snug text-foreground sm:text-base">
            {film.title}
          </div>
          <div className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground sm:text-[13px]">
            {film.trend_reason}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="index-score text-xl sm:text-2xl">{film.score?.toFixed(1)}</div>
          <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            {signalLabel(film.mentions_24h)} today
          </div>
        </div>
      </Link>
    </li>
  );
}

function TrendingPage() {
  const { data: films, isLoading, error } = useQuery({
    queryKey: ["trending", "films"],
    queryFn: () => getTrendingFilms(20),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Layout>
      <section className="px-4 pt-10 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
            In Discussion
          </div>
          <h1 className="mt-2 font-display text-4xl font-medium leading-tight sm:text-5xl">
            Trending
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            What audiences are actively discussing right now — ranked by conversation velocity
            across reviews, social media, and viewer communities.
          </p>
        </div>
      </section>

      <section className="mt-10 px-4 pb-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          {error && (
            <div className="border-y border-foreground/10 bg-surface p-8 text-center text-sm text-muted-foreground">
              Unable to load trending films. Please try again later.
            </div>
          )}

          {isLoading ? (
            <ul className="divide-y divide-foreground/[0.07] border-y border-foreground/10">
              {[...Array(8)].map((_, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5">
                  <div className="h-6 w-8 animate-pulse bg-foreground/10" />
                  <div className="h-16 w-11 animate-pulse bg-foreground/10 sm:h-[72px] sm:w-12" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 animate-pulse bg-foreground/10" />
                    <div className="h-3 w-64 max-w-full animate-pulse bg-foreground/10" />
                  </div>
                  <div className="h-6 w-10 animate-pulse bg-foreground/10" />
                </li>
              ))}
            </ul>
          ) : films && films.length > 0 ? (
            <ul className="divide-y divide-foreground/[0.07] border-y border-foreground/10">
              {films.map((film, i) => (
                <TrendingRow key={film.film_slug} film={film} position={i + 1} />
              ))}
            </ul>
          ) : (
            <div className="border-y border-foreground/10 bg-surface p-12 text-center text-sm text-muted-foreground">
              Nothing is trending yet — titles appear once enough real audience signal
              accumulates.
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}

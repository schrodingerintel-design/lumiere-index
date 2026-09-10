import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { getBiggestMovers } from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
import { ArrowDown, ArrowUp } from "lucide-react";
import { FilmCardSkeleton } from "@/components/lumiere/Skeletons";

export const Route = createFileRoute("/rising")({
  head: () => ({
    meta: [
      { title: "Biggest Movers — Lumière The Index" },
      {
        name: "description",
        content:
          "The biggest rank changes on the Lumière Index — largest daily climbers and decliners.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery({
      queryKey: ["index", "movers"],
      queryFn: () => getBiggestMovers(),
    });
  },
  component: BiggestMovers,
  errorComponent: RouteError,
});

function MoverCard({
  film,
}: {
  film: {
    slug: string;
    title: string;
    poster_url: string | null;
    gradient_from: string | null;
    gradient_to: string | null;
    direction: "up" | "down";
    movement: number;
    previous_rank: number | null;
    current_rank: number;
    current_score: number;
  };
}) {
  const up = film.direction === "up";
  return (
    <Link
      to="/films/$slug"
      params={{ slug: film.slug }}
      className="group block"
    >
      {/* Poster — the artwork carries the card; the score sits on it */}
      <div
        className="relative aspect-[2/3] overflow-hidden bg-ink"
        style={{
          background: `linear-gradient(155deg, ${film.gradient_from ?? "#333"}, ${film.gradient_to ?? "#111"})`,
        }}
      >
        {film.poster_url ? (
          <img
            src={film.poster_url}
            alt={film.title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-xs text-cream/80">
            {film.title}
          </div>
        )}
        {/* Current rank + score — the measurement, always visible */}
        <div className="absolute right-1.5 top-1.5 bg-black/70 px-1.5 py-1 font-mono text-[12px] font-semibold leading-none text-cream">
          {film.current_score?.toFixed(1)}
        </div>
        <div className="absolute left-1.5 top-1.5 bg-black/70 px-1.5 py-1 font-mono text-[11px] font-semibold leading-none text-cream/90">
          #{film.current_rank}
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-8">
          <div className="truncate text-sm font-medium text-white">{film.title}</div>
          <div className="mt-1 flex items-center gap-1 font-mono text-[11px] tabular text-white/80">
            {film.previous_rank != null ? (
              <>
                #{film.previous_rank} → #{film.current_rank}
              </>
            ) : (
              <>Now charting</>
            )}
            <span className={up ? "text-up" : "text-down"}>
              {up ? (
                <>
                  <ArrowUp className="inline h-3 w-3" aria-hidden /> {film.movement}
                </>
              ) : (
                <>
                  <ArrowDown className="inline h-3 w-3" aria-hidden /> {film.movement}
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function BiggestMovers() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["index", "movers"],
    queryFn: () => getBiggestMovers(),
    staleTime: 5 * 60 * 1000,
  });

  const gainers = data?.gainers ?? [];
  const decliners = data?.decliners ?? [];

  return (
    <Layout>
      <section className="px-4 pt-10 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
            The Index
          </div>
          <h1 className="mt-2 font-display text-4xl font-medium leading-tight sm:text-5xl">
            Biggest Movers
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            The largest rank changes between published Daily Indexes — which films moved the most,
            up or down. Movement is measured in rank positions, never score points.
          </p>
        </div>
      </section>

      {error && (
        <section className="mt-10 px-4 sm:px-6">
          <div className="mx-auto max-w-6xl border-y border-foreground/10 bg-surface p-8 text-center text-sm text-muted-foreground">
            Unable to load data. Please try again later.
          </div>
        </section>
      )}

      {isLoading && (
        <section className="mt-10 px-4 sm:px-6">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[...Array(10)].map((_, i) => (
              <FilmCardSkeleton key={i} />
            ))}
          </div>
        </section>
      )}

      {!isLoading && (
        <>
          <section className="mt-10 px-4 sm:px-6">
            <div className="mx-auto max-w-6xl">
              <div className="flex items-center gap-1.5 border-b border-foreground/10 pb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-up">
                <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                Climbing
              </div>
              {gainers.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  No rank changes in the latest published Index yet.
                </p>
              ) : (
                <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {gainers.map((f) => (
                    <MoverCard key={f.slug} film={f} />
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="mt-12 px-4 pb-16 sm:px-6">
            <div className="mx-auto max-w-6xl">
              <div className="flex items-center gap-1.5 border-b border-foreground/10 pb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-down">
                <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                Falling
              </div>
              {decliners.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  No downward movement in the latest published Index yet.
                </p>
              ) : (
                <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {decliners.map((f) => (
                    <MoverCard key={f.slug} film={f} />
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </Layout>
  );
}

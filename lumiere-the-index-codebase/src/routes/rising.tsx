import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { getBiggestMovers } from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { FilmCardSkeleton } from "@/components/lumiere/Skeletons";
import { FilmPosterThumbnail } from "@/components/lumiere/FilmPosterThumbnail";

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
      className="glass card-lift overflow-hidden rounded-2xl group transition block"
    >
      <div className="relative h-48 overflow-hidden">
        <FilmPosterThumbnail film={film} className="h-full w-full rounded-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-0.5 font-mono text-xs font-bold text-primary backdrop-blur">
          #{film.current_rank}
        </span>
        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 font-mono text-xs text-white backdrop-blur">
          {up ? (
            <ArrowUp className="h-3 w-3 text-live" />
          ) : (
            <ArrowDown className="h-3 w-3 text-down" />
          )}
          {film.previous_rank != null ? (
            <span>
              #{film.previous_rank} → #{film.current_rank}
            </span>
          ) : (
            <Minus className="h-3 w-3" />
          )}
        </div>
      </div>
      <div className="p-4">
        <div className="font-serif text-2xl leading-tight group-hover:text-primary transition-colors">
          {film.title}
        </div>
        <div className="mt-4 flex items-baseline justify-between border-t border-foreground/10 pt-3">
          <span
            className={`font-mono text-sm font-semibold tabular ${up ? "text-live" : "text-down"}`}
          >
            {up ? "↑" : "↓"} {film.movement} {film.movement === 1 ? "position" : "positions"}
          </span>
          <span className="font-mono text-2xl tabular text-primary font-semibold">
            {film.current_score?.toFixed(1)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function BiggestMovers() {
  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["index", "movers"],
    queryFn: () => getBiggestMovers(),
    staleTime: 5 * 60 * 1000,
  });

  const gainers = data?.gainers ?? [];
  const decliners = data?.decliners ?? [];

  return (
    <Layout>
      <section className="px-4 pt-6 lg:px-6">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-[9px] font-bold text-primary">
            BIGGEST MOVERS
          </span>
          <span>· Biggest rank changes</span>
        </div>
        <h1 className="mt-2 font-serif text-5xl lg:text-6xl">Biggest Movers</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground leading-relaxed">
          The largest rank changes between published Daily Indexes — which films moved the most,
          up or down. Movement is measured in rank positions, never score points.
        </p>
      </section>

      {error && (
        <section className="mt-10 px-4 lg:px-6">
          <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
            Unable to load data. Please try again later.
          </div>
        </section>
      )}

      {isLoading && (
        <section className="mt-10 grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3 lg:px-6">
          {[...Array(6)].map((_, i) => (
            <FilmCardSkeleton key={i} />
          ))}
        </section>
      )}

      {!isLoading && (
        <>
          <section className="mt-10 px-4 lg:px-6">
            <h2 className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.22em] text-live">
              <ArrowUp className="h-4 w-4" /> Biggest gainers
            </h2>
            {gainers.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No rank changes in the latest published Index yet.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {gainers.map((f) => (
                  <MoverCard key={f.slug} film={f} />
                ))}
              </div>
            )}
          </section>

          <section className="mt-12 px-4 pb-12 lg:px-6">
            <h2 className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.22em] text-down">
              <ArrowDown className="h-4 w-4" /> Biggest decliners
            </h2>
            {decliners.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No downward movement in the latest published Index yet.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {decliners.map((f) => (
                  <MoverCard key={f.slug} film={f} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </Layout>
  );
}

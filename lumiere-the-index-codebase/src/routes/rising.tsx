import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { getRisingFilms } from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
import { ArrowUp, Flame, TrendingUp } from "lucide-react";
import { FilmCardSkeleton } from "@/components/lumiere/Skeletons";
import { FilmPosterThumbnail } from "@/components/lumiere/FilmPosterThumbnail";

export const Route = createFileRoute("/rising")({
  head: () => ({
    meta: [
      { title: "Top 10 Rising Films — Lumière The Index" },
      {
        name: "description",
        content: "The top 10 films climbing the Lumière Index fastest right now.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery({
      queryKey: ["films", "rising"],
      queryFn: () => getRisingFilms(),
    });
  },
  component: Rising,
  errorComponent: RouteError,
});

function Rising() {
  const {
    data: films,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["films", "rising"],
    queryFn: () => getRisingFilms(),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Layout>
      <section className="px-4 pt-6 lg:px-6">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-[9px] font-bold text-primary flex items-center gap-1">
            <Flame className="h-3 w-3" />
            TOP 10 MOMENTUM
          </span>
          <span>· Velocity Ranking</span>
        </div>
        <h1 className="mt-2 font-serif text-5xl lg:text-6xl">Top 10 Rising Films</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground leading-relaxed">
          The 10 films climbing the Lumière Index fastest right now. Calculated from 24-hour audience mention velocity, positive sentiment shifts, and cross-platform discussion growth.
        </p>
      </section>

      <section className="mt-10 grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3 lg:px-6">
        {error && (
          <div className="col-span-full glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
            Unable to load data. Please try again later.
          </div>
        )}

        {isLoading
          ? [...Array(6)].map((_, i) => <FilmCardSkeleton key={i} />)
          : films?.map((f, i) => {
              const director = f.director && f.director !== "Unknown" ? f.director : "Director TBA";
              return (
                <Link
                  key={f.slug}
                  to="/films/$slug"
                  params={{ slug: f.slug }}
                  className="glass card-lift overflow-hidden rounded-2xl group transition block"
                >
                  <div className="relative h-48 overflow-hidden">
                    <FilmPosterThumbnail film={f} className="h-full w-full rounded-none" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-0.5 font-mono text-xs font-bold text-primary backdrop-blur">
                      #{i + 1}
                    </span>
                    <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 font-mono text-xs text-white backdrop-blur">
                      <ArrowUp className="h-3 w-3 text-live" />
                      {(f.movement ?? 0) > 0 ? `+${f.movement}` : f.movement}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="font-serif text-2xl leading-tight group-hover:text-primary transition-colors">
                      {f.title}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">{director}</div>
                    <div className="mt-4 flex items-baseline justify-between border-t border-foreground/10 pt-3">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-primary" />
                        Index Score
                      </span>
                      <span className="font-mono text-2xl tabular text-primary font-semibold">
                        {f.score?.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}

        {!isLoading && films?.length === 0 && (
          <div className="col-span-full glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
            No rising films in the latest snapshot yet. Check back after the next refresh.
          </div>
        )}
      </section>
    </Layout>
  );
}

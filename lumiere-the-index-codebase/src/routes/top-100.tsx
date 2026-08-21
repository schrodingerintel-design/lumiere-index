import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { getNewReleaseFilms } from "@/lib/apiClient";
import { isNewRelease } from "@/lib/filmUtils";
import { RouteError } from "@/lib/route-error";
import { ArrowUp, ArrowDown } from "lucide-react";
import { FilmRowSkeleton } from "@/components/lumiere/Skeletons";
import { FilmPosterThumbnail } from "@/components/lumiere/FilmPosterThumbnail";

export const Route = createFileRoute("/top-100")({
  head: () => ({
    meta: [
      { title: "Top 100 — Lumière The Index" },
      {
        name: "description",
        content:
          "The 100 films the world is talking about, ranked in real time by audience sentiment.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery({
      queryKey: ["films", "new-releases", 100],
      queryFn: () => getNewReleaseFilms(100),
    });
  },
  component: Top100,
  errorComponent: RouteError,
});

function Top100() {
  const {
    data: films,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["films", "new-releases", 100],
    queryFn: () => getNewReleaseFilms(100),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Layout>
      <section className="px-4 pt-6 lg:px-6">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {new Date().toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </div>
        <h1 className="mt-2 font-serif text-5xl lg:text-6xl">The Top 100</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Highest-rated newly released films on the Index, calculated from audience sentiment and
          engagement signals.
        </p>
      </section>

      <section className="mt-10 px-4 lg:px-6">
        {error && (
          <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
            Unable to load rankings right now. Please try again later.
          </div>
        )}
        <div className="glass overflow-hidden rounded-2xl border border-foreground/10">
          <div className="grid grid-cols-[50px_1fr_70px_70px] items-center gap-3 border-b border-foreground/10 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:grid-cols-[60px_60px_1fr_90px_90px_90px]">
            <div>Rank</div>
            <div className="hidden sm:block">Mvmt</div>
            <div>Title</div>
            <div className="hidden sm:block">Weeks</div>
            <div>Score</div>
            <div className="text-right">Signals</div>
          </div>
          <ul>
            {isLoading
              ? [...Array(20)].map((_, i) => <FilmRowSkeleton key={i} />)
              : films?.map((f) => {
                  const change = f.movement ?? null;
                  const director =
                    f.director && f.director !== "Unknown" ? f.director : "Director TBA";
                  const weeks = f.weeks_on_chart ?? 1;
                  const signals =
                    f.mentions_total >= 1000
                      ? `${(f.mentions_total / 1000).toFixed(1)}k`
                      : String(f.mentions_total);

                  return (
                    <li key={f.slug}>
                      <Link
                        to="/films/$slug"
                        params={{ slug: f.slug }}
                        className="grid grid-cols-[50px_1fr_70px_70px] items-center gap-3 border-b border-foreground/5 px-4 py-4 transition hover:bg-foreground/[0.03] sm:grid-cols-[60px_60px_1fr_90px_90px_90px]"
                      >
                        <div className="font-mono text-2xl tabular">
                          {String(f.rank).padStart(2, "0")}
                        </div>
                        <div className="hidden sm:block">
                          {f.prev_rank == null && isNewRelease(f) ? (
                            <span className="rounded bg-live px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-ink">
                              New
                            </span>
                          ) : change !== null && change !== 0 ? (
                            <span
                              className={`flex items-center gap-0.5 font-mono text-xs tabular ${change > 0 ? "text-forest-deep" : "text-down"}`}
                            >
                              {change > 0 ? (
                                <ArrowUp className="h-3 w-3" />
                              ) : (
                                <ArrowDown className="h-3 w-3" />
                              )}
                              {Math.abs(change)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                        <div className="min-w-0 flex items-center gap-3">
                          <FilmPosterThumbnail film={f} className="h-12 w-9" />
                          <div className="min-w-0">
                            <div className="truncate font-serif text-lg">{f.title}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {director} · {f.year}
                            </div>
                          </div>
                        </div>
                        <div className="hidden font-mono text-xs tabular text-muted-foreground sm:block">
                          {weeks} {weeks === 1 ? "wk" : "wks"}
                        </div>
                        <div className="font-mono text-sm tabular text-primary font-semibold">
                          {f.score?.toFixed(1)}
                        </div>
                        <div className="text-right font-mono text-xs tabular text-muted-foreground font-medium">
                          {signals}
                        </div>
                      </Link>
                    </li>
                  );
                })}
          </ul>
        </div>
      </section>
    </Layout>
  );
}

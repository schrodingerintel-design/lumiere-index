import { createFileRoute, Link } from "@tanstack/react-router";
import { canonicalLink, ogUrlMeta } from "@/lib/site";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { PagePlane } from "@/components/lumiere/PagePlane";
import { PageHead, LiveStamp } from "@/components/lumiere/PageHead";
import { getWeeklyTop100, type WeeklyEntry } from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
import { ArrowUp, ArrowDown, Minus, Tv, Film } from "lucide-react";
import { FilmRowSkeleton } from "@/components/lumiere/Skeletons";
import { FilmPosterThumbnail } from "@/components/lumiere/FilmPosterThumbnail";
import { MomentumMark } from "@/components/lumiere/Momentum";

export const Route = createFileRoute("/weekly-100")({
  head: () => ({
    meta: [
      { title: "Weekly Top 100 · The Index" },
      {
        name: "description",
        content:
          "The Weekly Top 100: the movies and TV shows that performed best throughout the week.",
      },
      ogUrlMeta("/weekly-100"),
    ],
    links: [canonicalLink("/weekly-100")],
  }),
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery({
      queryKey: ["weekly", "top100"],
      queryFn: () => getWeeklyTop100(),
    });
  },
  component: Weekly100,
  errorComponent: RouteError,
});

function TypeChip({ type }: { type: WeeklyEntry["content_type"] }) {
  const isTv = type === "TV_SHOW";
  return (
    <span className="ix-tag">
      {isTv ? <Tv aria-hidden /> : <Film aria-hidden />}
      {isTv ? "TV" : "Movie"}
    </span>
  );
}

function WeekLabel({ weekStart, weekEnd }: { weekStart: string; weekEnd: string }) {
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return (
    <span>
      {fmt(weekStart)} – {fmt(weekEnd)}
    </span>
  );
}

function Weekly100() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["weekly", "top100"],
    queryFn: () => getWeeklyTop100(),
    staleTime: 10 * 60 * 1000,
  });

  const entries = data?.entries ?? [];

  return (
    <Layout>
      <PagePlane lead={entries[0] ?? null} wide>
        <PageHead
          kicker={
            <>
              The Index · Weekly Top 100 ·{" "}
              {data ? (
                <WeekLabel weekStart={data.meta.week_start} weekEnd={data.meta.week_end} />
              ) : (
                "This week"
              )}
            </>
          }
          title="Weekly Top 100"
          lede="The movies and TV shows that performed best throughout the week. Sustained performance all week beats a one-day spike. Movies and TV shows compete on one chart; each entry is labeled."
          meta={<LiveStamp>Published weekly</LiveStamp>}
        />

        {error ? (
          <div className="ix-sec">
            <div className="ix-note">
              <p className="ix-note__title">Unable to load the weekly chart</p>
              <p className="ix-note__body">
                The chart engine did not answer. Please try again shortly.
              </p>
            </div>
          </div>
        ) : (
          <div className="ix-sec !pt-0">
            <div className="ix-thead">
              <div>Rank</div>
              <div>Mvmt</div>
              <div>Title</div>
              <div>Type</div>
              <div className="ix-thead__r">Momentum</div>
            </div>
            <ul className="ix-rows">
              {isLoading
                ? [...Array(20)].map((_, i) => <FilmRowSkeleton key={i} />)
                : entries.map((e) => {
                    const delta = e.rank_delta || 0;
                    const isDebut = e.previous_week_rank == null;
                    const meta =
                      e.director && e.director !== "Unknown"
                        ? `${e.director} · ${e.year}`
                        : e.year
                          ? String(e.year)
                          : "";

                    return (
                      <li key={`${e.slug}-${e.rank}`}>
                        <Link
                          to="/films/$slug"
                          params={{ slug: e.slug }}
                          className="ix-row"
                        >
                          <span className="ix-row__rk">
                            {String(e.rank).padStart(2, "0")}
                          </span>

                          {isDebut ? (
                            <span className="ix-delta ix-delta--new">New</span>
                          ) : delta ? (
                            <span
                              className={`ix-delta ${delta > 0 ? "ix-delta--up" : "ix-delta--down"}`}
                              title={delta > 0 ? "Climbed" : "Fell"}
                            >
                              {delta > 0 ? <ArrowUp aria-hidden /> : <ArrowDown aria-hidden />}
                              {Math.abs(delta)}
                            </span>
                          ) : (
                            <span className="ix-delta ix-delta--flat" title="Held its rank">
                              <Minus aria-hidden />0
                            </span>
                          )}

                          <span className="ix-row__main">
                            <FilmPosterThumbnail film={e} className="ix-row__art" />
                            <span className="min-w-0">
                              <span className="ix-row__title block">{e.title}</span>
                              <span className="ix-row__meta block">
                                {meta} · {e.total_signal_volume} signals this week
                              </span>
                            </span>
                          </span>

                          <span>
                            <TypeChip type={e.content_type} />
                          </span>
                          <span className="ix-row__r">
                            <MomentumMark state={e.momentum} />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
            </ul>
            {!isLoading && entries.length === 0 ? (
              <div className="ix-note">
                <p className="ix-note__title">No weekly chart yet</p>
                <p className="ix-note__body">
                  The first Weekly Top 100 publishes after the next full week of
                  measurements.
                </p>
              </div>
            ) : null}
          </div>
        )}
      </PagePlane>
    </Layout>
  );
}

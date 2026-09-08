import { useQuery } from "@tanstack/react-query";
import { ArrowUp, Sparkles, TrendingUp } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getRisingFilms, getNewEntries, getTrendingFilms } from "@/lib/apiClient";
import { PulseRowSkeleton } from "./Skeletons";
import { FilmPosterThumbnail } from "./FilmPosterThumbnail";

function gradientStyle(from: string | null, to: string | null) {
  return `linear-gradient(155deg, ${from ?? "#333"}, ${to ?? "#111"})`;
}

function SectionHead({ label, accent }: { label: string; accent: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
        {accent}
      </span>
      <span className="h-px flex-1 bg-foreground/10" />
      <span className="font-display text-lg font-semibold">{label}</span>
    </div>
  );
}

export function PulseRow() {
  const { data: rising, isLoading: risingLoading } = useQuery({
    queryKey: ["films", "rising"],
    // Arrow wrapper: React Query passes its context object as the first arg,
    // which would otherwise become `limit=[object Object]` → 422.
    queryFn: () => getRisingFilms(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: newEntries } = useQuery({
    queryKey: ["films", "new-entries"],
    queryFn: () => getNewEntries(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: trendingFilms } = useQuery({
    queryKey: ["trending", "films"],
    queryFn: () => getTrendingFilms(6),
    staleTime: 5 * 60 * 1000,
  });

  if (risingLoading) return <PulseRowSkeleton />;

  const big = rising?.[0];
  const topRising = rising?.slice(0, 3) ?? [];
  const topEntries = newEntries?.slice(0, 5) ?? [];
  const topTrending = trendingFilms?.slice(0, 3) ?? [];
  const maxMentions = Math.max(...topTrending.map((f) => f.mentions_24h), 1);

  return (
    <section className="mt-14 grid grid-cols-1 gap-8 px-4 md:grid-cols-2 xl:grid-cols-3 lg:px-6">
      {/* Biggest Mover + Rising Now */}
      <div className="flex h-full flex-col">
        <SectionHead accent="Momentum" label="Rising Now" />
        {big && (
          <Link
            to="/films/$slug"
            params={{ slug: big.slug }}
            className="group relative mt-4 block h-44 overflow-hidden"
          >
            {big.poster_url ? (
              <img
                src={big.poster_url}
                alt={big.title}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{ background: gradientStyle(big.gradient_from, big.gradient_to) }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
            <div className="absolute left-4 top-3 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-live">
              Biggest Mover
            </div>
            <div className="absolute inset-x-4 bottom-3 text-white">
              <div className="font-display text-2xl leading-tight">{big.title}</div>
              <div className="mt-0.5 text-xs text-white/80">
                {big.director} ·{" "}
                {big.prev_rank && big.prev_rank > 0 ? (
                  <>
                    {big.prev_rank} to #{big.rank}
                  </>
                ) : (
                  <>New entry — debuts at #{big.rank}</>
                )}
              </div>
            </div>
          </Link>
        )}
        <ul className="mt-4 divide-y divide-foreground/[0.07]">
          {topRising.map((r) => (
            <li key={r.slug}>
              <Link
                to="/films/$slug"
                params={{ slug: r.slug }}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <div className="truncate font-display">{r.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.director}</div>
                </div>
                {r.is_fallback ? (
                  <span className="font-mono text-[10px] tabular text-muted-foreground/50">
                    Charted
                  </span>
                ) : (r.movement ?? 0) > 0 ? (
                  <span className="flex items-center gap-0.5 font-mono text-xs tabular text-up">
                    <ArrowUp className="h-3 w-3" />
                    {r.movement}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
          {topRising.length === 0 && (
            <li className="py-2.5 text-xs text-muted-foreground">No data yet</li>
          )}
        </ul>
      </div>

      {/* New This Week */}
      <div className="flex h-full flex-col">
        <SectionHead accent="New" label="New This Week" />
        <ul className="mt-4 divide-y divide-foreground/[0.07]">
          {topEntries.map((n) => (
            <li key={n.slug}>
              <Link
                to="/films/$slug"
                params={{ slug: n.slug }}
                className="flex items-center gap-3 py-2.5"
              >
                <FilmPosterThumbnail film={n} className="h-14 w-10" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-base">{n.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{n.director}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-semibold tabular">#{n.rank}</div>
                  {n.is_fallback ? (
                    <div className="font-mono text-[10px] text-muted-foreground/50">On Chart</div>
                  ) : (
                    <div className="font-mono text-[10px] font-semibold text-live">NEW</div>
                  )}
                </div>
              </Link>
            </li>
          ))}
          {topEntries.length === 0 && (
            <li className="py-2.5 text-xs text-muted-foreground">No new entries yet</li>
          )}
        </ul>
      </div>

      {/* What's Trending */}
      <div className="flex h-full flex-col md:col-span-2 xl:col-span-1">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
            Discussion
          </span>
          <span className="h-px flex-1 bg-foreground/10" />
          <Link
            to="/trending"
            className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            See all →
          </Link>
        </div>
        <ul className="mt-4 divide-y divide-foreground/[0.07]">
          {topTrending.map((film) => (
            <li key={film.film_slug}>
              <Link
                to="/films/$slug"
                params={{ slug: film.film_slug }}
                className="group flex items-start gap-3 py-2.5"
              >
                <FilmPosterThumbnail film={film} className="h-12 w-9" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-sm group-hover:text-primary">
                    {film.title}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                    {film.trend_reason}
                  </div>
                  <div className="mt-1.5 h-0.5 bg-foreground/10">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${(film.mentions_24h / maxMentions) * 100}%` }}
                    />
                  </div>
                </div>
              </Link>
            </li>
          ))}
          {topTrending.length === 0 && (
            <li className="py-2.5 text-xs text-muted-foreground">
              No trending films yet — cards appear once titles accumulate enough audience signal.
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}

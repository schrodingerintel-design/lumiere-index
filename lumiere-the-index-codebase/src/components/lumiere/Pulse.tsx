import { useQuery } from "@tanstack/react-query";
import { ArrowUp, Sparkles, TrendingUp } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getRisingFilms, getNewEntries, getTrendingFilms } from "@/lib/apiClient";
import { PulseRowSkeleton } from "./Skeletons";
import { FilmPosterThumbnail } from "./FilmPosterThumbnail";

function gradientStyle(from: string | null, to: string | null) {
  return `linear-gradient(155deg, ${from ?? "#333"}, ${to ?? "#111"})`;
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
  const topEntries = newEntries?.slice(0, 4) ?? [];
  const topTrending = trendingFilms?.slice(0, 6) ?? [];
  const maxMentions = Math.max(...topTrending.map((f) => f.mentions_24h), 1);

  return (
    <section className="mt-12 grid grid-cols-1 gap-4 px-4 md:grid-cols-2 xl:grid-cols-3 lg:px-6">
      {/* Rising Now */}
      <div className="glass card-lift flex h-full flex-col overflow-hidden rounded-2xl">
        {big ? (
          <div className="relative h-44 overflow-hidden">
            {big.poster_url ? (
              <img
                src={big.poster_url}
                alt={big.title}
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{ background: gradientStyle(big.gradient_from, big.gradient_to) }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
            <div className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white backdrop-blur">
              <ArrowUp className="h-3 w-3 text-live" /> Biggest Mover
            </div>
            <div className="absolute inset-x-4 bottom-3 text-white">
              <div className="font-serif text-2xl leading-tight">{big.title}</div>
              <div className="text-xs text-white/80">
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
          </div>
        ) : (
          <div className="h-44 bg-foreground/5 flex items-center justify-center text-sm text-muted-foreground">
            No rising films yet
          </div>
        )}
        <div className="p-4">
          <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Rising Now
          </div>
          <ul className="space-y-2.5">
            {topRising.map((r) => (
              <li key={r.slug} className="flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <div className="truncate font-serif">{r.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.director}</div>
                </div>
                {r.is_fallback ? (
                  <span className="font-mono text-[10px] text-muted-foreground/50 tabular">
                    Charted
                  </span>
                ) : (r.movement ?? 0) !== 0 ? (
                  <span className="flex items-center gap-0.5 font-mono text-xs text-forest-deep tabular">
                    <ArrowUp className="h-3 w-3" />+{r.movement}
                  </span>
                ) : null}
              </li>
            ))}
            {topRising.length === 0 && (
              <li className="text-xs text-muted-foreground">No data yet</li>
            )}
          </ul>
        </div>
      </div>

      {/* New This Week */}
      <div className="glass card-lift flex h-full flex-col rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            New This Week
          </span>
        </div>
        <ul className="space-y-3">
          {topEntries.map((n) => (
            <li key={n.slug} className="flex items-center gap-3">
              <FilmPosterThumbnail film={n} className="h-14 w-10" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-serif text-base">{n.title}</div>
                <div className="truncate text-xs text-muted-foreground">{n.director}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-base tabular">#{n.rank}</div>
                {n.is_fallback ? (
                  <div className="font-mono text-[10px] text-muted-foreground/50">On Chart</div>
                ) : (
                  <div className="font-mono text-[10px] text-live">NEW</div>
                )}
              </div>
            </li>
          ))}
          {topEntries.length === 0 && (
            <li className="text-xs text-muted-foreground">No new entries yet</li>
          )}
        </ul>
      </div>

      {/* What's Trending */}
      <div className="glass card-lift flex h-full flex-col rounded-2xl p-4 md:col-span-2 xl:col-span-1">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              What's Trending
            </span>
          </div>
          <Link
            to="/trending"
            className="font-mono text-[10px] text-muted-foreground hover:text-foreground"
          >
            See all →
          </Link>
        </div>
        <ul className="space-y-3">
          {topTrending.map((film) => (
            <li key={film.film_slug}>
              <Link
                to="/films/$slug"
                params={{ slug: film.film_slug }}
                className="flex items-start gap-3 group"
              >
                <FilmPosterThumbnail film={film} className="h-12 w-9" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-serif text-sm group-hover:text-primary transition-colors">
                    {film.title}
                  </div>
                  <div className="mt-0.5 text-[10px] text-primary/80 font-medium leading-tight">
                    {film.trend_reason}
                  </div>
                  {film.tags[0] && (
                    <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">
                      {film.tags[0]}
                    </div>
                  )}
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-foreground/10">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(film.mentions_24h / maxMentions) * 100}%` }}
                    />
                  </div>
                </div>
              </Link>
            </li>
          ))}
          {topTrending.length === 0 && (
            <li className="text-xs text-muted-foreground">No trending films yet</li>
          )}
        </ul>
      </div>
    </section>
  );
}

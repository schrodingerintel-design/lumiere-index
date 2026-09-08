import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUp, ArrowDown } from "lucide-react";
import { type RankedFilm, searchTmdbMovie, tmdbPosterUrl } from "@/lib/apiClient";
import { filmTrend } from "@/lib/trend";

function gradientStyle(from: string | null, to: string | null) {
  return `linear-gradient(155deg, ${from ?? "#333"}, ${to ?? "#111"})`;
}

export function PosterCard({ film, width = 140 }: { film: RankedFilm; width?: number }) {
  const trend = filmTrend(film);
  const change = film.movement ?? 0;

  const { data: tmdb } = useQuery({
    queryKey: ["tmdb", film.title, film.year],
    queryFn: () => searchTmdbMovie(film.title, film.year ?? undefined),
    // Use the backend-provided poster when available — only search TMDB as a
    // fallback, so a page of cards doesn't fire dozens of slow proxy calls.
    enabled: !film.poster_url && !!film.title,
    staleTime: 24 * 60 * 60 * 1000,
    // One card fires per film (~60 per page load) — do not auto-retry, or a
    // slow/unauthenticated TMDB proxy re-floods the backend after every restart.
    retry: false,
  });

  const posterUrl = film.poster_url || tmdbPosterUrl(tmdb?.results?.[0]?.poster_path, "w342");

  return (
    <Link
      to="/films/$slug"
      params={{ slug: film.slug }}
      className="group block shrink-0"
      style={{ width }}
    >
      {/* The artwork IS the card — no container around it. */}
      <div
        className="relative aspect-[2/3] overflow-hidden bg-ink"
        style={{ background: gradientStyle(film.gradient_from, film.gradient_to) }}
      >
        {posterUrl && (
          <img
            src={posterUrl}
            alt={film.title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
            decoding="async"
          />
        )}
        {!posterUrl && (
          <div
            className="absolute inset-0 opacity-30 mix-blend-overlay"
            style={{
              backgroundImage:
                "radial-gradient(circle at 30% 20%, rgba(255,255,255,.5), transparent 50%)",
            }}
          />
        )}
        {/* Index Score — gold, quiet, on the artwork. */}
        <div className="absolute right-1.5 top-1.5 bg-black/70 px-1.5 py-1 font-mono text-[12px] font-bold leading-none text-primary">
          {film.score?.toFixed(1)}
        </div>
        {trend === "new" && (
          <div className="absolute left-1.5 top-1.5 bg-live px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-ink">
            New
          </div>
        )}
      </div>

      {/* Caption strip below the poster — rank, movement, title, year */}
      <div className="mt-2">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-xs font-semibold tabular text-muted-foreground">
            {String(film.rank).padStart(2, "0")}
          </span>
          {trend === "rise" ? (
            <span className="flex items-center font-mono text-[10px] tabular text-up">
              <ArrowUp className="h-3 w-3" />{change}
            </span>
          ) : trend === "fall" ? (
            <span className="flex items-center font-mono text-[10px] tabular text-down">
              <ArrowDown className="h-3 w-3" />{Math.abs(change)}
            </span>
          ) : trend === "steady" ? (
            <span className="font-mono text-[10px] text-yellow-300/80">—</span>
          ) : null}
        </div>
        <div className="mt-0.5 truncate font-display text-sm font-medium leading-snug">
          {film.title}
        </div>
        <div className="truncate font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {film.year}
        </div>
      </div>
    </Link>
  );
}

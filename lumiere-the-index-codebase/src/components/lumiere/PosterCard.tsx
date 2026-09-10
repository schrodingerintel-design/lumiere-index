import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  type RankedFilm,
  searchTmdbMovie,
  tmdbPosterUrl,
} from "@/lib/apiClient";

function gradientStyle(from: string | null, to: string | null) {
  return `linear-gradient(155deg, ${from ?? "#333"}, ${to ?? "#111"})`;
}

/**
 * The title card — poster as visual anchor, the way physical film artwork
 * deserves. Poster + title + score. Nothing else.
 */
export function PosterCard({
  film,
  width = 140,
  showRank = false,
}: {
  film: RankedFilm;
  /** Fixed px width for strips, or a CSS width like "100%" for grid cells. */
  width?: number | string;
  showRank?: boolean;
}) {
  const { data: tmdb } = useQuery({
    queryKey: ["tmdb", film.title, film.year],
    queryFn: () => searchTmdbMovie(film.title, film.year ?? undefined),
    // Use the backend-provided poster when available — only search TMDB as a
    // fallback, so a page of cards doesn't fire dozens of slow proxy calls.
    enabled: !film.poster_url && !!film.title,
    staleTime: 24 * 60 * 60 * 1000,
    // Do not auto-retry: a slow/unauthenticated TMDB proxy would otherwise be
    // re-flooded by a page of cards after every restart.
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
      <div
        className="relative aspect-[2/3] overflow-hidden bg-ink"
        style={{ background: gradientStyle(film.gradient_from, film.gradient_to) }}
      >
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={film.title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-xs font-display text-cream/80">
            {film.title}
          </div>
        )}
        {/* Index Score — ivory, quiet, on the artwork */}
        <div className="absolute right-1.5 top-1.5 bg-black/70 px-1.5 py-1 font-mono text-[12px] font-semibold leading-none text-cream">
          {film.score?.toFixed(1)}
        </div>
        {/* NEW badge takes the corner; the rank badge yields to it */}
        {film.prev_rank == null ? (
          <div className="absolute left-1.5 top-1.5 bg-cream px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase leading-none text-ink">
            New
          </div>
        ) : (
          showRank &&
          film.rank > 0 && (
            <div className="absolute left-1.5 top-1.5 bg-black/70 px-1.5 py-1 font-mono text-[11px] font-semibold leading-none text-cream/90">
              {String(film.rank).padStart(2, "0")}
            </div>
          )
        )}
      </div>

      <div className="mt-2">
        <div className="truncate text-sm font-medium leading-snug">{film.title}</div>
        <div className="truncate font-mono text-[11px] tabular text-muted-foreground">
          {film.year ?? ""}
        </div>
      </div>
    </Link>
  );
}

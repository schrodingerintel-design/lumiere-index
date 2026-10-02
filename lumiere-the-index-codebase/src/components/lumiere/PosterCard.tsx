import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  type RankedFilm,
  searchTmdbMovie,
  tmdbPosterUrl,
} from "@/lib/apiClient";
import { posterAt } from "@/lib/tmdbImage";
import { MomentumInline } from "./Momentum";

function gradientStyle(from: string | null, to: string | null) {
  return `linear-gradient(155deg, ${from ?? "#2a3140"}, ${to ?? "#131720"})`;
}

/**
 * The title card, as it appears anywhere off the front door.
 *
 * Identical to the home page's poster card: real artwork as the anchor, the
 * title in the plane's type, and the title's own colours as the placeholder
 * when artwork is missing. Rank is the chart's own value and only appears on an
 * official chart; an unranked title says so rather than inventing a state.
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

  const posterUrl =
    posterAt(film.poster_url, "w342") || tmdbPosterUrl(tmdb?.results?.[0]?.poster_path, "w342");

  // Rank only exists on an official chart (1–100). rank 0 / chart null ⇒ the
  // title is catalogue-only — render "Not currently ranked" semantics, never
  // a fake 0.0 score or a false "New" chart badge.
  const isRanked = (film.rank ?? 0) > 0;

  const meta = [
    film.genre_tag ?? null,
    film.country_origin ?? null,
    film.year ?? null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      to="/films/$slug"
      params={{ slug: film.slug }}
      className="ix-card"
      style={{ width }}
    >
      <div className="ix-card__art" style={{ background: gradientStyle(film.gradient_from, film.gradient_to) }}>
        {posterUrl ? (
          <img src={posterUrl} alt={`${film.title} poster`} loading="lazy" decoding="async" />
        ) : (
          <div className="ix-card__fallback">{film.title}</div>
        )}

        {/* Rank, or NEW. Unranked titles get neither — they are simply not
            currently ranked. */}
        {isRanked ? (
          film.prev_rank == null ? (
            <span className="ix-card__new">New</span>
          ) : showRank ? (
            <span className="ix-card__rk">{String(film.rank).padStart(2, "0")}</span>
          ) : null
        ) : null}

        {isRanked ? (
          <span className="ix-card__mom">
            <MomentumInline state={film.momentum} />
          </span>
        ) : null}
      </div>

      <div className="ix-card__cap">
        <div className="ix-card__t">{film.title}</div>
        <div className="ix-card__line">{meta}</div>
        {!isRanked ? (
          <div className="ix-card__line ix-card__line--dim">Not currently ranked</div>
        ) : null}
      </div>
    </Link>
  );
}

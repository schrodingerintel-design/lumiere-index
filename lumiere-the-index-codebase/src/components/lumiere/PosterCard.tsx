import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUp, ArrowDown } from "lucide-react";
import { type RankedFilm, searchTmdbMovie, tmdbPosterUrl } from "@/lib/apiClient";
import { isNewRelease } from "@/lib/filmUtils";

function gradientStyle(from: string | null, to: string | null) {
  return `linear-gradient(155deg, ${from ?? "#333"}, ${to ?? "#111"})`;
}

/** One Index-specific line per card — what the ranking says about this film. */
function indexNote(film: RankedFilm): string | null {
  if (film.prev_rank == null) return "New entry";
  const move = film.movement ?? 0;
  if (move >= 5) return `↑ ${move} positions this cycle`;
  if (move >= 1) return `↑ ${move} position${move === 1 ? "" : "s"} this cycle`;
  if (move <= -1) return `↓ ${Math.abs(move)} this cycle`;
  return null;
}

export function PosterCard({ film, width = 140 }: { film: RankedFilm; width?: number }) {
  const change = film.movement ?? null;
  const isNew = film.prev_rank == null && isNewRelease(film);

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
  const note = indexNote(film);

  return (
    <Link
      to="/films/$slug"
      params={{ slug: film.slug }}
      className="card-lift group block shrink-0"
      style={{ width }}
    >
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-xl bg-ink"
        style={{ background: gradientStyle(film.gradient_from, film.gradient_to) }}
      >
        {posterUrl && (
          <img
            src={posterUrl}
            alt={film.title}
            className="absolute inset-0 h-full w-full object-cover"
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
        <div className="absolute left-2 top-2 flex items-center gap-1">
          <span className="rounded-md border border-white/20 bg-black/60 px-2 py-1 font-mono text-xs font-medium text-white backdrop-blur-sm">
            #{film.rank}
          </span>
          {isNew ? (
            <span className="rounded-md bg-live px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
              New
            </span>
          ) : change !== 0 && change !== null ? (
            <span
              className={`flex items-center rounded-md px-1.5 py-1 font-mono text-[10px] font-medium ${
                change > 0 ? "bg-up/90 text-ink" : "bg-down/90 text-white"
              }`}
            >
              {change > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {Math.abs(change)}
            </span>
          ) : null}
        </div>

        {/* Index Score — dominant, right where the eye lands */}
        <div className="absolute right-2 top-2 rounded-full bg-primary px-2 py-1 font-mono text-[12px] font-bold leading-none text-primary-foreground shadow">
          {film.score?.toFixed(1)}
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-8">
          <div className="font-display text-lg font-semibold leading-tight text-white drop-shadow">
            {film.title}
          </div>
          {note && (
            <div className="mt-0.5 flex items-center gap-1 font-mono text-[9px] uppercase tracking-wide text-live">
              {note}
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 px-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Index Score
        </div>
      </div>
    </Link>
  );
}

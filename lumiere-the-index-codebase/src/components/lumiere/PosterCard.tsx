import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type RankedFilm, searchTmdbMovie, tmdbPosterUrl } from "@/lib/apiClient";
import { isNewRelease } from "@/lib/filmUtils";

function gradientStyle(from: string | null, to: string | null) {
  return `linear-gradient(155deg, ${from ?? "#333"}, ${to ?? "#111"})`;
}

export function PosterCard({ film, width = 140 }: { film: RankedFilm; width?: number }) {
  const change = film.movement ?? null;
  const isNew = film.prev_rank == null && isNewRelease(film);
  const director = film.director && film.director !== "Unknown" ? film.director : "Director TBA";

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
          <span className="rounded-md bg-black/50 border border-white/20 px-2 py-1 font-mono text-xs font-medium text-white backdrop-blur">
            #{film.rank}
          </span>
          {isNew ? (
            <span className="rounded-md bg-live px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
              New
            </span>
          ) : change !== 0 && change !== null ? (
            <span
              className={`rounded-md px-1.5 py-1 font-mono text-[10px] font-medium ${change > 0 ? "bg-up/90 text-ink" : "bg-down/90 text-white"}`}
            >
              {change > 0 ? "▲" : "▼"}
              {Math.abs(change)}
            </span>
          ) : null}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
          <div className="font-serif text-lg leading-tight text-white drop-shadow">
            {film.title}
          </div>
        </div>
      </div>
      <div className="mt-2 px-1">
        <div className="truncate text-xs text-muted-foreground">{director}</div>
      </div>
    </Link>
  );
}

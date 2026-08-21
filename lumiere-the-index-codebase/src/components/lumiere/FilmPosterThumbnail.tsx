import { useQuery } from "@tanstack/react-query";
import { searchTmdbMovie, tmdbPosterUrl } from "@/lib/apiClient";

/** The subset of film fields this thumbnail actually renders. */
export interface FilmThumbnailSource {
  title: string;
  year?: number | null;
  poster_url?: string | null;
  gradient_from?: string | null;
  gradient_to?: string | null;
}

interface FilmPosterThumbnailProps {
  film: FilmThumbnailSource;
  className?: string;
}

export function FilmPosterThumbnail({ film, className = "h-12 w-9" }: FilmPosterThumbnailProps) {
  // If backend provided poster_url, use it. Otherwise search TMDB.
  const { data: tmdb } = useQuery({
    queryKey: ["tmdb", film.title, film.year],
    queryFn: () => searchTmdbMovie(film.title, film.year ?? undefined),
    enabled: !film.poster_url && !!film.title,
    staleTime: 24 * 60 * 60 * 1000,
    // One card fires per film (~60 per page load) — do not auto-retry, or a
    // slow/unauthenticated TMDB proxy re-floods the backend after every restart.
    retry: false,
  });

  const poster = film.poster_url || tmdbPosterUrl(tmdb?.results?.[0]?.poster_path, "w342");
  const gradient = `linear-gradient(155deg, ${film.gradient_from ?? "#333"}, ${film.gradient_to ?? "#111"})`;

  return (
    <div className={`relative shrink-0 overflow-hidden rounded-md bg-ink ${className}`}>
      {poster ? (
        <img
          src={poster}
          alt={film.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="h-full w-full" style={{ background: gradient }} />
      )}
    </div>
  );
}

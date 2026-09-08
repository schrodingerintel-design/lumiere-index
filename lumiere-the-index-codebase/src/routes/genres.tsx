import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { getGenreFilms, getGenres, type RankedFilm } from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
import { Skeleton } from "@/components/lumiere/Skeletons";

export const Route = createFileRoute("/genres")({
  head: () => ({
    meta: [
      { title: "Browse by Genre — Lumière The Index" },
      {
        name: "description",
        content: "Explore index analytics and top films grouped by movie genres.",
      },
    ],
  }),
  component: GenresPage,
  errorComponent: RouteError,
});

interface GenreDef {
  id: string;
  name: string;
  /** The canonical backend genre_tag this filter maps to. Films enter a
   *  genre ONLY via this tag — never via synopsis keyword guessing, so
   *  Hollywood blockbusters can never leak into the wrong shelf. */
  tag: string;
}

const GENRES: GenreDef[] = [
  { id: "action", name: "Action", tag: "Action" },
  { id: "scifi", name: "Sci-Fi", tag: "Sci-Fi" },
  { id: "thriller", name: "Thriller", tag: "Thriller" },
  { id: "comedy", name: "Comedy", tag: "Comedy" },
  { id: "drama", name: "Drama", tag: "Drama" },
  { id: "romance", name: "Romance", tag: "Romance" },
  { id: "animation", name: "Animation", tag: "Animation" },
  { id: "horror", name: "Horror", tag: "Horror" },
  { id: "indie", name: "Indie", tag: "Indie" },
];

function GenresPage() {
  const [selectedGenre, setSelectedGenre] = useState<GenreDef>(GENRES[0]);

  // Fetch the list of available genres from the backend
  const { data: availableGenres = [], isLoading: genresLoading } = useQuery({
    queryKey: ["genres", "list"],
    queryFn: getGenres,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch films for the selected genre from the backend's dedicated endpoint
  const { data: genreFilms = [], isLoading: filmsLoading } = useQuery({
    queryKey: ["genres", selectedGenre.tag, "films", 100],
    queryFn: () => getGenreFilms(selectedGenre.tag, 100),
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = genresLoading || filmsLoading;
  const displayFilms = genreFilms;

  return (
    <Layout>
      <section className="px-4 pt-6 lg:px-6">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Categories
        </div>
        <h1 className="mt-2 font-display text-5xl lg:text-6xl">By Genre</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Explore cultural rankings and top titles segmented across film genres.
        </p>

        {/* Genre Selector Pills */}
        <div className="no-scrollbar mt-6 flex gap-2.5 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {availableGenres.map((g) => {
            // Find the matching GenreDef for this backend genre tag
            const matchingDef = GENRES.find((def) => def.tag.toLowerCase() === g.tag.toLowerCase());
            if (!matchingDef) return null;
            const isSelected = selectedGenre.id === matchingDef.id;
            return (
              <button
                key={g.tag}
                onClick={() => {
                  const def = GENRES.find((d) => d.tag.toLowerCase() === g.tag.toLowerCase());
                  if (def) setSelectedGenre(def);
                }}
                className={`flex shrink-0 items-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "glass border border-foreground/10 text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                }`}
              >
                <span>{g.label} ({g.count})</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Selected Genre Active Header */}
      <section className="mt-8 px-4 lg:px-6">
        <div className="flex items-center justify-between border-b border-foreground/10 pb-3">
          <div>
            <h2 className="font-display text-2xl">Top {selectedGenre.name} Films</h2>
            <p className="text-xs text-muted-foreground">
              Ranked by Index score · {displayFilms.length} titles tracked
            </p>
          </div>
        </div>

        {/* Movies Grid */}
        <div className="mt-6">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-[2/3] w-full rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : displayFilms.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {displayFilms.map((film) => (
                <Link
                  key={film.slug}
                  to="/films/$slug"
                  params={{ slug: film.slug }}
                  className="card-lift group relative block overflow-hidden rounded-xl glass border border-foreground/10 p-2"
                >
                  <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-ink">
                    {film.poster_url ? (
                      <img
                        src={film.poster_url}
                        alt={film.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-muted-foreground"
                        style={{
                          background: `linear-gradient(155deg, ${film.gradient_from ?? "#333"}, ${film.gradient_to ?? "#111"})`,
                        }}
                      >
                        {film.title}
                      </div>
                    )}
                    {film.rank > 0 && (
                      <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[9px] font-bold text-primary backdrop-blur">
                        #{film.rank}
                      </span>
                    )}
                    {film.score > 0 && (
                      <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 font-mono text-[11px] font-bold text-primary-foreground shadow">
                        {film.score.toFixed(1)}
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 px-1">
                    <div className="truncate font-display text-base font-medium leading-tight group-hover:text-primary transition">
                      {film.title}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-1">
                      <span className="font-mono text-xs text-muted-foreground">
                        {film.year || "—"}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                        Index
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
              No movies found for {selectedGenre.name}.
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}

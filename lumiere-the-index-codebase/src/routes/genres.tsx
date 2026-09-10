import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { getGenreFilms, getGenres, type RankedFilm } from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
import { FilmCardSkeleton } from "@/components/lumiere/Skeletons";
import { PosterCard } from "@/components/lumiere/PosterCard";

export const Route = createFileRoute("/genres")({
  head: () => ({
    meta: [
      { title: "Browse by Genre — The Index" },
      {
        name: "description",
        content: "Explore chart titles grouped by genre — every collection only ever contains films that genuinely belong to it.",
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
      <section className="px-4 pt-10 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
            Categories
          </div>
          <h1 className="mt-2 font-display text-4xl font-medium leading-tight sm:text-5xl">
            Genres
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Chart titles grouped by their canonical genre — every collection only ever contains
            films that genuinely belong to it.
          </p>

          {/* Genre selector — quiet pills, red marks the active shelf */}
          <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible sm:pb-0">
            {availableGenres.map((g) => {
              const matchingDef = GENRES.find(
                (def) => def.tag.toLowerCase() === g.tag.toLowerCase(),
              );
              if (!matchingDef) return null;
              const isSelected = selectedGenre.id === matchingDef.id;
              return (
                <button
                  key={g.tag}
                  onClick={() => {
                    const def = GENRES.find((d) => d.tag.toLowerCase() === g.tag.toLowerCase());
                    if (def) setSelectedGenre(def);
                  }}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-medium transition ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:border-foreground/25 hover:text-foreground"
                  }`}
                >
                  {g.label}
                  <span className={`ml-1.5 font-mono text-[11px] ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {g.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Selected genre shelf */}
      <section className="mt-8 px-4 pb-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-end justify-between border-b border-foreground/10 pb-3">
            <h2 className="font-display text-2xl font-medium">
              Top {selectedGenre.name} titles
            </h2>
            <span className="font-mono text-xs tabular text-muted-foreground">
              {displayFilms.length} {displayFilms.length === 1 ? "title" : "titles"} · by Index score
            </span>
          </div>

          <div className="mt-6">
            {isLoading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {[...Array(10)].map((_, i) => (
                  <FilmCardSkeleton key={i} />
                ))}
              </div>
            ) : displayFilms.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {displayFilms.map((film: RankedFilm) => (
                  <PosterCard key={film.slug} film={film} width="100%" showRank />
                ))}
              </div>
            ) : (
              <div className="border-y border-foreground/10 bg-surface p-12 text-center text-sm text-muted-foreground">
                No titles found for {selectedGenre.name} yet.
              </div>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}

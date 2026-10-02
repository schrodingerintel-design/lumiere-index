import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { canonicalLink, ogUrlMeta } from "@/lib/site";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { PagePlane } from "@/components/lumiere/PagePlane";
import { PageHead } from "@/components/lumiere/PageHead";
import { getGenreFilms, getGenres, type RankedFilm } from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
import { FilmCardSkeleton } from "@/components/lumiere/Skeletons";
import { PosterCard } from "@/components/lumiere/PosterCard";
import { AdSlot, isAdSlotActive } from "@/components/lumiere/AdSlot";

export const Route = createFileRoute("/genres")({
  head: () => ({
    meta: [
      { title: "Browse by Genre · The Index" },
      {
        name: "description",
        content:
          "The full catalogue grouped by genre. Ranked or not, every title is here: genre membership is independent of chart ranking.",
      },
      ogUrlMeta("/genres"),
    ],
    links: [canonicalLink("/genres")],
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

  // Future ad: genre-inline — ONE deliberately low-frequency slot between the
  // first and second halves of a large shelf. Never "after every few titles".
  // With advertising disabled (current state) this collapses to a single
  // contiguous grid identical to today's render.
  const genreAdActive = isAdSlotActive("genre-inline");
  const splitShelf = genreAdActive && displayFilms.length > 16;
  const firstGroup = splitShelf ? displayFilms.slice(0, 12) : displayFilms;
  const secondGroup = splitShelf ? displayFilms.slice(12) : [];

  return (
    <Layout>
      <PagePlane lead={firstGroup[0] ?? null} wide>
        <PageHead
          kicker="Categories"
          title="Genres"
          lede="Every title in the catalogue, grouped by its canonical genre, ranked or not. Chart membership and catalogue membership are independent: a title needs conversation signals to rank, not to belong."
        >
          {/* Genre selector — the plane's own quiet pills */}
          <div className="ix-pills">
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
                  className={isSelected ? "ix-pill is-active" : "ix-pill"}
                >
                  {g.label}
                  <span>{g.count}</span>
                </button>
              );
            })}
          </div>
        </PageHead>

        {/* Selected genre shelf */}
        <div className="ix-sec">
          <div className="ix-shelf">
            <h2>{selectedGenre.name} in the catalogue</h2>
            <span className="ix-row__num">
              {displayFilms.length} {displayFilms.length === 1 ? "title" : "titles"} · ranked
              titles first
            </span>
          </div>

          {isLoading ? (
            <div className="ix-grid">
              {[...Array(10)].map((_, i) => (
                <FilmCardSkeleton key={i} />
              ))}
            </div>
          ) : displayFilms.length > 0 ? (
            <>
              <div className="ix-grid">
                {firstGroup.map((film: RankedFilm) => (
                  <PosterCard key={film.slug} film={film} width="100%" showRank />
                ))}
              </div>
              {splitShelf && <AdSlot placement="genre-inline" />}
              {splitShelf && (
                <div className="ix-grid">
                  {secondGroup.map((film: RankedFilm) => (
                    <PosterCard key={film.slug} film={film} width="100%" showRank />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="ix-note">
              <p className="ix-note__title">Nothing here yet</p>
              <p className="ix-note__body">
                No titles found for {selectedGenre.name} yet.
              </p>
            </div>
          )}
        </div>
      </PagePlane>
    </Layout>
  );
}

import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getGenreFilms, type RankedFilm } from "@/lib/apiClient";
import { FilmCardSkeleton } from "./Skeletons";

function gradientStyle(from: string | null, to: string | null) {
  return `linear-gradient(155deg, ${from ?? "#333"}, ${to ?? "#111"})`;
}

interface GenreCategoryConfig {
  id: string;
  title: string;
  subtitle: string;
  /** The single backend `genre_tag` this collection maps to. Films enter a
   *  collection ONLY via this tag — no synopsis keyword guessing, so Hollywood
   *  blockbusters can never leak into e.g. East Asian Cinema. */
  tag: string;
}

const GENRE_CATEGORIES: GenreCategoryConfig[] = [
  {
    id: "action",
    title: "Action & High Octane",
    subtitle: "Blockbusters, adrenaline, and explosive cinematic storytelling",
    tag: "Action",
  },
  {
    id: "scifi",
    title: "Sci-Fi & Future Worlds",
    subtitle: "Futuristic visions, space epics, and speculative thrillers",
    tag: "Sci-Fi",
  },
  {
    id: "horror",
    title: "Horror & the Macabre",
    subtitle: "Night terrors, haunted houses, and dread-soaked suspense",
    tag: "Horror",
  },
  {
    id: "thriller",
    title: "Thrillers & Edge-of-Seat",
    subtitle: "Mystery, crime, and nerve-shredding suspense",
    tag: "Thriller",
  },
  {
    id: "drama",
    title: "Drama & Character Studies",
    subtitle: "Intimate portraits, social currents, and award-season contenders",
    tag: "Drama",
  },
  {
    id: "indie",
    title: "Indie & Festival Gems",
    subtitle: "Festival darlings and auteur masterworks from the circuit",
    tag: "Indie",
  },
  {
    id: "animation",
    title: "Animation & Anime",
    subtitle: "Visually breathtaking animated features from around the world",
    tag: "Animation",
  },
  {
    id: "romance",
    title: "Romance & longing",
    subtitle: "Love stories, heartbreak, and everything in between",
    tag: "Romance",
  },
  {
    id: "comedy",
    title: "Comedy",
    subtitle: "Satire, absurdity, and big laughs",
    tag: "Comedy",
  },
];

function GenreRow({ category, films }: { category: GenreCategoryConfig; films: RankedFilm[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const distance = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  };

  // Editorial one-liner per card, derived from Index signals.
  const cardNote = (film: RankedFilm): string => {
    if (film.prev_rank == null) return "New entry";
    const move = film.movement ?? 0;
    if (move > 0) return `↑ ${move} position${move === 1 ? "" : "s"} this cycle`;
    if (move < 0) return `↓ ${Math.abs(move)} position${Math.abs(move) === 1 ? "" : "s"} this cycle`;
    return "Steady this cycle";
  };

  return (
    <div className="space-y-3">
      {/* Category header — typography only, no icons */}
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h3 className="truncate font-display text-xl leading-tight text-foreground">
            {category.title}
          </h3>
          <p className="truncate text-xs text-muted-foreground">{category.subtitle}</p>
        </div>

        <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
          <button
            onClick={() => scroll("left")}
            className="flex h-9 w-9 items-center justify-center border border-foreground/15 text-muted-foreground transition hover:border-foreground/35 hover:text-foreground"
            aria-label={`Scroll ${category.title} left`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="flex h-9 w-9 items-center justify-center border border-foreground/15 text-muted-foreground transition hover:border-foreground/35 hover:text-foreground"
            aria-label={`Scroll ${category.title} right`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Horizontal scroll carousel — swipeable on touch devices */}
      <div
        ref={scrollRef}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 pt-1 scroll-smooth"
      >
        {films.map((film) => (
          <Link
            key={film.slug}
            to="/films/$slug"
            params={{ slug: film.slug }}
            className="card-lift group relative block w-[140px] shrink-0 snap-start sm:w-[160px]"
          >
            <div
              className="relative aspect-[2/3] overflow-hidden bg-ink"
              style={{ background: gradientStyle(film.gradient_from, film.gradient_to) }}
            >
              {film.poster_url ? (
                <img
                  src={film.poster_url}
                  alt={film.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-3 text-center text-xs font-display text-white/90">
                  {film.title}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

              {/* Index Score — gold on the artwork */}
              <div className="absolute right-1.5 top-1.5 bg-black/70 px-1.5 py-1 font-mono text-[12px] font-bold leading-none text-primary">
                {film.score?.toFixed(1)}
              </div>
              {film.prev_rank == null && (
                <div className="absolute left-1.5 top-1.5 bg-live px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-ink">
                  New
                </div>
              )}

              {/* Title overlay + Index note */}
              <div className="absolute inset-x-0 bottom-0 p-3">
                <div className="truncate font-display text-sm font-semibold text-white">
                  {film.title}
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-1">
                  {film.year && (
                    <div className="font-mono text-[10px] text-white/60">{film.year}</div>
                  )}
                  <div className="truncate font-mono text-[9px] uppercase tracking-wide text-live">
                    {cardNote(film)}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
        {films.length === 0 && (
          <div className="flex h-40 w-full items-center justify-center border border-dashed border-foreground/10 text-xs text-muted-foreground">
            Not enough {category.title.toLowerCase()} titles on the chart yet.
          </div>
        )}
      </div>
    </div>
  );
}

export function GenreSections() {
  // Fetch films for each genre from the backend's dedicated genre endpoint.
  // This ensures collections only contain films whose canonical genre_tag
  // genuinely matches — no client-side filtering, no leakage.
  const genreQueries = GENRE_CATEGORIES.map((category) => ({
    category,
    query: useQuery({
      queryKey: ["genres", category.tag, "films", 10],
      queryFn: () => getGenreFilms(category.tag, 24),
      staleTime: 5 * 60 * 1000,
    }),
  }));

  const isLoading = genreQueries.some((gq) => gq.query.isLoading);
  const hasError = genreQueries.some((gq) => gq.query.isError);

  return (
    <section className="mt-12 space-y-10 px-4 lg:px-6">
      <div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
            Explore by Genre
          </span>
          <span className="h-px flex-1 bg-foreground/10" />
        </div>
        <h2 className="mt-2 font-display text-3xl font-semibold">Curated Collections</h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Chart titles grouped by their genre — every collection only ever contains films that
          genuinely belong to it.
        </p>
      </div>

      {hasError ? (
        <div className="border border-foreground/10 bg-surface p-10 text-center text-sm text-muted-foreground">
          Unable to load genre collections. Please try again later.
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <FilmCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        genreQueries.map(({ category, query }) => (
          <GenreRow key={category.id} category={category} films={query.data ?? []} />
        ))
      )}
    </section>
  );
}

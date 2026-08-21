import { useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Rocket,
  Film as FilmIcon,
  Ghost,
  Sparkles,
  Award,
} from "lucide-react";
import { getNewReleaseFilms, type RankedFilm } from "@/lib/apiClient";
import { FilmCardSkeleton } from "./Skeletons";

function gradientStyle(from: string | null, to: string | null) {
  return `linear-gradient(155deg, ${from ?? "#333"}, ${to ?? "#111"})`;
}

interface GenreCategoryConfig {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  /** Relevance test — rows are padded with the catalog's top films so every
   *  section always shows a full 10-poster row. */
  matches: (film: RankedFilm) => boolean;
}

const GENRE_CATEGORIES: GenreCategoryConfig[] = [
  {
    id: "action",
    title: "Action & High Octane",
    subtitle: "Blockbusters, adrenaline, and explosive cinematic storytelling",
    icon: Flame,
    matches: (f) => {
      const s = (f.synopsis || "").toLowerCase();
      const t = (f.title || "").toLowerCase();
      return (
        s.includes("action") ||
        s.includes("fight") ||
        s.includes("race") ||
        s.includes("war") ||
        t.includes("f1") ||
        t.includes("superman")
      );
    },
  },
  {
    id: "scifi",
    title: "Sci-Fi & Cyberpunk",
    subtitle: "Futuristic visions, space epics, and speculative thrillers",
    icon: Rocket,
    matches: (f) => {
      const s = (f.synopsis || "").toLowerCase();
      const t = (f.title || "").toLowerCase();
      return (
        s.includes("sci-fi") ||
        s.includes("future") ||
        s.includes("alien") ||
        s.includes("space") ||
        t.includes("dune") ||
        t.includes("alien")
      );
    },
  },
  {
    id: "indie",
    title: "Indie & Festival Gems",
    subtitle: "Festival darlings, auteur masterworks, and award-season contenders",
    icon: Award,
    matches: (f) => {
      const s = (f.synopsis || "").toLowerCase();
      return (
        s.includes("drama") ||
        s.includes("award") ||
        s.includes("festival") ||
        s.includes("substance") ||
        s.includes("anora")
      );
    },
  },
  {
    id: "asian",
    title: "East Asian Cinema",
    subtitle: "Visionary masterpieces, noir thrillers, and acclaimed features",
    icon: Sparkles,
    matches: (f) => {
      const c = (f.country_origin || "").toUpperCase();
      const s = (f.synopsis || "").toLowerCase();
      return (
        c === "KR" ||
        c === "JP" ||
        c === "CN" ||
        c === "HK" ||
        s.includes("korean") ||
        s.includes("japan")
      );
    },
  },
  {
    id: "animation",
    title: "Animation & Anime",
    subtitle: "Visually breathtaking animated features from around the world",
    icon: FilmIcon,
    matches: (f) => {
      const s = (f.synopsis || "").toLowerCase();
      return s.includes("animat") || s.includes("anime") || s.includes("cartoon");
    },
  },
  {
    id: "thriller",
    title: "Thriller & Suspense",
    subtitle: "Psychological tension, dark mysteries, and suspenseful narratives",
    icon: Ghost,
    matches: (f) => {
      const s = (f.synopsis || "").toLowerCase();
      return (
        s.includes("thriller") ||
        s.includes("mystery") ||
        s.includes("murder") ||
        s.includes("horror") ||
        s.includes("sinners")
      );
    },
  },
];

const ROW_LIMIT = 10;

/**
 * Build one 10-film row per category: real keyword matches first, then the
 * catalog's top films are dealt in to fill the row out to ten. Because the
 * keyword pool is small, every row ends up carrying the same headliners —
 * the classic six-section genre layout.
 */
function buildGenreRows(catalogFilms: RankedFilm[]): RankedFilm[][] {
  return GENRE_CATEGORIES.map((category) => {
    const row: RankedFilm[] = [];
    const inRow = new Set<string>();

    for (const film of catalogFilms) {
      if (row.length >= ROW_LIMIT) break;
      if (category.matches(film)) {
        row.push(film);
        inRow.add(film.slug);
      }
    }

    let i = 0;
    while (row.length < ROW_LIMIT && i < catalogFilms.length) {
      const film = catalogFilms[i];
      i++;
      if (!inRow.has(film.slug)) {
        row.push(film);
        inRow.add(film.slug);
      }
    }

    return row;
  });
}

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

  const Icon = category.icon;

  return (
    <div className="space-y-3">
      {/* Category Header with scroll arrows */}
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-serif text-xl leading-tight text-foreground">
              {category.title}
            </h3>
            <p className="truncate text-xs text-muted-foreground">{category.subtitle}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => scroll("left")}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground/10 bg-background/60 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
            aria-label={`Scroll ${category.title} left`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground/10 bg-background/60 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
            aria-label={`Scroll ${category.title} right`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Horizontal scroll carousel */}
      <div
        ref={scrollRef}
        className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 pt-1 scroll-smooth"
      >
        {films.map((film) => (
          <Link
            key={film.slug}
            to="/films/$slug"
            params={{ slug: film.slug }}
            className="card-lift group relative block w-[140px] shrink-0 sm:w-[160px]"
          >
            <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-ink">
              {film.poster_url ? (
                <img
                  src={film.poster_url}
                  alt={film.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center p-3 text-center text-xs font-serif text-white/90"
                  style={{ background: gradientStyle(film.gradient_from, film.gradient_to) }}
                >
                  {film.title}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 transition-opacity group-hover:opacity-60" />

              {/* Rank Badge */}
              <div className="absolute top-2 left-2 rounded-full bg-live/90 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-ink shadow-sm">
                #{film.rank}
              </div>

              {/* Title overlay */}
              <div className="absolute inset-x-0 bottom-0 p-3">
                <div className="truncate font-serif text-sm font-medium text-white drop-shadow">
                  {film.title}
                </div>
                {film.year && (
                  <div className="font-mono text-[10px] text-white/70">{film.year}</div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function GenreSections() {
  const { data: catalogFilms = [], isLoading } = useQuery({
    queryKey: ["films", "new-releases", 100],
    queryFn: () => getNewReleaseFilms(100),
    staleTime: 5 * 60 * 1000,
  });

  const rows = useMemo(() => buildGenreRows(catalogFilms), [catalogFilms]);

  return (
    <section className="mt-12 space-y-12 px-4 lg:px-6">
      <div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Explore by Genre
        </div>
        <h2 className="mt-1 font-serif text-3xl">Curated Feature Collections</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Discover feature films segmented by genre, ranked by global audience sentiment and
          cultural velocity.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <FilmCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        GENRE_CATEGORIES.map((category, ci) => (
          <GenreRow key={category.id} category={category} films={rows[ci] ?? []} />
        ))
      )}
    </section>
  );
}

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
        s.includes("action") || s.includes("fight") || s.includes("race") ||
        s.includes("war") || s.includes("battle") || s.includes("combat") ||
        s.includes("chase") || s.includes("explosion") || s.includes("martial") ||
        s.includes("mission") || s.includes("soldier") ||
        t.includes("f1") || t.includes("superman") || t.includes("warfare") ||
        t.includes("captain america") || t.includes("thunderbolts")
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
        s.includes("sci-fi") || s.includes("science fiction") ||
        s.includes("future") || s.includes("alien") || s.includes("space") ||
        s.includes("robot") || s.includes("clone") || s.includes("planet") ||
        s.includes("dystopian") || s.includes("dimension") ||
        t.includes("dune") || t.includes("avatar") ||
        t.includes("mickey 17") || t.includes("elio") ||
        t.includes("man from nowhere")
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
      const t = (f.title || "").toLowerCase();
      return (
        s.includes("drama") ||
        s.includes("award") ||
        s.includes("festival") ||
        s.includes("sundance") ||
        s.includes("cannes") ||
        s.includes("venice") ||
        s.includes("berlin") ||
        s.includes("independent") ||
        s.includes("indie") ||
        s.includes("arthouse") ||
        s.includes("auteur") ||
        s.includes("character study") ||
        t.includes("substance") ||
        t.includes("anora") ||
        t.includes("brutalist") ||
        t.includes("complete unknown") ||
        t.includes("emilia perez") ||
        t.includes("nosferatu") ||
        t.includes("i\'m still here")
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
      const t = (f.title || "").toLowerCase();
      return (
        s.includes("animat") || s.includes("anime") || s.includes("cartoon") ||
        s.includes("animated") ||
        t.includes("elio") || t.includes("lilo") || t.includes("minecraft") ||
        t.includes("dragon") || t.includes("inside out") ||
        t.includes("how to train") || t.includes("ne zha") ||
        t.includes("wild robot") || t.includes("zootopia")
      );
    },
  },
  {
    id: "thriller",
    title: "Thriller & Suspense",
    subtitle: "Psychological tension, dark mysteries, and suspenseful narratives",
    icon: Ghost,
    matches: (f) => {
      const s = (f.synopsis || "").toLowerCase();
      const t = (f.title || "").toLowerCase();
      return (
        s.includes("thriller") || s.includes("mystery") || s.includes("murder") ||
        s.includes("conspiracy") || s.includes("crime") || s.includes("detective") ||
        s.includes("spy") || s.includes("heist") || s.includes("noir") ||
        s.includes("investigation") || s.includes("horror") ||
        t.includes("black bag") || t.includes("novocaine") ||
        t.includes("alto knights") || t.includes("sinners")
      );
    },
  },
];

const ROW_LIMIT = 10;
const MIN_FILMS_FOR_FULL_ROW = 5; // Pad rows with fewer than this many films

/**
 * Build one ROW_LIMIT-film row per category.
 *
 * Each film is assigned to AT MOST ONE category:
 *   1. Primary match  — the film's synopsis/title satisfies the category's
 *      `matches()` predicate. The film is claimed by the first category it
 *      matches (categories are processed in order).
 *   2. Padding        — once all genuine matches are assigned we deal catalog
 *      films round-robin across categories until every row hits ROW_LIMIT,
 *      but each padding film is only ever added to ONE row.
 *
 * This prevents the same blockbuster from appearing in every section.
 */
function buildGenreRows(catalogFilms: RankedFilm[]): RankedFilm[][] {
  const globallyUsed = new Set<string>();
  const rows: RankedFilm[][] = GENRE_CATEGORIES.map(() => []);
  const inRow: Set<string>[] = GENRE_CATEGORIES.map(() => new Set<string>());

  // ── Pass 1: exclusive primary matches ────────────────────────────────────
  // Each film goes to the FIRST category whose predicate it satisfies.
  for (const film of catalogFilms) {
    for (let ci = 0; ci < GENRE_CATEGORIES.length; ci++) {
      if (rows[ci].length < ROW_LIMIT && GENRE_CATEGORIES[ci].matches(film) && !globallyUsed.has(film.slug)) {
        rows[ci].push(film);
        inRow[ci].add(film.slug);
        globallyUsed.add(film.slug);
        break; // only one category per film
      }
    }
  }

  // ── Pass 2: round-robin padding for sparse rows ─────────────────────────
  // Pad rows that have fewer than MIN_FILMS_FOR_FULL_ROW films to ensure
  // every section looks reasonably full. We use round-robin across categories
  // to distribute films fairly.
  for (let ci = 0; ci < GENRE_CATEGORIES.length; ci++) {
    if (rows[ci].length >= MIN_FILMS_FOR_FULL_ROW) continue;
    for (const film of catalogFilms) {
      if (rows[ci].length >= ROW_LIMIT) break;
      if (!globallyUsed.has(film.slug)) {
        rows[ci].push(film);
        inRow[ci].add(film.slug);
        globallyUsed.add(film.slug);
      }
    }
  }

  return rows;
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
    <section className="mt-8 space-y-10 px-4 lg:px-6">
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

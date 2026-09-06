import { useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Rocket,
  Ghost,
  Sparkles,
  Award,
  Film as FilmIcon,
  Heart,
  Smile,
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
    icon: Flame,
    tag: "Action",
  },
  {
    id: "scifi",
    title: "Sci-Fi & Future Worlds",
    subtitle: "Futuristic visions, space epics, and speculative thrillers",
    icon: Rocket,
    tag: "Sci-Fi",
  },
  {
    id: "horror",
    title: "Horror & the Macabre",
    subtitle: "Night terrors, haunted houses, and dread-soaked suspense",
    icon: Ghost,
    tag: "Horror",
  },
  {
    id: "drama",
    title: "Drama & Character Studies",
    subtitle: "Intimate portraits, social currents, and award-season contenders",
    icon: Award,
    tag: "Drama",
  },
  {
    id: "indie",
    title: "Indie & Festival Gems",
    subtitle: "Festival darlings and auteur masterworks from the circuit",
    icon: Sparkles,
    tag: "Indie",
  },
  {
    id: "animation",
    title: "Animation & Anime",
    subtitle: "Visually breathtaking animated features from around the world",
    icon: FilmIcon,
    tag: "Animation",
  },
  {
    id: "romance",
    title: "Romance & longing",
    subtitle: "Love stories, heartbreak, and everything in between",
    icon: Heart,
    tag: "Romance",
  },
  {
    id: "comedy",
    title: "Comedy",
    subtitle: "Satire, absurdity, and big laughs",
    icon: Smile,
    tag: "Comedy",
  },
];

const ROW_LIMIT = 10;

/**
 * Build one row per category. Films are assigned to AT MOST ONE collection —
 * the first (highest-priority) matching tag wins — and rows only ever contain
 * films whose backend genre_tag genuinely matches. A sparse row is shown as
 * sparse; we never pad collections with unrelated films.
 */
function buildGenreRows(catalogFilms: RankedFilm[]): RankedFilm[][] {
  const claimed = new Set<string>();
  const rows: RankedFilm[][] = GENRE_CATEGORIES.map(() => []);

  for (const film of catalogFilms) {
    const filmTag = (film.genre_tag ?? "").trim().toLowerCase();
    if (!filmTag || claimed.has(film.slug)) continue;
    const ci = GENRE_CATEGORIES.findIndex(
      (c) => c.tag.toLowerCase() === filmTag && rows[GENRE_CATEGORIES.indexOf(c)].length < ROW_LIMIT,
    );
    if (ci === -1) continue;
    rows[ci].push(film);
    claimed.add(film.slug);
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

  // Editorial one-liner per card, derived from Index signals.
  const cardNote = (film: RankedFilm): string => {
    if (film.prev_rank == null) return "New entry";
    const move = film.movement ?? 0;
    if (move >= 5) return `↑ ${move} positions this cycle`;
    if (move >= 1) return `↑ ${move} position${move === 1 ? "" : "s"} this cycle`;
    if (move <= -1) return `↓ ${Math.abs(move)} this cycle`;
    return `Holding at #${film.rank}`;
  };

  return (
    <div className="space-y-3">
      {/* Category Header with scroll arrows */}
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-display text-xl leading-tight text-foreground">
              {category.title}
            </h3>
            <p className="truncate text-xs text-muted-foreground">{category.subtitle}</p>
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
          <button
            onClick={() => scroll("left")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/10 bg-background/60 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
            aria-label={`Scroll ${category.title} left`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/10 bg-background/60 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
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
                  className="flex h-full w-full items-center justify-center p-3 text-center text-xs font-display text-white/90"
                  style={{ background: gradientStyle(film.gradient_from, film.gradient_to) }}
                >
                  {film.title}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

              {/* Rank badge */}
              <div className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-white backdrop-blur-sm border border-white/15">
                #{film.rank}
              </div>

              {/* Index Score — dominant on the card */}
              <div className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 font-mono text-[11px] font-bold text-primary-foreground shadow">
                {film.score?.toFixed(1)}
              </div>

              {/* Title overlay + Index-specific note */}
              <div className="absolute inset-x-0 bottom-0 p-3">
                <div className="truncate font-display text-sm font-semibold text-white drop-shadow">
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
          <div className="flex h-40 w-full items-center justify-center rounded-xl border border-dashed border-foreground/10 text-xs text-muted-foreground">
            Not enough {category.title.toLowerCase()} titles on the chart yet.
          </div>
        )}
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
    <section className="mt-12 space-y-10 px-4 lg:px-6">
      <div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Explore by Genre
        </div>
        <h2 className="mt-1 font-display text-3xl">Curated Collections</h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Chart titles grouped by their genre — every collection only ever contains films that
          genuinely belong to it.
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

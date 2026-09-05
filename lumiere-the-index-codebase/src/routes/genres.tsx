import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { getTopFilms, getNewReleaseFilms, type RankedFilm } from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
import { Film, Flame, Rocket, Ghost, Sparkles, Heart, Smile, ShieldAlert } from "lucide-react";
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
  icon: React.ElementType;
  color: string;
  /** Returns true if a catalog film belongs to this genre */
  matches: (f: RankedFilm) => boolean;
}

const GENRES: GenreDef[] = [
  {
    id: "action",
    name: "Action",
    icon: Flame,
    color: "from-red-500/15 to-amber-500/10 text-red-500",
    matches: (f) => {
      const s = (f.synopsis || "").toLowerCase();
      const t = (f.title || "").toLowerCase();
      return (
        s.includes("action") || s.includes("war") || s.includes("race") ||
        s.includes("fight") || s.includes("battle") || s.includes("mission") ||
        s.includes("soldier") || s.includes("combat") || s.includes("explosion") ||
        s.includes("martial") || s.includes("chase") ||
        t.includes("f1") || t.includes("superman") || t.includes("warfare") ||
        t.includes("mission impossible") || t.includes("captain america") ||
        t.includes("thunderbolts") || t.includes("accountant")
      );
    },
  },
  {
    id: "scifi",
    name: "Sci-Fi",
    icon: Rocket,
    color: "from-blue-500/15 to-cyan-500/10 text-blue-500",
    matches: (f) => {
      const s = (f.synopsis || "").toLowerCase();
      const t = (f.title || "").toLowerCase();
      return (
        s.includes("sci-fi") || s.includes("science fiction") ||
        s.includes("alien") || s.includes("space") || s.includes("future") ||
        s.includes("robot") || s.includes("clone") || s.includes("planet") ||
        s.includes("dystopian") || s.includes("cyberpunk") || s.includes("dimension") ||
        t.includes("dune") || t.includes("avatar") || t.includes("mickey 17") ||
        t.includes("elio") || t.includes("klara") || t.includes("man from nowhere")
      );
    },
  },
  {
    id: "thriller",
    name: "Thriller",
    icon: Ghost,
    color: "from-emerald-500/15 to-teal-500/10 text-emerald-500",
    matches: (f) => {
      const s = (f.synopsis || "").toLowerCase();
      const t = (f.title || "").toLowerCase();
      return (
        s.includes("thriller") || s.includes("mystery") || s.includes("murder") ||
        s.includes("conspiracy") || s.includes("crime") || s.includes("detective") ||
        s.includes("framed") || s.includes("spy") || s.includes("serial") ||
        s.includes("heist") || s.includes("noir") || s.includes("investigation") ||
        t.includes("black bag") || t.includes("novocaine") || t.includes("alto knights")
      );
    },
  },
  {
    id: "comedy",
    name: "Comedy",
    icon: Smile,
    color: "from-amber-500/15 to-yellow-500/10 text-amber-500",
    matches: (f) => {
      const s = (f.synopsis || "").toLowerCase();
      const t = (f.title || "").toLowerCase();
      return (
        s.includes("comedy") || s.includes("hilarious") || s.includes("laugh") ||
        s.includes("funny") || s.includes("humorous") || s.includes("slapstick") ||
        s.includes("satire") || s.includes("parody") ||
        t.includes("minecraft") || t.includes("bugonia") || t.includes("honey don't")
      );
    },
  },
  {
    id: "drama",
    name: "Drama",
    icon: Film,
    color: "from-purple-500/15 to-indigo-500/10 text-purple-500",
    matches: (f) => {
      const s = (f.synopsis || "").toLowerCase();
      const t = (f.title || "").toLowerCase();
      return (
        s.includes("drama") || s.includes("family") || s.includes("relationship") ||
        s.includes("biography") || s.includes("historical") || s.includes("social") ||
        s.includes("struggles") || s.includes("intimate") || s.includes("poignant") ||
        t.includes("anora") || t.includes("wicked") || t.includes("conclave") ||
        t.includes("brutalist") || t.includes("complete unknown") ||
        t.includes("snow white") || t.includes("the bride")
      );
    },
  },
  {
    id: "romance",
    name: "Romance",
    icon: Heart,
    color: "from-pink-500/15 to-rose-500/10 text-pink-500",
    matches: (f) => {
      const s = (f.synopsis || "").toLowerCase();
      return (
        s.includes("love") || s.includes("romance") || s.includes("romantic") ||
        s.includes("wedding") || s.includes("heart") || s.includes("couple") ||
        s.includes("affair") || s.includes("marry") || s.includes("dating") ||
        s.includes("passion") || s.includes("soulmate")
      );
    },
  },
  {
    id: "animation",
    name: "Animation",
    icon: Sparkles,
    color: "from-indigo-500/15 to-blue-500/10 text-indigo-500",
    matches: (f) => {
      const s = (f.synopsis || "").toLowerCase();
      const t = (f.title || "").toLowerCase();
      return (
        s.includes("animat") || s.includes("anime") || s.includes("cartoon") ||
        s.includes("animated") || s.includes("cgI") ||
        t.includes("elio") || t.includes("lilo") || t.includes("minecraft") ||
        t.includes("dragon") || t.includes("inside out") ||
        t.includes("how to train") || t.includes("zootopia") ||
        t.includes("ne zha") || t.includes("wild robot")
      );
    },
  },
  {
    id: "horror",
    name: "Horror",
    icon: ShieldAlert,
    color: "from-orange-500/15 to-red-500/10 text-orange-500",
    matches: (f) => {
      const s = (f.synopsis || "").toLowerCase();
      const t = (f.title || "").toLowerCase();
      return (
        s.includes("horror") || s.includes("vampire") || s.includes("ghost") ||
        s.includes("demon") || s.includes("monster") || s.includes("dead") ||
        s.includes("zombie") || s.includes("supernatural") || s.includes("cult") ||
        s.includes("haunted") || s.includes("slasher") ||
        t.includes("nosferatu") || t.includes("sinners") || t.includes("heretic") ||
        t.includes("28 years") || t.includes("until dawn") ||
        t.includes("death of a unicorn") || t.includes("final destination") ||
        t.includes("substance")
      );
    },
  },
];

function GenresPage() {
  const [selectedGenre, setSelectedGenre] = useState<GenreDef>(GENRES[0]);

  // Use our catalog films — reliable posters + scores from the Index
  const { data: topFilms = [], isLoading: topLoading } = useQuery({
    queryKey: ["films", "top", 100],
    queryFn: () => getTopFilms(100),
    staleTime: 5 * 60 * 1000,
  });

  const { data: newReleases = [], isLoading: newLoading } = useQuery({
    queryKey: ["films", "new-releases", 100],
    queryFn: () => getNewReleaseFilms(100),
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = topLoading || newLoading;

  // Deduplicated union catalog, ranked by score
  const allFilms = useMemo(() => {
    const seen = new Set<string>();
    const merged: RankedFilm[] = [];
    for (const f of [...topFilms, ...newReleases]) {
      if (!seen.has(f.slug)) {
        seen.add(f.slug);
        merged.push(f);
      }
    }
    return merged.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }, [topFilms, newReleases]);

  // Filter to selected genre
  const filteredFilms = useMemo(
    () => allFilms.filter((f) => selectedGenre.matches(f)),
    [allFilms, selectedGenre],
  );

  // Fallback: if genre filter is too narrow, supplement with top-ranked catalog films
  const displayFilms = useMemo(() => {
    if (filteredFilms.length >= 5) return filteredFilms;
    const filteredSlugs = new Set(filteredFilms.map((f) => f.slug));
    const supplements = allFilms.filter((f) => !filteredSlugs.has(f.slug)).slice(0, 20 - filteredFilms.length);
    return [...filteredFilms, ...supplements];
  }, [filteredFilms, allFilms]);

  const ActiveIcon = selectedGenre.icon;

  return (
    <Layout>
      <section className="px-4 pt-6 lg:px-6">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Categories
        </div>
        <h1 className="mt-2 font-serif text-5xl lg:text-6xl">By Genre</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Explore cultural rankings and top titles segmented across film genres.
        </p>

        {/* Genre Selector Pills */}
        <div className="no-scrollbar mt-6 flex gap-2.5 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {GENRES.map((g) => {
            const Icon = g.icon;
            const isSelected = selectedGenre.id === g.id;
            return (
              <button
                key={g.id}
                onClick={() => setSelectedGenre(g)}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "glass border border-foreground/10 text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{g.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Selected Genre Active Header */}
      <section className="mt-8 px-4 lg:px-6">
        <div className="flex items-center justify-between border-b border-foreground/10 pb-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${selectedGenre.color}`}
            >
              <ActiveIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif text-2xl">Top {selectedGenre.name} Films</h2>
              <p className="text-xs text-muted-foreground">
                Ranked by Index score · {displayFilms.length} titles tracked
              </p>
            </div>
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
              {displayFilms.map((film, i) => (
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
                    {i < filteredFilms.length && (
                      <span className="absolute right-2 top-2 rounded-full bg-primary/90 px-2 py-0.5 font-mono text-[9px] font-bold text-white backdrop-blur">
                        {selectedGenre.name}
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 px-1">
                    <div className="truncate font-serif text-base font-medium leading-tight group-hover:text-primary transition">
                      {film.title}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-1">
                      <span className="font-mono text-xs text-muted-foreground">
                        {film.year || "—"}
                      </span>
                      {film.score > 0 && (
                        <span className="font-mono text-xs text-primary font-semibold">
                          {film.score.toFixed(0)}
                        </span>
                      )}
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

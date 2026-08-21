import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { discoverTmdbMovies, tmdbPosterUrl } from "@/lib/apiClient";
import { slugify } from "@/lib/utils";
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
  id: number;
  name: string;
  icon: React.ElementType;
  color: string;
}

const GENRES: GenreDef[] = [
  { id: 28, name: "Action", icon: Flame, color: "from-red-500/15 to-amber-500/10 text-red-500" },
  { id: 878, name: "Sci-Fi", icon: Rocket, color: "from-blue-500/15 to-cyan-500/10 text-blue-500" },
  {
    id: 53,
    name: "Thriller",
    icon: Ghost,
    color: "from-emerald-500/15 to-teal-500/10 text-emerald-500",
  },
  {
    id: 35,
    name: "Comedy",
    icon: Smile,
    color: "from-amber-500/15 to-yellow-500/10 text-amber-500",
  },
  {
    id: 18,
    name: "Drama",
    icon: Film,
    color: "from-purple-500/15 to-indigo-500/10 text-purple-500",
  },
  {
    id: 10749,
    name: "Romance",
    icon: Heart,
    color: "from-pink-500/15 to-rose-500/10 text-pink-500",
  },
  {
    id: 16,
    name: "Animation",
    icon: Sparkles,
    color: "from-indigo-500/15 to-blue-500/10 text-indigo-500",
  },
  {
    id: 27,
    name: "Horror",
    icon: ShieldAlert,
    color: "from-orange-500/15 to-red-500/10 text-orange-500",
  },
];

function GenresPage() {
  const [selectedGenre, setSelectedGenre] = useState<GenreDef>(GENRES[0]);

  const {
    data: movies,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["tmdb", "genre", selectedGenre.id],
    // Fail loudly instead of returning [] on error: a swallowed failure used to
    // get cached as an empty list (staleTime 1h), leaving the page blank even
    // after the backend recovered.
    queryFn: async () => {
      const json = await discoverTmdbMovies({ genres: String(selectedGenre.id) });
      return json.results ?? [];
    },
    staleTime: 60 * 60 * 1000,
    retry: 2,
  });

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

        {/* Genre Selector Pills — swipeable tab row on mobile, wrap on larger screens */}
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
                Ranked by audience sentiment & Index score
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
          ) : isError ? (
            <div className="glass rounded-2xl p-10 text-center">
              <p className="text-sm text-muted-foreground">
                Couldn't load {selectedGenre.name} titles right now.
              </p>
              <button
                onClick={() => refetch()}
                className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                Try again
              </button>
            </div>
          ) : movies && movies.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {movies.map((m) => {
                const poster = tmdbPosterUrl(m.poster_path, "w342");
                const year = m.release_date ? new Date(m.release_date).getFullYear() : null;

                return (
                  <Link
                    key={m.id}
                    to="/films/$slug"
                    params={{ slug: slugify(m.title) }}
                    className="card-lift group relative block overflow-hidden rounded-xl glass border border-foreground/10 p-2"
                  >
                    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-ink">
                      {poster ? (
                        <img
                          src={poster}
                          alt={m.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
                          {m.title}
                        </div>
                      )}
                    </div>

                    <div className="mt-2.5 px-1">
                      <div className="truncate font-serif text-base font-medium leading-tight group-hover:text-primary transition">
                        {m.title}
                      </div>
                      {year && (
                        <div className="mt-0.5 font-mono text-xs text-muted-foreground">{year}</div>
                      )}
                    </div>
                  </Link>
                );
              })}
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { getNewEntries } from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
import { FilmCardSkeleton } from "@/components/lumiere/Skeletons";
import { FilmPosterThumbnail } from "@/components/lumiere/FilmPosterThumbnail";
import { CalendarClock, Sparkles } from "lucide-react";

export const Route = createFileRoute("/new-entries")({
  head: () => ({
    meta: [
      { title: "New Entries — Lumière The Index" },
      {
        name: "description",
        content: "Movies that just hit theaters, released in the last month.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery({
      queryKey: ["films", "new-entries"],
      queryFn: () => getNewEntries(),
    });
  },
  component: NewEntriesPage,
  errorComponent: RouteError,
});

function formatDate(iso: string | null): string {
  if (!iso) return "Date TBA";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function FilmCard({ film }: { film: import("@/lib/apiClient").RankedFilm }) {
  const director = film.director && film.director !== "Unknown" ? film.director : "Director TBA";
  return (
    <div className="glass card-lift overflow-hidden rounded-2xl">
      <div className="relative aspect-[2/3] overflow-hidden">
        <FilmPosterThumbnail film={film} className="h-full w-full rounded-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <span className="absolute left-3 top-3 rounded-md bg-live px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-ink z-10">
          New
        </span>
        {film.rank > 0 && (
          <div className="absolute right-3 top-3 z-10 rounded-md bg-black/50 px-2 py-1 font-mono text-xs text-white backdrop-blur">
            #{film.rank}
          </div>
        )}
        <div className="absolute inset-x-3 bottom-3 text-white z-10">
          <div className="flex items-center gap-1.5 font-mono text-xs text-white/80">
            <CalendarClock className="h-3 w-3" />
            {formatDate(film.release_date)}
          </div>
          <div className="mt-0.5 font-serif text-xl leading-tight">{film.title}</div>
        </div>
      </div>
      <div className="p-3 text-xs text-muted-foreground">{director}</div>
    </div>
  );
}

function NewEntriesPage() {
  const {
    data: films,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["films", "new-entries"],
    // Arrow wrapper — React Query passes its context object as the first arg,
    // which would otherwise become `limit=[object Object]` → 422.
    queryFn: () => getNewEntries(),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Layout>
      <section className="px-4 pt-6 lg:px-6">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Debuts</div>
        <h1 className="mt-2 font-serif text-5xl lg:text-6xl">New Entries</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Movies that just hit theaters — every new release on the Index from the last 30 days.
        </p>
        <Link
          to="/calendar"
          className="mt-4 inline-flex items-center gap-1.5 font-mono text-xs text-primary hover:underline"
        >
          See what's coming next on Now &amp; Next →
        </Link>
      </section>

      <section className="mt-10 px-4 lg:px-6">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Released in the last 30 days
            </div>
            <h2 className="mt-1 font-serif text-3xl">New This Month</h2>
          </div>
        </div>

        {error && (
          <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
            Unable to load data. Please try again later.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading
            ? [...Array(8)].map((_, i) => <FilmCardSkeleton key={i} />)
            : films?.map((f) => <FilmCard key={f.slug} film={f} />)}
        </div>

        {!isLoading && films?.length === 0 && (
          <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
            No films have been released in the last month yet. Check back after the next ingest
            cycle.
          </div>
        )}
      </section>
    </Layout>
  );
}

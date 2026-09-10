import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { getIndexNewEntries } from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
import { FilmCardSkeleton } from "@/components/lumiere/Skeletons";

export const Route = createFileRoute("/new-entries")({
  head: () => ({
    meta: [
      { title: "New Entries — The Index" },
      {
        name: "description",
        content:
          "Films entering The Index for the first time — their official debut rank and date.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.prefetchQuery({
      queryKey: ["index", "new-entries"],
      queryFn: () => getIndexNewEntries(),
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

function FilmCard({ film }: { film: import("@/lib/apiClient").NewEntryFilm }) {
  const director = film.director && film.director !== "Unknown" ? film.director : null;
  return (
    <Link to="/films/$slug" params={{ slug: film.slug }} className="group block">
      <div
        className="relative aspect-[2/3] overflow-hidden bg-ink"
        style={{
          background: `linear-gradient(155deg, ${film.gradient_from ?? "#333"}, ${film.gradient_to ?? "#111"})`,
        }}
      >
        {film.poster_url ? (
          <img
            src={film.poster_url}
            alt={film.title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-xs text-cream/80">
            {film.title}
          </div>
        )}
        {/* Debut rank + debut score — the measurement on the artwork */}
        <div className="absolute right-1.5 top-1.5 bg-black/70 px-1.5 py-1 font-mono text-[12px] font-semibold leading-none text-cream">
          {film.debut_score?.toFixed(1)}
        </div>
        <div className="absolute left-1.5 top-1.5 bg-foreground/90 px-1.5 py-1 font-mono text-[10px] font-bold uppercase leading-none text-ink">
          New
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-8">
          <div className="truncate text-sm font-medium text-white">{film.title}</div>
          <div className="mt-1 font-mono text-[11px] text-white/80">
            Debuted #{film.debut_rank} · {formatDate(film.debut_date)}
          </div>
        </div>
      </div>
      <div className="mt-2 truncate text-xs text-muted-foreground">
        {[director, film.year].filter(Boolean).join(" · ")}
      </div>
    </Link>
  );
}

function NewEntriesPage() {
  const { data: films, isLoading, error } = useQuery({
    queryKey: ["index", "new-entries"],
    // Arrow wrapper — React Query passes its context object as the first arg,
    // which would otherwise become `limit=[object Object]` → 422.
    queryFn: () => getIndexNewEntries(),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Layout>
      <section className="px-4 pt-10 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
            Debuts
          </div>
          <h1 className="mt-2 font-display text-4xl font-medium leading-tight sm:text-5xl">
            New Entries
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Films entering The Index for the first time — where they debuted and when. Each film
            appears here once, at its debut.
          </p>
          <Link
            to="/calendar"
            className="mt-4 inline-block text-[13px] font-medium text-muted-foreground transition hover:text-foreground"
          >
            What's coming next →
          </Link>
        </div>
      </section>

      <section className="mt-10 px-4 pb-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          {error && (
            <div className="border-y border-foreground/10 bg-surface p-8 text-center text-sm text-muted-foreground">
              Unable to load data. Please try again later.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {isLoading
              ? [...Array(10)].map((_, i) => <FilmCardSkeleton key={i} />)
              : films?.map((f) => <FilmCard key={f.slug} film={f} />)}
          </div>

          {!isLoading && !error && films?.length === 0 && (
            <div className="border-y border-foreground/10 bg-surface p-12 text-center text-sm text-muted-foreground">
              No debuts on the published Index yet. New Entries appear after the next daily
              publication once films chart for the first time.
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}

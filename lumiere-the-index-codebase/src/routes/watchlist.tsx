import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { canonicalLink, ogUrlMeta } from "@/lib/site";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { PagePlane } from "@/components/lumiere/PagePlane";
import { PageHead } from "@/components/lumiere/PageHead";
import { Skeleton } from "@/components/lumiere/Skeletons";
import { getNewReleaseFilms, getTopFilms, type RankedFilm } from "@/lib/apiClient";
import { RouteError } from "@/lib/route-error";
import { Bookmark, BookmarkX } from "lucide-react";
import { FilmPosterThumbnail } from "@/components/lumiere/FilmPosterThumbnail";
import { tenureLabel } from "@/lib/filmUtils";
import { MomentumMark } from "@/components/lumiere/Momentum";

export const Route = createFileRoute("/watchlist")({
  head: () => ({
    meta: [
      { title: "My Watchlist · The Index" },
      { name: "description", content: "Titles you're tracking across the Index." },
      ogUrlMeta("/watchlist"),
    ],
    links: [canonicalLink("/watchlist")],
  }),
  component: WatchlistPage,
  errorComponent: RouteError,
});

function WatchlistPage() {
  const [savedSlugs, setSavedSlugs] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const list: string[] = JSON.parse(localStorage.getItem("lumiere_watchlist") ?? "[]");
      setSavedSlugs(list);
    } catch {
      setSavedSlugs([]);
    }
    setIsLoaded(true);
  }, []);

  const removeSlug = (slug: string) => {
    const next = savedSlugs.filter((s) => s !== slug);
    setSavedSlugs(next);
    localStorage.setItem("lumiere_watchlist", JSON.stringify(next));
  };

  const clearAll = () => {
    setSavedSlugs([]);
    localStorage.removeItem("lumiere_watchlist");
  };

  // Fetch catalog films to resolve saved slugs
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

  const allFilmsMap = new Map<string, RankedFilm>();
  for (const f of [...topFilms, ...newReleases]) {
    if (!allFilmsMap.has(f.slug)) {
      allFilmsMap.set(f.slug, f);
    }
  }

  const savedFilms = savedSlugs
    .map((slug) => allFilmsMap.get(slug))
    .filter((f): f is RankedFilm => f !== undefined);

  const isLoading = !isLoaded || (savedSlugs.length > 0 && topLoading && newLoading);

  return (
    <Layout>
      <PagePlane lead={savedFilms[0] ?? null}>
        <PageHead
          kicker="Following"
          title="My Watchlist"
          lede="Titles you're tracking. Follow their rank and momentum as the Index updates."
          meta={
            savedFilms.length > 0 ? (
              <button type="button" onClick={clearAll} className="ix-more">
                <BookmarkX aria-hidden />
                Clear all ({savedFilms.length})
              </button>
            ) : null
          }
        />

        <div className="ix-sec !pt-0">
          {isLoading ? (
            <ul className="ix-rows">
              {[...Array(4)].map((_, i) => (
                <li key={i} className="ix-row">
                  <span />
                  <span className="ix-row__main">
                    <Skeleton className="ix-row__art" />
                    <span className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-40 max-w-full" />
                      <Skeleton className="h-3 w-28" />
                    </span>
                  </span>
                  <span />
                  <span className="ix-row__r">
                    <Skeleton className="h-3 w-16" />
                  </span>
                </li>
              ))}
            </ul>
          ) : savedFilms.length === 0 ? (
            <div className="ix-note">
              <Bookmark className="ix-note__mark" aria-hidden />
              <p className="ix-note__title">Your watchlist is empty</p>
              <p className="ix-note__body">
                Save titles with the bookmark button on any film page to follow them here.
              </p>
              <Link to="/top-100" className="ix-more ix-note__cta">
                Browse the Movie 100
              </Link>
            </div>
          ) : (
            <ul className="ix-rows">
              {savedFilms.map((film) => {
                const director =
                  film.director && film.director !== "Unknown" ? film.director : null;
                return (
                  <li key={film.slug} className="group relative">
                    <Link
                      to="/films/$slug"
                      params={{ slug: film.slug }}
                      className="ix-row"
                    >
                      <span />
                      <span className="ix-row__main">
                        <FilmPosterThumbnail film={film} className="ix-row__art" />
                        <span className="min-w-0">
                          <span className="ix-row__title block">{film.title}</span>
                          <span className="ix-row__meta block">
                            {[director, film.year, `${tenureLabel(film)} on chart`]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                      </span>
                      <span className="ix-row__num">{film.rank > 0 ? `#${film.rank}` : ""}</span>
                      <span className="ix-row__r">
                        <MomentumMark state={film.momentum} />
                      </span>
                    </Link>
                    <button
                      onClick={() => removeSlug(film.slug)}
                      title="Remove from watchlist"
                      aria-label={`Remove ${film.title} from watchlist`}
                      className="ix-row__remove"
                    >
                      <BookmarkX aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PagePlane>
    </Layout>
  );
}

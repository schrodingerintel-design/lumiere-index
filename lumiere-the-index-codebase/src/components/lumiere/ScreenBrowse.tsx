import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "./Layout";
import { ScreenCard, CatalogStatus, ProviderCredit } from "./Catalog";
import { CultureNav } from "./CultureNav";
import { getCatalog, type ScreenType } from "@/lib/catalog";

export function ScreenBrowse({ type }: { type: ScreenType }) {
  const [collection, setCollection] = useState("trending");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["catalog", type, collection, page],
    queryFn: () => getCatalog(type, collection, page),
    staleTime: 1800000,
  });
  const films = (query.data?.results || []).filter((film) => !film.adult);
  return (
    <Layout>
      <div className="catalog-page">
        <header className="catalog-page-heading">
          <span className="eyebrow">{type === "movie" ? "Cinema" : "Television"}</span>
          <h1>{type === "movie" ? "Find a film to fall into." : "One more episode."}</h1>
          <p>
            {type === "movie"
              ? "New discoveries, enduring favorites, and the people behind them."
              : "Discover series, explore their cast, and find your next long watch."}
          </p>
        </header>
        <div className="catalog-toolbar">
          <div className="discovery-filters" role="group" aria-label="Browse collection">
            {[
              { id: "trending", label: "Trending this week" },
              { id: "popular", label: "Popular on TMDB" },
              { id: "top_rated", label: "Top rated on TMDB" },
            ].map((tab) => (
              <button
                key={tab.id}
                aria-pressed={collection === tab.id}
                onClick={() => {
                  setCollection(tab.id);
                  setPage(1);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <span className="catalog-source">Source: TMDB</span>
        </div>
        <CatalogStatus
          loading={query.isLoading}
          error={query.isError}
          retry={() => void query.refetch()}
          empty={!films.length}
        />
        <div className="screen-grid">
          {films.map((film) => (
            <ScreenCard key={film.id} film={film} type={type} />
          ))}
        </div>
        <div className="catalog-pagination">
          <button
            className="soft-button"
            disabled={page === 1 || query.isFetching}
            onClick={() => setPage((n) => n - 1)}
          >
            Previous
          </button>
          <span>
            Page {page}
            {query.data?.total_pages ? ` of ${Math.min(100, query.data.total_pages)}` : ""}
          </span>
          <button
            className="soft-button"
            disabled={
              query.isFetching || !query.data || page >= Math.min(100, query.data.total_pages)
            }
            onClick={() => setPage((n) => n + 1)}
          >
            Next page
          </button>
        </div>
        <ProviderCredit />
      </div>
    </Layout>
  );
}

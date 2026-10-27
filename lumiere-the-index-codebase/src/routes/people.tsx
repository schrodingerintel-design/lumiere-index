import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Layout } from "@/components/lumiere/Layout";
import { CultureNav } from "@/components/lumiere/CultureNav";
import { PersonCard, CatalogStatus, ProviderCredit } from "@/components/lumiere/Catalog";
import { getPeople } from "@/lib/catalog";
import { canonicalLink } from "@/lib/site";
export const Route = createFileRoute("/people")({
  head: () => ({
    meta: [
      { title: "Trending actors & filmmakers · The Index" },
      {
        name: "description",
        content:
          "Discover people trending on TMDB, explore their biographies, and browse film and television credits.",
      },
    ],
    links: [canonicalLink("/people")],
  }),
  loader: ({ context }) =>
    context.queryClient.prefetchQuery({
      queryKey: ["people", "week", 1],
      queryFn: () => getPeople("week", 1),
    }),
  component: People,
});
function People() {
  const [window, setWindow] = useState<"day" | "week">("week");
  const [page, setPage] = useState(1);
  const [department, setDepartment] = useState("Everyone");
  const query = useQuery({
    queryKey: ["people", window, page],
    queryFn: () => getPeople(window, page),
    staleTime: 1800000,
  });
  const people = (query.data?.results || []).filter(
    (person) => department === "Everyone" || person.known_for_department === department,
  );
  return (
    <Layout>
      <div className="catalog-page">
        <header className="catalog-page-heading">
          <span className="eyebrow">The people behind the stories</span>
          <h1>Names to know.</h1>
          <p>Actors, directors, and filmmakers trending on TMDB.</p>
        </header>
        <div className="catalog-toolbar">
          <div className="discovery-filters" role="group" aria-label="Trend period">
            {(["day", "week"] as const).map((period) => (
              <button
                key={period}
                aria-pressed={window === period}
                onClick={() => {
                  setWindow(period);
                  setPage(1);
                }}
              >
                This {period}
              </button>
            ))}
          </div>
          <label className="catalog-select">
            Department{" "}
            <select value={department} onChange={(event) => setDepartment(event.target.value)}>
              {["Everyone", "Acting", "Directing", "Writing", "Production", "Sound"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <CatalogStatus
          loading={query.isLoading}
          error={query.isError}
          empty={!people.length}
          retry={() => void query.refetch()}
        />
        <div className="people-grid">
          {people.map((person) => (
            <PersonCard key={person.id} person={person} />
          ))}
        </div>
        <div className="catalog-pagination">
          <button
            disabled={page === 1 || query.isFetching}
            className="soft-button"
            onClick={() => setPage((n) => n - 1)}
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            disabled={
              !query.data || query.isFetching || page >= Math.min(100, query.data.total_pages)
            }
            className="soft-button"
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

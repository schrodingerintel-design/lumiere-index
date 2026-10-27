import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Layout } from "@/components/lumiere/Layout";
import { CatalogPager } from "@/components/lumiere/CatalogPager";
import { PersonCard, CatalogStatus, ProviderCredit } from "@/components/lumiere/Catalog";
import { getPeopleWindow } from "@/lib/catalog";
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
      queryKey: ["people", "week", 1, 40],
      queryFn: () => getPeopleWindow("week", 1, 40),
    }),
  component: People,
});
function People() {
  const [window, setWindow] = useState<"day" | "week" | "popular">("week");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(40);
  const [department, setDepartment] = useState("Everyone");
  const query = useQuery({
    queryKey: ["people", window, page, size],
    queryFn: () => getPeopleWindow(window, page, size),
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
            {(["day", "week", "popular"] as const).map((period) => (
              <button
                key={period}
                aria-pressed={window === period}
                onClick={() => {
                  setWindow(period);
                  setPage(1);
                }}
              >
                {period === "popular" ? "Popular people" : `This ${period}`}
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
        <CatalogPager
          page={page}
          pages={query.data?.total_pages || 1}
          size={size}
          busy={query.isFetching}
          onPage={setPage}
          onSize={(value) => {
            setSize(value);
            setPage(1);
          }}
        />
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
        <CatalogPager
          page={page}
          pages={query.data?.total_pages || 1}
          size={size}
          busy={query.isFetching}
          onPage={setPage}
          onSize={(value) => {
            setSize(value);
            setPage(1);
          }}
        />
        <ProviderCredit />
      </div>
    </Layout>
  );
}

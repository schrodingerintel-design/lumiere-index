import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/lumiere/Layout";
import { CultureNav } from "@/components/lumiere/CultureNav";
import {
  ScreenCard,
  PersonCard,
  CultureCard,
  CatalogStatus,
  ProviderCredit,
} from "@/components/lumiere/Catalog";
import { CULTURE, CULTURE_CATEGORIES, getPeople, getCatalog } from "@/lib/catalog";
import { canonicalLink } from "@/lib/site";
export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore film, TV, people, games & music · The Index" },
      {
        name: "description",
        content: "A place for film, television, games, music, and the people shaping culture.",
      },
    ],
    links: [canonicalLink("/explore")],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.prefetchQuery({
        queryKey: ["people", "week", 1],
        queryFn: () => getPeople(),
      }),
      context.queryClient.prefetchQuery({
        queryKey: ["catalog", "movie", "trending", 1],
        queryFn: () => getCatalog("movie"),
      }),
    ]);
  },
  component: Explore,
});
function Explore() {
  const people = useQuery({
    queryKey: ["people", "week", 1],
    queryFn: () => getPeople(),
    staleTime: 1800000,
  });
  const films = useQuery({
    queryKey: ["catalog", "movie", "trending", 1],
    queryFn: () => getCatalog("movie"),
    staleTime: 1800000,
  });
  return (
    <Layout>
      <div className="catalog-page">
        <header className="catalog-page-heading explore-heading">
          <span className="eyebrow">The Index · Culture, connected</span>
          <h1>
            Find your next
            <br />
            <em>rabbit hole.</em>
          </h1>
          <p>Films worth a night. People worth knowing. Worlds worth exploring.</p>
        </header>
        <section className="catalog-section">
          <div className="catalog-section-heading">
            <h2>People in the spotlight</h2>
            <Link to="/people">All people</Link>
          </div>
          <CatalogStatus
            loading={people.isLoading}
            error={people.isError}
            empty={!people.data?.results.length}
            retry={() => void people.refetch()}
          />
          <div className="people-grid people-rail">
            {people.data?.results.slice(0, 8).map((person) => (
              <PersonCard key={person.id} person={person} />
            ))}
          </div>
        </section>
        <section className="catalog-section">
          <div className="catalog-section-heading">
            <h2>Trending films</h2>
            <Link to="/movies">Browse films</Link>
          </div>
          <CatalogStatus
            loading={films.isLoading}
            error={films.isError}
            empty={!films.data?.results.length}
            retry={() => void films.refetch()}
          />
          <div className="screen-grid">
            {films.data?.results
              .filter((film) => !film.adult)
              .slice(0, 6)
              .map((film) => (
                <ScreenCard key={film.id} film={film} type="movie" />
              ))}
          </div>
        </section>
        {CULTURE_CATEGORIES.map((category) => (
          <section className="catalog-section" key={category.kind}>
            <div className="catalog-section-heading">
              <div>
                <span className="eyebrow">Lumière selections</span>
                <h2>{category.heading}</h2>
              </div>
              <Link to={category.path}>All {category.label.toLowerCase()}</Link>
            </div>
            <div className="culture-grid">
              {CULTURE.filter((entry) => entry.kind === category.kind)
                .slice(0, 3)
                .map((entry) => (
                  <CultureCard key={entry.slug} entry={entry} />
                ))}
            </div>
          </section>
        ))}
        <ProviderCredit />
      </div>
    </Layout>
  );
}

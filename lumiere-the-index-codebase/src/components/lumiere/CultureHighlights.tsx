import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CULTURE, getPeople } from "@/lib/catalog";
import { PersonCard, CultureCard } from "./Catalog";

export function CultureHighlights() {
  const people = useQuery({
    queryKey: ["people", "week", 1],
    queryFn: () => getPeople(),
    staleTime: 1800000,
    retry: false,
  });
  return (
    <div className="catalog-page home-culture-highlights">
      {!!people.data?.results.length && (
        <section className="catalog-section">
          <div className="catalog-section-heading">
            <div>
              <span className="eyebrow">Trending on TMDB this week</span>
              <h2>The people in the picture</h2>
            </div>
            <Link to="/people">All people</Link>
          </div>
          <div className="people-grid people-rail">
            {people.data.results.map((person) => (
              <PersonCard key={person.id} person={person} />
            ))}
          </div>
        </section>
      )}
      <section className="catalog-section">
        <div className="catalog-section-heading">
          <div>
            <span className="eyebrow">Lumière selections</span>
            <h2>Beyond the screen</h2>
          </div>
          <Link to="/explore">Explore culture</Link>
        </div>
        <div className="culture-grid">
          {CULTURE.map((entry) => (
            <CultureCard key={entry.slug} entry={entry} />
          ))}
        </div>
      </section>
    </div>
  );
}

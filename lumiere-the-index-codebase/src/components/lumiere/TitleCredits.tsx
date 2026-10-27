import { Link } from "@tanstack/react-router";
import { PersonCard } from "./Catalog";
import type { ScreenDetail } from "@/lib/catalog";

export function TitleCredits({ film }: { film: ScreenDetail }) {
  const cast = film.credits?.cast || [];
  const crew = film.credits?.crew || [];
  const principals = crew.filter((person) =>
    ["Director", "Screenplay", "Writer", "Story"].includes(person.job || ""),
  );
  return (
    <section className="catalog-section" id="cast-and-crew">
      <h2>Cast & crew</h2>
      <dl className="screen-credits">
        {principals.map((person) => (
          <div key={`${person.id}:${person.job}`}>
            <dt>{person.job}</dt>
            <dd>
              <Link to="/people/$id" params={{ id: String(person.id) }}>
                {person.name}
              </Link>
            </dd>
          </div>
        ))}
      </dl>
      <div className="people-grid">
        {cast.slice(0, 6).map((person) => (
          <div key={person.id}>
            <PersonCard person={person} />
            <p className="cast-character">{person.character}</p>
          </div>
        ))}
      </div>
      {!cast.length && <p className="catalog-empty">Cast information is currently unavailable.</p>}
      {(cast.length > 6 || crew.length > 0) && (
        <details className="full-credits">
          <summary>
            Full cast & crew · {cast.length} cast, {crew.length} crew credits
          </summary>
          <div className="credit-list">
            {cast.slice(6).map((person, i) => (
              <p key={`cast:${person.id}:${i}`}>
                <Link to="/people/$id" params={{ id: String(person.id) }}>
                  {person.name}
                </Link>
                <span>{person.character || "Cast"}</span>
              </p>
            ))}
            {crew.map((person, i) => (
              <p key={`crew:${person.id}:${i}`}>
                <Link to="/people/$id" params={{ id: String(person.id) }}>
                  {person.name}
                </Link>
                <span>{person.job || person.department || "Crew"}</span>
              </p>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Layout } from "@/components/lumiere/Layout";
import { ScreenCard, SaveItem, ShareItem, ProviderCredit } from "@/components/lumiere/Catalog";
import { getPerson, imageOf, safeExternal } from "@/lib/catalog";
import { canonicalLink } from "@/lib/site";
import { RouteError } from "@/lib/route-error";

export const Route = createFileRoute("/people_/$id")({
  loader: ({ context, params }) => {
    if (!/^\d+$/.test(params.id)) throw new Error("Person not found");
    return context.queryClient.ensureQueryData({
      queryKey: ["person", params.id],
      queryFn: () => getPerson(params.id),
      staleTime: 21600000,
    });
  },
  head: ({ loaderData, params }) => ({
    meta: [
      { title: `${loaderData?.name || "Person"} · The Index` },
      {
        name: "description",
        content:
          loaderData?.biography?.slice(0, 155) || "Biography, filmography, and television credits.",
      },
      ...(!loaderData ? [{ name: "robots", content: "noindex" }] : []),
    ],
    links: [canonicalLink(`/people/${params.id}`)],
  }),
  component: PersonDetail,
  errorComponent: RouteError,
});

function PersonDetail() {
  const person = Route.useLoaderData();
  const [filter, setFilter] = useState("All credits");
  const [sort, setSort] = useState("Most rated");
  const [visible, setVisible] = useState(36);
  const credits = [
    ...(person.combined_credits?.cast || []),
    ...(person.combined_credits?.crew || []),
  ];
  const unique = [
    ...new Map(
      credits.filter((item) => !item.adult).map((item) => [`${item.media_type}:${item.id}`, item]),
    ).values(),
  ];
  const filtered = unique
    .filter(
      (item) =>
        filter === "All credits" || item.media_type === (filter === "Films" ? "movie" : "tv"),
    )
    .sort((a, b) =>
      sort === "Most rated"
        ? (b.vote_count || 0) - (a.vote_count || 0)
        : (b.release_date || b.first_air_date || "").localeCompare(
            a.release_date || a.first_air_date || "",
          ),
    );
  return (
    <Layout>
      <div className="catalog-page">
        <nav className="catalog-breadcrumb">
          <Link to="/people">People</Link>
          <span>/</span>
          <span>{person.name}</span>
        </nav>
        <header className="profile-hero">
          <div className="profile-portrait">
            {person.profile_path ? (
              <img src={imageOf(person.profile_path)} alt={person.name} />
            ) : (
              <span>{person.name}</span>
            )}
          </div>
          <div>
            <span className="eyebrow">{person.known_for_department || "Film & television"}</span>
            <h1>{person.name}</h1>
            <div className="profile-facts">
              {person.birthday && <span>Born {person.birthday}</span>}
              {person.deathday && <span>Died {person.deathday}</span>}
              {person.place_of_birth && <span>{person.place_of_birth}</span>}
            </div>
            <p className="profile-intro">
              {person.biography?.split("\n")[0] || "Explore film and television credits below."}
            </p>
            <div className="detail-actions">
              <SaveItem
                item={{
                  key: `person:${person.id}`,
                  title: person.name,
                  path: `/people/${person.id}`,
                  image: imageOf(person.profile_path, "w342"),
                  category: "People",
                  subtitle: person.known_for_department,
                }}
              />
              <ShareItem title={person.name} path={`/people/${person.id}`} />
              {safeExternal(person.homepage) && (
                <a
                  className="soft-button"
                  href={safeExternal(person.homepage)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Official website
                </a>
              )}
              <a
                className="text-link"
                href={`https://www.themoviedb.org/person/${person.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Source profile on TMDB
              </a>
            </div>
          </div>
        </header>
        {person.biography && person.biography.split("\n").filter(Boolean).length > 1 && (
          <details className="biography">
            <summary>Read full biography</summary>
            {person.biography
              .split("\n")
              .filter(Boolean)
              .slice(1)
              .map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
          </details>
        )}
        <section className="catalog-section">
          <div className="catalog-section-heading">
            <h2>
              Filmography <span>{unique.length}</span>
            </h2>
            <label className="catalog-select">
              Sort{" "}
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option>Newest</option>
                <option>Most rated</option>
              </select>
            </label>
          </div>
          <div className="discovery-filters" role="group" aria-label="Credit type">
            {["All credits", "Films", "TV"].map((item) => (
              <button key={item} aria-pressed={filter === item} onClick={() => setFilter(item)}>
                {item}
              </button>
            ))}
          </div>
          <div className="screen-grid">
            {filtered.slice(0, visible).map((film) => (
              <ScreenCard
                key={`${film.media_type}:${film.id}`}
                film={film}
                type={film.media_type || "movie"}
              />
            ))}
          </div>
          {filtered.length > visible && (
            <div className="catalog-pagination">
              <button className="soft-button" onClick={() => setVisible((count) => count + 36)}>
                Show more credits
              </button>
              <span>
                {visible} of {filtered.length}
              </span>
            </div>
          )}
          {!filtered.length && (
            <p className="catalog-empty">No credits available for this selection.</p>
          )}
        </section>
        <ProviderCredit />
      </div>
    </Layout>
  );
}

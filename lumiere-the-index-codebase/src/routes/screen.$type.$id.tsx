import { TitleCredits } from "@/components/lumiere/TitleCredits";
import { WatchAvailability } from "@/components/lumiere/WatchAvailability";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/lumiere/Layout";
import { ScreenCard, SaveItem, ShareItem, ProviderCredit } from "@/components/lumiere/Catalog";
import { getScreen, imageOf, titleOf, yearOf, type ScreenType } from "@/lib/catalog";
import { canonicalLink, titleSocialMeta } from "@/lib/site";
import { RouteError } from "@/lib/route-error";

export const Route = createFileRoute("/screen/$type/$id")({
  loader: ({ context, params }) => {
    if (!["movie", "tv"].includes(params.type) || !/^\d+$/.test(params.id))
      throw new Error("Title not found");
    return context.queryClient.ensureQueryData({
      queryKey: ["screen", params.type, params.id],
      queryFn: () => getScreen(params.type as ScreenType, params.id),
      staleTime: 1800000,
    });
  },
  head: ({ loaderData, params }) => ({
    meta: titleSocialMeta(
      loaderData ? titleOf(loaderData) : "Title",
      loaderData?.overview?.slice(0, 155) || "Cast, crew, and title details on Lumière Index.",
      `/screen/${params.type}/${params.id}`,
      imageOf(loaderData?.poster_path, "w780"),
    ),
    links: [canonicalLink(`/screen/${params.type}/${params.id}`)],
  }),
  component: ScreenDetail,
  errorComponent: RouteError,
});

function ScreenDetail() {
  const film = Route.useLoaderData();
  const { type, id } = Route.useParams();
  const title = titleOf(film);
  const crew = film.credits?.crew || [];
  const directors = crew.filter((person) => person.job === "Director");
  const creators = film.created_by || [];
  const writers = [
    ...new Map(
      crew
        .filter((person) => ["Screenplay", "Writer", "Story"].includes(person.job || ""))
        .map((person) => [person.id, person]),
    ).values(),
  ];
  const trailer = film.videos?.results.find(
    (video) =>
      video.site === "YouTube" && video.type === "Trailer" && /^[a-zA-Z0-9_-]{11}$/.test(video.key),
  );
  const recommendations = film.recommendations?.results.filter((item) => !item.adult) || [];
  return (
    <Layout>
      <div
        className="screen-hero"
        style={{
          backgroundImage: film.backdrop_path
            ? `linear-gradient(90deg,#17131ef5,#17131e77),linear-gradient(0deg,#17131e,transparent),url(${imageOf(film.backdrop_path, "w1280")})`
            : undefined,
        }}
      >
        <div className="catalog-page">
          <nav className="catalog-breadcrumb">
            <Link to={type === "tv" ? "/series" : "/movies"}>{type === "tv" ? "TV" : "Films"}</Link>
            <span>/</span>
            <span>{title}</span>
          </nav>
          <header className="screen-detail-header">
            <div className="screen-detail-poster">
              {film.poster_path ? (
                <img src={imageOf(film.poster_path)} alt={title} />
              ) : (
                <span>{title}</span>
              )}
            </div>
            <div>
              <span className="eyebrow">
                {type === "tv" ? "TV series" : "Film"} · {yearOf(film)}
                {film.status ? ` · ${film.status}` : ""}
              </span>
              <h1>{title}</h1>
              {film.tagline && <p className="screen-tagline">{film.tagline}</p>}
              <div className="profile-facts">
                {film.genres?.map((genre) => (
                  <span key={genre.id}>{genre.name}</span>
                ))}
                {film.runtime ? (
                  <span>
                    {Math.floor(film.runtime / 60)}h {film.runtime % 60}m
                  </span>
                ) : null}
                {film.number_of_seasons ? <span>{film.number_of_seasons} seasons</span> : null}
                {film.number_of_episodes ? <span>{film.number_of_episodes} episodes</span> : null}
              </div>
              <p className="profile-intro">
                {film.overview || "A synopsis is not available from the catalog."}
              </p>
              <dl className="screen-credits">
                {(type === "movie" ? directors : creators).length > 0 && (
                  <div>
                    <dt>{type === "movie" ? "Director" : "Created by"}</dt>
                    <dd>
                      {(type === "movie" ? directors : creators).map((person) => (
                        <Link key={person.id} to="/people/$id" params={{ id: String(person.id) }}>
                          {person.name}
                        </Link>
                      ))}
                    </dd>
                  </div>
                )}
                {writers.length > 0 && (
                  <div>
                    <dt>Writing</dt>
                    <dd>
                      {writers.map((person) => (
                        <Link key={person.id} to="/people/$id" params={{ id: String(person.id) }}>
                          {person.name}
                        </Link>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
              <div className="detail-actions">
                <SaveItem
                  item={{
                    key: `${type}:${id}`,
                    title,
                    path: `/screen/${type}/${id}`,
                    image: imageOf(film.poster_path, "w342"),
                    category: type === "tv" ? "TV" : "Film",
                    subtitle: yearOf(film),
                  }}
                />
                <ShareItem title={title} path={`/screen/${type}/${id}`} />
                {trailer && (
                  <a
                    className="primary-button"
                    href={`https://www.youtube.com/watch?v=${trailer.key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Watch trailer
                  </a>
                )}
              </div>
              {(film.vote_count || 0) > 0 && (
                <p className="detail-rating">
                  <strong>
                    {film.vote_average?.toFixed(1)}
                    <small>/10</small>
                  </strong>
                  <span>
                    Audience rating · <a href="#data-sources">source</a>
                    <br />
                    {new Intl.NumberFormat("en").format(film.vote_count || 0)} votes
                  </span>
                </p>
              )}
            </div>
          </header>
        </div>
      </div>
      <div className="catalog-page">
        <TitleCredits film={film} />
        {type === "tv" && !!film.seasons?.length && (
          <section className="catalog-section">
            <h2>Seasons</h2>
            <div className="season-grid">
              {film.seasons.map((season) => (
                <article key={season.id}>
                  {season.poster_path && (
                    <img src={imageOf(season.poster_path, "w185")} alt="" loading="lazy" />
                  )}
                  <div>
                    <h3>{season.name}</h3>
                    <span>
                      {season.air_date?.slice(0, 4)} · {season.episode_count} episodes
                    </span>
                    <p>{season.overview}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        <section className="catalog-section">
          <h2>Details</h2>
          <dl className="title-facts">
            <div>
              <dt>{type === "tv" ? "First aired" : "Release date"}</dt>
              <dd>{film.release_date || film.first_air_date || "Not announced"}</dd>
            </div>
            {film.original_language && (
              <div>
                <dt>Original language</dt>
                <dd>
                  {film.spoken_languages?.map((language) => language.english_name).join(", ") ||
                    film.original_language.toUpperCase()}
                </dd>
              </div>
            )}
            {!!film.production_countries?.length && (
              <div>
                <dt>Production countries</dt>
                <dd>{film.production_countries.map((country) => country.name).join(" · ")}</dd>
              </div>
            )}
            {!!film.production_companies?.length && (
              <div>
                <dt>Production</dt>
                <dd>{film.production_companies.map((company) => company.name).join(" · ")}</dd>
              </div>
            )}
          </dl>
        </section>
        <WatchAvailability
          type={type as ScreenType}
          id={film.id}
          upcoming={
            (film.release_date || film.first_air_date || "") > new Date().toISOString().slice(0, 10)
          }
        />
        <section className="catalog-section" id="data-sources">
          <h2>Data sources</h2>
          <p>
            Audience ratings, votes, credits, and catalog information are supplied by TMDB. They are
            separate from Lumière chart rankings. No Index ranking or measured trend evidence is
            attached to this catalog page.
          </p>
          <Link to="/about">About our data & methodology</Link>
        </section>
        {recommendations.length > 0 && (
          <section className="catalog-section">
            <h2>More like this</h2>
            <div className="screen-grid">
              {recommendations.map((item) => (
                <ScreenCard key={item.id} film={item} type={type as ScreenType} />
              ))}
            </div>
          </section>
        )}
        <ProviderCredit />
      </div>
    </Layout>
  );
}

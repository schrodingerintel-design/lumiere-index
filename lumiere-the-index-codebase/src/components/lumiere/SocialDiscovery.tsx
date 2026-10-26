import { useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Flame,
  MessageCircle,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { getTopFilms, getTrendingFilms, getBiggestMovers, type RankedFilm } from "@/lib/apiClient";
import { FilmActions } from "./FilmActions";
import { Movement } from "./Ranking";
import { useWatchlist } from "@/lib/watchlist";

const count = (value: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const FILTERS = ["All titles", "Movies", "TV shows", "Saved"] as const;
type Filter = (typeof FILTERS)[number];

export function FilmConversationCard({ film }: { film: RankedFilm }) {
  return (
    <article className="conversation-card">
      <Link
        to="/films/$slug"
        params={{ slug: film.slug }}
        className="conversation-art"
        aria-label={`Explore ${film.title}`}
        style={{
          background: `linear-gradient(140deg, ${film.gradient_from || "#603749"}, ${film.gradient_to || "#211c34"})`,
        }}
      >
        {(film.backdrop_url || film.poster_url) && (
          <img src={film.backdrop_url || film.poster_url!} alt="" loading="lazy" decoding="async" />
        )}
        <span className="art-scrim" />
        <span className="art-rank">
          #{film.rank} <span>{film.content_type === "TV_SHOW" ? "TV 100" : "Movie 100"}</span>
        </span>
        <span className="art-open">
          <ArrowUpRight size={20} />
        </span>
        {film.genre_tag && <span className="art-genre">{film.genre_tag}</span>}
      </Link>
      <div className="conversation-body">
        <div className="conversation-meta">
          <span>
            {film.content_type === "TV_SHOW" ? "TV series" : "Film"}
            {film.year ? ` · ${film.year}` : ""}
          </span>
          <Movement film={film} />
        </div>
        <Link to="/films/$slug" params={{ slug: film.slug }}>
          <h3>{film.title}</h3>
        </Link>
        <p className="conversation-description">
          {film.synopsis ||
            "Explore the audience signals and see where this title sits in the culture."}
        </p>
        <div className="signal-note">
          <MessageCircle size={15} />
          <span>
            {film.mentions_total > 0
              ? `${count(film.mentions_total)} tracked mentions`
              : "Audience signals on The Index"}
          </span>
        </div>
        <div className="conversation-bottom">
          <Link to="/films/$slug" params={{ slug: film.slug }}>
            Explore the buzz <ArrowRight size={14} />
          </Link>
          <FilmActions slug={film.slug} title={film.title} compact />
        </div>
      </div>
    </article>
  );
}

export function SocialDiscovery() {
  const [filter, setFilter] = useState<Filter>("All titles");
  const [active, setActive] = useState(0);
  const { slugs } = useWatchlist();
  const movies = useQuery({
    queryKey: ["films", "top", 10],
    queryFn: () => getTopFilms(10),
    staleTime: 300_000,
  });
  const tv = useQuery({
    queryKey: ["films", "tv100", 10],
    queryFn: () => getTopFilms(10, 0, "TV_100"),
    staleTime: 300_000,
  });
  const trending = useQuery({
    queryKey: ["trending", "home", 12],
    queryFn: () => getTrendingFilms(12),
    staleTime: 300_000,
  });
  const movers = useQuery({
    queryKey: ["index", "movers"],
    queryFn: () => getBiggestMovers(),
    staleTime: 300_000,
  });
  const filmPool = [...(movies.data ?? []), ...(tv.data ?? [])];
  const unique = [...new Map(filmPool.map((film) => [film.slug, film])).values()];
  const featured = (movies.data ?? []).slice(0, 4);
  const hero = featured[active] ?? featured[0];
  const films =
    filter === "Movies"
      ? (movies.data ?? [])
      : filter === "TV shows"
        ? (tv.data ?? [])
        : filter === "Saved"
          ? unique.filter((film) => slugs.includes(film.slug))
          : unique
              .slice(0, 4)
              .concat(unique.filter((film) => film.content_type === "TV_SHOW").slice(0, 2));
  const hasError =
    filter === "Movies"
      ? movies.isError
      : filter === "TV shows"
        ? tv.isError
        : movies.isError || tv.isError;
  const loading = movies.isLoading || tv.isLoading;
  const palette = {
    "--film-from": hero?.gradient_from || "#6e3c58",
    "--film-to": hero?.gradient_to || "#40366a",
  } as CSSProperties;

  return (
    <div className="social-home" style={palette}>
      <section className="discovery-welcome">
        <div>
          <span className="eyebrow">
            <Sparkles size={14} /> For the love of film & TV
          </span>
          <h1>
            Good stories bring us together<span>.</span>
          </h1>
          <p>Find your next obsession. Follow the buzz. Pass it on.</p>
        </div>
        <Link to="/watchlist" className="soft-button welcome-watchlist">
          <Bookmark size={17} /> Your watchlist <ArrowUpRight size={16} />
        </Link>
      </section>

      <div className="discovery-opening">
        <section className="spotlight" aria-label="In the spotlight">
          {hero && (hero.backdrop_url || hero.poster_url) && (
            <img
              key={hero.slug}
              className="spotlight-image"
              src={hero.backdrop_url || hero.poster_url!}
              alt=""
              fetchPriority="high"
            />
          )}
          <div className="spotlight-scrim" />
          <div className="spotlight-top">
            <span className="spotlight-label">
              <Flame size={15} /> In the spotlight
            </span>
            <span className="spotlight-edition">Audience powered. Always.</span>
          </div>
          <div className="spotlight-copy">
            {hero ? (
              <>
                <span className="spotlight-context">
                  #{hero.rank} on the Movie 100{hero.genre_tag ? ` · ${hero.genre_tag}` : ""}
                  {hero.year ? ` · ${hero.year}` : ""}
                </span>
                <h2>{hero.title}</h2>
                <p>
                  {hero.synopsis ||
                    "A story on the audience's radar. Explore the signals behind its place on The Index."}
                </p>
                <div className="spotlight-actions">
                  <Link to="/films/$slug" params={{ slug: hero.slug }} className="primary-button">
                    Discover this film <ArrowRight size={17} />
                  </Link>
                  <FilmActions slug={hero.slug} title={hero.title} />
                </div>
              </>
            ) : (
              <>
                <h2>Your next obsession starts here.</h2>
                <p>
                  {movies.isError
                    ? "The spotlight is taking a moment. You can still explore films and your watchlist."
                    : movies.isLoading
                      ? "Finding the stories in the spotlight…"
                      : "The next chart is being prepared. Discover more while you wait."}
                </p>
                <Link to="/genres" className="primary-button">
                  Explore films <ArrowRight size={17} />
                </Link>
                {movies.isError && (
                  <button className="soft-button" onClick={() => void movies.refetch()}>
                    Try again
                  </button>
                )}
              </>
            )}
          </div>
          {featured.length > 1 && (
            <div className="spotlight-selector" aria-label="Choose spotlight film">
              {featured.map((film, i) => (
                <button
                  key={film.slug}
                  type="button"
                  aria-pressed={hero?.slug === film.slug}
                  onClick={() => setActive(i)}
                >
                  <span>0{i + 1}</span>
                  <span>{film.title}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="culture-pulse">
          <div className="pulse-heading">
            <span className="eyebrow">
              <span className="status-dot" /> The culture pulse
            </span>
            <TrendingUp size={18} />
          </div>
          <h2>Making moves.</h2>
          <p>The biggest climbs in the latest chart.</p>
          <div className="pulse-titles">
            {movers.isLoading ? (
              <p role="status">Loading chart movement…</p>
            ) : movers.isError ? (
              <p>
                Movement is unavailable.{" "}
                <button onClick={() => void movers.refetch()}>Retry</button>
              </p>
            ) : !movers.data?.gainers.length ? (
              <p>New movements will appear after the next chart.</p>
            ) : (
              movers.data.gainers.slice(0, 4).map((film) => (
                <Link
                  key={film.slug}
                  to="/films/$slug"
                  params={{ slug: film.slug }}
                  className="pulse-title"
                >
                  {film.poster_url ? (
                    <img src={film.poster_url} alt="" loading="lazy" />
                  ) : (
                    <span className="pulse-placeholder" />
                  )}
                  <span>
                    <strong>{film.title}</strong>
                    <small>
                      Now #{film.current_rank} ·{" "}
                      {film.content_type === "TV_SHOW" ? "TV 100" : "Movie 100"}
                    </small>
                  </span>
                  <span className="pulse-change">
                    <ArrowUpRight size={15} />
                    {Math.abs(film.movement)}
                  </span>
                </Link>
              ))
            )}
          </div>
          <Link to="/rising" className="pulse-all">
            All chart movers <ArrowRight size={16} />
          </Link>
          <div className="pulse-footnote">
            Real audience signals.
            <br />
            <strong>Zero critic weight.</strong>
            <Link to="/methodology">
              How it works <ArrowUpRight size={13} />
            </Link>
          </div>
        </aside>
      </div>

      <section className="buzz-strip" aria-label="Trending conversations">
        <div>
          <MessageCircle size={18} />
          <strong>In the conversation</strong>
        </div>
        <div className="buzz-topics no-scrollbar">
          {trending.data?.slice(0, 6).map((film) => (
            <Link key={film.film_slug} to="/films/$slug" params={{ slug: film.film_slug }}>
              <span>#</span>
              {film.title}
            </Link>
          ))}
          {!trending.data?.length && (
            <Link to="/trending">
              Explore what's trending <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </section>

      <div className="discovery-feed-layout">
        <section className="discovery-feed" aria-labelledby="discover-heading">
          <div className="section-intro">
            <div>
              <span className="eyebrow">Find something that stays with you</span>
              <h2 id="discover-heading">On everyone's radar</h2>
            </div>
            <Link to="/trending" className="text-link">
              Explore trending <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="discovery-filters" role="group" aria-label="Filter discovery">
            {FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={filter === item}
                onClick={() => setFilter(item)}
              >
                {item === "All titles" && <Sparkles size={14} />}
                {item === "Saved" && <Bookmark size={14} />}
                {item}
              </button>
            ))}
          </div>
          {hasError && (
            <div className="discovery-notice" role="status">
              Some titles couldn't load.{" "}
              <button
                onClick={() => {
                  void movies.refetch();
                  void tv.refetch();
                }}
              >
                Try again
              </button>
            </div>
          )}
          <div className="conversation-grid">
            {loading
              ? Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="conversation-skeleton" aria-hidden="true" />
                ))
              : films.map((film) => <FilmConversationCard key={film.slug} film={film} />)}
          </div>
          {loading && (
            <p className="sr-only" role="status">
              Loading discovery titles
            </p>
          )}
          {!loading && films.length === 0 && (
            <div className="discovery-empty">
              <Bookmark size={28} />
              <h3>
                {filter === "Saved"
                  ? "Make room for your next favorite."
                  : "More stories are on their way."}
              </h3>
              <p>
                {filter === "Saved"
                  ? "Save a title with the bookmark button. Your full watchlist lives on this device."
                  : "Check back after the next chart refresh."}
              </p>
              {filter === "Saved" && (
                <Link to="/watchlist" className="soft-button">
                  Open your watchlist <ArrowRight size={16} />
                </Link>
              )}
            </div>
          )}
          {filter === "Saved" && films.length > 0 && (
            <p className="saved-scope">
              Showing saved titles from today's discovery.{" "}
              <Link to="/watchlist">See your full watchlist →</Link>
            </p>
          )}
        </section>
        <aside className="discovery-sidebar">
          <section className="watchlist-invite">
            <span className="invite-icon">
              <Bookmark size={23} />
            </span>
            <span className="eyebrow">Your own little film club</span>
            <h2>“We should watch this.”</h2>
            <p>
              Keep the films you mean to watch in one place. Share a discovery with someone who gets
              your taste.
            </p>
            <Link to="/watchlist" className="primary-button">
              Build your watchlist <ArrowRight size={16} />
            </Link>
            <small>Saved on this device. No account needed.</small>
          </section>
          <section className="explore-paths">
            <span className="eyebrow">Go down a rabbit hole</span>
            <h2>Follow your curiosity</h2>
            <Link to="/genres">
              <span>
                Find your mood<small>Explore films by genre</small>
              </span>
              <span>↗</span>
            </Link>
            <Link to="/new-entries">
              <span>
                Something new<small>Fresh faces on the charts</small>
              </span>
              <span>↗</span>
            </Link>
            <Link to="/calendar">
              <span>
                Make movie plans<small>Now playing & coming soon</small>
              </span>
              <span>↗</span>
            </Link>
            <Link to="/compare">
              <span>
                Settle the debate<small>Compare two titles</small>
              </span>
              <span>↗</span>
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

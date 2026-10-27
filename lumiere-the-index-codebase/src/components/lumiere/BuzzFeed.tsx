import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getTrendingFilms, type TrendingFilmOut } from "@/lib/apiClient";
import { FilmActions } from "./FilmActions";

const formatCount = (value: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
function BuzzCard({ film, lead = false }: { film: TrendingFilmOut; lead?: boolean }) {
  const limited = !film.confidence || ["insufficient", "low"].includes(film.confidence);
  return (
    <article className={`buzz-card ${lead ? "buzz-card-lead" : ""}`}>
      <Link
        to="/films/$slug"
        params={{ slug: film.film_slug }}
        className="buzz-art"
        aria-label={`Explore ${film.title}`}
      >
        {film.poster_url && <img src={film.poster_url} alt="" loading="lazy" />}
        <span className="buzz-art-shade" />
        <span className="buzz-kicker">{limited ? "On the radar" : "In the conversation"}</span>
        <div className="buzz-art-title">
          <h3>{film.title}</h3>
          {film.top_topic && !limited && <span>{film.top_topic}</span>}
        </div>
      </Link>
      <div className="buzz-card-body">
        <p>
          {film.trend_reason ||
            "Recorded activity is limited. Explore the available title evidence."}
        </p>
        <div className="buzz-measurements">
          {film.mentions_24h > 0 && <span>{formatCount(film.mentions_24h)} records · 24h</span>}
          {film.attention_delta_pct != null && !limited && (
            <span>
              {film.attention_delta_pct > 0 ? "+" : ""}
              {film.attention_delta_pct.toFixed(0)}% recorded activity
            </span>
          )}
          {limited && <span>Limited coverage</span>}
        </div>
        <div className="buzz-card-actions">
          <Link to="/films/$slug" params={{ slug: film.film_slug }}>
            Explore the buzz →
          </Link>
          <FilmActions slug={film.film_slug} title={film.title} />
        </div>
      </div>
    </article>
  );
}
export function BuzzFeed({ compact = false }: { compact?: boolean }) {
  const [risingOnly, setRisingOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(24);
  const query = useQuery({
    queryKey: compact ? ["trending", "home", 12] : ["trending", "films", 200],
    queryFn: () => getTrendingFilms(compact ? 12 : 200),
    staleTime: 300000,
  });
  const titles = (query.data || []).filter(
    (film) => !risingOnly || (film.attention_delta_pct != null && film.attention_delta_pct > 0),
  );
  const visible = compact ? titles.slice(0, 8) : titles.slice(0, visibleCount);
  return (
    <section className={`buzz-feed ${compact ? "buzz-feed-home" : ""}`} aria-label="Lumière Buzz">
      <div className="buzz-feed-heading">
        <div>
          <span className="eyebrow">Lumière Buzz</span>
          <h2>{compact ? "Catch the conversation." : "The stories in motion."}</h2>
        </div>
        {compact ? (
          <Link to="/trending" className="soft-button">
            All the buzz →
          </Link>
        ) : (
          <div className="discovery-filters" role="group" aria-label="Filter buzz">
            <button aria-pressed={!risingOnly} onClick={() => setRisingOnly(false)}>
              All stories
            </button>
            <button aria-pressed={risingOnly} onClick={() => setRisingOnly(true)}>
              Rising
            </button>
          </div>
        )}
      </div>
      {query.isPending ? (
        <div className="buzz-card-grid" aria-label="Loading buzz">
          {[0, 1, 2, 3].map((i) => (
            <div className="buzz-loading" key={i} />
          ))}
        </div>
      ) : query.isError ? (
        <div className="catalog-empty">
          <p>Buzz couldn’t load.</p>
          <button className="soft-button" onClick={() => void query.refetch()}>
            Try again
          </button>
        </div>
      ) : visible.length ? (
        <div className="buzz-card-grid">
          {visible.map((film, i) => (
            <BuzzCard key={film.film_slug} film={film} lead={i === 0} />
          ))}
        </div>
      ) : (
        <div className="catalog-empty">
          <p>
            {risingOnly
              ? "No measured increases in this feed yet."
              : "New stories will appear as activity is recorded."}
          </p>
        </div>
      )}
      {!compact && visibleCount < titles.length && (
        <button className="soft-button" onClick={() => setVisibleCount((value) => value + 24)}>
          Show more stories · {titles.length - visibleCount} remaining
        </button>
      )}
      {!compact && (
        <p className="buzz-coverage-note">
          Based on activity recorded by Lumière. Coverage varies by title.{" "}
          <Link to="/methodology">Sources & methodology</Link>
        </p>
      )}
    </section>
  );
}

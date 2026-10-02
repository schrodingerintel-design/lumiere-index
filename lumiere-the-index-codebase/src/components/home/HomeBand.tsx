import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ArrowRight, Minus } from "lucide-react";
import { posterAt, posterSrcSet } from "@/lib/tmdbImage";

/**
 * Any row the home page renders.
 *
 * The same card serves the ranked chart, the Biggest Movers rail and the New
 * Entries rail, so `rank` and `movement` are both optional. Rank is always the
 * chart's own value — the card never derives or invents one.
 */
export interface HomeCardFilm {
  slug: string;
  title: string;
  poster_url: string | null;
  /** null on New Entries: the title has not been given a chart position yet. */
  rank?: number | null;
  /** Signed. Positive is a rise, negative a fall. */
  movement?: number | null;
  genre_tag?: string | null;
  country_origin?: string | null;
  year?: number | null;
  content_type?: "MOVIE" | "TV_SHOW" | null;
  release_date?: string | null;
  first_air_date?: string | null;
}

type Direction = "new" | "rise" | "fall" | "flat";

function directionOf(film: HomeCardFilm): Direction {
  if (film.rank == null) return "new";
  const move = film.movement ?? 0;
  if (move > 0) return "rise";
  if (move < 0) return "fall";
  return "flat";
}

/** The arrow or word carries the meaning, so movement never relies on colour. */
function Movement({ film }: { film: HomeCardFilm }) {
  const dir = directionOf(film);
  if (dir === "new") return <span className="ix-mv ix-mv--new">New</span>;
  if (dir === "rise") {
    return (
      <span className="ix-mv ix-mv--up">
        <ArrowUp aria-hidden /> {film.movement}
      </span>
    );
  }
  if (dir === "fall") {
    return (
      <span className="ix-mv ix-mv--down">
        <ArrowDown aria-hidden /> {Math.abs(film.movement ?? 0)}
      </span>
    );
  }
  return (
    <span className="ix-mv ix-mv--flat">
      <Minus aria-hidden /> 0
    </span>
  );
}

/** The air date's year. TV shows carry first_air_date, never release_date. */
function yearOf(film: HomeCardFilm): string | null {
  if (film.year != null) return String(film.year);
  const date =
    film.content_type === "TV_SHOW" ? film.first_air_date : film.release_date;
  return date ? date.slice(0, 4) : null;
}

function caption(film: HomeCardFilm): string {
  if (film.genre_tag && film.country_origin) return `${film.genre_tag} · ${film.country_origin}`;
  return film.genre_tag ?? film.country_origin ?? yearOf(film) ?? "";
}

export function HomePosterCard({ film }: { film: HomeCardFilm }) {
  const poster = posterAt(film.poster_url, "w342");
  const dir = directionOf(film);

  return (
    <Link to="/films/$slug" params={{ slug: film.slug }} className="ix-pcard">
      <span className="ix-pcard__art">
        {film.rank != null && <span className="ix-pcard__rk">{film.rank}</span>}
        {poster ? (
          <img
            src={poster}
            srcSet={posterSrcSet(film.poster_url)}
            sizes="(max-width: 640px) 30vw, (max-width: 1100px) 15vw, 11vw"
            alt={`${film.title} poster`}
            width={342}
            height={513}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="ix-pcard__fallback" aria-hidden />
        )}
      </span>
      <span className="ix-pcard__cap">
        <span className="ix-pcard__t">{film.title}</span>
        <Movement film={film} />
      </span>
      <span className="ix-pcard__line">
        <i className={`is-${dir}`} aria-hidden />
        <span>{caption(film)}</span>
      </span>
    </Link>
  );
}

/**
 * A titled band of poster cards.
 *
 * `defer` defers rendering until the band approaches the viewport — used for
 * everything below the fold so the first paint stays cheap.
 */
export function HomeBand({
  title,
  sub,
  to,
  toLabel,
  items,
  columns = 6,
  defer = false,
}: {
  title: string;
  sub?: string;
  to?: string;
  toLabel?: string;
  items: HomeCardFilm[];
  columns?: 4 | 6;
  defer?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <section className={`ix-band${defer ? " ix-band--defer" : ""}`}>
      <div className="ix-band__hd">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {to && toLabel && (
          <Link to={to} className="ix-band__tool">
            {toLabel}
            <ArrowRight aria-hidden />
          </Link>
        )}
      </div>
      <div className={columns === 4 ? "ix-grid ix-grid--4" : "ix-grid"}>
        {items.map((film) => (
          <HomePosterCard key={film.slug} film={film} />
        ))}
      </div>
    </section>
  );
}

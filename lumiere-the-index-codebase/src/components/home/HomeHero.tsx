import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Minus, Play } from "lucide-react";
import type { RankedFilm } from "@/lib/apiClient";
import { filmTrend } from "@/lib/trend";
import { airDate } from "@/lib/filmUtils";
import { backdropAt, backdropSrcSet } from "@/lib/tmdbImage";

/**
 * The number 1 hero — and only number 1.
 *
 * The chart does not repeat #1 anywhere below it, so this is the only place the
 * leading title is presented at full scale.
 */
export function HomeHero({ film }: { film: RankedFilm }) {
  const trend = filmTrend(film);
  const move = film.movement ?? 0;
  const date = airDate(film);

  const tenure =
    film.days_at_one && film.days_at_one > 0
      ? `${film.days_at_one} ${film.days_at_one === 1 ? "day" : "days"} at #1`
      : film.peak_rank === 1
        ? "Peak #1"
        : "On the chart";

  return (
    <section className="ix-hero">
      <Link to="/films/$slug" params={{ slug: film.slug }} className="ix-hero__card">
        <img
          className="ix-hero__img"
          src={backdropAt(film.backdrop_url, "w1280") ?? undefined}
          srcSet={backdropSrcSet(film.backdrop_url)}
          sizes="(max-width: 640px) 100vw, 92vw"
          alt=""
          width={1280}
          height={720}
          fetchPriority="high"
          decoding="async"
        />
        <div className="ix-hero__body">
          <span className="ix-hero__rank">
            <b>#{film.rank}</b> Movie 100{" "}
            {trend === "new" ? (
              <span className="ix-mv ix-mv--new">New</span>
            ) : trend === "rise" ? (
              <span className="ix-mv ix-mv--up">
                <ArrowUp aria-hidden /> {move}
              </span>
            ) : trend === "fall" ? (
              <span className="ix-mv ix-mv--down">
                <ArrowDown aria-hidden /> {Math.abs(move)}
              </span>
            ) : (
              <span className="ix-mv ix-mv--flat">
                <Minus aria-hidden /> 0
              </span>
            )}
          </span>
          <h1 className="ix-hero__title">{film.title}</h1>
          <div className="ix-hero__meta">
            {film.genre_tag && <span>{film.genre_tag}</span>}
            {film.country_origin && (
              <>
                <span aria-hidden>·</span>
                <span>{film.country_origin}</span>
              </>
            )}
            {date && (
              <>
                <span aria-hidden>·</span>
                <span>{date.slice(0, 4)}</span>
              </>
            )}
            {film.weeks_on_chart ? (
              <>
                <span aria-hidden>·</span>
                <span>
                  {film.weeks_on_chart}{" "}
                  {film.weeks_on_chart === 1 ? "week" : "weeks"} on chart
                </span>
              </>
            ) : null}
          </div>
          <span className="ix-hero__chip">
            <i>
              <Play aria-hidden />
            </i>
            {tenure}
          </span>
        </div>
      </Link>
    </section>
  );
}

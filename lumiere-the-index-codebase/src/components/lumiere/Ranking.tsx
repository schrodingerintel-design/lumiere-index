import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { RankedFilm } from "@/lib/apiClient";
import { FilmPosterThumbnail } from "./FilmPosterThumbnail";
import { ListSkeleton } from "./Skeletons";

/**
 * Movement indicator — arrow + number, color-supported but never color-only.
 * "NEW" for first chart appearances; "—" for holds.
 */
export function Movement({ film }: { film: RankedFilm }) {
  const change = film.movement ?? 0;
  if (film.prev_rank == null) {
    return (
      <span
        className="inline-block rounded-sm bg-foreground/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-foreground"
        title="First appearance on The Index"
      >
        New
      </span>
    );
  }
  if (change > 0) {
    return (
      <span
        className="flex items-center gap-0.5 font-mono text-xs tabular text-up"
        title={`Up ${change} since yesterday`}
      >
        <ArrowUp className="h-3 w-3" aria-hidden />
        {change}
      </span>
    );
  }
  if (change < 0) {
    return (
      <span
        className="flex items-center gap-0.5 font-mono text-xs tabular text-down"
        title={`Down ${Math.abs(change)} since yesterday`}
      >
        <ArrowDown className="h-3 w-3" aria-hidden />
        {Math.abs(change)}
      </span>
    );
  }
  return (
    <span className="font-mono text-sm text-muted-foreground" title="Held its rank">
      —
    </span>
  );
}

function metaLine(film: RankedFilm): string {
  const director = film.director && film.director !== "Unknown" ? film.director : null;
  // Chart tenure in days — the chart refreshes every 15 minutes, so days is
  // the honest unit. NEW entries (no previous snapshot) show "1d".
  const days = film.days_on_chart ?? 1;
  return [director, film.year, `${days}d`].filter(Boolean).join(" · ");
}

/**
 * The editorial ranking row — rank, poster, title, score.
 * A quiet horizontal row with a hairline rule; metadata stays secondary.
 */
export function RankRow({ film }: { film: RankedFilm }) {
  return (
    <Link
      to="/films/$slug"
      params={{ slug: film.slug }}
      className="group flex items-center gap-3 py-3 transition-colors hover:bg-foreground/[0.03] sm:gap-4 sm:py-3.5"
    >
      <span className="w-7 shrink-0 font-mono text-lg tabular text-muted-foreground sm:w-8 sm:text-xl">
        {String(film.rank).padStart(2, "0")}
      </span>
      <FilmPosterThumbnail film={film} className="h-16 w-11 sm:h-[72px] sm:w-12" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium leading-snug text-foreground sm:text-base">
          {film.title}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground sm:text-[13px]">
          {metaLine(film)}
        </div>
      </div>
      <div className="hidden w-14 shrink-0 sm:block">
        <Movement film={film} />
      </div>
      <div className="shrink-0 text-right">
        <div className="index-score text-xl sm:text-2xl">{film.score?.toFixed(1)}</div>
        <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.18em] text-muted-foreground">
          Index Score
        </div>
      </div>
    </Link>
  );
}

/**
 * Page section heading — kicker, serif title, rule, and optional "see all".
 */
export function SectionHeading({
  kicker,
  title,
  copy,
  seeAllHref,
  seeAllLabel = "See all",
}: {
  kicker?: string;
  title: string;
  copy?: string;
  seeAllHref?: string;
  seeAllLabel?: string;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-xl">
        {kicker && (
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
            {kicker}
          </div>
        )}
        <h2 className="mt-1.5 font-display text-2xl font-medium leading-tight sm:text-3xl">
          {title}
        </h2>
        {copy && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy}</p>}
      </div>
      {seeAllHref && (
        <Link
          to={seeAllHref}
          className="shrink-0 text-[13px] font-medium text-muted-foreground transition hover:text-foreground"
        >
          {seeAllLabel} →
        </Link>
      )}
    </div>
  );
}

/** Ranked list wrapper — hairline rules, responsive skeleton, empty + error states. */
export function RankedList({
  films,
  isLoading,
  error,
  skeletonRows = 8,
}: {
  films: RankedFilm[] | undefined;
  isLoading: boolean;
  error?: unknown;
  skeletonRows?: number;
}) {
  return (
    <ul className="divide-y divide-foreground/[0.07] border-y border-foreground/10">
      {isLoading ? (
        <ListSkeleton rows={skeletonRows} />
      ) : error ? (
        <li className="py-12 text-center text-sm text-muted-foreground">
          Something went wrong. Please try again.
        </li>
      ) : films && films.length > 0 ? (
        films.map((f) => (
          <li key={f.slug}>
            <RankRow film={f} />
          </li>
        ))
      ) : (
        <li className="py-12 text-center text-sm text-muted-foreground">
          The chart is being prepared. Check back shortly.
        </li>
      )}
    </ul>
  );
}

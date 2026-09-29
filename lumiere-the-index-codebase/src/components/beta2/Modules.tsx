/**
 * Beta 2.0 — homepage discovery modules.
 *
 * §5 is explicit that these must not all be the same horizontal carousel, so
 * each one earns a different rhythm:
 *
 *   Surging        — a dense poster rail, scannable in one flick
 *   Biggest Movers — rows with a directional bar (the one place movement gets
 *                    visual weight, because movement IS the story)
 *   New Entries    — staggered "arrival" cards
 *   Movies / TV    — two large editorial entry panels, not a list
 *   Weekly         — a single monumental spotlight
 *   Genres         — a tactile chip grid
 *
 * Truthfulness constraint: every line here is derived from data we actually
 * hold. No module implies we know WHY something is moving, and nothing implies
 * we measure watching, viewing or conversation.
 */
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Sparkles } from "lucide-react";

import type { MoverFilm, NewEntryFilm } from "@/lib/apiClient";
import { count, VOICE } from "@/lib/voice";
import { ArtFrame, MovementChip, RankGlyph, SectionHeader, movementTone } from "./ChartAtoms";
import { cn } from "@/lib/utils";

interface RankedLike {
  title: string;
  slug: string;
  rank?: number | null;
  year?: number | null;
  poster_url?: string | null;
  gradient_from?: string | null;
  gradient_to?: string | null;
  prev_rank?: number | null;
  movement?: number | null;
  peak_rank?: number | null;
  days_on_chart?: number | null;
  momentum?: string | null;
}

/**
 * SURGING NOW — the titles climbing fastest.
 * A tight poster rail: artwork is the fastest thing to parse at speed.
 */
export function SurgingRail({ films }: { films: RankedLike[] }) {
  if (films.length === 0) return null;
  return (
    <section className="fold-defer mx-auto w-full max-w-canvas px-5 py-14 sm:px-8 sm:py-16 lg:px-14">
      <SectionHeader
        eyebrow="Rising"
        title="Moving up. Fast."
        copy="The titles climbing the fastest right now."
        href="/rising"
      />
      <ul className="rail -mx-5 px-5 sm:-mx-8 sm:px-8 lg:-mx-14 lg:px-14">
        {films.map((film) => (
          <li key={film.slug} className="rail-item w-[9.5rem] sm:w-[11rem]">
            <Link
              to="/films/$slug"
              params={{ slug: film.slug }}
              className="tier-row focus-ring group block rounded-b2-md p-2"
            >
              <div className="relative">
                <ArtFrame
                  film={film}
                  ratio="2/3"
                  className="rounded-b2-md"
                  sizes="(min-width: 640px) 160px, 136px"
                  imgClassName="transition-transform duration-500 group-hover:scale-[1.05]"
                />
                <span className="absolute left-2 top-2 rounded-b2-sm bg-[#070708]/75 px-1.5 py-0.5 backdrop-blur-sm">
                  <RankGlyph rank={film.rank ?? 0} className="text-[12px]" />
                </span>
              </div>
              <h3 className="mt-2.5 line-clamp-2 text-[13px] font-medium leading-snug text-paper">
                {film.title}
              </h3>
              {film.movement ? (
                <p className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-[#4ADE80]">
                  <ArrowUp className="h-3 w-3" aria-hidden />
                  {film.movement}
                  <span className="sr-only">{count(film.movement, "place")}</span>
                </p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * BIGGEST MOVERS — "Things escalated."
 *
 * The one module where a directional bar carries weight. The bar encodes
 * magnitude, not value, so it cannot be read as a financial chart, and the
 * number and glyph still state the movement without relying on colour.
 */
export function MoversModule({ films }: { films: MoverFilm[] }) {
  if (films.length === 0) return null;
  const peak = Math.max(...films.map((f) => Math.abs(f.movement)), 1);

  return (
    <section className="fold-defer mx-auto w-full max-w-canvas px-5 py-14 sm:px-8 sm:py-16 lg:px-14">
      <SectionHeader
        eyebrow="Biggest Movers"
        title={VOICE.moversTitle}
        copy="The largest rank changes since the last published chart."
        href="/rising"
      />
      <ul className="grid gap-2 lg:grid-cols-2 lg:gap-3">
        {films.map((film) => {
          const up = film.direction === "up";
          const magnitude = Math.abs(film.movement);
          const width = `${Math.max(12, (magnitude / peak) * 100)}%`;
          return (
            <li key={film.slug}>
              <Link
                to="/films/$slug"
                params={{ slug: film.slug }}
                className="tier-row focus-ring group flex items-center gap-4 p-2.5 sm:gap-5 sm:p-3"
              >
                <ArtFrame
                  film={film}
                  ratio="2/3"
                  className="h-[4.5rem] w-12 shrink-0 rounded-b2-sm sm:h-20 sm:w-[3.4rem]"
                  sizes="(min-width: 640px) 54px, 48px"
                  imgClassName="transition-transform duration-500 group-hover:scale-[1.06]"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[15px] font-medium text-paper">{film.title}</h3>
                  <p className="mt-0.5 text-[12px] text-[#7C7A76]">
                    {film.previous_rank != null
                      ? `#${film.previous_rank} → #${film.current_rank}`
                      : `#${film.current_rank}`}
                  </p>
                  {/* Magnitude bar — animates once on arrival. */}
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-3">
                    <div
                      className={cn(
                        "anim-sweep h-full rounded-full",
                        up ? "bg-[#4ADE80]" : "bg-[#F87171]",
                      )}
                      style={{ width }}
                    />
                  </div>
                </div>
                <MovementChip
                  tone={up ? "up" : "down"}
                  movement={magnitude}
                  register="discovery"
                  className="shrink-0"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * NEW ENTRIES — "Fresh on the chart."
 *
 * New entries get a distinct arrival animation, because arriving is the story.
 * Only the debut rank is shown: a new title has no trajectory yet, and
 * implying one would be fiction.
 */
export function NewEntriesModule({ films }: { films: NewEntryFilm[] }) {
  if (films.length === 0) return null;
  return (
    <section className="fold-defer mx-auto w-full max-w-canvas px-5 py-14 sm:px-8 sm:py-16 lg:px-14">
      <SectionHeader
        eyebrow="New Entries"
        title={VOICE.newEntriesTitle}
        copy="Titles that joined The Index for the first time in the latest cycle."
        href="/new-entries"
      />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {films.map((film, i) => (
          <li key={film.slug} className="anim-arrival" style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}>
            <Link
              to="/films/$slug"
              params={{ slug: film.slug }}
              className="tier-major-card focus-ring group block overflow-hidden"
            >
              <div className="relative">
                <ArtFrame
                  film={film}
                  ratio="2/3"
                  className="rounded-none"
                  imgClassName="transition-transform duration-500 group-hover:scale-[1.05]"
                  sizes="(min-width: 1024px) 16rem, 45vw"
                />
                <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-violet/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-paper">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  New
                </span>
              </div>
              <div className="p-3">
                <h3 className="truncate text-[13px] font-semibold leading-snug text-paper">{film.title}</h3>
                <p className="mt-1 text-[12px] text-[#7C7A76]">Debuted at #{film.debut_rank}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * MOVIES / TV — two large editorial entry panels.
 *
 * Deliberately not a chart preview. These are doors, sized to feel like the
 * two halves of what The Index covers.
 */
export function ChartEntryPanels({
  movies,
  tv,
}: {
  movies: RankedLike[];
  tv: RankedLike[];
}) {
  const panels = [
    {
      href: "/top-100",
      kicker: "Movie 100",
      title: VOICE.moviesTitle,
      copy: "The full hundred, ranked by measured cultural momentum.",
      films: movies.slice(0, 5),
    },
    {
      href: "/tv-100",
      kicker: "TV 100",
      title: VOICE.tvTitle,
      copy: "The series commanding the most attention right now.",
      films: tv.slice(0, 5),
    },
  ];

  return (
    <section className="fold-defer mx-auto w-full max-w-canvas px-5 py-14 sm:px-8 sm:py-16 lg:px-14">
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        {panels.map((panel) => (
          <Link
            key={panel.href}
            to={panel.href}
            className="tier-major-card focus-ring group relative flex flex-col justify-between overflow-hidden p-5 sm:p-7"
          >
            <div>
              <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-violet-hi">
                {panel.kicker}
              </div>
              <h3 className="mt-2 text-[clamp(1.375rem,3vw,1.875rem)] font-bold leading-[1.1] tracking-[-0.02em] text-paper">
                {panel.title}
              </h3>
              <p className="mt-2 max-w-[40ch] text-[14px] leading-relaxed text-[#A8A6A1]">
                {panel.copy}
              </p>
            </div>
            {/* A peek at the leaders, so the panel promises a real chart. */}
            <div className="mt-6 flex items-end gap-2">
              {panel.films.slice(0, 5).map((film) => (
                <div key={film.slug} className="min-w-0 flex-1">
                  <ArtFrame
                    film={film}
                    ratio="2/3"
                    className="w-full rounded-b2-sm"
                    imgClassName="transition-transform duration-500 group-hover:scale-[1.04]"
                    sizes="(min-width: 1024px) 8rem, 18vw"
                  />
                </div>
              ))}
            </div>
            <span className="mt-5 inline-flex items-center gap-1 text-[13px] font-medium text-paper">
              Open the chart
              <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * WEEKLY — a single monumental spotlight.
 *
 * Weekly answers a different question ("what defined this week?"), so it must
 * not look like the live charts. Larger, quieter, one title.
 */
export function WeeklySpotlight({
  leader,
  weekLabel,
}: {
  leader: RankedLike | null;
  weekLabel?: string | null;
}) {
  // The Weekly door stays open even before the week is published — the
  // archive exists as a destination, we just have no leader to show yet. We
  // never invent a placeholder title.
  return (
    <section className="fold-defer mx-auto w-full max-w-canvas px-5 py-14 sm:px-8 sm:py-16 lg:px-14">
      <div className="tier-major-card relative overflow-hidden p-5 sm:p-8 lg:p-10">
        <div className="amb-surface absolute inset-0" aria-hidden />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-10">
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-violet-hi">
              Weekly 100
              {weekLabel ? <span className="text-[#7C7A76]"> · {weekLabel}</span> : null}
            </div>
            <h3 className="mt-2 text-[clamp(1.75rem,4.5vw,2.75rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-paper">
              {VOICE.weeklyTitle}
            </h3>
            <p className="mt-3 max-w-[46ch] text-[14px] leading-relaxed text-[#A8A6A1]">
              The week in culture, measured across movies and TV together — whole-week
              performance, one combined hundred.
            </p>
            <Link
              to="/weekly-100"
              className="focus-ring mt-6 inline-flex min-h-11 items-center rounded-b2-sm border border-line-strong px-5 text-[14px] font-medium text-paper transition-colors hover:bg-surface-2"
            >
              Open Weekly 100
            </Link>
          </div>
          {leader ? (
            <Link
              to="/films/$slug"
              params={{ slug: leader.slug }}
              className="focus-ring group relative mx-auto w-40 shrink-0 sm:w-48"
            >
              <div className="amb-halo" aria-hidden />
              <ArtFrame
                film={leader}
                ratio="2/3"
                priority={false}
                className="relative w-full rounded-b2-md shadow-2xl shadow-black/60"
                sizes="(min-width: 640px) 192px, 160px"
                imgClassName="transition-transform duration-500 group-hover:scale-[1.04]"
              />
              <p className="mt-3 truncate text-center text-[13px] font-medium text-paper">
                {leader.title}
              </p>
              <p className="text-center text-[12px] text-[#7C7A76]">#1 this week</p>
            </Link>
          ) : (
            <p className="mx-auto max-w-[24ch] text-center text-[13px] text-[#7C7A76]">
              This week&rsquo;s hundred lands when the week does.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/** DISCOVERY — genre entry points as a tactile chip grid. */
export function GenreDiscovery({
  genres,
}: {
  genres: { tag: string; label: string; count: number }[];
}) {
  if (genres.length === 0) return null;
  return (
    <section className="fold-defer mx-auto w-full max-w-canvas px-5 py-14 sm:px-8 sm:py-16 lg:px-14">
      <SectionHeader
        eyebrow="Discovery"
        title="Go deeper"
        copy="Browse the Index by genre."
        href="/genres"
        hrefLabel="All genres"
      />
      <ul className="flex flex-wrap gap-2">
        {genres.map((genre) => (
          <li key={genre.tag}>
            <Link
              to="/genres"
              className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface-1 px-4 text-[14px] font-medium text-paper transition-colors hover:border-violet/50 hover:bg-surface-2"
            >
              {genre.label}
              <span className="text-[12px] text-[#7C7A76]">{genre.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export type { RankedLike };

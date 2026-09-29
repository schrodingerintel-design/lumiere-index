/**
 * Beta 2.0 — Top 10.
 *
 * The chart is the product, so the top ten gets the strongest treatment
 * outside the hero. The point of this module is HIERARCHY: a hundred equally
 * important rows is a database view, not a chart. Here, #1 is visually
 * distinct, #2–#5 are premium cards, and #6–#10 stay prestigious but yield
 * progressively.
 *
 * Layout note: on mobile this is a horizontal snap rail (thumb-friendly,
 * artwork-forward, one flick to see the next title); on desktop it is a two
 * column grid that uses the extra canvas instead of just getting wider.
 */
import { Link } from "@tanstack/react-router";

import type { RankedFilm } from "@/lib/apiClient";
import { VOICE, movementLine } from "@/lib/voice";
import {
  ArtFrame,
  MovementChip,
  PeakTag,
  RankGlyph,
  SectionHeader,
  SurgeTag,
  TenureTag,
  movementTone,
} from "./ChartAtoms";
import { useAmbience, useAmbienceStyle } from "./useAmbience";
import { useRef } from "react";
import { cn } from "@/lib/utils";

/** #1 gets a dedicated, unmistakably larger treatment. */
function LeaderSpotlight({ film }: { film: RankedFilm }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const ambience = useAmbience({
    artworkUrl: film.backdrop_url ?? film.poster_url ?? null,
    titleColour: film.gradient_from ?? null,
  });
  useAmbienceStyle(ambience, ref);

  const tone = movementTone({ previousRank: film.prev_rank, movement: film.movement });

  return (
    <Link
      to="/films/$slug"
      params={{ slug: film.slug }}
      className="tier-major-card focus-ring group relative col-span-full block overflow-hidden sm:col-span-2 lg:col-span-4"
    >
      <div ref={ref} className="amb-surface relative flex flex-col gap-5 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
        <div className="relative shrink-0">
          <div className="amb-halo" aria-hidden />
          <ArtFrame
            film={film}
            ratio="2/3"
            className="relative w-28 sm:w-32"
            sizes="(min-width: 640px) 128px, 112px"
            imgClassName="transition-transform duration-500 group-hover:scale-[1.04]"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <RankGlyph rank={film.rank ?? 1} className="text-[3rem] sm:text-[3.5rem]" />
            {film.momentum === "SURGING" ? <SurgeTag /> : null}
          </div>
          <h3 className="mt-2 truncate text-[clamp(1.25rem,2.4vw,1.75rem)] font-bold leading-tight tracking-[-0.02em] text-paper">
            {film.title}
          </h3>
          <p className="mt-1.5 text-[13px] text-[#A8A6A1]">
            {[film.director && film.director !== "Unknown" ? film.director : null, film.year]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <MovementChip tone={tone} movement={film.movement} register="discovery" />
            <span className="text-[13px] text-[#A8A6A1]">
              {movementLine(
                {
                  rank: film.rank ?? 1,
                  previousRank: film.prev_rank,
                  movement: film.movement,
                  daysOnChart: film.days_on_chart,
                },
                "discovery",
              )}
            </span>
            <PeakTag peakRank={film.peak_rank} />
            <TenureTag days={film.days_on_chart} />
          </div>
        </div>
      </div>
    </Link>
  );
}

/** #2–#5: large premium cards. */
function PremiumCard({ film }: { film: RankedFilm }) {
  const tone = movementTone({ previousRank: film.prev_rank, movement: film.movement });
  return (
    <Link
      to="/films/$slug"
      params={{ slug: film.slug }}
      className="tier-major-card focus-ring group col-span-1 block overflow-hidden"
    >
      <div className="relative">
        <ArtFrame
          film={film}
          ratio="2/3"
          className="rounded-none"
          imgClassName="transition-transform duration-500 group-hover:scale-[1.05]"
          sizes="(min-width: 1024px) 288px, (min-width: 640px) 45vw, 78vw"
        />
        <span className="absolute left-3 top-3 rounded-b2-sm bg-[#070708]/75 px-2 py-0.5 backdrop-blur-sm">
          <RankGlyph rank={film.rank ?? 0} className="text-[13px]" />
        </span>
        {film.momentum === "SURGING" ? (
          <span className="absolute right-3 top-3">
            <SurgeTag />
          </span>
        ) : null}
      </div>
      <div className="p-4">
        <h3 className="truncate text-[15px] font-semibold leading-snug text-paper">{film.title}</h3>
        <p className="mt-1 truncate text-[12px] text-[#7C7A76]">
          {[film.year, film.director && film.director !== "Unknown" ? film.director : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <MovementChip tone={tone} movement={film.movement} />
          <PeakTag peakRank={film.peak_rank} />
        </div>
      </div>
    </Link>
  );
}

/** #6–#10: strong, but compact enough to read as a run rather than a card. */
function StrongRow({ film }: { film: RankedFilm }) {
  const tone = movementTone({ previousRank: film.prev_rank, movement: film.movement });
  return (
    <Link
      to="/films/$slug"
      params={{ slug: film.slug }}
      className="tier-row focus-ring group flex items-center gap-4 p-2.5 sm:gap-5"
    >
      <span className="w-9 shrink-0 text-right sm:w-11">
        <RankGlyph rank={film.rank ?? 0} className="text-[1.5rem]" />
      </span>
      <ArtFrame
        film={film}
        ratio="2/3"
        className="h-20 w-[3.4rem] shrink-0 rounded-b2-sm sm:h-24 sm:w-[4.1rem]"
        sizes="(min-width: 640px) 66px, 54px"
        imgClassName="transition-transform duration-500 group-hover:scale-[1.06]"
      />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-semibold leading-snug text-paper">{film.title}</h3>
        <p className="mt-0.5 truncate text-[12px] text-[#7C7A76]">
          {[film.year, film.director && film.director !== "Unknown" ? film.director : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <MovementChip tone={tone} movement={film.movement} />
        <PeakTag peakRank={film.peak_rank} className="hidden sm:inline" />
      </div>
    </Link>
  );
}

export function TopTen({ films }: { films: RankedFilm[] }) {
  if (films.length === 0) return null;
  const [first, ...rest] = films;
  const premium = rest.slice(0, 4);
  const strong = rest.slice(4, 10);

  return (
    <section className="fold-defer mx-auto w-full max-w-canvas px-5 py-14 sm:px-8 sm:py-16 lg:px-14 lg:py-20">
      <SectionHeader
        eyebrow="Movie 100"
        title={VOICE.moviesTitle}
        copy="Ranked by measured cultural momentum, refreshed every 15 minutes."
        href="/top-100"
        hrefLabel="Full Movie 100"
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <LeaderSpotlight film={first} />
        {premium.map((film) => (
          <PremiumCard key={film.slug} film={film} />
        ))}
      </div>

      {strong.length > 0 ? (
        <div className="mt-3 grid gap-1 sm:mt-4 lg:grid-cols-2 lg:gap-2">
          {strong.map((film) => (
            <StrongRow key={film.slug} film={film} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Compact chart rows — the #11–#25 and #26–#100 density for the full charts.
 * Exported from here so Movie 100 / TV 100 / Weekly share one implementation.
 */
export function CompactChartRow({ film }: { film: RankedFilm }) {
  const tone = movementTone({ previousRank: film.prev_rank, movement: film.movement });
  const isNew = tone === "new";
  return (
    <Link
      to="/films/$slug"
      params={{ slug: film.slug }}
      className={cn(
        "tier-row focus-ring group flex items-center gap-3 py-2.5 sm:gap-4 sm:py-3",
        isNew && "anim-arrival",
      )}
    >
      <span className="w-8 shrink-0 text-right sm:w-10">
        <RankGlyph rank={film.rank ?? 0} variant="outline" className="text-[1.125rem] sm:text-[1.375rem]" />
      </span>
      <ArtFrame
        film={film}
        ratio="2/3"
        className="h-14 w-[2.4rem] shrink-0 rounded-b2-sm sm:h-16 sm:w-11"
        sizes="(min-width: 640px) 44px, 38px"
        imgClassName="transition-transform duration-500 group-hover:scale-[1.06]"
      />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[14px] font-medium leading-snug text-paper sm:text-[15px]">
          {film.title}
        </h3>
        <p className="mt-0.5 truncate text-[12px] text-[#7C7A76]">
          {[film.year, film.director && film.director !== "Unknown" ? film.director : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="hidden shrink-0 items-center gap-6 sm:flex">
        <PeakTag peakRank={film.peak_rank} />
        <TenureTag days={film.days_on_chart} />
      </div>
      <MovementChip tone={tone} movement={film.movement} className="shrink-0" />
    </Link>
  );
}

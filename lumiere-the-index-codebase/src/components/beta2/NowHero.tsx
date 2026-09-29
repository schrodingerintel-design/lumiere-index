/**
 * Beta 2.0 — the hero.
 *
 * Answers "what matters right now?" in the first viewport. The current #1 is
 * the protagonist: it gets hero-scale artwork, a signature rank numeral, and
 * the page atmosphere that the rest of the screen inherits.
 *
 * Design decisions worth stating:
 *
 * · The backdrop is present but never competes. It is dimmed and graded so the
 *   type stays at full contrast, and the adaptive wash supplies the colour
 *   that the photograph itself can't provide in a dark UI.
 *
 * · Peek, don't hide. Neighbouring titles are visible at the edges on mobile,
 *   so the visitor understands there is a chart below rather than a
 *   single-title hero.
 *
 * · Mobile is swipeable, desktop is anchored to the leader. The two layouts
 *   are different experiences on purpose, not one layout that shrank (§11).
 *
 * · The hero never exposes a score, a signal count, or any other internal.
 *   Public facts only: rank, movement, peak, tenure.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";

import type { RankedFilm } from "@/lib/apiClient";
import { tmdbAtSize, tmdbSrcSet } from "@/lib/apiClient";
import { VOICE, movementLine, peakLine, tenureLine } from "@/lib/voice";
import {
  ArtFrame,
  DesktopOnlyArtFrame,
  LivePill,
  MovementChip,
  RankGlyph,
  movementTone,
} from "./ChartAtoms";
import { useAmbience, useAmbienceStyle } from "./useAmbience";
import { cn } from "@/lib/utils";

/** How many leading titles the hero can explore. */
const LEADERS = 5;

export function NowHero({ films }: { films: RankedFilm[] }) {
  const leaders = films.slice(0, LEADERS);
  const [index, setIndex] = useState(0);
  const regionRef = useRef<HTMLElement | null>(null);

  // A new #1 resets exploration so the default state is always honest about
  // who is leading.
  useEffect(() => {
    setIndex(0);
  }, [films[0]?.slug]);

  const active = leaders[index] ?? films[0] ?? null;

  const ambience = useAmbience({
    artworkUrl: active?.backdrop_url ?? active?.poster_url ?? null,
    titleColour: active?.gradient_from ?? null,
  });
  useAmbienceStyle(ambience, regionRef);

  if (!active) return null;

  const tone = movementTone({
    previousRank: active.prev_rank,
    movement: active.movement,
  });
  const isLeader = index === 0;

  const go = (delta: number) => {
    if (leaders.length < 2) return;
    setIndex((current) => (current + delta + leaders.length) % leaders.length);
  };

  // Swipe between leading titles (§11). Pointer-events based so it works with
  // touch and pen; ignored once the gesture turns into a vertical scroll.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") return;
    swipe.current = { x: event.clientX, y: event.clientY };
  }, []);
  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const start = swipe.current;
      swipe.current = null;
      if (!start || leaders.length < 2) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
      go(dx < 0 ? 1 : -1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leaders.length],
  );

  return (
    <section
      ref={regionRef}
      className="no-bleed relative isolate overflow-hidden"
      aria-label="What matters right now"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {/* ── Atmosphere ─────────────────────────────────────────────────────
          Two layers: the artwork itself (dimmed, graded) and the adaptive
          wash on top. Neither is a background colour in the CSS sense — the
          canvas underneath stays #070708 and text always sits on ink. */}
      <div className="amb-field absolute inset-0 -z-10" aria-hidden />

      {active.backdrop_url ? (
        <div className="absolute inset-0 -z-10" aria-hidden>
          {/* This is the LCP element, so it is the single most important
              request on the page. The API only ever gives us one w1280 URL;
              a phone at 2x needs 780px, and the browser was downloading 255 KB
              to paint a 780px-wide box at 42% opacity behind a scrim. The
              srcset lets it pick w780 on a phone and w1280 on a desktop, and
              `fetchPriority` + eager loading keep it off the lazy queue
              because it is above the fold by definition. */}
          <img
            key={active.backdrop_url}
            src={tmdbAtSize(active.backdrop_url, "w780") ?? active.backdrop_url}
            srcSet={tmdbSrcSet(active.backdrop_url, "backdrop")}
            sizes="100vw"
            alt=""
            className="anim-fade h-full w-full scale-105 object-cover object-[50%_28%] opacity-[0.42]"
            fetchPriority="high"
            loading="eager"
            decoding="async"
          />
          {/* Grade: pull the photo down toward the canvas so type keeps its
              contrast and the violet accent stays the loudest thing here. */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#070708]/55 via-[#070708]/78 to-[#070708]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#070708]/90 via-transparent to-[#070708]/50" />
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-canvas px-5 pb-8 pt-6 sm:px-8 sm:pb-12 sm:pt-10 lg:px-14 lg:pb-16 lg:pt-14">
        {/* Eyebrow row: what this is, and how live it is. */}
        <div className="mb-6 flex flex-wrap items-center gap-3 sm:mb-8">
          <LivePill />
          <span className="text-[12px] font-medium uppercase tracking-[0.18em] text-[#A8A6A1]">
            {VOICE.heroEyebrow}
          </span>
          <span className="text-[12px] text-[#7C7A76]">Updated every 15 min</span>
        </div>

        <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-14">
          {/* ── Identity ───────────────────────────────────────────────── */}
          <div className="min-w-0">
            <div className="flex items-start gap-4 sm:gap-6">
              <RankGlyph rank={active.rank ?? 1} variant="hero" className="shrink-0" />
              <div className="min-w-0 flex-1 pt-1">
                <h1 className="text-[clamp(2.25rem,7.5vw,4.5rem)] font-extrabold leading-[0.95] tracking-[-0.035em] text-paper">
                  <Link
                    to="/films/$slug"
                    params={{ slug: active.slug }}
                    className="focus-ring transition-colors hover:text-violet-hi"
                  >
                    {active.title}
                  </Link>
                </h1>
                <p className="mt-3 text-[14px] text-[#A8A6A1]">
                  {[active.director && active.director !== "Unknown" ? active.director : null, active.year]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>

            {/* Movement, stated plainly. Never colour-only. */}
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <MovementChip tone={tone} movement={active.movement} register="discovery" />
              <span className="text-[13px] text-[#A8A6A1]">
                {movementLine(
                  {
                    rank: active.rank ?? 1,
                    previousRank: active.prev_rank,
                    movement: active.movement,
                    daysOnChart: active.days_on_chart,
                  },
                  "discovery",
                )}
              </span>
              {peakLine(active.peak_rank) ? (
                <span className="text-[13px] text-[#7C7A76]">{peakLine(active.peak_rank)}</span>
              ) : null}
              {tenureLine(active.days_on_chart) ? (
                <span className="text-[13px] text-[#7C7A76]">{tenureLine(active.days_on_chart)}</span>
              ) : null}
            </div>

            {active.synopsis ? (
              <p className="mt-5 line-clamp-2 max-w-measure text-[14px] leading-relaxed text-[#A8A6A1] lg:line-clamp-3">
                {active.synopsis}
              </p>
            ) : null}

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to="/films/$slug"
                params={{ slug: active.slug }}
                className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-b2-sm bg-violet px-5 text-[14px] font-semibold text-paper transition-colors hover:bg-violet-lo"
              >
                <Play className="h-4 w-4" aria-hidden />
                See the run
              </Link>
              <Link
                to="/top-100"
                className="focus-ring inline-flex min-h-11 items-center rounded-b2-sm border border-line-strong px-5 text-[14px] font-medium text-paper transition-colors hover:bg-surface-2"
              >
                Movie 100
              </Link>
            </div>
          </div>

          {/* ── Artwork ──────────────────────────────────────────────────
              Mobile: a peek at the neighbours, swipeable. Desktop: the
              poster sits in an ambient halo so it feels lit by its own
              colour rather than pasted onto the page. */}
          <div className="relative hidden lg:block">
            <div className="amb-halo" aria-hidden />
            <Link
              to="/films/$slug"
              params={{ slug: active.slug }}
              className="focus-ring relative block overflow-hidden rounded-b2-lg shadow-2xl shadow-black/60 amb-edge"
            >
              <DesktopOnlyArtFrame
                film={active}
                ratio="2/3"
                className="w-full rounded-none"
                sizes="22rem"
              />
            </Link>
          </div>
        </div>

        {/* ── Exploration ───────────────────────────────────────────────
            Only rendered when there is more than one leader, and only where
            exploring is meaningful. Keyboard and pointer both work. */}
        {leaders.length > 1 ? (
          <div className="mt-8 flex items-center gap-3 sm:mt-10">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous title"
              className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-strong text-[#A8A6A1] transition-colors hover:bg-surface-2 hover:text-paper"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>

            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
              {leaders.map((film, i) => {
                const selected = i === index;
                return (
                  <button
                    key={film.slug}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-current={selected ? "true" : undefined}
                    aria-label={`Show ${film.title}, ranked ${film.rank}`}
                    className={cn(
                      "focus-ring-inset group relative h-16 w-12 shrink-0 overflow-hidden rounded-b2-sm transition-all duration-200 sm:h-20 sm:w-16",
                      selected
                        ? "ring-2 ring-violet ring-offset-2 ring-offset-[#070708]"
                        : "opacity-55 hover:opacity-100",
                    )}
                  >
                    <ArtFrame film={film} className="h-full w-full rounded-none" />
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next title"
              className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-strong text-[#A8A6A1] transition-colors hover:bg-surface-2 hover:text-paper"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        ) : null}

        {/* Screen-reader narration of the carousel, matching the existing
            1.x pattern so the experience is not a downgrade for AT users. */}
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {isLeader
            ? `${active.title} is number one on Movie 100.`
            : `${active.title}, ranked number ${active.rank} on Movie 100.`}
        </p>
      </div>
    </section>
  );
}

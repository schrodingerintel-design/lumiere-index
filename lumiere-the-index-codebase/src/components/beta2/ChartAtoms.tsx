/**
 * Beta 2.0 — chart atoms.
 *
 * The primitives every ranked surface composes from. They exist so the
 * hierarchy between "this is #1", "this is #4" and "this is #87" is expressed
 * once, in one place, and stays consistent as the system propagates from the
 * homepage to Movie 100, TV 100, Weekly and the title pages.
 *
 * Two rules are load-bearing here:
 *
 * 1. MOVEMENT IS NEVER COLOUR-ONLY (§19). Every movement state pairs its
 *    colour with a directional glyph AND (where space allows) a word. Green
 *    and red are the last channel to arrive, never the only one.
 *
 * 2. NO RANKING INTERNALS. Scores, signal volumes, source weights, confidence
 *    and provider health are never rendered by anything in this file. What a
 *    visitor can see is rank, artwork, title, movement, peak and tenure — the
 *    public facts about a chart position.
 */
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Flame, Minus, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { tmdbPosterUrl, tmdbSrcSet, tmdbAtSize } from "@/lib/apiClient";
import { count, movementLine, peakLine, tenureLine, VOICE } from "@/lib/voice";
import { cn } from "@/lib/utils";

/** Poster helper for a ranked title. Falls back to a gradient wash. */
export function posterFor(
  film: { title: string; poster_url?: string | null; gradient_from?: string | null; gradient_to?: string | null },
  size: "w342" | "w185" | "w500" | "original" = "w342",
): string | null {
  if (film.poster_url) return film.poster_url;
  void size;
  return null;
}

export function gradientFor(
  film: { gradient_from?: string | null; gradient_to?: string | null },
): string {
  return `linear-gradient(155deg, ${film.gradient_from ?? "#2a2a2f"}, ${film.gradient_to ?? "#0f0f12"})`;
}

/**
 * The signature rank numeral. Outlines the mid-chart positions so the column
 * reads as a texture of numbers without competing with the artwork.
 */
export function RankGlyph({
  rank,
  variant = "solid",
  className,
}: {
  rank: number;
  variant?: "solid" | "outline" | "hero";
  className?: string;
}) {
  return (
    <span
      className={cn(
        variant === "outline" ? "rank-glyph-outline" : "rank-glyph",
        variant === "hero" && "text-[clamp(4.5rem,14vw,11rem)]",
        className,
      )}
    >
      {rank}
    </span>
  );
}

/** Movement state derived from published chart data only. */
export type MovementTone = "up" | "down" | "hold" | "new";

export function movementTone(input: {
  previousRank: number | null | undefined;
  movement: number | null | undefined;
  isNewEntry?: boolean;
}): MovementTone {
  if (input.isNewEntry || input.previousRank == null) return "new";
  const m = input.movement ?? 0;
  if (m > 0) return "up";
  if (m < 0) return "down";
  return "hold";
}

/**
 * Movement chip — the public state of change.
 *
 * Colour is the third channel, never the first: a glyph carries direction,
 * the number carries magnitude, and the accessible name carries the sentence.
 */
export function MovementChip({
  tone,
  movement,
  register = "chart",
  className,
  showLabel = true,
}: {
  tone: MovementTone;
  movement: number | null | undefined;
  register?: "discovery" | "chart" | "history";
  className?: string;
  showLabel?: boolean;
}) {
  const magnitude = Math.abs(movement ?? 0);

  if (tone === "new") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-violet/15 px-2 py-0.5 text-[11px] font-semibold text-violet-hi",
          className,
        )}
        title="New to the chart"
      >
        <Sparkles className="h-3 w-3" aria-hidden />
        {showLabel ? "New" : null}
        <span className="sr-only">New to the chart</span>
      </span>
    );
  }

  const Icon = tone === "up" ? ArrowUp : tone === "down" ? ArrowDown : Minus;
  const toneClass =
    tone === "up"
      ? "text-[#4ADE80]"
      : tone === "down"
        ? "text-[#F87171]"
        : "text-[#7C7A76]";
  const spoken = movementLine(
    { rank: 0, previousRank: 1, movement: tone === "up" ? magnitude : tone === "down" ? -magnitude : 0 },
    register,
  );

  return (
    <span
      className={cn("inline-flex items-center gap-1 text-[12px] font-semibold tabular", toneClass, className)}
      title={spoken}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {tone !== "hold" ? magnitude : null}
      <span className="sr-only">
        {tone === "up"
          ? `Up ${count(magnitude, "place")}`
          : tone === "down"
            ? `Down ${count(magnitude, "place")}`
            : "Held position"}
      </span>
    </span>
  );
}

/** Peak position — omitted entirely when the data has none. */
export function PeakTag({ peakRank, className }: { peakRank?: number | null; className?: string }) {
  const label = peakLine(peakRank);
  if (!label) return null;
  return <span className={cn("text-[12px] text-[#A8A6A1]", className)}>{label}</span>;
}

/** Tenure on the live chart, in days — the honest unit for a 15-min refresh. */
export function TenureTag({ days, className }: { days?: number | null; className?: string }) {
  const label = tenureLine(days);
  if (!label) return null;
  return <span className={cn("text-[12px] text-[#7C7A76]", className)}>{label}</span>;
}

/** Surging marker for genuinely fast risers. */
export function SurgeTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-violet/12 px-2 py-0.5 text-[11px] font-semibold text-violet-hi",
        className,
      )}
    >
      <Flame className="h-3 w-3" aria-hidden />
      Surging
    </span>
  );
}

/**
 * Section header for the 2.0 discovery modules.
 *
 * Each module gets a headline in the product's voice plus an honest
 * supporting line. Kicker labels are set in the type system rather than the
 * old all-caps mono treatment, which is being phased out (§23).
 */
export function SectionHeader({
  eyebrow,
  title,
  copy,
  href,
  hrefLabel = "See all",
  aside,
}: {
  eyebrow?: string;
  title: string;
  copy?: string;
  href?: string;
  hrefLabel?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-violet-hi">{eyebrow}</div>
        ) : null}
        <h2 className="mt-1.5 text-[clamp(1.5rem,3.2vw,2.125rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-paper">
          {title}
        </h2>
        {copy ? <p className="mt-2 max-w-[52ch] text-[14px] leading-relaxed text-[#A8A6A1]">{copy}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-4">
        {aside}
        {href ? (
          <Link
            to={href}
            className="focus-ring -mr-2 inline-flex min-h-11 items-center gap-1 rounded-b2-sm px-2 text-[13px] font-medium text-[#A8A6A1] transition-colors hover:text-paper"
          >
            {hrefLabel}
            <span aria-hidden>→</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Artwork frame — one place that decides how poster art behaves: object-cover,
 * a gradient underlay for titles with no poster, and an optional ambient halo
 * that the adaptive system colours.
 */
export function ArtFrame({
  film,
  ratio = "2/3",
  className,
  imgClassName,
  loading = "lazy",
  sizes,
  priority = false,
}: {
  film: { title: string; poster_url?: string | null; gradient_from?: string | null; gradient_to?: string | null };
  ratio?: "2/3" | "16/9" | "1/1";
  className?: string;
  imgClassName?: string;
  loading?: "lazy" | "eager";
  sizes?: string;
  priority?: boolean;
}) {
  const poster = posterFor(film, "w342");
  // `sizes` is what makes a srcset useful. Every call site states the real
  // rendered width, so a rail card asks for a 185px poster and a hero card can
  // still ask for 500. Without it the browser assumes 100vw and over-fetches.
  const srcSet = tmdbSrcSet(poster, "poster");
  return (
    <div
      className={cn("relative overflow-hidden rounded-b2-md bg-surface-1", className)}
      style={{
        aspectRatio: ratio,
        background: gradientFor(film),
      }}
    >
      {poster ? (
        <img
          src={poster}
          srcSet={srcSet}
          sizes={sizes ?? (srcSet ? "180px" : undefined)}
          alt={film.title}
          loading={priority ? "eager" : loading}
          decoding="async"
          fetchPriority={priority ? "high" : undefined}
          className={cn("h-full w-full object-cover", imgClassName)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center p-3 text-center text-[12px] font-medium text-[#A8A6A1]">
          {film.title}
        </div>
      )}
    </div>
  );
}

/**
 * Poster that only exists on large screens.
 *
 * A `hidden lg:block` ancestor does NOT stop a browser fetching the image —
 * the element is still in the document and the preload scanner still sees it,
 * so a phone was downloading a 500px poster for a poster it can never see.
 * `<picture>` with a `media` source is the only construct that reliably
 * prevents the request, so that is what the desktop-only hero artwork uses.
 */
export function DesktopOnlyArtFrame({
  film,
  ratio = "2/3",
  className,
  imgClassName,
  sizes,
}: {
  film: { title: string; poster_url?: string | null; gradient_from?: string | null; gradient_to?: string | null };
  ratio?: "2/3" | "16/9" | "1/1";
  className?: string;
  imgClassName?: string;
  sizes?: string;
}) {
  const poster = posterFor(film, "w342");
  return (
    <div
      className={cn("relative overflow-hidden rounded-b2-md bg-surface-1", className)}
      style={{
        aspectRatio: ratio,
        background: gradientFor(film),
      }}
    >
      {poster ? (
        <picture>
          <source
            media="(min-width: 1024px)"
            srcSet={tmdbSrcSet(poster, "poster")}
            sizes={sizes ?? "288px"}
          />
          {/* Deliberately has no src of its own: a <picture> with a media
              source that never matches falls through here, and an img with
              only a data-less src issues no request at all. The gradient
              behind it keeps the box visually intact until the desktop layout
              takes over. */}
          <img
            alt={film.title}
            loading="lazy"
            decoding="async"
            className={cn("h-full w-full object-cover", imgClassName)}
          />
        </picture>
      ) : (
        <div className="flex h-full w-full items-center justify-center p-3 text-center text-[12px] font-medium text-[#A8A6A1]">
          {film.title}
        </div>
      )}
    </div>
  );
}

/** Live "updated" pill used in the hero and chart headers. */
export function LivePill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-line bg-scrim px-2.5 py-1 text-[11px] font-medium text-[#A8A6A1] backdrop-blur-sm",
        className,
      )}
    >
      <span className="anim-live h-1.5 w-1.5 rounded-full bg-violet" aria-hidden />
      Live
    </span>
  );
}

export { VOICE };

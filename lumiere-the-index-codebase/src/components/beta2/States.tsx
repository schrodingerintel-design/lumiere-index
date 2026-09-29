/**
 * Beta 2.0 — loading, empty and degraded states.
 *
 * §17 is a product requirement, not a nice-to-have: a failure must still look
 * like The Index. These states therefore share the surface palette, the type
 * system and the voice, rather than dropping the visitor into a browser-default
 * page.
 *
 * Two engineering rules hold across all of them:
 *
 * · Skeletons MIRROR the real layout's geometry. A skeleton that doesn't match
 *   the content it replaces is a layout-shift generator, and CLS is a
 *   performance bug (§18).
 *
 * · A degraded state is never silent and never eternal. If the charts can't be
 *   reached we say so and offer a retry, instead of spinning forever.
 */
import { Link } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";

import { VOICE } from "@/lib/voice";
import { cn } from "@/lib/utils";

// ── skeletons ───────────────────────────────────────────────────────────────

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("b2-skeleton", className)} aria-hidden />;
}

/** Hero skeleton: artwork plane + the type block beneath it. */
export function HeroSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-canvas px-5 py-8 sm:px-8 lg:px-14 lg:py-14"
      aria-hidden
    >
      <div className="mb-8 flex items-center gap-3">
        <SkeletonBlock className="h-6 w-16 rounded-full" />
        <SkeletonBlock className="h-3 w-40" />
      </div>
      <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-14">
        <div>
          <div className="flex items-start gap-6">
            <SkeletonBlock className="h-20 w-24 sm:h-28 sm:w-32" />
            <div className="flex-1 space-y-3 pt-2">
              <SkeletonBlock className="h-10 w-4/5 sm:h-14" />
              <SkeletonBlock className="h-3 w-40" />
            </div>
          </div>
          <div className="mt-6 flex gap-4">
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="h-4 w-28" />
          </div>
          <div className="mt-8 flex gap-3">
            <SkeletonBlock className="h-11 w-36 rounded-b2-sm" />
            <SkeletonBlock className="h-11 w-28 rounded-b2-sm" />
          </div>
        </div>
        <SkeletonBlock className="hidden aspect-[2/3] w-full rounded-b2-lg lg:block" />
      </div>
    </div>
  );
}

/** Top-10 skeleton: one wide spotlight, then cards, matching the real grid. */
export function TopTenSkeleton() {
  return (
    <section
      className="mx-auto w-full max-w-canvas px-5 py-14 sm:px-8 lg:px-14"
      aria-hidden
    >
      <div className="mb-6 space-y-3">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-8 w-72 max-w-full" />
        <SkeletonBlock className="h-3 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="col-span-full flex gap-5 rounded-b2-lg border border-line p-4 sm:col-span-2 lg:col-span-4">
          <SkeletonBlock className="h-40 w-28 shrink-0 sm:h-44 sm:w-32" />
          <div className="flex-1 space-y-3 py-2">
            <SkeletonBlock className="h-12 w-32" />
            <SkeletonBlock className="h-6 w-3/4" />
            <SkeletonBlock className="h-3 w-32" />
            <div className="flex gap-4 pt-2">
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="h-3 w-24" />
            </div>
          </div>
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="overflow-hidden rounded-b2-lg border border-line">
            <SkeletonBlock className="aspect-[2/3] w-full rounded-none" />
            <div className="space-y-2 p-4">
              <SkeletonBlock className="h-4 w-4/5" />
              <SkeletonBlock className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Generic rail skeleton for the horizontal discovery modules. */
export function RailSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="rail -mx-5 px-5 sm:-mx-8 sm:px-8 lg:-mx-14 lg:px-14" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rail-item w-[9.5rem] sm:w-[11rem]">
          <SkeletonBlock className="aspect-[2/3] w-full" />
          <SkeletonBlock className="mt-3 h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

/** Section header skeleton, so headers don't pop in after their content. */
export function SectionHeaderSkeleton() {
  return (
    <div className="mb-6 space-y-3" aria-hidden>
      <SkeletonBlock className="h-3 w-20" />
      <SkeletonBlock className="h-7 w-64 max-w-full" />
    </div>
  );
}

// ── degraded / empty states ─────────────────────────────────────────────────

/**
 * Charts unreachable. Honest, calm, and always offers a way forward — the
 * visitor learns what happened instead of watching a skeleton forever.
 */
export function ChartsUnavailable({ onRetry }: { onRetry?: () => void }) {
  return (
    <section className="mx-auto w-full max-w-canvas px-5 py-20 sm:px-8 lg:px-14">
      <div className="mx-auto max-w-[46ch] rounded-b2-lg border border-line bg-surface-1 px-6 py-12 text-center sm:px-10">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-line text-[#A8A6A1]">
          <RotateCcw className="h-5 w-5" aria-hidden />
        </div>
        <h2 className="mt-5 text-[1.25rem] font-semibold text-paper">Charts are reconnecting</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[#A8A6A1]">{VOICE.chartsUnavailable}</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-b2-sm bg-violet px-5 text-[14px] font-semibold text-paper transition-colors hover:bg-violet-lo"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Try again
            </button>
          ) : null}
          <Link
            to="/"
            className="focus-ring inline-flex min-h-11 items-center rounded-b2-sm border border-line-strong px-5 text-[14px] font-medium text-paper transition-colors hover:bg-surface-2"
          >
            Go home
          </Link>
        </div>
      </div>
    </section>
  );
}

/** A module that resolved to no data — stated plainly, never an empty box. */
export function ModuleEmpty({ note }: { note?: string }) {
  return (
    <p className="rounded-b2-md border border-dashed border-line px-5 py-10 text-center text-[14px] text-[#7C7A76]">
      {note ?? "Nothing here yet. The Index updates every 15 minutes."}
    </p>
  );
}

/** 404 — still unmistakably The Index. */
export function NotFoundState() {
  return (
    <section className="mx-auto flex min-h-[70svh] w-full max-w-canvas flex-col items-center justify-center px-5 py-24 text-center">
      <div className="rank-glyph-outline text-[clamp(4rem,12vw,7rem)]">404</div>
      <h1 className="mt-4 text-[1.5rem] font-semibold text-paper">Wrong turn.</h1>
      <p className="mt-2 max-w-[42ch] text-[14px] leading-relaxed text-[#A8A6A1]">
        That page isn't part of the Index. The charts are still right where you left them.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/"
          className="focus-ring inline-flex min-h-11 items-center rounded-b2-sm bg-violet px-5 text-[14px] font-semibold text-paper transition-colors hover:bg-violet-lo"
        >
          Go home
        </Link>
        <Link
          to="/top-100"
          className="focus-ring inline-flex min-h-11 items-center rounded-b2-sm border border-line-strong px-5 text-[14px] font-medium text-paper transition-colors hover:bg-surface-2"
        >
          Movie 100
        </Link>
      </div>
    </section>
  );
}

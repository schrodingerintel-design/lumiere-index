/**
 * Momentum — the public state of change.
 *
 * Derived by the backend from each title's rank trajectory across recent
 * chart snapshots (deterministic thresholds, never the score's value).
 * SURGING gets slightly more visual weight than STEADY; everything stays
 * within the existing typography and token system — no status pills.
 */
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

export type MomentumState = "SURGING" | "RISING" | "STEADY" | "COOLING" | "FALLING";

const STYLES: Record<
  MomentumState,
  { label: string; icon: typeof ArrowUp; className: string; strong: boolean }
> = {
  SURGING: { label: "Surging", icon: ArrowUp, className: "text-primary", strong: true },
  RISING: { label: "Rising", icon: ArrowUp, className: "text-foreground/80", strong: false },
  STEADY: { label: "Steady", icon: Minus, className: "text-muted-foreground", strong: false },
  COOLING: { label: "Cooling", icon: ArrowDown, className: "text-muted-foreground", strong: false },
  FALLING: { label: "Falling", icon: ArrowDown, className: "text-muted-foreground/70", strong: false },
};

export function momentumState(value: string | null | undefined): MomentumState {
  const s = (value ?? "STEADY").toUpperCase();
  return (s in STYLES ? s : "STEADY") as MomentumState;
}

/**
 * Editorial momentum mark — small caps word + directional glyph.
 * `strong` (SURGING) earns the accent color and a touch more weight;
 * everything else stays quiet.
 */
export function MomentumMark({
  state,
  className = "",
}: {
  state: string | null | undefined;
  className?: string;
}) {
  const m = STYLES[momentumState(state)];
  const Icon = m.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] ${m.className} ${className}`}
      title={`Momentum: ${m.label}`}
    >
      <Icon
        className={`h-3 w-3 ${m.strong ? "stroke-[2.5]" : ""}`}
        aria-hidden
      />
      {m.label}
    </span>
  );
}

/**
 * Compact inline form for dense rows and cards: "↑ SURGING".
 */
export function MomentumInline({
  state,
  className = "",
}: {
  state: string | null | undefined;
  className?: string;
}) {
  const m = STYLES[momentumState(state)];
  const Icon = m.icon;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${m.className} ${className}`}
      title={`Momentum: ${m.label}`}
    >
      <Icon className={`h-3 w-3 ${m.strong ? "stroke-[2.5]" : ""}`} aria-hidden />
    </span>
  );
}

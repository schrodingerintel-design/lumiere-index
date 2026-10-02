/**
 * Momentum — the public state of change.
 *
 * Derived by the backend from each title's rank trajectory across recent chart
 * snapshots (deterministic thresholds, never the score's value).
 *
 * Rendered in the plane's movement language: the same arrows and the same
 * amber/blue pair the home page uses for a rising or falling title, so a chart
 * row and a poster card say the same thing with the same marks. No status
 * pills, no red.
 */
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

export type MomentumState = "SURGING" | "RISING" | "STEADY" | "COOLING" | "FALLING";

const STYLES: Record<
  MomentumState,
  { label: string; icon: typeof ArrowUp; tone: string; strong: boolean }
> = {
  SURGING: { label: "Surging", icon: ArrowUp, tone: "ix-mom--up", strong: true },
  RISING: { label: "Rising", icon: ArrowUp, tone: "ix-mom--up", strong: false },
  STEADY: { label: "Steady", icon: Minus, tone: "ix-mom--flat", strong: false },
  COOLING: { label: "Cooling", icon: ArrowDown, tone: "ix-mom--flat", strong: false },
  FALLING: { label: "Falling", icon: ArrowDown, tone: "ix-mom--down", strong: false },
};

export function momentumState(value: string | null | undefined): MomentumState {
  const s = (value ?? "STEADY").toUpperCase();
  return (s in STYLES ? s : "STEADY") as MomentumState;
}

/** Word plus glyph. SURGING earns weight; everything else stays quiet. */
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
    <span className={`ix-mom ${m.tone} ${className}`.trim()} title={`Momentum: ${m.label}`}>
      <Icon aria-hidden />
      {m.label}
    </span>
  );
}

/** Glyph only, for dense rows and cards. */
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
      className={`ix-mom ix-mom--icon ${m.tone} ${className}`.trim()}
      title={`Momentum: ${m.label}`}
    >
      <Icon aria-hidden />
    </span>
  );
}

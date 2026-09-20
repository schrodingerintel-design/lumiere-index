import { useState } from "react";
import { BETA_VERSION } from "@/lib/beta";
import { BetaNotice } from "@/components/lumiere/BetaNotice";

/**
 * The Beta chip — lives beside the brand mark in the header (desktop and
 * mobile) and in the footer wordmark. Obvious enough that every viewer
 * knows they're looking at a beta; quiet enough to never fight the chart.
 * Clicking it always opens the current release notes.
 */
export function BetaBadge({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Beta version ${BETA_VERSION} — see what's new`}
        title={`Beta v${BETA_VERSION} — see what's new`}
        className={`inline-flex h-[18px] shrink-0 items-center rounded-full border border-primary/40 bg-primary/10 px-1.5 font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.08em] text-primary transition hover:border-primary/70 hover:bg-primary/20 ${className}`}
      >
        β{BETA_VERSION}
      </button>
      {open && <BetaNotice forceOpen onClose={() => setOpen(false)} />}
    </>
  );
}

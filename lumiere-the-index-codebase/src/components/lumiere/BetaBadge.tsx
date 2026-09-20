import { useState } from "react";
import { BETA_VERSION } from "@/lib/beta";
import { BetaNotice } from "@/components/lumiere/BetaNotice";

/**
 * The Beta pill — sits beside the brand mark in the header (desktop and
 * mobile) and in the footer wordmark. The word spelled out in full, pill
 * shaped, quiet enough to never fight the chart but impossible to miss.
 * Clicking it opens the release notes as a centered popup.
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
        className={`inline-flex h-6 shrink-0 items-center rounded-full border border-primary/40 bg-primary/10 px-2.5 font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.1em] text-primary transition hover:border-primary/70 hover:bg-primary/20 ${className}`}
      >
        Beta&nbsp;v{BETA_VERSION}
      </button>
      {open && <BetaNotice forceOpen onClose={() => setOpen(false)} />}
    </>
  );
}

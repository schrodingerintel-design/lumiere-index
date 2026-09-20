import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  BETA_RELEASES,
  BETA_VERSION,
  CURRENT_RELEASE,
  LAST_SEEN_VERSION_KEY,
  markBetaAnnouncementSeen,
  pendingBetaAnnouncement,
  releasesSince,
  type BetaRelease,
} from "@/lib/beta";
import { LogoMark } from "@/components/lumiere/Brand";

/**
 * The Beta notice — the single popup system for beta communication.
 *
 * Two modes, driven by pendingBetaAnnouncement():
 *  - intro:  a brand-new viewer is told, once, that The Index is a public
 *            beta — what that means and where the version chip lives.
 *  - update: a returning viewer whose last-seen version is older gets the
 *            what's-new rundown for every version they missed.
 *
 * Shows once per version (localStorage), dismissible, Escape closes,
 * focus lands on the dialog so keyboard users aren't trapped behind it.
 * Renders nothing when there's nothing to say.
 */
export function BetaNotice({ forceOpen, onClose }: { forceOpen?: boolean; onClose?: () => void }) {
  const [mode] = useState(() => (forceOpen ? "update" : pendingBetaAnnouncement()));
  const [visible, setVisible] = useState(mode !== null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasForced = useRef(forceOpen === true);

  useEffect(() => {
    if (visible) closeRef.current?.focus();
  }, [visible]);

  const dismiss = () => {
    markBetaAnnouncementSeen();
    setVisible(false);
    onClose?.();
  };

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible || mode === null) return null;

  const missed: BetaRelease[] =
    mode === "update" && !wasForced.current && typeof localStorage !== "undefined"
      ? releasesSince(safeGet(LAST_SEEN_VERSION_KEY) ?? BETA_VERSION)
      : [CURRENT_RELEASE];

  return (
    <div
      className="animate-fade-up fixed inset-x-3 bottom-3 z-[70] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:max-w-sm"
      role="dialog"
      aria-modal="false"
      aria-label={`Beta ${BETA_VERSION} release notes`}
    >
      <div className="overflow-hidden rounded-xl border border-border bg-ink/95 shadow-2xl shadow-black/60 backdrop-blur-md">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-4 w-4 text-foreground" />
            <div>
              <p className="font-display text-[15px] leading-tight tracking-tight text-foreground">
                {mode === "intro" ? "You're viewing a beta" : `What's new in Beta ${BETA_VERSION}`}
              </p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {mode === "intro"
                  ? `The Index · Beta v${BETA_VERSION}`
                  : CURRENT_RELEASE.date}
              </p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={dismiss}
            aria-label="Dismiss beta notice"
            className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
          {mode === "intro" && (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              The Index is a live chart of what film and television the culture is
              actually talking about — refreshed every 15 minutes. It's in public
              beta: everything you see can change, improve and grow. The{" "}
              <span className="font-mono text-[11px] font-semibold text-primary">β{BETA_VERSION}</span>{" "}
              chip beside the logo always shows the current version — tap it any
              time to see what's changed.
            </p>
          )}

          {missed.map((release) => (
            <div key={release.version} className={release !== missed[0] ? "mt-4 border-t border-foreground/5 pt-3" : ""}>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Beta v{release.version} · {release.date}
              </p>
              <p className="mt-1 text-[13px] font-medium leading-snug text-foreground">
                {release.headline}
              </p>
              <ul className="mt-1.5 space-y-1">
                {release.changes.map((change, i) => (
                  <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-muted-foreground">
                    <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary/70" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Public Beta
          </p>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md border border-foreground/15 px-3 py-1.5 text-[12px] font-medium text-foreground transition hover:border-foreground/30 hover:bg-foreground/5"
          >
            {mode === "intro" ? "Got it" : "Thanks — got it"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** localStorage read that never throws (private mode, disabled storage). */
function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** All known releases, newest first — for the About page changelog. */
export { BETA_RELEASES };

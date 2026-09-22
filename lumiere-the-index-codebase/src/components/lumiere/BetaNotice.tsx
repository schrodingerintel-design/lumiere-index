import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
 * One mode, driven by pendingBetaAnnouncement():
 *  - update: a returning viewer whose last-seen version is older gets the
 *            what's-new rundown for every version they missed. First-time
 *            visitors get NO popup — nothing should greet a brand-new
 *            visitor but the site itself; the badge is the on-demand
 *            surface (tap it to open the latest notes any time).
 *
 * Always a CENTERED modal (mobile and desktop), with a dimming backdrop.
 * Shows once per version (localStorage), dismissible via button, Escape or
 * backdrop tap; background scroll is locked while open. Renders nothing
 * when there's nothing to say.
 *
 * The dialog is portaled to document.body. This is not cosmetic: the badge
 * instance mounts inside the header, whose `backdrop-filter` makes it the
 * containing block for position:fixed descendants — an unportaled modal
 * would center inside the 56px header strip and land off-screen. Portaling
 * anchors the overlay to the real viewport everywhere it is used.
 */
export function BetaNotice({ forceOpen, onClose }: { forceOpen?: boolean; onClose?: () => void }) {
  const [mode] = useState(() => (forceOpen ? "update" : pendingBetaAnnouncement()) as "update" | null);
  const [visible, setVisible] = useState(mode !== null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasForced = useRef(forceOpen === true);

  useEffect(() => {
    if (visible) closeRef.current?.focus();
  }, [visible]);

  // Lock background scroll while the modal is open.
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
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
    mode === "update" && !wasForced.current
      ? releasesSince(safeGet(LAST_SEEN_VERSION_KEY) ?? BETA_VERSION)
      : [CURRENT_RELEASE];

  // createPortal is never reached during SSR: on the server localStorage is
  // unavailable so pendingBetaAnnouncement() returns null, and forceOpen is
  // only ever set by a client-side badge tap.
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Beta ${BETA_VERSION} release notes`}
    >
      {/* Backdrop — click to dismiss */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={dismiss} aria-hidden />

      {/* Centered dialog */}
      <div className="animate-fade-up relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-ink shadow-2xl shadow-black/70">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <LogoMark className="h-5 w-5 shrink-0 text-foreground" />
            <div>
              <p className="font-display text-lg leading-tight tracking-tight text-foreground">
                {`What's new in Beta ${BETA_VERSION}`}
              </p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {CURRENT_RELEASE.date}
              </p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={dismiss}
            aria-label="Dismiss beta notice"
            className="-mr-1.5 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {missed.map((release) => (
            <div key={release.version} className={release !== missed[0] ? "mt-5 border-t border-foreground/5 pt-4" : ""}>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Beta v{release.version} · {release.date}
              </p>
              <p className="mt-1.5 text-sm font-medium leading-snug text-foreground">
                {release.headline}
              </p>
              <ul className="mt-2 space-y-1.5">
                {release.changes.map((change, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                    <span aria-hidden className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-primary/70" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Public Beta
          </p>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Thanks, got it
          </button>
        </div>
      </div>
    </div>,
    document.body,
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

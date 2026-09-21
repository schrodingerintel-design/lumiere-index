import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Download, Loader2, Share2, X } from "lucide-react";
import {
  renderFilmCard,
  renderChartCard,
  shareCard,
  downloadCard,
  copyCardImage,
  type ChartCardOptions,
  type ShareCardResult,
} from "@/lib/shareCard";
import type { RankedFilm } from "@/lib/apiClient";
import { SITE_URL } from "@/lib/site";

type Phase = "rendering" | "ready" | "error";

/**
 * ShareCardButton — one tap opens a centered preview modal with the
 * fully-rendered card, then Share / Download / Copy actions.
 *
 * Rendering starts when the modal opens; the card is drawn locally on a
 * canvas, so the only latency is the poster fetch, which degrades to the
 * brand gradient if the CDN is slow.
 */
export function ShareCardButton({
  variant,
  card,
  className = "",
  label = "Share",
}: {
  variant: "film" | "chart";
  /** film → RankedFilm; chart → ChartCardOptions */
  card: RankedFilm | ChartCardOptions;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("rendering");
  const [result, setResult] = useState<ShareCardResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [action, setAction] = useState<null | "shared" | "copied">(null);

  const startRender = useCallback(async () => {
    setPhase("rendering");
    setResult(null);
    try {
      const r =
        variant === "film"
          ? await renderFilmCard(card as RankedFilm)
          : await renderChartCard(card as ChartCardOptions);
      setResult(r);
      setPreviewUrl(URL.createObjectURL(r.blob));
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, [card, variant]);

  useEffect(() => {
    if (open) void startRender();
  }, [open, startRender]);

  // Revoke the preview object URL when it changes or the modal closes.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleShare = async () => {
    if (!result) return;
    const filmCard = variant === "film" ? (card as RankedFilm) : null;
    const chartOpts = variant === "chart" ? (card as ChartCardOptions) : null;
    const title = filmCard ? `${filmCard.title} · The Index` : "The Index · Live Charts";
    const text = filmCard
      ? `${filmCard.title} is #${filmCard.rank} on The Index.`
      : (chartOpts?.title ?? "The Index");
    const outcome = await shareCard(result, { title, text, url: SITE_URL });
    if (outcome === "shared") setAction("shared");
    else if (outcome === "link-copied") setAction("copied");
    setTimeout(() => setAction(null), 2500);
  };

  const handleDownload = async () => {
    if (!result) return;
    await downloadCard(result);
  };

  const handleCopy = async () => {
    if (!result) return;
    const outcome = await copyCardImage(result);
    if (outcome === "copied") {
      setAction("copied");
      setTimeout(() => setAction(null), 2500);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={label}
        className={`inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground ${className}`}
      >
        <Share2 className="h-3.5 w-3.5" />
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Share card"
          onClick={() => setOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          <div
            className="relative max-h-[88vh] w-full max-w-sm overflow-y-auto rounded-2xl border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="px-5 pt-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                The Index
              </p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">
                Share this moment on the chart
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Poster card rendered on your device.
              </p>
            </div>

            {/* Card preview */}
            <div className="mt-4 flex max-h-[52vh] justify-center overflow-y-auto px-5">
              {phase === "rendering" && (
                <div className="flex aspect-[4/5] w-full max-w-[260px] items-center justify-center rounded-xl border bg-muted/40">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="font-mono text-xs uppercase tracking-widest">
                      Rendering…
                    </span>
                  </div>
                </div>
              )}
              {phase === "ready" && previewUrl && (
                <img
                  src={previewUrl}
                  alt="Share card preview"
                  className="w-full max-w-[260px] rounded-xl border shadow-lg"
                />
              )}
              {phase === "error" && (
                <div className="flex aspect-[4/5] w-full max-w-[260px] items-center justify-center rounded-xl border bg-muted/40">
                  <span className="px-6 text-center text-sm text-muted-foreground">
                    Couldn't render the card. Try again.
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-4 grid grid-cols-3 gap-2 px-5 pb-5">
              <button
                onClick={handleShare}
                disabled={!result}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              >
                {action === "shared" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
                {action === "shared" ? "Sent" : "Share"}
              </button>
              <button
                onClick={handleDownload}
                disabled={!result}
                className="flex items-center justify-center gap-1.5 rounded-lg border bg-background/60 px-3 py-2.5 text-sm font-medium transition hover:bg-muted/60 disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> Save
              </button>
              <button
                onClick={handleCopy}
                disabled={!result}
                className="flex items-center justify-center gap-1.5 rounded-lg border bg-background/60 px-3 py-2.5 text-sm font-medium transition hover:bg-muted/60 disabled:opacity-50"
              >
                {action === "copied" ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {action === "copied" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

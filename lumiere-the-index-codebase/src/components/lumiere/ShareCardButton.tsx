import { useState } from "react";
import { Download, ImageDown } from "lucide-react";
import {
  renderFilmCard,
  renderChartCard,
  downloadCard,
  type ChartCardOptions,
} from "@/lib/shareCard";
import type { RankedFilm } from "@/lib/apiClient";

/**
 * ShareCardButton — renders a branded poster-card PNG on demand and saves it
 * as a download. Rendering happens on click so no work is done until the
 * user asks for it; posters load in parallel with per-request timeouts so a
 * slow CDN degrades to the gradient fallback, never a hang.
 */
export function ShareCardButton({
  variant,
  card,
  className = "",
  label = "Download card",
}: {
  variant: "film" | "chart";
  /** film → RankedFilm; chart → ChartCardOptions */
  card: RankedFilm | ChartCardOptions;
  className?: string;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "busy" | "saved">("idle");

  const handleClick = async () => {
    if (state === "busy") return;
    setState("busy");
    try {
      const result =
        variant === "film"
          ? await renderFilmCard(card as RankedFilm)
          : await renderChartCard(card as ChartCardOptions);
      const outcome = await downloadCard(result);
      if (outcome === "downloaded") {
        setState("saved");
        setTimeout(() => setState("idle"), 2500);
      } else {
        setState("idle");
      }
    } catch {
      setState("idle");
    }
  };

  const busy = state === "busy";
  const Icon = busy ? ImageDown : Download;
  const text = busy ? "Rendering…" : state === "saved" ? "Card saved ✓" : label;

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-60 ${className}`}
    >
      <Icon className={`h-3.5 w-3.5 ${busy ? "animate-pulse" : ""}`} />
      {text}
    </button>
  );
}

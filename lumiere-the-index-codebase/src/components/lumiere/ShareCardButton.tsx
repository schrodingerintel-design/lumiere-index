import { useState } from "react";
import { Download, ImageDown, Share2 } from "lucide-react";
import {
  renderFilmCard,
  renderChartCard,
  shareOrDownloadCard,
  type ChartCardOptions,
} from "@/lib/shareCard";
import type { RankedFilm } from "@/lib/apiClient";

/**
 * ShareCardButton — renders a branded poster-card PNG on demand and either
 * shares it through the OS share sheet (when file sharing is supported) or
 * downloads it directly. Rendering happens on click so no work is done
 * until the user asks for it.
 */
export function ShareCardButton({
  variant,
  card,
  className = "",
  label = "Share card",
}: {
  variant: "film" | "chart";
  /** film → RankedFilm; chart → ChartCardOptions */
  card: RankedFilm | ChartCardOptions;
  className?: string;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "busy" | "shared" | "downloaded">("idle");

  const handleClick = async () => {
    if (state === "busy") return;
    setState("busy");
    try {
      const result =
        variant === "film"
          ? await renderFilmCard(card as RankedFilm)
          : await renderChartCard(card as ChartCardOptions);
      const text =
        variant === "film"
          ? `${(card as RankedFilm).title} is #${(card as RankedFilm).rank} on The Index with a score of ${(card as RankedFilm).score?.toFixed(1)}.`
          : `${(card as ChartCardOptions).title} — ${(card as ChartCardOptions).subtitle}`;
      const outcome = await shareOrDownloadCard(result, text);
      if (outcome === "shared" || outcome === "downloaded") {
        setState(outcome);
        setTimeout(() => setState("idle"), 2500);
      } else {
        setState("idle");
      }
    } catch {
      setState("idle");
    }
  };

  const busy = state === "busy";
  const Icon = busy ? ImageDown : state === "downloaded" ? Download : Share2;
  const text = busy
    ? "Rendering…"
    : state === "shared"
      ? "Shared"
      : state === "downloaded"
        ? "Card saved"
        : label;

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

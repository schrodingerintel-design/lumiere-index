import { useState } from "react";
import { Check, Share2 } from "lucide-react";

/**
 * ShareButton — one consistent share affordance across The Index.
 *
 * Uses the Web Share API when available (mobile / supported browsers); falls
 * back to copying the link and confirming inline. Never throws — a rejected
 * share simply leaves the button unchanged.
 */
export function sharePage(opts: { title: string; text: string }): Promise<"shared" | "copied" | "failed"> {
  const url = typeof window !== "undefined" ? window.location.href : "";
  if (typeof navigator !== "undefined" && navigator.share) {
    return navigator.share({ title: opts.title, text: opts.text, url }).then(
      () => "shared",
      () => "failed",
    );
  }
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(url).then(
      () => "copied",
      () => "failed",
    );
  }
  return Promise.resolve("failed");
}

export function ShareButton({
  title,
  text,
  className = "",
  label = "Share",
}: {
  title: string;
  text: string;
  className?: string;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "shared" | "copied">("idle");

  const handleShare = async () => {
    const result = await sharePage({ title, text });
    if (result === "shared" || result === "copied") {
      setState(result);
      setTimeout(() => setState("idle"), 2000);
    }
  };

  return (
    <button
      onClick={handleShare}
      aria-label={`Share ${title}`}
      className={`inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground ${className}`}
    >
      {state === "idle" ? (
        <Share2 className="h-3.5 w-3.5" />
      ) : (
        <Check className="h-3.5 w-3.5 text-primary" />
      )}
      {state === "idle" ? label : state === "shared" ? "Shared" : "Link copied"}
    </button>
  );
}

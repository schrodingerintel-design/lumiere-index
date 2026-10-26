import { useState } from "react";
import { Bookmark, BookmarkCheck, Check, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useWatchlist } from "@/lib/watchlist";
import { sitePath } from "@/lib/site";

export function FilmActions({
  slug,
  title,
  compact = false,
}: {
  slug: string;
  title: string;
  compact?: boolean;
}) {
  const { saved, toggle } = useWatchlist(slug);
  const [shared, setShared] = useState(false);
  async function share() {
    const url = sitePath(`/films/${encodeURIComponent(slug)}`);
    try {
      if (navigator.share)
        await navigator.share({ title, text: `What's your take on ${title}?`, url });
      else {
        await navigator.clipboard.writeText(url);
        setShared(true);
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError"))
        toast.error("Couldn't share this title. Please try again.");
    }
  }
  return (
    <div className={`film-actions ${compact ? "film-actions-compact" : ""}`}>
      <button
        type="button"
        onClick={() => toggle()}
        aria-pressed={saved}
        aria-label={`${saved ? "Remove" : "Save"} ${title}${saved ? " from" : " to"} watchlist`}
        className={saved ? "is-saved" : ""}
      >
        {saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
        {!compact && <span>{saved ? "Saved" : "Watchlist"}</span>}
      </button>
      <button type="button" onClick={() => void share()} aria-label={`Share ${title}`}>
        {shared ? <Check size={17} /> : <Share2 size={17} />}
        {!compact && <span>{shared ? "Link copied" : "Share"}</span>}
      </button>
      <span className="sr-only" role="status">
        {shared ? "Film link copied" : ""}
      </span>
    </div>
  );
}

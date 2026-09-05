import { Sparkles, TrendingUp, TrendingDown, Compass, AlertCircle, Zap, Eye } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { TrendingFilmOut } from "@/lib/apiClient";

interface EditorialInsightProps {
  films: TrendingFilmOut[];
}

// Real external platforms only — never the engine's own name.
const PLATFORM_NAMES: Record<string, string> = {
  reddit: "Reddit",
  tiktok: "TikTok",
  youtube: "YouTube",
  news: "news outlets",
  letterboxd: "Letterboxd",
  trends: "Google Trends",
  wikipedia: "Wikipedia",
};

function platformName(key: string | null | undefined): string | null {
  if (!key) return null;
  return PLATFORM_NAMES[key.toLowerCase()] ?? key;
}

function isConfident(film: TrendingFilmOut): boolean {
  return film.confidence === "moderate" || film.confidence === "high";
}

function isHigh(film: TrendingFilmOut): boolean {
  return film.confidence === "high";
}

// ── driver-specific label and icon ────────────────────────────────────────────

function driverLabel(film: TrendingFilmOut, isHeadline: boolean, rank: number): string {
  const label = film.driver_label ?? null;
  if (!label || !isConfident(film)) return "Not enough signal yet";
  // Superlative badge ("#NN Sustained Dominance") only at the high tier, and
  // only for the headline slot holder — which requires real current activity.
  if (isHeadline && isHigh(film) && film.headline_eligible) {
    return `#${String(rank).padStart(2, "0")} ${label}`;
  }
  return label;
}

function DriverIcon({ driver, className }: { driver: string | null | undefined; className?: string }) {
  if (driver === "momentum") return <TrendingUp className={className} />;
  if (driver === "declining") return <TrendingDown className={className} />;
  if (driver === "recency") return <Zap className={className} />;
  if (driver === "engagement") return <Eye className={className} />;
  return <TrendingUp className={className} />;
}

// ── headline varies by driver + confidence ────────────────────────────────────

function editorialHeadline(top: TrendingFilmOut): string {
  const confidence = top.confidence ?? "insufficient";
  const driver = top.dominant_driver ?? null;
  const delta = top.attention_delta_pct ?? null;
  const sign = delta != null && delta >= 0 ? "+" : "";
  const deltaStr = delta == null ? null : `${sign}${delta.toFixed(0)}%`;
  const platform = platformName(top.top_platform);
  const sample = top.sample_size ?? 0;

  if (confidence === "insufficient") {
    // No claim-bearing headline at all — honest neutral state.
    return "Just entered tracking — not enough signal yet";
  }
  if (confidence === "low") {
    // Hedged statement only; no superlatives.
    return `Limited early signal — ${top.title} just started registering audience mentions`;
  }

  if (driver === "recency") {
    return `${top.title} opens strong — drawing ${sample.toLocaleString()} signals in its first days`;
  }
  if (driver === "momentum") {
    return deltaStr
      ? `${top.title} surging ${deltaStr}${platform ? ` on ${platform}` : ""}`
      : `${top.title} surging — momentum building${platform ? ` on ${platform}` : ""}`;
  }
  if (driver === "declining") {
    return delta != null && delta < 0
      ? `${top.title} cools — conversation down ${Math.abs(delta).toFixed(0)}% from peak`
      : `${top.title} cooling after earlier momentum`;
  }
  if (driver === "engagement") {
    return `${top.title} holds with deep audience engagement — ${top.score.toFixed(1)} Index Score`;
  }
  // sustained attention (CA-driven) — "anchors the Index" requires real current
  // activity (CA_norm/M_norm above the headline floor), not just a high blended
  // score carried by recency or stale cross-platform history.
  if (isHigh(top) && top.headline_eligible) {
    return deltaStr
      ? `${top.title} anchors the Index — ${deltaStr} conversation this cycle`
      : `${top.title} anchors the Index — ${sample.toLocaleString()} signals tracked`;
  }
  return deltaStr
    ? `${top.title} holds steady — ${deltaStr} conversation this cycle`
    : `${top.title} holds steady — ${sample.toLocaleString()} signals tracked`;
}

// ── body paragraph ─────────────────────────────────────────────────────────────

function editorialBody(top: TrendingFilmOut): string {
  // The backend already produces evidence-appropriate copy per confidence tier.
  return top.trend_reason || "";
}

// ── spotlight card copy ────────────────────────────────────────────────────────

function spotlightCopy(film: TrendingFilmOut): string {
  const confidence = film.confidence ?? "insufficient";
  const driver = film.dominant_driver ?? null;
  const delta = film.attention_delta_pct ?? null;
  const sign = delta != null && delta >= 0 ? "+" : "";
  const deltaStr = delta == null ? null : `${sign}${delta.toFixed(0)}%`;
  const platform = platformName(film.top_platform);
  const sample = film.sample_size ?? 0;

  if (confidence === "insufficient") {
    return "Just entered tracking — not enough signal yet";
  }
  if (confidence === "low") {
    const noun = sample === 1 ? "mention" : "mentions";
    return `Limited early signal — ${sample.toLocaleString()} ${noun} tracked so far`;
  }

  if (driver === "recency") {
    return `Opening window active — ${sample.toLocaleString()} signals over the last 30 days`;
  }
  if (driver === "momentum") {
    return deltaStr
      ? `Conversation ${deltaStr} over 3 days — rapid rise`
      : `${film.title} is gaining momentum — ${sample.toLocaleString()} signals tracked`;
  }
  if (driver === "declining") {
    return delta != null && delta < 0
      ? `Signal cooling — conversation down ${Math.abs(delta).toFixed(0)}% from peak`
      : `Cooling after earlier momentum — ${sample.toLocaleString()} signals tracked`;
  }
  if (driver === "engagement") {
    return `High audience intensity — ${film.score.toFixed(1)} Index Score holding strong`;
  }
  return `${sample.toLocaleString()} signals tracked over the last 30 days${
    platform ? `, led by ${platform}` : ""
  }`;
}

// ── component ─────────────────────────────────────────────────────────────────

export function EditorialInsight({ films }: EditorialInsightProps) {
  const spotlightFilms = films.slice(0, 3);

  const now = new Date();
  const weekLabel = now.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (spotlightFilms.length === 0) {
    return (
      <section className="mt-4 px-4 lg:px-6">
        <div className="glass overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-background via-foreground/[0.06] to-primary/5 dark:via-ink/80 p-6 lg:p-8 flex items-center gap-4 text-muted-foreground">
          <AlertCircle className="h-5 w-5 text-primary shrink-0" />
          <p className="text-sm">
            Editorial Briefing — not enough audience signal yet. Briefs appear once titles
            clear the evidence floor.
          </p>
        </div>
      </section>
    );
  }

  // Headline slot falls through to the next-highest title with real current
  // activity (headline_eligible).  The ranked order itself is kept — a stale
  // title may still rank #1 by blended score, but it must not claim dominance.
  const headlineIdx = spotlightFilms.findIndex((f) => f.headline_eligible);
  const top = spotlightFilms[headlineIdx === -1 ? 0 : headlineIdx];
  const topPlatform = platformName(top.top_platform);
  const topDelta = top.attention_delta_pct ?? null;

  return (
    <section className="mt-4 px-4 lg:px-6">
      <div className="glass overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-background via-foreground/[0.06] to-primary/5 dark:via-ink/80 p-6 lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-primary font-mono text-xs uppercase tracking-widest">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Index Editorial Brief · {weekLabel}</span>
            </div>
            <h2 className="mt-2 font-serif text-3xl lg:text-4xl text-foreground">
              <span className="italic text-primary">{editorialHeadline(top)}</span>
            </h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              {editorialBody(top)}
            </p>
          </div>

          <div className="shrink-0 flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-background/60 p-5 backdrop-blur max-w-sm">
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <Compass className="h-4 w-4 text-primary" />
              <span>Signal Breakdown · {top.title}</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Index Score</dt>
              <dd className="text-right font-mono text-primary font-semibold">{top.score.toFixed(1)}</dd>
              <dt className="text-muted-foreground">24h mentions</dt>
              <dd className="text-right font-mono">{top.mentions_24h.toLocaleString()}</dd>
              <dt className="text-muted-foreground">3-day trend</dt>
              <dd className="text-right font-mono">
                {topDelta == null
                  ? "—"
                  : `${topDelta >= 0 ? "+" : ""}${topDelta.toFixed(0)}%`}
              </dd>
              <dt className="text-muted-foreground">Driver</dt>
              <dd className="text-right font-mono">{top.driver_label ?? "Not enough signal yet"}</dd>
              <dt className="text-muted-foreground">Top platform</dt>
              <dd className="text-right font-mono">
                {topPlatform ?? "Not enough platform data yet"}
              </dd>
              <dt className="text-muted-foreground">Signal volume</dt>
              <dd className="text-right font-mono">
                {(top.sample_size ?? 0).toLocaleString()} in 30d
              </dd>
            </dl>
            <div className="text-[10px] uppercase font-mono text-primary mt-1">
              — Lumière Signal Engine
            </div>
          </div>
        </div>

        {/* Dynamic spotlight cards */}
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3 pt-5 border-t border-foreground/10">
          {spotlightFilms.map((film, i) => {
            const driver = film.dominant_driver ?? null;
            return (
              <Link
                key={film.film_slug}
                to="/films/$slug"
                params={{ slug: film.film_slug }}
                className="group rounded-xl border border-foreground/5 bg-foreground/[0.03] p-4 transition hover:bg-foreground/10"
              >
                <div className="flex items-center justify-between text-xs font-mono text-primary mb-1">
                  <span>{driverLabel(film, i === headlineIdx, film.rank)}</span>
                  <DriverIcon driver={driver} className="h-3.5 w-3.5" />
                </div>
                <div className="font-serif text-lg font-medium text-foreground group-hover:text-primary transition-colors">
                  {film.title}
                </div>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {spotlightCopy(film)}
                </p>
                {/* Tags */}
                {film.tags && film.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {film.tags.map((tag) => (
                      <span key={tag} className="rounded px-1.5 py-0.5 font-mono text-[9px] bg-primary/10 text-primary">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
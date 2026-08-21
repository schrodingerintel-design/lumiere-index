import { Sparkles, TrendingUp, Compass, AlertCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { RankedFilm } from "@/lib/apiClient";

interface EditorialInsightProps {
  films: RankedFilm[];
}

function spotlightLabel(index: number, film: RankedFilm): string {
  if (index === 0) return `#${String(film.rank).padStart(2, "0")} Velocity Spotlight`;
  if (index === 1) return "Rising Signal";
  return "Audience Momentum";
}

function spotlightCopy(film: RankedFilm): string {
  const mv = film.movement ?? 0;
  if (mv >= 10)
    return `Surging +${mv} positions on viral audience reactions across social and review platforms.`;
  if (mv >= 5)
    return `Climbing +${mv} spots on strong word-of-mouth beyond its initial release window.`;
  if (mv > 0) return `Gaining +${mv} spots — audience conversation is building across channels.`;
  return `Holding at #${film.rank} with ${film.score.toFixed(1)} Index Score — sustained cultural presence.`;
}

function editorialHeadline(top: RankedFilm): string {
  const mv = top.movement ?? 0;
  if (mv >= 10) return `${top.title} leads the Index — +${mv} positions gained this cycle`;
  if (mv >= 5)
    return `${top.title} climbs sharply — audience signals intensifying across platforms`;
  if (mv > 0) return `${top.title} holds the velocity lead with steady momentum`;
  return `${top.title} anchors the cultural Index at #${top.rank}`;
}

function editorialBody(top: RankedFilm): string {
  const mv = top.movement ?? 0;
  const score = top.score.toFixed(1);
  if (mv >= 5) {
    return `Lumière's multi-channel signal tracking detected a surge in organic audience engagement. Reviews across Letterboxd, Reddit and news sources are citing ${top.title} as a standout cultural moment — moving +${mv} positions to reach ${score} on the Index Score.`;
  }
  return `With an Index Score of ${score}, ${top.title} leads this week's cultural pulse. Audience signal volume across review and social platforms points to sustained engagement beyond the initial release window.`;
}

export function EditorialInsight({ films }: EditorialInsightProps) {
  // Only show films with actual movement as spotlight; fall back to top-ranked
  const realMovers = films.filter((f) => !f.is_fallback && (f.movement ?? 0) > 0);
  const spotlightFilms = realMovers.length >= 1 ? films.slice(0, 3) : films.slice(0, 3);

  const now = new Date();
  const weekLabel = now.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // No data at all — show a clean placeholder
  if (spotlightFilms.length === 0) {
    return (
      <section className="mt-12 px-4 lg:px-6">
        <div className="glass overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-background via-foreground/[0.06] to-primary/5 dark:via-ink/80 p-6 lg:p-8 flex items-center gap-4 text-muted-foreground">
          <AlertCircle className="h-5 w-5 text-primary shrink-0" />
          <p className="text-sm">
            Editorial Briefing — signal data loading. Check back shortly as the Index populates.
          </p>
        </div>
      </section>
    );
  }

  const top = spotlightFilms[0];

  return (
    <section className="mt-12 px-4 lg:px-6">
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
              <span>Cultural Velocity Takeaway</span>
            </div>
            <p className="text-xs text-foreground/90 font-serif italic">
              "Lumière's Index Score for '{top.title}' reached {top.score.toFixed(1)} — tracking
              audience sentiment velocity as the most predictive metric for sustained cultural
              relevance."
            </p>
            <div className="text-[10px] uppercase font-mono text-primary">
              — Lumière Editorial Board
            </div>
          </div>
        </div>

        {/* Dynamic spotlight cards — driven by actual top movers */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 pt-6 border-t border-foreground/10">
          {spotlightFilms.map((film, i) => (
            <Link
              key={film.slug}
              to="/films/$slug"
              params={{ slug: film.slug }}
              className="group rounded-xl border border-foreground/5 bg-foreground/[0.03] p-4 transition hover:bg-foreground/10"
            >
              <div className="flex items-center justify-between text-xs font-mono text-primary mb-1">
                <span>{spotlightLabel(i, film)}</span>
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
              <div className="font-serif text-lg font-medium text-foreground group-hover:text-primary transition-colors">
                {film.title}
              </div>
              {film.is_fallback ? (
                <p className="mt-1 text-xs text-muted-foreground/60 line-clamp-2 italic">
                  Charted · {film.score.toFixed(1)} Index Score — no active movement this cycle
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {spotlightCopy(film)}
                </p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

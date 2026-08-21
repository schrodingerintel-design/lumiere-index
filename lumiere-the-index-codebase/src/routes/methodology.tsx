import { createFileRoute } from "@tanstack/react-router";
import { StaticPage } from "@/components/lumiere/StaticPage";
import { RouteError } from "@/lib/route-error";
import { Lock, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Index Methodology — Lumière The Index" },
      {
        name: "description",
        content:
          "How the Lumière Index measures cultural momentum from audience interest, social conversation, media presence, and availability.",
      },
    ],
  }),
  component: Methodology,
  errorComponent: RouteError,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-serif text-2xl text-foreground">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-inside list-disc space-y-1 font-mono text-sm">
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}

function Methodology() {
  return (
    <StaticPage eyebrow="Lumière Index Methodology" title="How The Index Measures Cultural Momentum">
      <p className="font-serif text-xl text-foreground/90">
        The Lumière Index is a real-time ranking system designed to measure the cultural impact and
        momentum of movies and television shows.
      </p>
      <p>
        Entertainment is no longer shaped by a single factor. A movie's influence can come from
        theaters, streaming platforms, online communities, social conversations, search behavior,
        media coverage, and audience engagement. The Lumière Index combines multiple signals to
        create a broader understanding of what is capturing global attention.
      </p>

      <Section title="What Does The Index Measure?">
        <p>The Lumière Index measures cultural momentum. It does not simply rank:</p>
        <List
          items={[
            "The highest-grossing films.",
            "The highest-rated films.",
            "The most-reviewed films.",
          ]}
        />
        <p>
          Instead, it identifies the movies and shows generating the strongest overall attention and
          conversation. A film can rise because it is:
        </p>
        <List
          items={[
            "Newly released.",
            "Creating global discussion.",
            "Trending online.",
            "Being rediscovered.",
            "Driving audience engagement.",
            "Becoming culturally significant.",
          ]}
        />
      </Section>

      <Section title="Ranking Signals">
        <p>The Lumière Index evaluates multiple categories of signals.</p>

        <div className="rounded-xl border border-foreground/10 bg-background/40 p-4">
          <h3 className="font-serif text-lg text-foreground">Audience Interest</h3>
          <p className="mt-1 text-sm">Measures how actively audiences are discovering and engaging with a title. Signals may include:</p>
          <List items={["Search interest.", "Platform activity.", "Audience interactions.", "Viewing trends."]} />
        </div>

        <div className="rounded-xl border border-foreground/10 bg-background/40 p-4">
          <h3 className="font-serif text-lg text-foreground">Social Conversation</h3>
          <p className="mt-1 text-sm">Measures the level and momentum of public discussion. Signals may include:</p>
          <List items={["Social media discussions.", "Community conversations.", "Viral moments.", "Audience reactions."]} />
        </div>

        <div className="rounded-xl border border-foreground/10 bg-background/40 p-4">
          <h3 className="font-serif text-lg text-foreground">Media Presence</h3>
          <p className="mt-1 text-sm">Measures how strongly a title is appearing across entertainment coverage. Signals may include:</p>
          <List items={["News coverage.", "Industry announcements.", "Interviews.", "Editorial attention."]} />
        </div>

        <div className="rounded-xl border border-foreground/10 bg-background/40 p-4">
          <h3 className="font-serif text-lg text-foreground">Availability &amp; Visibility</h3>
          <p className="mt-1 text-sm">Measures how accessible and discoverable a title is. Signals may include:</p>
          <List items={["Streaming availability.", "New releases.", "Major platform appearances.", "Regional availability."]} />
        </div>
      </Section>

      <Section title="Real-Time Movement">
        <p>The Index is designed to reflect change. Rankings can move based on:</p>
        <List
          items={[
            "New releases.",
            "Trending conversations.",
            "Audience discoveries.",
            "Major announcements.",
            "Cultural events.",
          ]}
        />
        <p>
          A movie's position today may not be the same tomorrow because culture constantly changes.
        </p>
      </Section>

      <Section title="Index Score">
        <p>
          Every title receives a Lumière Index Score representing its current cultural momentum. The
          score is generated through Lumière's ranking system using multiple data inputs and signals.
        </p>
        <p>
          The score is not a review score. It does not represent whether a movie is “good” or “bad.”
          It represents how strongly a title is impacting culture at a given moment.
        </p>
      </Section>

      <div className="glass rounded-2xl border border-primary/20 bg-primary/5 p-6">
        <div className="flex items-center gap-2 font-serif text-xl font-medium text-primary">
          <Lock className="h-5 w-5" />
          <span>How the Index Score (0–100) is Calculated</span>
        </div>
        <ul className="mt-3 space-y-2 font-mono text-xs text-foreground/80">
          <li>
            • <strong>Weighted Signal Volume:</strong> Every mention counts by source weight (Reddit,
            Letterboxd, news, YouTube, TikTok, Wikipedia, Google Trends), with engagement log-scaled
            so genuine reach outranks spam.
          </li>
          <li>
            • <strong>Recency Decay:</strong> Fresh conversation is weighted higher via a 24-hour
            half-life over a 48-hour rolling window.
          </li>
          <li>
            • <strong>Sentiment Multiplier:</strong> Average audience sentiment adjusts the score up
            to ±25%, rewarding films people actually feel strongly about.
          </li>
          <li>
            • <strong>Relative Normalization:</strong> Scores are normalized so top-performing
            releases sit near 97.8 and everything else ranks relative to them. Recalculated every 15
            minutes.
          </li>
        </ul>
      </div>

      <Section title="Independence &amp; Transparency">
        <p>
          Lumière rankings are designed to reflect audience and cultural signals rather than paid
          influence. Titles cannot purchase higher rankings. Sponsored content, partnerships, or
          promotional placements, when available, will always be clearly identified.
        </p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>0% critic weight — rankings are driven entirely by audience signals.</span>
        </div>
      </Section>

      <Section title="Continuous Improvement">
        <p>
          The Lumière Index is constantly evolving. As entertainment habits change, our methodology
          will continue improving to better represent how audiences discover, discuss, and experience
          stories. Our goal is simple: to build the world's most trusted measurement of entertainment
          culture.
        </p>
        <p className="text-xs text-muted-foreground">© Lumière</p>
      </Section>
    </StaticPage>
  );
}

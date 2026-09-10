import { createFileRoute } from "@tanstack/react-router";
import { StaticPage } from "@/components/lumiere/StaticPage";
import { RouteError } from "@/lib/route-error";
import { Lock, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Index Methodology — The Index" },
      {
        name: "description",
        content:
          "How The Index measures cultural momentum from audience interest, social conversation, media presence, and availability.",
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
    <StaticPage eyebrow="Index Methodology" title="How The Index Measures Cultural Momentum">
      <p className="font-serif text-xl text-foreground/90">
        The Index is a real-time ranking system designed to measure the cultural impact and
        momentum of movies and television shows.
      </p>
      <p>
        Entertainment is no longer shaped by a single factor. A movie's influence can come from
        theaters, streaming platforms, online communities, social conversations, search behavior,
        media coverage, and audience engagement. The Index combines these dimensions to
        create a broader understanding of what is capturing global attention.
      </p>

      <Section title="What Does The Index Measure?">
        <p>The Index measures cultural momentum. It does not simply rank:</p>
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

      <Section title="What Goes Into a Ranking">
        <p>The Index looks at four dimensions of cultural attention.</p>

        <div className="rounded-xl border border-foreground/10 bg-background/40 p-4">
          <h3 className="font-serif text-lg text-foreground">Audience Interest</h3>
          <p className="mt-1 text-sm">How actively audiences are discovering and engaging with a title.</p>
        </div>

        <div className="rounded-xl border border-foreground/10 bg-background/40 p-4">
          <h3 className="font-serif text-lg text-foreground">Social Conversation</h3>
          <p className="mt-1 text-sm">The level and momentum of public discussion.</p>
        </div>

        <div className="rounded-xl border border-foreground/10 bg-background/40 p-4">
          <h3 className="font-serif text-lg text-foreground">Media Presence</h3>
          <p className="mt-1 text-sm">How strongly a title is appearing across entertainment coverage.</p>
        </div>

        <div className="rounded-xl border border-foreground/10 bg-background/40 p-4">
          <h3 className="font-serif text-lg text-foreground">Availability &amp; Visibility</h3>
          <p className="mt-1 text-sm">How accessible and discoverable a title is.</p>
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

      <Section title="Data Collection vs. The Official Ranking">
        <p>
          Three different clocks run the Index, and they are not the same thing:
        </p>
        <List
          items={[
            "Data collection — continuous. Audience activity is measured around the clock.",
            "The official Top 100 — a published ranking cycle. Each cycle writes one immutable snapshot; ranks, movement, and days-on-chart are computed between consecutive snapshots only.",
            "Biggest Movers — derived from rank changes between consecutive published Indexes. It highlights the titles climbing or falling fastest; it is not a separate ranking with separate math.",
          ]}
        />
        <p>
          Movement (↑/↓) is computed from rank change between the two most recent snapshots —
          never from Index Score changes — so a film that moves from #20 to #15 shows ↑ 5
          even if its score barely moved.
        </p>
      </Section>

      <Section title="Index Score">
        <p>
          Every title receives an Index Score representing its current cultural momentum. The
          score is generated through the Index's ranking system using multiple data inputs.
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
        <p className="mt-3 text-xs text-foreground/70">
          The pipeline runs in one direction — raw data is never edited to change a
          score, and no number is ever synthesized:
        </p>
        <ul className="mt-3 space-y-2 font-mono text-xs text-foreground/80">
          <li>
            • <strong>Raw data:</strong> real audience activity is ingested from across the web,
            deduped and verified.
          </li>
          <li>
            • <strong>Processing:</strong> it rolls into daily per-title series —
            volume, sentiment, and momentum.
          </li>
          <li>
            • <strong>Five weighted components:</strong> Current Attention (30%), Momentum (25%),
            Recency (20%), Audience Engagement (15%), and Cross-Platform Reach (10%). Every
            component is time-windowed, so a film released this week is never structurally
            disadvantaged against one tracked for months.
          </li>
          <li>
            • <strong>Relative normalization:</strong> components are percentile-normalized within
            the active pool, then blended and scaled to 0–100. The score is relative cultural
            momentum — not a review score.
          </li>
          <li>
            • <strong>Evidence floor:</strong> every score carries a confidence tier from its raw
            sample size. Titles with insufficient evidence get hedged copy — or no claims at all —
            never invented ones.
          </li>
        </ul>
      </div>

      <Section title="Independence &amp; Transparency">
        <p>
          The Index's rankings are designed to reflect audience and cultural momentum rather than paid
          influence. Titles cannot purchase higher rankings. Sponsored content, partnerships, or
          promotional placements, when available, will always be clearly identified.
        </p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>0% critic weight — rankings are driven entirely by audience attention.</span>
        </div>
      </Section>

      <Section title="Continuous Improvement">
        <p>
          The Index is constantly evolving. As entertainment habits change, our methodology
          will continue improving to better represent how audiences discover, discuss, and experience
          stories. Our goal is simple: to build the world's most trusted measurement of entertainment
          culture.
        </p>
        <p className="text-xs text-muted-foreground">© The Index — by Lumière</p>
      </Section>
    </StaticPage>
  );
}

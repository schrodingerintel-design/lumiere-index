import { createFileRoute } from "@tanstack/react-router";
import { canonicalLink, ogUrlMeta } from "@/lib/site";
import { StaticPage } from "@/components/lumiere/StaticPage";
import { RouteError } from "@/lib/route-error";
import { Lock, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Index Methodology · The Index" },
      {
        name: "description",
        content:
          "How The Index measures cultural momentum from audience interest, social conversation, media presence, and availability.",
      },
      ogUrlMeta("/methodology"),
    ],
    links: [canonicalLink("/methodology")],
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
            "Data collection: continuous. Audience activity is measured around the clock.",
            "The live charts (Movie 100, TV 100): recomputed every 15 minutes from the latest signals.",
            "The Weekly Top 100: published once per week from the whole week's measurements. Sustained performance across the week counts more than a one-day spike.",
            "Biggest Movers: derived from rank changes between consecutive published charts. It highlights the titles climbing or falling fastest; it is not a separate ranking with separate math.",
          ]}
        />
        <p>
          Movement (↑/↓) is computed from rank change between the two most recent snapshots.
          A film that moves from #20 to #15 shows ↑ 5.
        </p>
      </Section>

      <Section title="Momentum">
        <p>
          Momentum is the public state of change: whether a title is SURGING, RISING,
          STEADY, COOLING or FALLING right now. It is derived from each title's rank
          trajectory across recent charts, with thresholds that absorb normal ranking
          noise. A one-place move never changes the label.
        </p>
        <p>
          Momentum is independent of chart position. A #1 title can be COOLING while
          staying #1, and a #26 title can be SURGING because attention is arriving fast.
          A brand-new entry needs a few days of history before it can carry anything
          other than STEADY.
        </p>
        <div className="mt-4 overflow-hidden rounded-lg border border-foreground/10">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-foreground/10 bg-foreground/[0.03] text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <th className="px-4 py-2 font-medium">Momentum</th>
                <th className="px-4 py-2 font-medium">Meaning</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {[
                ["SURGING ↑", "Climbing fast"],
                ["RISING ↑", "Climbing steadily"],
                ["STEADY →", "Holding position"],
                ["COOLING ↓", "Slipping"],
                ["FALLING ↓", "Falling fast"],
              ].map(([state, meaning]) => (
                <tr key={state} className="border-b border-foreground/5 last:border-0">
                  <td className="px-4 py-1.5 text-foreground/90">{state}</td>
                  <td className="px-4 py-1.5 font-sans text-muted-foreground">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          What the charts do not show: an internal score. The ranking engine weighs each
          title's measured attention and produces the order you see, but that number stays
          internal. Rank, movement, momentum, peak and time on chart are the public story.
        </p>
      </Section>

      <div className="glass rounded-2xl border border-primary/20 bg-primary/5 p-6">
        <div className="flex items-center gap-2 font-serif text-xl font-medium text-primary">
          <Lock className="h-5 w-5" />
          <span>How the Ranking is Calculated</span>
        </div>
        <p className="mt-3 text-xs text-foreground/70">
          The pipeline runs in one direction: raw data is never edited to change a
          score, and no number is ever synthesized.
        </p>
        <ul className="mt-3 space-y-2 font-mono text-xs text-foreground/80">
          <li>
            • <strong>Raw data:</strong> real audience activity is ingested from across the web,
            deduped and verified.
          </li>
          <li>
            • <strong>Processing:</strong> it rolls into daily per-title series:
            volume, sentiment, and momentum.
          </li>
          <li>
            • <strong>Five weighted components:</strong> Current Attention (30%), Momentum (25%),
            Recency (20%), Audience Engagement (15%), and Cross-Platform Reach (10%). Every
            component is time-windowed, so a film released this week is never structurally
            disadvantaged against one tracked for months.
          </li>
          <li>
            • <strong>The ranking:</strong> the blended components set each chart's order.
            The underlying score stays internal — the public sees the order it produces,
            plus rank movement and Momentum, never the raw number.
          </li>
          <li>
            • <strong>Evidence floor:</strong> every ranking carries a confidence tier from its raw
            sample size. Titles with insufficient evidence get hedged copy, or no claims at all,
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
          <span>0% critic weight: rankings are driven entirely by audience attention.</span>
        </div>
      </Section>

      <Section title="Continuous Improvement">
        <p>
          The Index is constantly evolving. As entertainment habits change, our methodology
          will continue improving to better represent how audiences discover, discuss, and experience
          stories. Our goal is simple: to build the world's most trusted measurement of entertainment
          culture.
        </p>
        <p className="text-xs text-muted-foreground">© The Index by Lumière</p>
      </Section>
    </StaticPage>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { canonicalLink, ogUrlMeta } from "@/lib/site";
import { StaticPage } from "@/components/lumiere/StaticPage";
import { BETA_RELEASES } from "@/lib/beta";
import { RouteError } from "@/lib/route-error";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About The Index · Lumière The Index" },
      {
        name: "description",
        content:
          "Lumière: The Index is a real-time cultural ranking platform tracking the movies and series capturing global attention.",
      },
      ogUrlMeta("/about"),
    ],
    links: [canonicalLink("/about")],
  }),
  component: About,
  errorComponent: RouteError,
});

function About() {
  return (
    <StaticPage
      eyebrow="About The Index"
      title={
        <>
          Measuring the stories
          <br />
          shaping culture.
        </>
      }
    >
      <p className="font-serif text-xl text-foreground/90">
        Lumière Index connects entertainment discovery with charts of recorded cultural attention.
      </p>
      <p>
        Explore films, TV, people, games, creators, and music. Movie 100 and TV 100 track attention
        in our collected sources; a chart position is not a review or a measure of artistic quality.
      </p>
      <section id="data-sources">
        <a href="https://www.themoviedb.org">
          <img src="/tmdb-logo.svg" width="110" height="40" alt="TMDB" />
        </a>
        <h2>Data sources & limitations</h2>
        <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
        <p>
          Catalog metadata, credits, artwork, and audience ratings come from TMDB. Ratings and
          provider trending lists are distinct from Lumière rankings. Each chart title exposes the
          available collection totals, source coverage, and published rank history. Missing
          measurements remain unavailable.
        </p>
        <p>
          Streaming availability is provided by JustWatch via TMDB. It varies by country and can
          change between retrievals. Wikipedia reference text is attributed to its contributors
          under CC BY-SA 4.0; images retain their individual credits and licenses.
        </p>
        <p>
          Lumière applies its own deterministic ranking rules to collected inputs. Coverage is
          incomplete and a high rank does not establish broad audience consensus. Source totals
          describe collection records, not unique viewers. Per-snapshot reproduction manifests are
          not currently available in the public API.
        </p>
        <Link to="/methodology">Read the ranking methodology</Link>
      </section>
      <section>
        <h2>What the charts measure</h2>
        <p>
          Rank is a title’s position in its published chart. Movement compares published positions;
          Momentum describes recent attention. Audience ratings are a separate assessment from TMDB
          voters. Missing history does not establish movement.
        </p>
        <p>
          The Index combines supported search, social, community, video, and news inputs using its
          published methodology. A source’s availability varies by title and collection period. The
          evidence section on each chart title shows which records are actually available.
        </p>
      </section>
      <section>
        <h2>Original work</h2>
        <p>
          Lumière produces its chart ordering, historical rank views, discovery connections, and
          original culture guides. Reference biographies and catalog facts are attributed to their
          providers. Editorial selections are not popularity rankings.
        </p>
      </section>
      <div>
        <h2 className="font-serif text-2xl text-foreground">Beta changelog</h2>
        <p className="mt-3">
          The Index is in public beta: new signals, charts and fixes ship continuously. Changes are
          summarized here, newest first.
        </p>
        <div className="mt-5 space-y-6">
          {BETA_RELEASES.map((release) => (
            <div key={release.version} className="border-l-2 border-primary/30 pl-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Beta v{release.version} · {release.date}
              </p>
              <h3 className="mt-1 text-[15px] font-semibold text-foreground">{release.headline}</h3>
              <ul className="mt-2 space-y-1.5">
                {release.changes.map((change, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                    <span
                      aria-hidden
                      className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-primary/60"
                    />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-foreground/10 bg-surface p-6">
        <p className="text-sm text-foreground/80">
          Want to know exactly how the ranking is calculated?{" "}
          <Link to="/methodology" className="font-medium text-primary hover:underline">
            Read the Lumière Index Methodology →
          </Link>
        </p>
      </div>
    </StaticPage>
  );
}

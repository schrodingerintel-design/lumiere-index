import { createFileRoute, Link } from "@tanstack/react-router";
import { canonicalLink, ogUrlMeta } from "@/lib/site";
import { StaticPage } from "@/components/lumiere/StaticPage";
import { BETA_RELEASES } from "@/lib/beta";
import { RouteError } from "@/lib/route-error";
import { Compass, Eye, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About The Index — Lumière The Index" },
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
        Lumière: The Index is a real-time cultural ranking platform built to track the movies and
        series capturing global attention.
      </p>
      <p>
        Entertainment moves faster than ever. A film can become a worldwide conversation overnight
        through theaters, streaming, social platforms, and communities. Yet understanding what is
        truly trending has become fragmented across countless platforms. The Index brings
        that picture together in one place.
      </p>

      <div>
        <h2 className="font-serif text-2xl text-foreground">What is The Index?</h2>
        <p className="mt-3">
          The Index is a ranking system designed to measure cultural momentum. Rather than focusing
          on a single metric, Lumière looks at the full picture surrounding movies and shows to
          understand their impact, visibility, and relevance.
        </p>
        <p>
          Our goal is not to decide what people should watch. Our goal is to show what the world is
          watching, discussing, and discovering.
        </p>
      </div>

      <div>
        <h2 className="font-serif text-2xl text-foreground">Why The Index?</h2>
        <p className="mt-3">Traditional entertainment rankings often focus on one area:</p>
        <ul className="mt-2 list-inside list-disc space-y-1 font-mono text-sm">
          <li>Box office performance.</li>
          <li>Reviews.</li>
          <li>Ratings.</li>
          <li>Popularity polls.</li>
        </ul>
        <p className="mt-4">
          But culture is bigger than one number. A film can become influential before it becomes
          commercially successful. A series can dominate conversations before traditional
          measurements capture its impact. The Index exists to measure that movement.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="border border-foreground/10 bg-surface p-5">
          <Compass className="mb-2 h-6 w-6 text-primary" />
          <h3 className="font-serif text-lg font-medium text-foreground">For Audiences</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            See which films the world is talking about — ranked by real attention, not promotion.
          </p>
        </div>
        <div className="border border-foreground/10 bg-surface p-5">
          <TrendingUp className="mb-2 h-6 w-6 text-primary" />
          <h3 className="font-serif text-lg font-medium text-foreground">For Creators</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Follow how your work is landing across search, social, and community — as it happens.
          </p>
        </div>
        <div className="border border-foreground/10 bg-surface p-5">
          <Eye className="mb-2 h-6 w-6 text-primary" />
          <h3 className="font-serif text-lg font-medium text-foreground">For The Industry</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Track cultural momentum before it shows up at the box office.
          </p>
        </div>
      </div>

      <div>
        <h2 className="font-serif text-2xl text-foreground">Our Vision</h2>
        <p className="mt-3">
          We believe entertainment deserves a modern cultural index. From movies and television to
          creators, books, games, and the wider world of entertainment, Lumière aims to become the
          global reference point for cultural momentum.
        </p>
        <p>
          Lumière is not just a chart. It is a way to understand culture as it happens — built for
          the future of entertainment.
        </p>
      </div>

      <div>
        <h2 className="font-serif text-2xl text-foreground">Beta changelog</h2>
        <p className="mt-3">
          The Index is in public beta — new signals, charts and fixes ship
          continuously. Every version is announced in the β chip beside the logo
          and summarized here, newest first.
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
                    <span aria-hidden className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-primary/60" />
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
          Want to know exactly how the Index Score is calculated?{" "}
          <Link to="/methodology" className="font-medium text-primary hover:underline">
            Read the Lumière Index Methodology →
          </Link>
        </p>
      </div>
    </StaticPage>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { canonicalLink, ogUrlMeta } from "@/lib/site";
import { StaticPage } from "@/components/lumiere/StaticPage";
import { BETA_RELEASES } from "@/lib/beta";
import { RouteError } from "@/lib/route-error";
import { Compass, Eye, TrendingUp } from "lucide-react";

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
      lede="The Index is a live measurement of what film and television culture is paying attention to, and how that attention is moving."
    >
      <p className="ix-lede">
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
        <h2>What is The Index?</h2>
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
        <h2>Why The Index?</h2>
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

      <div className="ix-box__grid">
        <div className="ix-box">
          <Compass aria-hidden />
          <h3>For Audiences</h3>
          <p>
            See which films the world is talking about, ranked by real attention, not promotion.
          </p>
        </div>
        <div className="ix-box">
          <TrendingUp aria-hidden />
          <h3>For Creators</h3>
          <p>
            Follow how your work is landing across search, social, and community, as it happens.
          </p>
        </div>
        <div className="ix-box">
          <Eye aria-hidden />
          <h3>For The Industry</h3>
          <p>Track cultural momentum before it shows up at the box office.</p>
        </div>
      </div>

      <div>
        <h2>Our Vision</h2>
        <p className="mt-3">
          We believe entertainment deserves a modern cultural index. From movies and television to
          creators, books, games, and the wider world of entertainment, Lumière aims to become the
          global reference point for cultural momentum.
        </p>
        <p>
          Lumière is not just a chart. It is a way to understand culture as it happens, built for
          the future of entertainment.
        </p>
      </div>

      <div>
        <h2>Beta changelog</h2>
        <p>
          The Index is in public beta: new signals, charts and fixes ship
          continuously. Every version is announced in the β chip beside the logo
          and summarized here, newest first.
        </p>
        <div className="ix-log">
          {BETA_RELEASES.map((release) => (
            <div key={release.version} className="ix-log__item">
              <p className="ix-log__when">
                Beta v{release.version} · {release.date}
              </p>
              <h3 className="ix-log__t">{release.headline}</h3>
              <ul className="ix-log__list">
                {release.changes.map((change, i) => (
                  <li key={i}>
                    <i aria-hidden />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="ix-box">
        <p>
          Want to know exactly how the ranking is calculated?{" "}
          <Link to="/methodology" className="font-medium">
            Read the Lumière Index Methodology →
          </Link>
        </p>
      </div>
    </StaticPage>
  );
}

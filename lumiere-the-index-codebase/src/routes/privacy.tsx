import { createFileRoute } from "@tanstack/react-router";
import { StaticPage } from "@/components/lumiere/StaticPage";
import { RouteError } from "@/lib/route-error";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Lumière The Index" },
      {
        name: "description",
        content:
          "How Lumière collects, uses, protects, and processes information when you use the Index.",
      },
    ],
  }),
  component: Privacy,
  errorComponent: RouteError,
});

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-serif text-xl text-foreground">
        <span className="mr-2 font-mono text-sm text-primary">{num}</span>
        {title}
      </h2>
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

function Privacy() {
  return (
    <StaticPage eyebrow="Legal" title="Privacy Policy">
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Effective Date: September 1st 2026
      </p>

      <Section num="1." title="Introduction">
        <p>
          Welcome to Lumière (“Lumière”, “The Index”, “we”, “our”, or “us”). This Privacy Policy
          explains how we collect, use, protect, and process information when you access or use
          Lumière products, websites, applications, and services.
        </p>
        <p>By using Lumière, you agree to the practices described in this Privacy Policy.</p>
      </Section>

      <Section num="2." title="Information We Collect">
        <p className="font-medium text-foreground">Information You Provide</p>
        <p>When you use Lumière, we may collect information you voluntarily provide, including:</p>
        <List
          items={[
            "Name",
            "Email address",
            "Account details",
            "Profile information",
            "Preferences",
            "Saved movies or shows",
            "Feedback and communications with us",
          ]}
        />

        <p className="font-medium text-foreground">Information Collected Automatically</p>
        <p>When you use Lumière, we may automatically collect:</p>
        <List
          items={[
            "Device information",
            "Browser type",
            "Operating system",
            "IP address",
            "General location information",
            "Usage activity",
            "Pages viewed",
            "Search activity",
            "Interaction with features",
            "Performance data",
          ]}
        />

        <p className="font-medium text-foreground">Entertainment Data</p>
        <p>
          Lumière may collect, analyze, and process publicly available entertainment information,
          including:
        </p>
        <List
          items={[
            "Movie and television information",
            "Public engagement signals",
            "Industry data",
            "Trending discussions",
            "Publicly available cultural signals",
          ]}
        />
        <p>This information is used to create rankings, charts, analytics, and discovery features.</p>
      </Section>

      <Section num="3." title="How We Use Information">
        <p>We use collected information to:</p>
        <List
          items={[
            "Provide and improve Lumière services.",
            "Create personalized experiences.",
            "Maintain and improve ranking systems.",
            "Analyze platform performance.",
            "Understand user behavior.",
            "Prevent abuse and maintain security.",
            "Communicate updates and announcements.",
            "Develop new products and features.",
          ]}
        />
      </Section>

      <Section num="4." title="The Lumière Index and Data Processing">
        <p>
          The Lumière Index analyzes multiple signals to understand cultural momentum around movies
          and shows.
        </p>
        <p>Personal user information is not used to artificially influence rankings.</p>
        <p>
          Rankings are generated using Lumière's methodology and may incorporate publicly available
          information and aggregated platform data.
        </p>
      </Section>

      <Section num="5." title="Cookies and Tracking Technologies">
        <p>Lumière may use cookies and similar technologies to:</p>
        <List
          items={[
            "Remember user preferences.",
            "Maintain sessions.",
            "Improve performance.",
            "Understand usage patterns.",
            "Measure engagement.",
          ]}
        />
        <p>Users may manage cookie preferences through their browser settings.</p>
      </Section>

      <Section num="6." title="Third-Party Services">
        <p>Lumière may use third-party services for:</p>
        <List items={["Hosting.", "Analytics.", "Authentication.", "Payments.", "Data processing.", "Infrastructure."]} />
        <p>These providers may process information only as necessary to provide their services.</p>
      </Section>

      <Section num="7." title="Data Sharing">
        <p>Lumière does not sell personal information.</p>
        <p>We may share information when necessary with:</p>
        <List
          items={[
            "Service providers.",
            "Legal authorities when required.",
            "Business partners during corporate transactions such as mergers or acquisitions.",
          ]}
        />
      </Section>

      <Section num="8." title="Data Security">
        <p>
          We use reasonable technical and organizational measures to protect user information.
          However, no online service can guarantee complete security.
        </p>
      </Section>

      <Section num="9." title="Your Rights">
        <p>Depending on your location, you may have rights including:</p>
        <List
          items={[
            "Accessing your personal data.",
            "Correcting inaccurate information.",
            "Requesting deletion.",
            "Managing communication preferences.",
            "Objecting to certain processing activities.",
          ]}
        />
        <p>Requests can be submitted through our contact channels.</p>
      </Section>

      <Section num="10." title="Children's Privacy">
        <p>
          Lumière is not intended for users below the minimum age required by applicable laws. We do
          not knowingly collect personal information from children without appropriate authorization.
        </p>
      </Section>

      <Section num="11." title="International Users">
        <p>
          Lumière operates globally. Your information may be processed in countries where our service
          providers operate. We take reasonable steps to ensure appropriate protection of personal
          information.
        </p>
      </Section>

      <Section num="12." title="Changes to This Privacy Policy">
        <p>We may update this Privacy Policy periodically.</p>
        <p>
          When significant changes occur, we will update the effective date and provide additional
          notice where required.
        </p>
      </Section>

      <Section num="13." title="Contact Us">
        <p>If you have questions regarding this Privacy Policy, contact:</p>
        <p className="font-mono text-sm">
          Lumière
          <br />
          Email: privacy@lumiere.com
          <br />
          Website: Theindex.com
        </p>
        <p className="text-xs text-muted-foreground">© Lumière. All rights reserved.</p>
      </Section>
    </StaticPage>
  );
}

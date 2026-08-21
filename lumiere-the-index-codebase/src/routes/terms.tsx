import { createFileRoute } from "@tanstack/react-router";
import { StaticPage } from "@/components/lumiere/StaticPage";
import { RouteError } from "@/lib/route-error";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Lumière The Index" },
      {
        name: "description",
        content: "The terms and conditions governing use of Lumière: The Index.",
      },
    ],
  }),
  component: Terms,
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

function Terms() {
  return (
    <StaticPage eyebrow="Legal" title="Terms & Conditions">
      <p>
        Welcome to Lumière: The Index. These Terms & Conditions (“Terms”) govern your access to and
        use of Lumière products, websites, applications, and services (collectively, the “Service”).
        By accessing or using the Service, you agree to be bound by these Terms. If you do not agree,
        please do not use the Service.
      </p>

      <Section num="1." title="Use of the Service">
        <p>
          The Service provides rankings, charts, analytics, and discovery features based on publicly
          available entertainment signals. You may use the Service for personal, non-commercial
          purposes unless otherwise agreed in writing.
        </p>
      </Section>

      <Section num="2." title="The Index and Rankings">
        <p>
          The Lumière Index reflects cultural momentum derived from multiple audience and public
          signals. Rankings are provided for informational purposes and do not constitute editorial
          endorsement or professional advice.
        </p>
        <p>
          Lumière rankings are designed to reflect audience and cultural signals rather than paid
          influence. Titles cannot purchase higher rankings. Sponsored content, partnerships, or
          promotional placements, when available, are always clearly identified.
        </p>
      </Section>

      <Section num="3." title="Intellectual Property">
        <p>
          All content within the Service — including rankings, charts, data presentations, branding,
          and design — is owned by or licensed to Lumière and is protected by applicable intellectual
          property laws. You may not copy, reproduce, distribute, or create derivative works from the
          Service except as expressly permitted.
        </p>
      </Section>

      <Section num="4." title="Acceptable Use">
        <p>You agree not to:</p>
        <ul className="list-inside list-disc space-y-1 font-mono text-sm">
          <li>Use the Service for any unlawful purpose.</li>
          <li>Attempt to manipulate rankings, scores, or public signal data.</li>
          <li>Access the Service through automated means that exceed reasonable usage limits.</li>
          <li>Interfere with the security or operation of the Service.</li>
          <li>Misrepresent your identity or affiliation.</li>
        </ul>
      </Section>

      <Section num="5." title="Disclaimer of Warranties">
        <p>
          The Service is provided “as is” and “as available.” While we work to keep rankings
          accurate and current, Lumière makes no warranties, express or implied, regarding the
          completeness, accuracy, or availability of the Service or any information it contains.
        </p>
      </Section>

      <Section num="6." title="Limitation of Liability">
        <p>
          To the maximum extent permitted by law, Lumière shall not be liable for any indirect,
          incidental, special, consequential, or punitive damages arising from your use of the
          Service or reliance on any ranking, score, or other information provided.
        </p>
      </Section>

      <Section num="7." title="Changes to These Terms">
        <p>
          We may update these Terms from time to time. When significant changes occur, we will update
          the effective date and provide notice where required. Continued use of the Service after
          changes take effect constitutes acceptance of the revised Terms.
        </p>
      </Section>

      <Section num="8." title="Contact">
        <p>If you have questions about these Terms, contact us at privacy@lumiere.com.</p>
        <p className="text-xs text-muted-foreground">© Lumière. All rights reserved.</p>
      </Section>
    </StaticPage>
  );
}

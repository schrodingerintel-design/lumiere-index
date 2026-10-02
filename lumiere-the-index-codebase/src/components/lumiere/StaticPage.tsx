import type { ReactNode } from "react";
import { Layout } from "./Layout";
import { PagePlane } from "./PagePlane";
import { PageHead } from "./PageHead";

/**
 * A written page — About, Methodology, Privacy, Terms.
 *
 * Same plane, same head, same type as every chart. The copy is set in the
 * product's own reading language rather than in a document stylesheet: one
 * measure, generous leading, quiet rules between sections.
 */
export function StaticPage({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Layout>
      <PagePlane>
        <PageHead kicker={eyebrow} title={title} lede={lede} />
        <div className="ix-prose">{children}</div>
      </PagePlane>
    </Layout>
  );
}

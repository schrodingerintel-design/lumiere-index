import type { ReactNode } from "react";
import { Layout } from "./Layout";

export function StaticPage({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <Layout>
      <section className="mx-auto max-w-3xl px-4 pb-8 pt-10 lg:px-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
          {eyebrow}
        </div>
        <h1 className="mt-2 font-display text-4xl font-medium leading-tight sm:text-5xl">{title}</h1>
        <div className="mt-8 space-y-6 leading-relaxed text-foreground/80">{children}</div>
      </section>
    </Layout>
  );
}

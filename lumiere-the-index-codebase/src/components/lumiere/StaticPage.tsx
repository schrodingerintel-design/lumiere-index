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
      <section className="mx-auto max-w-3xl px-4 pb-8 pt-6 lg:px-6">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {eyebrow}
        </div>
        <h1 className="mt-2 font-serif text-4xl leading-tight lg:text-5xl">{title}</h1>
        <div className="mt-8 space-y-6 leading-relaxed text-foreground/80">{children}</div>
      </section>
    </Layout>
  );
}

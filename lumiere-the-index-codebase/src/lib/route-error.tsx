import { Link, type ErrorComponentProps } from "@tanstack/react-router";
import { Layout } from "@/components/lumiere/Layout";
import { recoverFromStaleDeploy } from "@/lib/staleDeploy";

export function RouteError({ error, reset }: ErrorComponentProps) {
  // Route-level chunk-load failure = stale deployment (see staleDeploy.ts).
  // One cache-bypassing reload per session; otherwise render this boundary.
  if (recoverFromStaleDeploy(error)) return null;

  return (
    <Layout>
      <section className="flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          The Index
        </div>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">Something went wrong</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          This section failed to load. You can try again or go back home.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => {
              reset();
              window.location.reload();
            }}
            className="border border-foreground/25 bg-foreground px-5 py-2.5 min-h-[44px] font-mono text-[11px] uppercase tracking-[0.18em] text-background transition hover:bg-foreground/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Try again
          </button>
          <Link
            to="/"
            className="border border-foreground/20 px-5 py-2.5 min-h-[44px] inline-flex items-center font-mono text-[11px] uppercase tracking-[0.18em] text-foreground transition hover:border-foreground/45 hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Go home
          </Link>
        </div>
      </section>
    </Layout>
  );
}

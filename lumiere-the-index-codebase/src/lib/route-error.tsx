import { Link } from "@tanstack/react-router";
import { Layout } from "@/components/lumiere/Layout";

export function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <Layout>
      <section className="flex flex-col items-center justify-center px-4 py-20 text-center">
        <h1 className="font-display text-4xl font-medium">Something went wrong</h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">
          This section failed to load. You can try again or go back home.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => {
              reset();
              window.location.reload();
            }}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
          <Link
            to="/"
            className="rounded-full border border-foreground/15 px-5 py-2 text-sm font-medium text-foreground"
          >
            Go home
          </Link>
        </div>
      </section>
    </Layout>
  );
}

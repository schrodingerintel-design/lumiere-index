export function QuoteBanner() {
  return (
    <section className="mt-16 px-4 lg:px-6">
      {/* A single editorial statement — solid surface, typography does the work. */}
      <div className="border-y border-foreground/10 bg-surface px-8 py-16 text-center">
        <p className="font-display text-2xl leading-snug md:text-4xl">
          “The only ranking that moves
          <br className="hidden md:block" /> as fast as culture.”
        </p>
        <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          — Lumière Editorial
        </div>
      </div>
    </section>
  );
}

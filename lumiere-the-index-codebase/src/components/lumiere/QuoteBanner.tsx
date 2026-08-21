export function QuoteBanner() {
  return (
    <section className="mt-16 px-4 lg:px-6">
      <div className="glass-dark relative overflow-hidden rounded-3xl px-8 py-20 text-center">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(82,183,136,.35), transparent 50%), radial-gradient(circle at 80% 80%, rgba(45,106,79,.4), transparent 50%)",
          }}
        />
        <p className="relative font-serif text-3xl leading-tight md:text-5xl">
          “The only ranking that moves
          <br className="hidden md:block" /> as fast as culture.”
        </p>
        <div className="relative mt-6 text-[10px] uppercase tracking-[0.3em] text-cream/60">
          — Lumière Editorial
        </div>
      </div>
    </section>
  );
}

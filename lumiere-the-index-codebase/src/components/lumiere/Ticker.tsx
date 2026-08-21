export function Ticker() {
  const phrase =
    "Real Time Rankings · Real People · Real Conversations · Real Audience Insights · ";
  const text = phrase.repeat(3);
  return (
    <footer className="mt-16 overflow-hidden bg-primary py-6 text-primary-foreground dark:bg-ink dark:text-cream">
      <div className="flex whitespace-nowrap animate-ticker">
        <div className="font-serif text-3xl tracking-tight">{text}</div>
        <div className="font-serif text-3xl tracking-tight" aria-hidden>
          {text}
        </div>
      </div>
    </footer>
  );
}

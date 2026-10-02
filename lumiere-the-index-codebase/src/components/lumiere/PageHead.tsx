import type { ReactNode } from "react";

/**
 * The head of every interior page.
 *
 * One arrangement, everywhere: a small kicker, the page's own title in the
 * display face, a lede that says what the page is for, and — where the page
 * has something live to say — a quiet stamp on the right.
 *
 * This replaced fifteen hand-rolled header blocks, each with its own type size,
 * tracking and colour. Same destinations, same words, one voice.
 */
export function PageHead({
  kicker,
  title,
  lede,
  meta,
  children,
}: {
  /** Small line above the title: the chart's own name and cadence. */
  kicker?: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  /** Right-hand stamp: live state, the date, a count. */
  meta?: ReactNode;
  /** Optional controls rendered under the lede. */
  children?: ReactNode;
}) {
  // Deliberately not a <header>: the product has exactly one banner (TopNav),
  // and a second landmark with that role on every page would be both a lie and
  // a screen-reader trap.
  return (
    <div className="ix-phead">
      <div className="ix-phead__main">
        {kicker ? <span className="ix-phead__kicker">{kicker}</span> : null}
        <h1 className="ix-phead__title">{title}</h1>
        {lede ? <p className="ix-phead__lede">{lede}</p> : null}
        {children}
      </div>
      {meta ? <div className="ix-phead__aside">{meta}</div> : null}
    </div>
  );
}

/** The standard "this page is live" stamp. */
export function LiveStamp({ children }: { children?: ReactNode }) {
  return (
    <span className="ix-live ix-live--plane">
      <i aria-hidden />
      {children ?? "Live"}
    </span>
  );
}

import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import {
  getBiggestMovers,
  getMetaRefresh,
  getRisingFilms,
  type MoverFilm,
  type RankedFilm,
} from "@/lib/apiClient";
import { MomentumInline } from "./Momentum";

/* ── Front page ─────────────────────────────────────────────────────────────
   The editorial front page, in the classic newspaper-hero shape: one wide,
   backdrop-backed lead story that rotates through the top five rising
   titles via invisible left/right tap zones, and a right rail carrying the
   Biggest Movers as a lead card plus stacked rows.

   Every figure shown is real: rise provenance is the /films/rising endpoint
   (movement-based), movers are published rank deltas. No invented scores, no
   placeholder copy, and honest skeleton/empty/error states per query. */

/** How many rising titles headline the hero. */
const HERO_TOP_COUNT = 5;

function formatUsDate(date: Date): string {
  // Server and browser render the same label: UTC date parts feed a fixed
  // "en-US" format, so hydration can never flash a different day.
  const [year, month, day] = [
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  ];
  return new Date(Date.UTC(year, month, day)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/* ── The hero's rotating headline ────────────────────────────────────────────
   One backdrop still (the lead title's), a category chip ("Rising"), the
   display headline in Fraunces with the title dynamic. Rotation is driven
   by invisible left/right tap zones at the hero's edges plus an 8s
   auto-advance; arrow keys do the same from the keyboard. */

function HeroHeadline({ film, position }: { film: RankedFilm; position: number }) {
  const code = film.content_type === "TV_SHOW" ? "TV · Rising" : "Film · Rising";
  return (
    <div className="max-w-xl">
      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-cream/85">
        {code}
      </div>
      <h2 className="mt-3 font-display text-[clamp(2.4rem,5vw,4rem)] font-medium leading-[1.02] tracking-tight text-cream drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]">
        {film.title}
      </h2>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-cream/80">
        {film.director && film.director !== "Unknown" && <span>{film.director}</span>}
        {film.year && (
          <span className="font-mono">
            {film.year}
          </span>
        )}
        <span className="font-mono">
          Rising to #{film.rank}
        </span>
        {film.momentum && <MomentumInline state={film.momentum} className="text-cream" />}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Link
          to="/films/$slug"
          params={{ slug: film.slug }}
          className="inline-flex min-h-[44px] items-center gap-2 bg-cream px-5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-ink transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream"
        >
          Read the title page
        </Link>
      </div>
      {/* Screen-reader identity of the active story — position is announced
          even though the rotation is driven by invisible tap zones. */}
      <span className="sr-only" aria-live="polite">
        Rising story {position + 1} of {HERO_TOP_COUNT}
      </span>
    </div>
  );
}

/** Invisible prev/next tap zones overlaying the hero: tap the left or
 *  right edge of the backdrop to move between rising stories. They must NOT
 *  cover the interactive content (the title-page link) — click-through is
 *  handled by putting them behind the content layer (`-z-10` equivalent:
 *  they render first, content renders after with a higher stacking order).
 *  Keyboard users get the same movement via the arrow-key handler on the
 *  hero section. */
function HeroTapZones({
  onPrev,
  onNext,
  disabled,
}: {
  onPrev: () => void;
  onNext: () => void;
  disabled: boolean;
}) {
  if (disabled) return null;
  return (
    <>
      <button
        type="button"
        aria-label="Previous rising story"
        onClick={onPrev}
        className="absolute inset-y-0 left-0 z-0 w-[18%] cursor-default bg-transparent focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-cream"
      />
      <button
        type="button"
        aria-label="Next rising story"
        onClick={onNext}
        className="absolute inset-y-0 right-0 z-0 w-[18%] cursor-default bg-transparent focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-cream"
      />
    </>
  );
}

/* The live-refresh chip — same hydration-safe pattern as HomeIntro: the
   time-of-day label renders only after mount so server and browser agree. */
function FrontTickerLine() {
  const { data: refresh } = useQuery({
    queryKey: ["meta", "refresh"],
    queryFn: () => getMetaRefresh(),
    staleTime: 60 * 1000,
  });
  const [clock, setClock] = useState(false);
  useEffect(() => {
    if (refresh?.next_refresh_at) setClock(true);
  }, [refresh?.next_refresh_at]);
  return (
    <span className="inline-flex shrink-0 items-center gap-2 border border-foreground/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-forest-deep" aria-hidden />
      Live
      {clock && refresh?.next_refresh_at && (
        <span title="Next chart refresh">
          {new Date(refresh.next_refresh_at).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      )}
    </span>
  );
}

/* ── The Biggest Movers side rail ────────────────────────────────────────────
   One lead card (the single largest climber) with poster art and movement
   metadata, then compact rows. Movement is the published rank delta between
   the last two charts — arrows, never invented scores. */

function MoverLeadCard({ film }: { film: MoverFilm }) {
  const up = film.direction === "up";
  const gradient = `linear-gradient(155deg, ${film.gradient_from ?? "#333"}, ${film.gradient_to ?? "#111"})`;
  return (
    <Link
      to={`/films/$slug`}
      params={{ slug: film.slug }}
      aria-label={`${film.title}, moved ${up ? "up" : "down"} ${Math.abs(film.movement)} to #${film.current_rank}`}
      className="group block"
    >
      <div className="relative overflow-hidden">
        <div className="relative aspect-[16/10] w-full overflow-hidden" style={{ background: gradient }}>
          {film.poster_url ? (
            <img
              src={film.poster_url}
              alt=""
              role="presentation"
              className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transform-none"
              loading="lazy"
              decoding="async"
            />
          ) : null}
        </div>
        <div className="py-3.5">
          <div className="truncate font-display text-lg font-medium leading-snug text-cream transition-colors group-hover:text-primary">
            {film.title}
          </div>
          <div className="mt-1 flex items-center gap-2 font-mono text-[11px] tabular text-muted-foreground">
            {film.previous_rank != null && (
              <span>
                #{film.previous_rank} → #{film.current_rank}
              </span>
            )}
            <span className={`inline-flex items-center gap-0.5 font-mono text-[12px] font-semibold ${up ? "text-up" : "text-down"}`}>
              {up ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />}
              {Math.abs(film.movement)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function MoverSideRow({ film }: { film: MoverFilm }) {
  const up = film.direction === "up";
  const poster = film.poster_url;
  const gradient = `linear-gradient(155deg, ${film.gradient_from ?? "#333"}, ${film.gradient_to ?? "#111"})`;
  return (
    <Link
      to={`/films/$slug`}
      params={{ slug: film.slug }}
      aria-label={`${film.title}, moved ${up ? "up" : "down"} ${Math.abs(film.movement)} to #${film.current_rank}`}
      className="group flex items-center gap-3 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
    >
      <div
        className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-ink"
        style={{ background: gradient }}
      >
        {poster ? (
          <img
            src={poster}
            alt=""
            role="presentation"
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="p-1 text-center font-display text-[10px] leading-tight text-cream/80">
            {film.title}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium transition-colors group-hover:text-primary" title={film.title}>
          {film.title}
        </div>
        <div className="mt-0.5 font-mono text-[11px] tabular text-muted-foreground">
          {film.previous_rank != null
            ? `#${film.previous_rank} → #${film.current_rank}`
            : `#${film.current_rank}`}
        </div>
      </div>
      <span
        className={`flex items-center gap-0.5 font-mono text-xs font-semibold tabular ${up ? "text-up" : "text-down"}`}
      >
        {up ? <ArrowUpRight className="h-3 w-3" aria-hidden /> : <ArrowDownRight className="h-3 w-3" aria-hidden />}
        {Math.abs(film.movement)}
      </span>
    </Link>
  );
}

function MoversRail() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["index", "movers"],
    queryFn: () => getBiggestMovers(),
    staleTime: 5 * 60 * 1000,
  });

  const moverLead = (data?.gainers ?? [])[0];
  const moverRows = (data?.gainers ?? []).slice(1, 4);

  return (
    <aside
      aria-label="Biggest movers"
      className="glass p-4 rounded-xl lg:p-5"
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
        Biggest movers
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-4">
          <div className="aspect-[16/10] w-full animate-pulse rounded-md bg-foreground/10" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-14 w-10 animate-pulse rounded-md bg-foreground/10" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-28 animate-pulse rounded bg-foreground/10" />
                <div className="h-2.5 w-20 animate-pulse rounded bg-foreground/10" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Movers are reconnecting. The Index refreshes every 12 hours.
        </p>
      ) : !moverLead ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No rank movement between the last two published charts yet.
        </p>
      ) : (
        <div className="mt-3">
          <MoverLeadCard film={moverLead} />
          {moverRows.length > 0 && (
            <div className="mt-2 border-t border-foreground/[0.08]">
              {moverRows.map((f) => (
                <MoverSideRow key={f.slug} film={f} />
              ))}
            </div>
          )}
          <div className="mt-3 border-t border-foreground/[0.08] pt-3">
            <Link
              to="/rising"
              className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground transition hover:text-foreground"
            >
              All biggest movers →
            </Link>
          </div>
        </div>
      )}
    </aside>
  );
}

/* ── The hero body itself ────────────────────────────────────────────────────
   Left: backdrop + rotating headline. Right: the movers side rail. */

function FrontHero() {
  const { data: rising, isLoading, error } = useQuery({
    queryKey: ["films", "rising", HERO_TOP_COUNT],
    queryFn: () => getRisingFilms(HERO_TOP_COUNT),
    staleTime: 5 * 60 * 1000,
  });

  const picks = (rising ?? []).slice(0, HERO_TOP_COUNT);
  const [active, setActive] = useState(0);
  const lead = picks[active] ?? picks[0];
  const backdrop = lead?.backdrop_url ?? lead?.poster_url ?? null;

  // Rotate every 8s while mounted. Reduced-motion users simply never see
  // flash; the interval cost is one state swap, negligible either way.
  useEffect(() => {
    if (picks.length <= 1) return;
    const timer = setInterval(() => {
      setActive((a) => (a + 1) % picks.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [picks.length]);

  // Wrap-around movement shared by the tap zones and the keyboard handler.
  const goPrev = () => picks.length > 1 && setActive((a) => (a - 1 + picks.length) % picks.length);
  const goNext = () => picks.length > 1 && setActive((a) => (a + 1) % picks.length);

  // Left/right arrows move between rising stories, matching the invisible
  // tap zones (only when the hero is focused — no global key hijacking).
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    // Ignore while focus sits on the title-page link: Enter/Space there is
    // navigation, arrows there would be surprising.
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "A" || t.closest?.("a"))) return;
    if (e.key === "ArrowLeft") goPrev();
    else goNext();
  };

  const gradient = `linear-gradient(155deg, ${lead?.gradient_from ?? "#333"}, ${lead?.gradient_to ?? "#111"})`;

  return (
    <div className="grid w-full grid-cols-1 gap-6 px-4 pb-2 pt-4 sm:px-6 lg:mx-auto lg:max-w-[90rem] lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8 lg:px-8 lg:pb-0 lg:pt-8">
      <section
        aria-label="Rising on The Index"
        onKeyDown={onKeyDown}
        className="group relative min-h-[78svh] overflow-hidden rounded-xl bg-surface sm:min-h-[30rem] lg:min-h-[26rem]"
      >
        {/* Backdrop still of the lead title — art first, then a progressive
            blackout so white type holds AA contrast throughout. */}
        <div className="absolute inset-0" style={{ background: gradient }}>
          {backdrop && (
            <img
              src={backdrop}
              alt=""
              role="presentation"
              className="h-full w-full object-cover object-center opacity-80 transition-transform duration-700 motion-reduce:transform-none"
              loading="lazy"
              decoding="async"
            />
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20" />
        <HeroTapZones
          onPrev={goPrev}
          onNext={goNext}
          disabled={picks.length <= 1}
        />
        <div className="relative flex min-h-[inherit] flex-col justify-end p-5 sm:p-8 lg:min-h-[26rem] lg:p-10">
          {isLoading ? (
            <div className="max-w-xl space-y-4">
              <div className="h-3 w-24 animate-pulse rounded bg-cream/20" />
              <div className="h-12 w-3/4 max-w-full animate-pulse rounded bg-cream/20" />
              <div className="h-10 w-48 animate-pulse rounded bg-cream/20" />
            </div>
          ) : error ? (
            <p className="text-sm text-cream/85">
              The live chart is reconnecting. Rising picks reappear the moment
              the engine is back.
            </p>
          ) : lead ? (
            <HeroHeadline film={lead} position={active} />
          ) : (
            <p className="max-w-md text-sm text-cream/85">
              No rising picks in the latest chart yet. Check back after the
              next refresh.
            </p>
          )}
        </div>
      </section>
      <div className="lg:pt-1">
        <MoversRail />
      </div>
    </div>
  );
}
/** The complete front page masthead block (date line, hero, movers rail). */
export function FrontPage({ children }: { children?: ReactNode }) {
  return (
    <section className="pb-2">
      {/* Tight two-column date+hype strip that never wraps on the narrowest
          phones: the date is the only flexible item, and both labels share
          one baseline so the masthead reads as a single line. */}
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-6 lg:mx-auto lg:max-w-[90rem] lg:px-8">
        <div className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:text-[11px] sm:tracking-[0.22em]">
          {formatUsDate(new Date())}
        </div>
        <FrontTickerLine />
      </div>
      <FrontHero />
      {children}
    </section>
  );
}

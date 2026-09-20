/**
 * shareCard.ts — renders shareable cards on an offscreen canvas.
 *
 * Two card types:
 *  - "film":  one title — full-bleed poster backdrop, giant rank, dominant
 *             Index Score, brand lockup
 *  - "chart": a ranked list — top rows with poster thumbs, brand lockup
 *
 * Design language (matching the site): ink ground, ivory display type,
 * single red accent, hairline frame. The poster IS the composition —
 * cover-filling the card under a cinematic scrim — so the card reads as
 * a movie still with the Index's data stamped on top.
 *
 * Everything is drawn locally (poster fetched via the CORS-safe image
 * proxy, CDN fallback), so the output is a clean PNG the Web Share API
 * can attach as a file and the user can download directly.
 */

import type { RankedFilm } from "@/lib/apiClient";
import { getApiBase } from "@/lib/apiClient";
import { SITE_URL } from "@/lib/site";

const IVORY = "#F4F1EA";
const INK = "#080808";
const RED = "#E52B2B";
const MUTED = "#A6A29B";
const HAIRLINE = "rgba(244, 241, 234, 0.16)";

const DISPLAY_FONT = '"Fraunces", Georgia, "Times New Roman", serif';
const SANS_FONT = '"Inter", system-ui, -apple-system, sans-serif';
const MONO_FONT = '"DM Mono", ui-monospace, "SF Mono", Menlo, monospace';

/** Load an image with CORS so the canvas stays untainted and exportable.
 *  Tries the backend proxy first (immune to the non-CORS image-cache trap),
 *  then the CDN directly; cached per-URL with a timeout so a slow source
 *  degrades to the gradient fallback, never a hang. */
const imgCache = new Map<string, Promise<HTMLImageElement | null>>();

function loadImage(src: string, timeoutMs = 4000): Promise<HTMLImageElement | null> {
  const cached = imgCache.get(src);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (v: HTMLImageElement | null) => {
      if (!done) {
        done = true;
        resolve(v);
      }
    };
    img.crossOrigin = "anonymous";
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    setTimeout(() => finish(null), timeoutMs);
    img.src = src;
  });
  imgCache.set(src, promise);
  return promise;
}

/** Proxy first, CDN second — first success wins. */
async function loadPoster(
  posterUrl: string | null | undefined,
  size: "w185" | "w500",
): Promise<HTMLImageElement | null> {
  const proxied = posterSrc(posterUrl, size);
  if (proxied) {
    const viaProxy = await loadImage(proxied);
    if (viaProxy) return viaProxy;
  }
  const direct = cdnPosterSrc(posterUrl, size);
  return direct ? loadImage(direct) : null;
}

/** Build a TMDB poster URL at the requested size. Posters are fetched via
 *  the backend image proxy — browsers key their image cache without CORS
 *  attributes, so a canvas crossOrigin request to image.tmdb.org can be
 *  served the site's non-CORS cache entry and the load fails. The proxy
 *  (the same API host the app already fetches data from) sidesteps that.
 *  Falls back to the CDN directly if the proxy is unreachable. */
function posterSrc(
  posterUrl: string | null | undefined,
  size: "w185" | "w500",
): string | null {
  if (!posterUrl) return null;
  const name = posterUrl.split("?")[0].split("/").pop() ?? "";
  if (!/^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/.test(name)) return null;
  return `${getApiBase().replace(/\/+$/, "")}/api/v1/tmdb/image/${size}/${name}`;
}

/** Direct-CDN fallback used if the proxy request fails. */
function cdnPosterSrc(
  posterUrl: string | null | undefined,
  size: "w185" | "w500",
): string | null {
  if (!posterUrl) return null;
  const name = posterUrl.split("?")[0].split("/").pop() ?? "";
  if (!name) return null;
  return `https://image.tmdb.org/t/p/${size}/${name}`;
}

/** Draw `img` filling the target rect with center-crop (object-fit: cover).
 *  Uses the destination-rect form only — the caller's clip constrains the
 *  overflow, so there is no source-rect math to get wrong. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** The gradient placeholder block — always painted under a poster slot so
 *  the card never shows a bare hole, even while/after an image fails. */
function drawPosterFallback(
  ctx: CanvasRenderingContext2D,
  film: RankedFilm,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, film.gradient_from || "#333");
  grad.addColorStop(1, film.gradient_to || "#111");
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The Index prismatic logo mark, drawn with vectors. */
function drawBrandMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  // Rounded dark square.
  ctx.fillStyle = INK;
  roundRect(ctx, 0, 0, size, size, size * 0.2);
  ctx.fill();
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = Math.max(1, size * 0.02);
  ctx.stroke();
  // Prismatic shard mark (three facets, like the favicon).
  ctx.fillStyle = IVORY;
  const u = size;
  ctx.beginPath();
  ctx.moveTo(u * 0.45, u * 0.08);
  ctx.lineTo(u * 0.78, u * 0.62);
  ctx.lineTo(u * 0.45, u * 0.46);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(u * 0.43, u * 0.46);
  ctx.lineTo(u * 0.23, u * 0.64);
  ctx.lineTo(u * 0.43, u * 0.86);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(u * 0.47, u * 0.46);
  ctx.lineTo(u * 0.78, u * 0.62);
  ctx.lineTo(u * 0.47, u * 0.86);
  ctx.lineTo(u * 0.47, u * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBrandLockup(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  markSize: number,
) {
  drawBrandMark(ctx, x, y, markSize);
  const tx = x + markSize + markSize * 0.35;
  ctx.fillStyle = IVORY;
  ctx.font = `600 ${markSize * 0.5}px ${SANS_FONT}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Lumière", tx, y + markSize * 0.48);
  ctx.fillStyle = MUTED;
  ctx.font = `${markSize * 0.24}px ${SANS_FONT}`;
  ctx.fillText(
    "T H E   I N D E X",
    tx + markSize * 0.04,
    y + markSize * 0.82,
  );
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Shrink font size until the text fits maxWidth (single line). */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startPx: number,
  weight: number,
  family: string,
): number {
  let px = startPx;
  for (;;) {
    ctx.font = `${weight} ${px}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth || px <= 18) return px;
    px -= 2;
  }
}

/** Human label for the chart a rank belongs to ("MOVIE 100" / "TV 100"). */
function chartLabel(film: RankedFilm): string {
  if (film.chart_type === "TV_100") return "TV 100";
  if (film.chart_type === "MOVIE_100") return "MOVIE 100";
  return "THE INDEX";
}

/** Wait for the webfonts the card uses so canvas text renders in brand
 *  type even on the first render after a cold load. Never rejects. */
async function ensureFonts(): Promise<void> {
  try {
    await document.fonts.ready;
  } catch {
    /* font availability is best-effort; system fallbacks are fine */
  }
}

function hairlineFrame(ctx: CanvasRenderingContext2D, W: number, H: number, inset = 28) {
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 2;
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
}

function liveBadge(ctx: CanvasRenderingContext2D, W: number, y: number) {
  const date = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const text = `LIVE · ${date.toUpperCase()}`;
  ctx.font = `22px ${MONO_FONT}`;
  const w = ctx.measureText(text).width;
  // Red pulse dot + right-aligned live/date stamp.
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.arc(W - 88 - w, y - 7, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = MUTED;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, W - 80, y);
}

export interface ShareCardResult {
  blob: Blob;
  filename: string;
}

/** Render the one-title card. 1080×1350 (4:5) — ideal for social feeds.
 *
 *  Immersive composition: the poster cover-fills the entire card as the
 *  backdrop under a cinematic scrim; a floating poster card, the giant
 *  chart rank and the dominant Index Score sit on top; title, meta and
 *  the canonical domain anchor the bottom. */
export async function renderFilmCard(film: RankedFilm): Promise<ShareCardResult> {
  await ensureFonts();
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const poster = await loadPoster(film.poster_url, "w500");

  // ── 1. Full-bleed backdrop: the poster IS the background ──────────────────
  if (poster) {
    drawCover(ctx, poster, 0, 0, W, H);
  } else {
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, film.gradient_from || "#26221f");
    bg.addColorStop(1, INK);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  }

  // ── 2. Cinematic scrim — darken for legibility, heavier at the bottom ────
  ctx.fillStyle = "rgba(8, 8, 8, 0.52)";
  ctx.fillRect(0, 0, W, H);
  const scrim = ctx.createLinearGradient(0, H * 0.28, 0, H);
  scrim.addColorStop(0, "rgba(8, 8, 8, 0)");
  scrim.addColorStop(0.55, "rgba(8, 8, 8, 0.66)");
  scrim.addColorStop(1, "rgba(8, 8, 8, 0.96)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, W, H);

  hairlineFrame(ctx, W, H);

  // ── 3. Header: brand lockup + live stamp ──────────────────────────────────
  drawBrandLockup(ctx, 72, 60, 56);
  liveBadge(ctx, W, 100);

  // ── 4. Floating poster card (left) with a soft shadow ────────────────────
  const pX = 96;
  const pY = 300;
  const pW = 396;
  const pH = 594; // 2:3
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
  ctx.shadowBlur = 44;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = INK;
  roundRect(ctx, pX, pY, pW, pH, 18);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, pX, pY, pW, pH, 18);
  ctx.clip();
  drawPosterFallback(ctx, film, pX, pY, pW, pH);
  if (poster) drawCover(ctx, poster, pX, pY, pW, pH);
  ctx.restore();
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 2;
  roundRect(ctx, pX, pY, pW, pH, 18);
  ctx.stroke();

  // ── 5. Right column: giant rank + chart identity + tenure ─────────────────
  const colX = pX + pW + 72;
  const colW = W - 96 - colX;

  const rankText = `#${film.rank}`;
  const rankFont = fitFont(ctx, rankText, colW, 168, 700, DISPLAY_FONT);
  ctx.fillStyle = IVORY;
  ctx.font = `700 ${rankFont}px ${DISPLAY_FONT}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(rankText, colX - 4, pY + 150);

  // Red accent bar under the rank.
  ctx.fillStyle = RED;
  ctx.fillRect(colX, pY + 186, 116, 7);

  ctx.fillStyle = MUTED;
  ctx.font = `500 24px ${MONO_FONT}`;
  ctx.fillText(`ON THE ${chartLabel(film)}`, colX, pY + 246);

  // Movement line (+3 / −2 / DEBUT) — quiet, factual.
  const mv = film.movement ?? 0;
  if (mv > 0) {
    ctx.fillStyle = RED;
    ctx.font = `600 30px ${MONO_FONT}`;
    ctx.fillText(`▲ +${mv}`, colX, pY + 306);
  } else if (mv < 0) {
    ctx.fillStyle = MUTED;
    ctx.font = `600 30px ${MONO_FONT}`;
    ctx.fillText(`▼ ${mv}`, colX, pY + 306);
  } else {
    ctx.fillStyle = MUTED;
    ctx.font = `500 24px ${MONO_FONT}`;
    ctx.fillText("· HOLDING STEADY", colX, pY + 306);
  }

  // Tenure lines.
  ctx.fillStyle = MUTED;
  ctx.font = `26px ${MONO_FONT}`;
  const rawDirector = film.director && film.director !== "Unknown" ? film.director : null;
  const directorName = rawDirector && !/ TBA$/.test(rawDirector) ? rawDirector : null;
  const tenure = [
    film.days_on_chart ? `${film.days_on_chart} days on the chart` : null,
    film.days_at_one ? `${film.days_at_one} day${film.days_at_one === 1 ? "" : "s"} at #1` : null,
    directorName,
  ].filter(Boolean) as string[];
  tenure.forEach((line, i) => {
    ctx.fillText(line, colX, pY + 380 + i * 48);
  });

  // ── 6. Bottom band: dominant Index Score vs. title block ─────────────────
  const bandY = 962;
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(96, bandY);
  ctx.lineTo(W - 96, bandY);
  ctx.stroke();

  // Score — the headline number, visually dominant.
  ctx.fillStyle = MUTED;
  ctx.font = `500 26px ${MONO_FONT}`;
  ctx.fillText("I N D E X   S C O R E", 96, bandY + 66);
  const scoreText = film.score?.toFixed(1) ?? "—";
  const scoreFont = fitFont(ctx, scoreText, 520, 210, 600, DISPLAY_FONT);
  ctx.fillStyle = IVORY;
  ctx.font = `600 ${scoreFont}px ${DISPLAY_FONT}`;
  ctx.fillText(scoreText, 90, bandY + 254);
  ctx.fillStyle = RED;
  ctx.fillRect(96, bandY + 288, 64, 5);

  // Title block — right-aligned opposite the score.
  const titleMaxW = 470;
  const titleFont = fitFont(ctx, film.title, titleMaxW, 62, 600, DISPLAY_FONT);
  ctx.fillStyle = IVORY;
  ctx.font = `600 ${titleFont}px ${DISPLAY_FONT}`;
  const titleLines = wrapText(ctx, film.title, titleMaxW).slice(0, 2);
  let ty = bandY + 96 - (titleLines.length - 1) * (titleFont * 1.08);
  for (const line of titleLines) {
    ctx.fillText(line, W - 96 - ctx.measureText(line).width, ty);
    ty += titleFont * 1.08;
  }
  ctx.fillStyle = MUTED;
  ctx.font = `26px ${SANS_FONT}`;
  const underTitle = [film.year ? String(film.year) : null, film.genre_tag]
    .filter(Boolean)
    .join("  ·  ");
  if (underTitle) {
    ctx.fillText(underTitle, W - 96 - ctx.measureText(underTitle).width, ty + 14);
  }

  // ── 7. Footer ─────────────────────────────────────────────────────────────
  ctx.fillStyle = IVORY;
  ctx.font = `500 24px ${MONO_FONT}`;
  ctx.fillText(SITE_URL.replace(/^https:\/\//, ""), 96, H - 66);
  ctx.fillStyle = MUTED;
  ctx.font = `22px ${MONO_FONT}`;
  const right = "REFRESHED EVERY 15 MIN";
  ctx.fillText(right, W - 96 - ctx.measureText(right).width, H - 66);

  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/png"),
  );
  return { blob, filename: `the-index-${film.slug}.png` };
}

export interface ChartCardOptions {
  title: string;          // e.g. "The Top 10" or "TV 100"
  subtitle: string;       // supporting line under the heading
  films: RankedFilm[];    // rows (max 5 shown)
  /** Display rank override — chart pages renumber (TV chart shows 1–50). */
  rankOf?: (film: RankedFilm, index: number) => number;
  /** Per-chart score label — TV charts read "TVDex". Defaults to "INDEX". */
  scoreLabel?: string;
}

/** Render the ranked-list card. 1080×1350 (4:5). Up to 5 rows.
 *  Same immersive language as the film card: subtle red wash over ink,
 *  hairline frame, live stamp, poster thumbs, dominant scores. */
export async function renderChartCard(opts: ChartCardOptions): Promise<ShareCardResult> {
  await ensureFonts();
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Ground: ink with a faint red wash bleeding from the top.
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, -120, 60, W / 2, -120, 900);
  glow.addColorStop(0, "rgba(229, 43, 43, 0.16)");
  glow.addColorStop(1, "rgba(229, 43, 43, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  hairlineFrame(ctx, W, H);
  drawBrandLockup(ctx, 72, 60, 56);
  liveBadge(ctx, W, 100);

  // Kicker + heading + subtitle.
  ctx.fillStyle = RED;
  ctx.font = `500 24px ${MONO_FONT}`;
  ctx.fillText("THE INDEX · LIVE CULTURAL RANKINGS", 96, 236);

  ctx.fillStyle = IVORY;
  const hFont = fitFont(ctx, opts.title, W - 192, 88, 600, DISPLAY_FONT);
  ctx.font = `600 ${hFont}px ${DISPLAY_FONT}`;
  ctx.fillText(opts.title, 96, 326);

  ctx.fillStyle = MUTED;
  ctx.font = `27px ${SANS_FONT}`;
  ctx.fillText(opts.subtitle, 96, 380);

  // Rows.
  const rows = opts.films.slice(0, 5);
  const rowH = 152;
  const listTop = 468;

  // Fetch all row posters in parallel up front — sequential awaits made the
  // card render take one network round-trip per row.
  const posters = await Promise.all(
    rows.map((f) => loadPoster(f.poster_url, "w185")),
  );

  for (let i = 0; i < rows.length; i++) {
    const f = rows[i];
    const y = listTop + i * rowH;
    const rank = opts.rankOf ? opts.rankOf(f, i) : f.rank;
    const poster = posters[i];

    // Hairline separator above each row (except first).
    if (i > 0) {
      ctx.strokeStyle = HAIRLINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(96, y - 12);
      ctx.lineTo(W - 96, y - 12);
      ctx.stroke();
    }

    // Rank number — the leader reads red.
    ctx.fillStyle = i === 0 ? RED : IVORY;
    ctx.font = `600 ${i === 0 ? 68 : 52}px ${DISPLAY_FONT}`;
    ctx.textBaseline = "middle";
    const rankStr = String(rank);
    ctx.fillText(rankStr, 96, y + rowH / 2 - 22);

    // Movement tag under the rank (quiet, factual).
    const mv = f.movement ?? 0;
    ctx.textBaseline = "alphabetic";
    ctx.font = `500 19px ${MONO_FONT}`;
    if (mv > 0) {
      ctx.fillStyle = RED;
      ctx.fillText(`+${mv}`, 96, y + rowH / 2 + 22);
    } else if (mv < 0) {
      ctx.fillStyle = MUTED;
      ctx.fillText(`${mv}`, 96, y + rowH / 2 + 22);
    }

    // Poster thumb — gradient always under, image over it, soft shadow.
    const thumbH = rowH - 42;
    const thumbW = thumbH * 0.68;
    const thumbY = y + 8;
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = INK;
    roundRect(ctx, 236, thumbY, thumbW, thumbH, 10);
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundRect(ctx, 236, thumbY, thumbW, thumbH, 10);
    ctx.clip();
    drawPosterFallback(ctx, f, 236, thumbY, thumbW, thumbH);
    if (poster) drawCover(ctx, poster, 236, thumbY, thumbW, thumbH);
    ctx.restore();
    ctx.strokeStyle = HAIRLINE;
    ctx.lineWidth = 1.5;
    roundRect(ctx, 236, thumbY, thumbW, thumbH, 10);
    ctx.stroke();

    // Title + meta.
    const textX = 236 + thumbW + 30;
    const textW = W - textX - 250;
    ctx.fillStyle = IVORY;
    ctx.textBaseline = "alphabetic";
    const tFont = fitFont(ctx, f.title, textW, 40, 600, SANS_FONT);
    ctx.font = `600 ${tFont}px ${SANS_FONT}`;
    ctx.fillText(f.title, textX, y + 62);

    ctx.fillStyle = MUTED;
    ctx.font = `22px ${MONO_FONT}`;
    const meta = [
      f.days_on_chart ? `${f.days_on_chart}d on chart` : null,
      directorLabel(f),
    ]
      .filter(Boolean)
      .join("  ·  ");
    ctx.fillText(meta, textX, y + 100);

    // Score right-aligned with its label.
    ctx.fillStyle = IVORY;
    ctx.font = `600 44px ${DISPLAY_FONT}`;
    const scoreText = f.score?.toFixed(1) ?? "—";
    ctx.fillText(scoreText, W - 96 - ctx.measureText(scoreText).width, y + rowH / 2 - 8);
    ctx.fillStyle = MUTED;
    ctx.font = `16px ${MONO_FONT}`;
    const idxLabel = (opts.scoreLabel ?? "INDEX").toUpperCase();
    ctx.fillText(idxLabel, W - 96 - ctx.measureText(idxLabel).width, y + rowH / 2 + 20);
  }

  // Footer.
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(96, H - 128);
  ctx.lineTo(W - 96, H - 128);
  ctx.stroke();
  ctx.fillStyle = IVORY;
  ctx.font = `500 24px ${MONO_FONT}`;
  ctx.fillText(SITE_URL.replace(/^https:\/\//, ""), 96, H - 70);
  ctx.fillStyle = MUTED;
  ctx.font = `22px ${MONO_FONT}`;
  const right = "0% CRITIC WEIGHT";
  ctx.fillText(right, W - 96 - ctx.measureText(right).width, H - 70);

  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/png"),
  );
  return { blob, filename: `the-index-${opts.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png` };
}

/** Catalog placeholders are not names. */
function directorLabel(f: RankedFilm): string | null {
  const d = f.director;
  if (!d || d === "Unknown" || / TBA$/.test(d)) return null;
  return d;
}

/** Save the rendered card as a PNG download — deterministic, no OS share
 *  sheet (whose "copy to clipboard" path confused the intent). */
export async function downloadCard(card: ShareCardResult): Promise<"downloaded" | "failed"> {
  try {
    const url = URL.createObjectURL(card.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = card.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return "downloaded";
  } catch {
    return "failed";
  }
}

/** Web Share with the actual image file attached. Falls back to copying
 *  the link when the platform can't share files (desktop browsers). */
export async function shareCard(
  card: ShareCardResult,
  payload: { title: string; text: string; url: string },
): Promise<"shared" | "link-copied" | "failed"> {
  try {
    const file = new File([card.blob], card.filename, { type: "image/png" });
    const canShareFiles =
      typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
    if (canShareFiles) {
      await navigator.share({ files: [file], title: payload.title, text: payload.text });
      return "shared";
    }
    if (typeof navigator.share === "function") {
      // No file support — share the link itself through the sheet.
      await navigator.share({ title: payload.title, text: payload.text, url: payload.url });
      return "shared";
    }
    await navigator.clipboard.writeText(payload.url);
    return "link-copied";
  } catch {
    return "failed";
  }
}

/** Copy the image itself to the clipboard (where supported). */
export async function copyCardImage(card: ShareCardResult): Promise<"copied" | "failed"> {
  try {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return "failed";
    await navigator.clipboard.write([new ClipboardItem({ "image/png": card.blob })]);
    return "copied";
  } catch {
    return "failed";
  }
}

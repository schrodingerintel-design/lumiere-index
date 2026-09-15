/**
 * shareCard.ts — renders downloadable share cards on an offscreen canvas.
 *
 * Two card types:
 *  - "film":  one title — poster, rank pill, Index Score, brand lockup
 *  - "chart": a ranked list — top rows with poster thumbs, brand lockup
 *
 * Everything is drawn locally (poster fetched via CORS-enabled TMDB CDN),
 * so the output is a clean PNG the Web Share API can attach as a file.
 * Fonts fall back gracefully if webfonts are unavailable in the canvas.
 */

import type { RankedFilm } from "@/lib/apiClient";
import { getApiBase } from "@/lib/apiClient";

const IVORY = "#F4F1EA";
const INK = "#080808";
const SURFACE = "#111111";
const RED = "#E52B2B";
const MUTED = "#A6A29B";
const HAIRLINE = "rgba(244, 241, 234, 0.12)";

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
  let name: string;
  if (/^https?:\/\//.test(posterUrl)) {
    name = posterUrl.split("?")[0].split("/").pop() ?? "";
  } else {
    name = posterUrl.split("?")[0].split("/").pop() ?? "";
  }
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

export interface ShareCardResult {
  blob: Blob;
  filename: string;
}

/** Render the one-title card. 1080×1350 (4:5) — ideal for social feeds. */
export async function renderFilmCard(film: RankedFilm): Promise<ShareCardResult> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background.
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);

  // Poster panel, left-aligned with generous margin.
  const posterW = 480;
  const posterH = 720;
  const posterX = 80;
  const posterY = 210;

  const poster = await loadPoster(film.poster_url, "w500");

  if (poster) {
    ctx.save();
    roundRect(ctx, posterX, posterY, posterW, posterH, 24);
    ctx.clip();
    drawPosterFallback(ctx, film, posterX, posterY, posterW, posterH);
    drawCover(ctx, poster, posterX, posterY, posterW, posterH);
    ctx.restore();
  } else {
    ctx.save();
    roundRect(ctx, posterX, posterY, posterW, posterH, 24);
    ctx.clip();
    drawPosterFallback(ctx, film, posterX, posterY, posterW, posterH);
    ctx.restore();
  }
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 2;
  roundRect(ctx, posterX, posterY, posterW, posterH, 24);
  ctx.stroke();

  // Right column: rank pill, score, tenure.
  const colX = posterX + posterW + 60;
  const colW = W - colX - 80;

  // Rank pill.
  const pillText = `#${film.rank}`;
  const pillFont = fitFont(ctx, pillText, colW, 84, 700, DISPLAY_FONT);
  ctx.font = `700 ${pillFont}px ${DISPLAY_FONT}`;
  const pillW = ctx.measureText(pillText).width + 48;
  const pillH = 88;
  ctx.fillStyle = RED;
  roundRect(ctx, colX, posterY + 8, pillW, pillH, 10);
  ctx.fill();
  ctx.fillStyle = IVORY;
  ctx.textBaseline = "middle";
  ctx.fillText(pillText, colX + 24, posterY + 8 + pillH / 2 + 4);

  // Index Score — the headline number.
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = MUTED;
  ctx.font = `500 22px ${SANS_FONT}`;
  const scoreY = posterY + 8 + pillH + 150;
  ctx.fillText("INDEX SCORE", colX, scoreY - 120);
  ctx.fillStyle = IVORY;
  const scoreText = film.score?.toFixed(1) ?? "—";
  const scoreFont = fitFont(ctx, scoreText, colW, 200, 600, DISPLAY_FONT);
  ctx.font = `600 ${scoreFont}px ${DISPLAY_FONT}`;
  ctx.fillText(scoreText, colX - 6, scoreY + 40);

  // Tenure lines.
  ctx.fillStyle = MUTED;
  ctx.font = `24px ${MONO_FONT}`;
  const rawDirector =
    film.director && film.director !== "Unknown" ? film.director : null;
  // "Director TBA" / "Creator TBA" are catalog placeholders, not names.
  const directorName =
    rawDirector && !/ TBA$/.test(rawDirector) ? rawDirector : null;
  const metaLines = [
    film.days_on_chart ? `${film.days_on_chart} days on chart` : null,
    film.days_at_one ? `${film.days_at_one} day${film.days_at_one === 1 ? "" : "s"} at #1` : null,
    directorName,
    film.year ? String(film.year) : null,
  ].filter(Boolean) as string[];
  metaLines.forEach((line, i) => {
    ctx.fillText(line, colX, scoreY + 110 + i * 46);
  });

  // Title — bottom left, big.
  ctx.fillStyle = IVORY;
  const titleFont = fitFont(ctx, film.title, W - 160, 96, 600, DISPLAY_FONT);
  ctx.font = `600 ${titleFont}px ${DISPLAY_FONT}`;
  const titleLines = wrapText(ctx, film.title, W - 160).slice(0, 2);
  let ty = H - 260 - (titleLines.length - 1) * (titleFont * 1.05);
  for (const line of titleLines) {
    ctx.fillText(line, 80, ty);
    ty += titleFont * 1.05;
  }

  // Metadata under the title.
  ctx.fillStyle = MUTED;
  ctx.font = `26px ${SANS_FONT}`;
  const underTitle = [film.year ? String(film.year) : null, film.genre_tag]
    .filter(Boolean)
    .join("  ·  ");
  ctx.fillText(underTitle, 80, H - 180);

  // Brand lockup, top.
  drawBrandLockup(ctx, 80, 64, 64);

  // Footer note.
  ctx.fillStyle = MUTED;
  ctx.font = `22px ${MONO_FONT}`;
  ctx.fillText("The Index · Live cultural rankings · 0% critic weight", 80, H - 70);

  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/png"),
  );
  return { blob, filename: `the-index-${film.slug}.png` };
}

export interface ChartCardOptions {
  title: string;          // e.g. "The Top 10" or "Top 50 TV Shows"
  subtitle: string;       // supporting line under the heading
  films: RankedFilm[];    // rows (max 5 shown)
  /** Display rank override — chart pages renumber (TV chart shows 1–50). */
  rankOf?: (film: RankedFilm, index: number) => number;
}

/** Render the ranked-list card. 1080×1350 (4:5). Up to 5 rows. */
export async function renderChartCard(opts: ChartCardOptions): Promise<ShareCardResult> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);

  drawBrandLockup(ctx, 80, 64, 64);

  // Heading.
  ctx.fillStyle = RED;
  ctx.font = `500 24px ${SANS_FONT}`;
  ctx.fillText("THE INDEX · LIVE", 80, 230);

  ctx.fillStyle = IVORY;
  const hFont = fitFont(ctx, opts.title, W - 160, 84, 600, DISPLAY_FONT);
  ctx.font = `600 ${hFont}px ${DISPLAY_FONT}`;
  ctx.fillText(opts.title, 80, 320);

  ctx.fillStyle = MUTED;
  ctx.font = `26px ${SANS_FONT}`;
  ctx.fillText(opts.subtitle, 80, 372);

  // Rows.
  const rows = opts.films.slice(0, 5);
  const rowH = 150;
  const listTop = 470;

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
      ctx.moveTo(80, y - 14);
      ctx.lineTo(W - 80, y - 14);
      ctx.stroke();
    }

    // Rank number.
    ctx.fillStyle = i === 0 ? RED : IVORY;
    ctx.font = `600 ${i === 0 ? 64 : 48}px ${DISPLAY_FONT}`;
    ctx.textBaseline = "middle";
    ctx.fillText(String(rank), 80, y + rowH / 2 - 26);

    // Poster thumb — gradient always under, image over it.
    const thumbSize = rowH - 46;
    const thumbY = y + 8;
    const thumbW = thumbSize * 0.68;
    ctx.save();
    roundRect(ctx, 220, thumbY, thumbW, thumbSize, 8);
    ctx.clip();
    drawPosterFallback(ctx, f, 220, thumbY, thumbW, thumbSize);
    if (poster) drawCover(ctx, poster, 220, thumbY, thumbW, thumbSize);
    ctx.restore();

    // Title + meta.
    const textX = 220 + thumbSize * 0.68 + 28;
    const textW = W - textX - 240;
    ctx.fillStyle = IVORY;
    ctx.textBaseline = "alphabetic";
    const tFont = fitFont(ctx, f.title, textW, 38, 600, SANS_FONT);
    ctx.font = `600 ${tFont}px ${SANS_FONT}`;
    ctx.fillText(f.title, textX, y + 58);

    ctx.fillStyle = MUTED;
    ctx.font = `22px ${MONO_FONT}`;
    const meta = [
      f.days_on_chart ? `${f.days_on_chart}d on chart` : null,
      f.score?.toFixed(1) ? `Score ${f.score.toFixed(1)}` : null,
    ]
      .filter(Boolean)
      .join("  ·  ");
    ctx.fillText(meta, textX, y + 96);

    // Score right-aligned.
    ctx.fillStyle = IVORY;
    ctx.font = `600 40px ${DISPLAY_FONT}`;
    const scoreText = f.score?.toFixed(1) ?? "—";
    ctx.fillText(scoreText, W - 80 - ctx.measureText(scoreText).width, y + rowH / 2 - 10);
    ctx.fillStyle = MUTED;
    ctx.font = `16px ${MONO_FONT}`;
    const idxLabel = "INDEX";
    ctx.fillText(idxLabel, W - 80 - ctx.measureText(idxLabel).width, y + rowH / 2 + 18);
  }

  // Footer.
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, H - 130);
  ctx.lineTo(W - 80, H - 130);
  ctx.stroke();
  ctx.fillStyle = MUTED;
  ctx.font = `24px ${MONO_FONT}`;
  ctx.fillText("The Index · Live cultural rankings · theindex.app", 80, H - 70);

  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/png"),
  );
  return { blob, filename: `the-index-${opts.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png` };
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

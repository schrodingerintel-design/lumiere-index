"""Generate public/og-image.png (1200x630) for The Index.

Stdlib-only (zlib + struct): draws the brand lockup with a 5x7 bitmap font
scaled up, so the Open Graph / Twitter share image needs no image libraries,
fonts, or browser tooling to regenerate. Run from the repo root:

    backend/.venv/bin/python scripts/generate_og_image.py
"""
import struct
import zlib
from pathlib import Path

W, H = 1200, 630

# Brand palette (matches the site tokens).
BG = (8, 8, 8)
IVORY = (244, 241, 234)
MUTED = (166, 162, 155)
RED = (229, 43, 43)
HAIRLINE = (38, 38, 38)

# ── 5x7 bitmap font ─────────────────────────────────────────────────────────
FONT = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "C": ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "G": ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    "J": ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "10100", "00100", "00100", "00100", "11111"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
    "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
    "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
    "·": ["00000", "00000", "00000", "00100", "00000", "00000", "00000"],
    "—": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    "È": ["00100", "00000", "11111", "10000", "11110", "10000", "11111"],
    ".": ["00000", "00000", "00000", "00000", "00000", "00000", "00100"],
    ",": ["00000", "00000", "00000", "00000", "00000", "00100", "01000"],
    ":": ["00000", "00100", "00000", "00000", "00000", "00100", "00000"],
    "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
    "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
}

# ── canvas ──────────────────────────────────────────────────────────────────
px = bytearray(BG * (W * H))


def fill_rect(x, y, w, h, color):
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(W, x + w), min(H, y + h)
    for yy in range(y0, y1):
        base = (yy * W + x0) * 3
        for xx in range(x0, x1):
            px[base] = color[0]
            px[base + 1] = color[1]
            px[base + 2] = color[2]
            base += 3


def point_in_tri(px_, py_, tri):
    (ax, ay), (bx, by), (cx, cy) = tri
    d1 = (px_ - bx) * (ay - by) - (ax - bx) * (py_ - by)
    d2 = (px_ - cx) * (by - cy) - (bx - cx) * (py_ - cy)
    d3 = (px_ - ax) * (cy - ay) - (cx - ax) * (py_ - ay)
    has_neg = d1 < 0 or d2 < 0 or d3 < 0
    has_pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (has_neg and has_pos)


def fill_tri(tri, color):
    xs = [p[0] for p in tri]
    ys = [p[1] for p in tri]
    for y in range(max(0, int(min(ys))), min(H, int(max(ys)) + 1)):
        for x in range(max(0, int(min(xs))), min(W, int(max(xs)) + 1)):
            if point_in_tri(x + 0.5, y + 0.5, tri):
                base = (y * W + x) * 3
                px[base] = color[0]
                px[base + 1] = color[1]
                px[base + 2] = color[2]


def text_width(text, scale):
    return len(text) * 6 * scale - scale


def draw_text(text, x, y, scale, color, center=False):
    if center:
        x = (W - text_width(text, scale)) // 2
    for ch in text:
        glyph = FONT.get(ch.upper(), FONT[" "])
        for gy, row in enumerate(glyph):
            for gx, bit in enumerate(row):
                if bit == "1":
                    fill_rect(
                        x + gx * scale,
                        y + gy * scale,
                        scale,
                        scale,
                        color,
                    )
        x += 6 * scale


# ── composition ─────────────────────────────────────────────────────────────
# Hairline frame inset 24px.
fill_rect(24, 24, W - 48, 2, HAIRLINE)
fill_rect(24, H - 26, W - 48, 2, HAIRLINE)
fill_rect(24, 24, 2, H - 48, HAIRLINE)
fill_rect(W - 26, 24, 2, H - 48, HAIRLINE)

# Prismatic shard mark (the favicon's three facets), centered, 150px.
S = 150
MX = (W - S) // 2
MY = 64
u = S


def scale_pt(fx, fy):
    return (MX + fx / 100 * u, MY + fy / 100 * u)


fill_tri(
    [scale_pt(45, 8), scale_pt(78, 62), scale_pt(45, 46)],
    IVORY,
)
fill_tri(
    [scale_pt(43, 46), scale_pt(23, 64), scale_pt(43, 86)],
    IVORY,
)
fill_tri(
    [scale_pt(47, 46), scale_pt(78, 62), scale_pt(47, 86)],
    IVORY,
)

# Wordmark.
draw_text("THE INDEX", 0, 268, 14, IVORY, center=True)

# Tagline.
draw_text("LIVE CULTURAL MOMENTUM — MOVIE 100 · TV 100", 0, 412, 3, MUTED, center=True)

# Bottom line: the canonical domain first.
draw_text(
    "LUMIEREINDEX.COM · REFRESHED EVERY 15 MIN · 0% CRITIC WEIGHT",
    0,
    540,
    3,
    IVORY,
    center=True,
)

# Red accent under the bottom line.
bar_w = text_width("LUMIEREINDEX.COM · REFRESHED EVERY 15 MIN · 0% CRITIC WEIGHT", 3)
fill_rect((W - 240) // 2, 586, 240, 4, RED)

# ── PNG encode (truecolor, no interlace) ────────────────────────────────────
def chunk(tag, data):
    c = struct.pack(">I", len(data)) + tag + data
    return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


raw = b"".join(b"\x00" + bytes(px[y * W * 3 : (y + 1) * W * 3]) for y in range(H))
png = (
    b"\x89PNG\r\n\x1a\n"
    + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0))
    + chunk(b"IDAT", zlib.compress(raw, 9))
    + chunk(b"IEND", b"")
)

out = Path(__file__).resolve().parent.parent / "lumiere-the-index-codebase" / "public" / "og-image.png"
out.write_bytes(png)
print(f"wrote {out} ({out.stat().st_size} bytes, {W}x{H})")

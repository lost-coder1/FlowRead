#!/usr/bin/env python3
"""FlowRead Play Store art.

Takes raw device captures and emits the eight 1080x1920 phone screenshots plus
the 1024x500 feature graphic, in the look established by the pre-pivot listing.

Why a script and not a design tool: the listing goes stale every time the UI
moves (the 1.5.4 set was stale within one release), so the art has to be
re-runnable from fresh captures rather than rebuilt by hand.

The background is lifted out of the reference image itself rather than
re-created, so the gradient, grain and the diagonal sweep match the live
listing exactly instead of approximately.

    python3 scripts/store-art/build.py
"""

import json
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ASSETS = os.path.join(ROOT, "Playstore Assets")
OUT = os.path.join(ASSETS, "final")
REFERENCE = os.path.join(ASSETS, "FlowReadReferenceImage.jpg")

W, H = 1080, 1920

# Phone geometry, measured off the reference (see the frame-edge scan in the
# build notes): the screen is the dark inner rect, the frame a stroke outside it.
SCREEN = (196, 464, 906, H)          # left, top, right, bottom (bleeds off-canvas)
FRAME_PAD = 9                        # frame stroke sits this far outside the screen
SCREEN_RADIUS = 44
FRAME_RADIUS = 54

# Caption block.
CAP_TOP = 118
CAP_MAX_W = 968
CAP_LINE_H = 128
CAP_SIZE = 96

FONT_HEAVY = ("/System/Library/Fonts/Avenir Next.ttc", 8)   # Avenir Next Heavy
FONT_CAPTION = ("/System/Library/Fonts/Avenir Next.ttc", 2)  # Demi Bold -- Heavy reads
                                                            # bubbly at 96px over a
                                                            # screenshot; the feature
                                                            # graphic keeps Heavy.
FONT_BOLD = ("/System/Library/Fonts/Avenir Next.ttc", 0)    # Avenir Next Bold

CREAM = (232, 228, 220)
ACCENT = (232, 197, 71)


def font(spec, size):
    path, idx = spec
    return ImageFont.truetype(path, size, index=idx)


# ───────────────────────── background plate ──────────────────────────────────

def build_plate():
    """The brown gradient, synthesised.

    An earlier version lifted the background out of the reference by masking the
    caption and the phone and interpolating each row across the gap. It matched
    the palette exactly and left horizontal streaks wherever a row was mostly
    glyph, because a handful of clean pixels got stretched across the whole
    line. Synthesising it is both cleaner and resolution-free, which the
    1024x500 feature graphic needs anyway.

    The stops are sampled off the reference down its left margin.
    """
    stops = [
        (0.00, (0x3c, 0x2b, 0x1b)),
        (0.10, (0x3b, 0x2a, 0x1a)),
        (0.21, (0x45, 0x30, 0x1b)),
        (0.31, (0x46, 0x28, 0x10)),
        (0.47, (0x71, 0x47, 0x17)),
        (0.63, (0x80, 0x5a, 0x2d)),
        (0.78, (0xaf, 0x8d, 0x60)),
        (1.00, (0xdb, 0xbb, 0x92)),
    ]
    ys = np.array([s[0] for s in stops])
    cols = np.array([s[1] for s in stops], dtype=float)
    t = np.linspace(0.0, 1.0, H)
    ramp = np.stack([np.interp(t, ys, cols[:, c]) for c in range(3)], axis=1)
    a = np.repeat(ramp[:, None, :], W, axis=1)

    # The reference carries a soft diagonal sweep, lighter towards the upper
    # right and lower left. One broad ellipse is enough to suggest it; anything
    # sharper reads as a gradient artefact rather than light.
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    sweep = np.exp(-(((xx - W * 0.86) / (W * 0.95)) ** 2 +
                     ((yy - H * 0.22) / (H * 0.42)) ** 2))
    a += (sweep * 16.0)[:, :, None]

    rng = np.random.default_rng(7)
    a += rng.normal(0.0, 3.6, size=(H, W, 1))        # film grain, as in the reference
    a += rng.normal(0.0, 1.4, size=(H, W, 3))        # a little chroma noise

    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")


# ───────────────────────── capture preparation ───────────────────────────────

def strip_status_bar(img):
    """Drop the Android status bar if this capture still has one.

    One UI ignores SysUI demo mode, so captures arrive carrying a real clock and
    battery level. The pre-pivot listing cropped the bar off entirely and inside
    a device frame that reads correctly, so this does the same -- and does it to
    every shot, because the captures are inconsistent about it.
    """
    a = np.asarray(img.convert("RGB")).astype(int)
    h, w, _ = a.shape
    bg = np.median(a[2:12, 2:12].reshape(-1, 3), axis=0)
    busy = (np.abs(a - bg).sum(axis=2) > 40).sum(axis=1) > (w * 0.008)

    limit = int(h * 0.05)
    first = next((y for y in range(limit) if busy[y]), None)
    if first is None:
        return img, 0
    end = first
    while end < h and busy[end]:
        end += 1
    if end > limit * 1.4:                 # a long band is app content, not a bar
        return img, 0
    cut = end + max(6, int(h * 0.004))
    return img.crop((0, cut, w, h)), cut


def fit_screen(img):
    """Scale a capture to the frame's inner width and crop to its height."""
    x0, y0, x1, y1 = SCREEN
    tw, th = x1 - x0, y1 - y0
    img, _ = strip_status_bar(img)
    scale = tw / img.width
    img = img.resize((tw, max(1, round(img.height * scale))), Image.LANCZOS)
    if img.height < th:                   # short capture: extend with its last row
        pad = Image.new("RGB", (tw, th), tuple(np.asarray(img).reshape(-1, 3)[-tw:].mean(axis=0).astype(int)))
        pad.paste(img, (0, 0))
        img = pad
    return img.crop((0, 0, tw, th))


# ───────────────────────── drawing ───────────────────────────────────────────

def rounded_mask(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius, fill=255)
    return m


def draw_phone(base, shot):
    x0, y0, x1, y1 = SCREEN
    fx0, fy0, fx1 = x0 - FRAME_PAD, y0 - FRAME_PAD, x1 + FRAME_PAD

    # Glow: a soft cream halo, brighter at the top-left, as in the reference.
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).rounded_rectangle(
        [fx0 - 6, fy0 - 6, fx1 + 6, H + 60], FRAME_RADIUS + 8, fill=190)
    glow = glow.filter(ImageFilter.GaussianBlur(22))
    base.paste(Image.new("RGB", (W, H), CREAM), (0, 0), glow.point(lambda v: int(v * 0.42)))

    # Drop shadow under the phone.
    shadow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(shadow).rounded_rectangle(
        [fx0 + 10, fy0 + 26, fx1 + 10, H + 60], FRAME_RADIUS, fill=150)
    shadow = shadow.filter(ImageFilter.GaussianBlur(30))
    base.paste(Image.new("RGB", (W, H), (0, 0, 0)), (0, 0), shadow.point(lambda v: int(v * 0.55)))

    # Frame body, then the screen inside it.
    frame = Image.new("RGB", (fx1 - fx0, H - fy0 + 60), (16, 14, 12))
    base.paste(frame, (fx0, fy0), rounded_mask(frame.size, FRAME_RADIUS))

    screen = fit_screen(shot)
    base.paste(screen, (x0, y0), rounded_mask(screen.size, SCREEN_RADIUS))

    # Thin bright edge on the frame.
    edge = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(edge).rounded_rectangle(
        [fx0, fy0, fx1, H + 60], FRAME_RADIUS, outline=CREAM + (205,), width=4)
    base.paste(Image.alpha_composite(base.convert("RGBA"), edge).convert("RGB"), (0, 0))
    return base


def wrap(text, fnt, max_w, draw):
    """Break a caption into balanced lines.

    Greedy wrapping fills each line to the margin and leaves the remainder
    stranded -- "Watch the days add / up." reads as a mistake rather than a
    line break. So: take the fewest lines that fit, then choose the split that
    makes the longest line as short as possible.
    """
    words = text.split()
    if not words:
        return [""]

    def widths(groups):
        return [draw.textlength(" ".join(g), font=fnt) for g in groups]

    def split_at(cuts):
        out, prev = [], 0
        for c in list(cuts) + [len(words)]:
            out.append(words[prev:c])
            prev = c
        return out

    import itertools
    for n in range(1, min(len(words), 4) + 1):
        best, best_max = None, None
        for cuts in itertools.combinations(range(1, len(words)), n - 1):
            groups = split_at(cuts)
            if any(not g for g in groups):
                continue
            ws = widths(groups)
            if max(ws) > max_w:
                continue
            if best_max is None or max(ws) < best_max:
                best, best_max = groups, max(ws)
        if best:
            return [" ".join(g) for g in best]

    return [text]          # nothing fits; the caller shrinks the size


def draw_caption(base, text):
    draw = ImageDraw.Draw(base)
    size = CAP_SIZE
    while size > 54:
        fnt = font(FONT_CAPTION, size)
        lines = wrap(text, fnt, CAP_MAX_W, draw)
        if len(lines) <= 2:
            break
        size -= 4
    fnt = font(FONT_CAPTION, size)
    lines = wrap(text, fnt, CAP_MAX_W, draw)
    line_h = int(CAP_LINE_H * size / CAP_SIZE)

    # Shadow on its own blurred layer: a hard offset copy reads as a printing
    # fault at this size, where a soft one just lifts the text off the grain.
    shade = Image.new("L", (W, H), 0)
    sd = ImageDraw.Draw(shade)
    y = CAP_TOP
    for line in lines:
        x = (W - draw.textlength(line, font=fnt)) / 2
        sd.text((x, y + 6), line, font=fnt, fill=150)
        y += line_h
    shade = shade.filter(ImageFilter.GaussianBlur(14))
    base.paste(Image.new("RGB", (W, H), (0, 0, 0)), (0, 0), shade)

    y = CAP_TOP
    for line in lines:
        x = (W - draw.textlength(line, font=fnt)) / 2
        draw.text((x, y), line, font=fnt, fill=(255, 255, 255))
        y += line_h
    return base


# ───────────────────────── outputs ───────────────────────────────────────────

def build_shot(plate, shot_path, caption):
    base = plate.copy()
    base = draw_phone(base, Image.open(shot_path))
    return draw_caption(base, caption)


def _feature_bg(w, h):
    """The feature graphic's own gradient: dark at the left, tan at the right.

    The phone screenshots run their gradient top-to-bottom; this one runs
    diagonally so the headline sits on the dark end and the phone on the light,
    which is what the reference does and what keeps white text legible.
    """
    stops = [(0.0, (0x30, 0x23, 0x16)), (0.45, (0x5f, 0x40, 0x1e)),
             (0.75, (0x97, 0x71, 0x42)), (1.0, (0xd6, 0xb6, 0x8c))]
    ts = np.array([p[0] for p in stops])
    cs = np.array([p[1] for p in stops], dtype=float)

    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    t = np.clip(0.74 * (xx / w) + 0.26 * (yy / h), 0, 1)
    a = np.stack([np.interp(t, ts, cs[:, c]) for c in range(3)], axis=2)

    # The sweeping lighter band the reference draws across the middle.
    band = np.exp(-(((yy - (h * 0.58 + np.sin(xx / w * 3.1) * h * 0.13)) / (h * 0.17)) ** 2))
    a += (band * 13.0)[:, :, None]

    rng = np.random.default_rng(11)
    a += rng.normal(0.0, 3.0, size=(h, w, 1))
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")


def build_feature_graphic():
    """1024x500, in the reference's layout.

    Play renders this small, so nothing under ~24px goes in it, and the phone
    is product presence rather than readable text -- the reference's phone is
    equally illegible apart from one word. It is shown whole, with margins top
    and bottom, rather than bled off the edges.
    """
    fw, fh = 1024, 500
    base = _feature_bg(fw, fh)

    # ── the phone, whole, on the right ───────────────────────────────────
    shot = os.path.join(ASSETS, "FlowReadSS1.jpeg")
    text_right = fw - 80
    if os.path.exists(shot):
        img, _ = strip_status_bar(Image.open(shot))
        outer_h = 446
        inner_h = outer_h - 14
        inner_w = max(1, round(inner_h * img.width / img.height))
        outer_w = inner_w + 14
        px = fw - outer_w - 56
        py = (fh - outer_h) // 2
        img = img.resize((inner_w, inner_h), Image.LANCZOS)

        glow = Image.new("L", (fw, fh), 0)
        ImageDraw.Draw(glow).rounded_rectangle(
            [px - 10, py - 10, px + outer_w + 10, py + outer_h + 10], 32, fill=200)
        glow = glow.filter(ImageFilter.GaussianBlur(15))
        base.paste(Image.new("RGB", (fw, fh), CREAM), (0, 0),
                   glow.point(lambda v: int(v * 0.46)))

        shadow = Image.new("L", (fw, fh), 0)
        ImageDraw.Draw(shadow).rounded_rectangle(
            [px + 6, py + 12, px + outer_w + 10, py + outer_h + 12], 30, fill=140)
        base.paste(Image.new("RGB", (fw, fh), (0, 0, 0)), (0, 0),
                   shadow.filter(ImageFilter.GaussianBlur(20)))

        frame = Image.new("RGB", (outer_w, outer_h), (16, 14, 12))
        base.paste(frame, (px, py), rounded_mask(frame.size, 30))
        base.paste(img, (px + 7, py + 7), rounded_mask((inner_w, inner_h), 24))

        edge = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
        ImageDraw.Draw(edge).rounded_rectangle(
            [px, py, px + outer_w, py + outer_h], 30, outline=CREAM + (205,), width=3)
        base = Image.alpha_composite(base.convert("RGBA"), edge).convert("RGB")
        text_right = px - 34

    # ── the words, on the left ───────────────────────────────────────────
    draw = ImageDraw.Draw(base)
    left = 58
    col = text_right - left

    head = font(FONT_HEAVY, 70)
    draw.text((left, 54), "Read more.", font=head, fill=(255, 255, 255))
    draw.text((left, 132), "Scroll less.", font=head, fill=ACCENT)

    sub = font(FONT_BOLD, 26)
    lines = ["Pick the apps that eat your time.",
             "FlowRead nudges you to read first.",
             "You stay in control."]
    y = 246
    for line in lines:
        draw.text((left + 2, y), line, font=sub, fill=CREAM)
        y += 36

    icon_path = os.path.join(ROOT, "play-store-icon-512.png")
    icon_y = 374
    x = left
    if os.path.exists(icon_path):
        icon = Image.open(icon_path).convert("RGB").resize((76, 76), Image.LANCZOS)
        base.paste(icon, (left, icon_y), rounded_mask((76, 76), 17))
        x = left + 96
    word = font(FONT_HEAVY, 48)
    draw.text((x, icon_y + 12), "Flow", font=word, fill=(255, 255, 255))
    draw.text((x + draw.textlength("Flow", font=word), icon_y + 12), "Read",
              font=word, fill=ACCENT)

    if col < 480:
        print("  ! feature graphic text column is only %dpx" % col)
    return base


def main():
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots.json")) as fh:
        shots = json.load(fh)

    print("building background plate from the reference ...")
    plate = build_plate()
    plate.save(os.path.join(OUT, "_plate.png"))

    missing = []
    for i, shot in enumerate(shots, start=1):
        src = os.path.join(ASSETS, shot["file"])
        if not os.path.exists(src):
            missing.append(shot["file"])
            continue
        img = build_shot(plate, src, shot["caption"])
        name = "%02d_%s.png" % (i, shot["slug"])
        img.save(os.path.join(OUT, name))
        print("  %-28s <- %-34s %s" % (name, shot["file"], shot["caption"]))

    fg = build_feature_graphic()
    fg.save(os.path.join(OUT, "feature_graphic_1024x500.png"))
    print("  feature_graphic_1024x500.png")

    if missing:
        print("\nMISSING CAPTURES (nothing written for these):")
        for m in missing:
            print("   -", m)
    print("\n->", OUT)


if __name__ == "__main__":
    sys.exit(main())

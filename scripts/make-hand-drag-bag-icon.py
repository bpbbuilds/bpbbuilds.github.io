"""Compose create catalog-drag icon from real Cursor_grabbed + LeatherBag.

Vibe target: bold R→L drag sketch — tilted bag, fist on bottom-right,
thick trailing speed lines. Uses game sprites only (no AI redraw).
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
HAND = ROOT / "tools/game-extract-full/Assets/Cursor/Cursor_grabbed.png"
BAG = ROOT / "tools/game-extract-full/Items/Sprites/LeatherBag.png"
OUT = ROOT / "assets/icons/create/hand-drag-bag.png"

SIZE = 512
PAD = 28
BAG_TILT_DEG = 22  # lean into leftward drag (matches sketch)


def silhouette_bottom_right(im: Image.Image, alpha_min: int = 20) -> tuple[int, int]:
    """Bottom-right of the visible bag (bias bottom; sketch + in-game cursor)."""
    px = im.load()
    w, h = im.size
    best = (0, 0)
    best_score = -1.0
    for y in range(h):
        for x in range(w):
            if px[x, y][3] < alpha_min:
                continue
            score = x * 0.4 + y * 0.6
            if score > best_score:
                best_score = score
                best = (x, y)
    return best


def draw_speed_lines(
    canvas: Image.Image,
    origin_x: float,
    origin_y: float,
) -> Image.Image:
    """Bold tapered trails to the right (behind leftward motion)."""
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    # ink ≈ game UI brown/black
    ink = (45, 28, 20)
    specs = (
        # length, y_offset, start_w, end_w, alpha
        (210, -62, 9, 2, 230),
        (240, -28, 8, 2, 210),
        (195, 4, 10, 2, 230),
        (225, 36, 7, 1, 190),
        (170, 66, 8, 2, 200),
    )
    ang = math.radians(8)  # nearly horizontal, slight down like sketch
    for length, y_off, w0, w1, alpha in specs:
        x0 = origin_x
        y0 = origin_y + y_off
        # Draw as short segments that taper
        steps = 14
        for i in range(steps):
            t0 = i / steps
            t1 = (i + 1) / steps
            xa = x0 + math.cos(ang) * length * t0
            ya = y0 + math.sin(ang) * length * t0
            xb = x0 + math.cos(ang) * length * t1
            yb = y0 + math.sin(ang) * length * t1
            tw = w0 + (w1 - w0) * ((t0 + t1) / 2)
            a = int(alpha * (1.0 - t0 * 0.55))
            d.line([(xa, ya), (xb, yb)], fill=(*ink, a), width=max(1, int(round(tw))))
    layer = layer.filter(ImageFilter.GaussianBlur(0.35))
    return Image.alpha_composite(canvas, layer)


def main() -> None:
    hand = Image.open(HAND).convert("RGBA")
    bag = Image.open(BAG).convert("RGBA")

    # Bag dominates like the sketch
    bag_w = 310
    bw, bh = bag.size
    s = bag_w / bw
    bag = bag.resize((int(bw * s), int(bh * s)), Image.Resampling.LANCZOS)
    bag = bag.rotate(BAG_TILT_DEG, expand=True, resample=Image.Resampling.BICUBIC)

    # Fist a bit smaller than bag — reads as cursor on the item
    hh_target = 168
    hw, hh = hand.size
    s = hh_target / hh
    hand = hand.resize((int(hw * s), int(hh * s)), Image.Resampling.LANCZOS)
    hand = hand.rotate(-10, expand=True, resample=Image.Resampling.BICUBIC)
    hw, hh = hand.size

    bag_box = bag.getbbox()
    if not bag_box:
        raise SystemExit("bag empty")
    bl, bt, br, bb = bag_box
    content_w = br - bl
    content_h = bb - bt
    corner_x, corner_y = silhouette_bottom_right(bag)

    # Extra room on the right for speed lines
    w = SIZE + 180
    h = SIZE + 100
    base = Image.new("RGBA", (w, h), (0, 0, 0, 0))

    bag_x = (w - content_w) // 2 - 55 - bl
    bag_y = (h - content_h) // 2 - 28 - bt

    grip_x = bag_x + corner_x
    grip_y = bag_y + corner_y
    # Fist sits on BR corner, slightly below like the sketch grip
    hand_x = int(grip_x - hw * 0.48)
    hand_y = int(grip_y - hh * 0.42)

    trail_x = bag_x + bl + int(content_w * 0.88)
    trail_y = bag_y + bt + int(content_h * 0.5)
    base = draw_speed_lines(base, trail_x, trail_y)

    base.paste(bag, (bag_x, bag_y), bag)
    base.paste(hand, (hand_x, hand_y), hand)

    bbox = base.getbbox()
    if not bbox:
        raise SystemExit("empty composite")
    cropped = base.crop(bbox)
    cw, ch = cropped.size
    # Prefer a bit of horizontal room so trails don't feel cropped
    side = max(cw, ch) + PAD * 2
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    # Bias content slightly left so trails breathe on the right
    ox = (side - cw) // 2 - 8
    oy = (side - ch) // 2
    out.paste(cropped, (ox, oy), cropped)
    out = out.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUT, "PNG")
    print(f"wrote {OUT} (BR @ {corner_x},{corner_y})")


if __name__ == "__main__":
    main()

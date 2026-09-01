"""
Bake Godot chibi Idle animations → looping WebP for the homepage.

Prototype: Ranger (extend CLASSES / --class later).

  python scripts/bake-chibi-idle.py
  python scripts/bake-chibi-idle.py --class Ranger --fps 12 --height 480
"""

from __future__ import annotations

import argparse
import copy
import importlib.util
import math
import re
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
EXTRACT = ROOT / "tools" / "game-extract-full"
OUT = ROOT / "assets" / "characters"

# Shared world canvas so every frame shares the same origin (no swim).
CANVAS_SIZE = 1800
CY_BIAS = 160
_TEX_CACHE: dict[str, Image.Image] = {}


def _tex(path: Path) -> Image.Image:
    key = str(path)
    hit = _TEX_CACHE.get(key)
    if hit is None:
        hit = chibi.knock_black(Image.open(path))
        _TEX_CACHE[key] = hit
    return hit


def _load_chibi():
    path = ROOT / "scripts" / "composite-class-chibis.py"
    spec = importlib.util.spec_from_file_location("composite_class_chibis", path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


chibi = _load_chibi()


def parse_float_list(blob: str) -> list[float]:
    return [float(x) for x in re.findall(r"[-\d.eE+]+", blob)]


def parse_idle_animation(tscn_text: str) -> dict | None:
    """Pull the Idle Animation sub_resource (value tracks only)."""
    blocks = re.split(r"(?=\[sub_resource type=\"Animation\")", tscn_text)
    idle = None
    for block in blocks:
        if not block.startswith('[sub_resource type="Animation"'):
            continue
        if re.search(r'resource_name\s*=\s*"Idle"', block):
            idle = block
            break
    if not idle:
        # Fallback: longest Animation (>= 5s). RESET is ~0.001s.
        best_len = 0.0
        for block in blocks:
            if not block.startswith('[sub_resource type="Animation"'):
                continue
            lm = re.search(r"length\s*=\s*([\d.]+)", block)
            if not lm:
                continue
            ln = float(lm.group(1))
            if ln >= 5.0 and ln > best_len:
                best_len = ln
                idle = block
    if not idle:
        return None

    length_m = re.search(r"length\s*=\s*([\d.]+)", idle)
    length = float(length_m.group(1)) if length_m else 15.0
    tracks = []
    for m in re.finditer(
        r'tracks/(\d+)/type\s*=\s*"value"\s*'
        r'tracks/\1/path\s*=\s*NodePath\("([^"]+)"\)\s*'
        r"[\s\S]*?"
        r"tracks/\1/keys\s*=\s*\{([\s\S]*?)\n\}",
        idle,
    ):
        node_prop = m.group(2)
        if ":" not in node_prop:
            continue
        node_path, prop = node_prop.rsplit(":", 1)
        keys_blob = m.group(3)
        times_m = re.search(r'"times":\s*PoolRealArray\(([^)]*)\)', keys_blob)
        trans_m = re.search(r'"transitions":\s*PoolRealArray\(([^)]*)\)', keys_blob)
        values_m = re.search(r'"values":\s*\[([^\]]*)\]', keys_blob)
        if not times_m or not values_m:
            continue
        times = parse_float_list(times_m.group(1))
        transitions = parse_float_list(trans_m.group(1)) if trans_m else [1.0] * len(times)
        raw_vals = values_m.group(1).strip()
        if "Vector2" in raw_vals:
            values = [
                chibi.parse_vector2(v)
                for v in re.findall(r"Vector2\([^)]*\)", raw_vals)
            ]
        else:
            values = parse_float_list(raw_vals)
        if len(times) != len(values):
            continue
        while len(transitions) < len(times):
            transitions.append(1.0)
        tracks.append(
            {
                "node": node_path,
                "prop": prop,
                "times": times,
                "values": values,
                "transitions": transitions,
            }
        )
    return {"length": length, "tracks": tracks}


def godot_ease(t: float, curve: float) -> float:
    """Godot Math.ease / Animation track transition curve."""
    t = max(0.0, min(1.0, t))
    if curve == 0.0:
        return 0.0
    if curve > 0.0:
        if curve < 1.0:
            return 1.0 - (1.0 - t) ** (1.0 / curve)
        return t**curve
    # Negative: ease-in-out with exponent -curve (Idle uses ~-1.93)
    exp = -curve
    if t < 0.5:
        return 0.5 * (t * 2.0) ** exp
    return 1.0 - 0.5 * ((1.0 - t) * 2.0) ** exp


def sample_track(track: dict, t: float, length: float):
    times = track["times"]
    values = track["values"]
    transitions = track["transitions"]
    if not times:
        return None
    if len(times) == 1:
        return values[0]

    t = t % length if length > 0 else 0.0
    # loop_wrap: after last key, interpolate toward first across the loop boundary
    if t <= times[0]:
        # between last→first wrapping
        t0, t1 = times[-1], times[0] + length
        v0, v1 = values[-1], values[0]
        tr = transitions[-1]
        u = (t + length - t0) / (t1 - t0) if t1 != t0 else 0.0
        u = godot_ease(u, tr)
    elif t >= times[-1]:
        t0, t1 = times[-1], times[0] + length
        v0, v1 = values[-1], values[0]
        tr = transitions[-1]
        u = (t - t0) / (t1 - t0) if t1 != t0 else 0.0
        u = godot_ease(u, tr)
    else:
        i = 0
        while i + 1 < len(times) and times[i + 1] < t:
            i += 1
        t0, t1 = times[i], times[i + 1]
        v0, v1 = values[i], values[i + 1]
        tr = transitions[i]
        u = (t - t0) / (t1 - t0) if t1 != t0 else 0.0
        u = godot_ease(u, tr)

    if isinstance(v0, tuple):
        return (v0[0] + (v1[0] - v0[0]) * u, v0[1] + (v1[1] - v0[1]) * u)
    return v0 + (v1 - v0) * u


def apply_animation(nodes: dict, anim: dict, t: float) -> dict:
    out = copy.deepcopy(nodes)
    for track in anim["tracks"]:
        path = track["node"]
        if path not in out:
            continue
        val = sample_track(track, t, anim["length"])
        if val is None:
            continue
        prop = track["prop"]
        if prop == "rotation_degrees":
            out[path]["rotation"] = math.radians(float(val))
        elif prop == "rotation":
            out[path]["rotation"] = float(val)
        elif prop == "position" and isinstance(val, tuple):
            out[path]["position"] = val
    return out


def render_frame(
    res, nodes, *, canvas_size=CANVAS_SIZE, cy_bias=CY_BIAS
) -> Image.Image:
    """Same compositing path as composite-class-chibis; full canvas (no crop)."""
    sprites = []
    for path, n in nodes.items():
        if n["type"] != "Sprite" or n["texture_id"] is None:
            continue
        if n["name"] == "Shadow":
            continue
        tex_path = res.get(n["texture_id"])
        if not tex_path or not tex_path.exists():
            continue
        parent = n["parent"]
        parent_path = "" if parent in (None, ".") else parent
        m = chibi.world_mat(nodes, parent_path)
        m = chibi.mat_mul(
            m, chibi.mat_from_trs(n["position"], n["rotation"], n["scale"])
        )
        z = chibi.accumulate_z(
            nodes, parent_path, n["z_index"], n["show_behind_parent"]
        )
        sprites.append((z, path, n, tex_path, m))

    sprites.sort(key=lambda t: (t[0], t[1]))
    w = h = canvas_size
    cx, cy = w // 2, h // 2 + cy_bias
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))

    for _z, _path, n, tex_path, m in sprites:
        im = _tex(tex_path)
        ox, oy = n["offset"]
        tw, th = im.size
        corners = [
            (-tw / 2 + ox, -th / 2 + oy),
            (tw / 2 + ox, -th / 2 + oy),
            (tw / 2 + ox, th / 2 + oy),
            (-tw / 2 + ox, th / 2 + oy),
        ]
        world_corners = [chibi.apply(m, x, y) for x, y in corners]
        xs = [p[0] for p in world_corners]
        ys = [p[1] for p in world_corners]
        minx, maxx = min(xs), max(xs)
        miny, maxy = min(ys), max(ys)
        dw = max(1, int(math.ceil(maxx - minx)))
        dh = max(1, int(math.ceil(maxy - miny)))
        a, b, c, d, e, f = m
        det = a * e - b * d
        if abs(det) < 1e-8:
            continue
        ia, ib, id_, ie = e / det, -b / det, -d / det, a / det
        ic = -(ia * c + ib * f)
        iff = -(id_ * c + ie * f)
        a0, a1 = ia, ib
        a2 = ia * minx + ib * miny + ic - ox + tw / 2
        a3, a4 = id_, ie
        a5 = id_ * minx + ie * miny + iff - oy + th / 2
        piece = im.transform(
            (dw, dh), Image.AFFINE, (a0, a1, a2, a3, a4, a5), resample=Image.BICUBIC
        )
        mod = n["modulate"]
        if mod != (1.0, 1.0, 1.0, 1.0):
            r, g, b, a_ch = piece.split()
            piece = Image.merge(
                "RGBA",
                (
                    r.point(lambda x: int(x * mod[0])),
                    g.point(lambda x: int(x * mod[1])),
                    b.point(lambda x: int(x * mod[2])),
                    a_ch.point(lambda x: int(x * mod[3])),
                ),
            )
        px = int(round(cx + minx))
        py = int(round(cy + miny))
        if px < w and py < h and px + dw > 0 and py + dh > 0:
            canvas.alpha_composite(piece, (max(0, px), max(0, py)))

    return canvas


def fit_height(im: Image.Image, max_h: int) -> Image.Image:
    if im.height <= max_h:
        return im
    ratio = max_h / im.height
    return im.resize(
        (max(1, int(im.width * ratio)), max_h), Image.LANCZOS
    )


def _log(msg: str) -> None:
    print(msg, flush=True)


def bake_class(
    class_name: str,
    *,
    fps: float = 12.0,
    max_h: int = 480,
    quality: int = 82,
) -> Path | None:
    tscn = (
        EXTRACT
        / "CharacterClasses"
        / class_name
        / f"{class_name}ChibiSprite.tscn"
    )
    if not tscn.exists():
        _log(f"missing {tscn}")
        return None

    text = tscn.read_text(encoding="utf-8", errors="replace")
    anim = parse_idle_animation(text)
    if not anim or not anim["tracks"]:
        _log(f"no Idle animation tracks in {tscn.name}")
        return None

    res, nodes = chibi.parse_tscn(tscn)
    length = anim["length"]
    n_frames = max(2, int(round(length * fps)))
    duration_ms = max(1, int(round(1000 / fps)))

    _log(
        f"baking {class_name} Idle: {length}s @ {fps}fps -> {n_frames} frames, "
        f"{len(anim['tracks'])} tracks, {duration_ms}ms/frame"
    )

    # Pass 1: measure shared world-space crop (discard canvases — saves GBs of RAM).
    _log("  pass 1/2: measuring crop box")
    x0 = y0 = 10**9
    x1 = y1 = 0
    for i in range(n_frames):
        t = (i / n_frames) * length
        canvas = render_frame(res, apply_animation(nodes, anim, t))
        bb = canvas.getbbox()
        canvas.close()
        if not bb:
            continue
        x0 = min(x0, bb[0])
        y0 = min(y0, bb[1])
        x1 = max(x1, bb[2])
        y1 = max(y1, bb[3])
        if (i + 1) % 30 == 0 or i + 1 == n_frames:
            _log(f"    measured {i + 1}/{n_frames}")

    if x0 > x1:
        _log("no opaque pixels")
        return None
    pad = 4
    box = (
        max(0, x0 - pad),
        max(0, y0 - pad),
        min(CANVAS_SIZE, x1 + pad),
        min(CANVAS_SIZE, y1 + pad),
    )
    _log(f"  crop box {box}")

    # Pass 2: crop + scale into final frames only.
    _log("  pass 2/2: rendering frames")
    frames: list[Image.Image] = []
    for i in range(n_frames):
        t = (i / n_frames) * length
        canvas = render_frame(res, apply_animation(nodes, anim, t))
        frames.append(fit_height(canvas.crop(box), max_h))
        canvas.close()
        if (i + 1) % 30 == 0 or i + 1 == n_frames:
            _log(f"    frame {i + 1}/{n_frames}")

    OUT.mkdir(parents=True, exist_ok=True)
    dest = OUT / f"char-{class_name.lower()}-idle.webp"
    frames[0].save(
        dest,
        format="WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=[duration_ms] * len(frames),
        loop=0,
        quality=quality,
        method=6,
        minimize_size=True,
    )
    kb = dest.stat().st_size / 1024
    _log(f"wrote {dest} ({kb:.0f} KB, {frames[0].size[0]}x{frames[0].size[1]})")
    return dest


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Bake chibi Idle -> animated WebP")
    p.add_argument("--class", dest="klass", default="Ranger")
    p.add_argument("--fps", type=float, default=12.0)
    p.add_argument("--height", type=int, default=480)
    p.add_argument("--quality", type=int, default=82)
    args = p.parse_args(argv)

    if not EXTRACT.is_dir():
        print("missing game extract at", EXTRACT, file=sys.stderr)
        return 1

    out = bake_class(
        args.klass,
        fps=args.fps,
        max_h=args.height,
        quality=args.quality,
    )
    return 0 if out else 1


if __name__ == "__main__":
    raise SystemExit(main())

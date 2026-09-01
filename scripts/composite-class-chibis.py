"""Composite default chibi class sprites from game extract .tscn → assets/characters/."""

from __future__ import annotations

import math
import re
from collections import defaultdict
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
EXTRACT = ROOT / "tools" / "game-extract-full"
OUT = ROOT / "assets" / "characters"

CLASSES = [
    "Ranger",
    "Reaper",
    "Pyromancer",
    "Berserker",
    "Mage",
    "Adventurer",
    "Engineer",
]

# Homepage showcase wardrobe skins (Chibi folder name under Skins/Chibi/).
SKIN_BY_CLASS = {
    "Ranger": "Lucky",
    "Reaper": "Classy",
    "Pyromancer": "Sparkle",
    "Berserker": "Dragon",
    "Mage": "Sapphire",
    "Engineer": "Lab",
}

# Optional weapon texture swap after skin (paths relative to EXTRACT).
WEAPON_BY_CLASS = {
    "Reaper": {
        "node": "Body/Scythe/ScytheSprite",
        "texture": "Items/Sprites/StaffofUnhealing.png",
        # Classy poses ScytheSprite for a wide scythe; staff is tall/narrow.
        "position": (18.0, -40.0),
        "scale": (0.95, 0.95),
    },
}

IDENTITY = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0]


def parse_vector2(s: str) -> tuple[float, float]:
    m = re.search(r"Vector2\(\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*\)", s)
    if not m:
        return 0.0, 0.0
    return float(m.group(1)), float(m.group(2))


def parse_tscn(path: Path):
    text = path.read_text(encoding="utf-8", errors="replace")
    res: dict[int, Path] = {}
    for m in re.finditer(
        r'\[ext_resource path="([^"]+)" type="Texture" id=(\d+)\]', text
    ):
        rel = m.group(1).replace("res://", "")
        res[int(m.group(2))] = EXTRACT / rel

    nodes: dict[str, dict] = {}
    seq = 0
    for block in re.split(r"(?=\[node name=)", text):
        if not block.startswith("[node name="):
            continue
        header = block.split("\n", 1)[0]
        hm = re.match(
            r'\[node name="([^"]+)" type="([^"]+)"(?: parent="([^"]*)")?[^\]]*\]',
            header,
        )
        if not hm:
            continue
        name, ntype, parent = hm.group(1), hm.group(2), hm.group(3)
        full = _node_full_path(name, parent)
        idx_m = re.search(r'\bindex="?(\d+)"?', header)

        props = {
            "name": name,
            "type": ntype,
            "parent": parent,
            "path": full,
            "position": (0.0, 0.0),
            "rotation": 0.0,
            "scale": (1.0, 1.0),
            "offset": (0.0, 0.0),
            "z_index": 0,
            "texture_id": None,
            "show_behind_parent": False,
            "modulate": (1.0, 1.0, 1.0, 1.0),
            "visible": True,
            "flip_h": False,
            "seq": seq,
            "child_index": int(idx_m.group(1)) if idx_m else None,
            "points": None,
            "width": 1.0,
            "default_color": (1.0, 1.0, 1.0, 1.0),
        }
        seq += 1
        _apply_node_props(props, block)
        nodes[full] = props
    return res, nodes


def _node_full_path(name: str, parent: str | None) -> str:
    if parent in (None,):
        return "" if name == "Sprite" else name
    if parent == ".":
        return name
    return f"{parent}/{name}"


def _apply_node_props(props: dict, block: str) -> None:
    for line in block.splitlines()[1:]:
        line = line.strip()
        if line.startswith("position ="):
            props["position"] = parse_vector2(line)
        elif line.startswith("offset ="):
            props["offset"] = parse_vector2(line)
        elif line.startswith("scale ="):
            props["scale"] = parse_vector2(line)
        elif line.startswith("rotation ="):
            props["rotation"] = float(line.split("=", 1)[1].strip())
        elif line.startswith("z_index ="):
            props["z_index"] = int(float(line.split("=", 1)[1].strip()))
        elif line.startswith("texture = ExtResource("):
            props["texture_id"] = int(
                re.search(r"ExtResource\(\s*(\d+)\s*\)", line).group(1)
            )
        elif line.startswith("texture = null"):
            props["texture_id"] = None
        elif line.startswith("show_behind_parent = true"):
            props["show_behind_parent"] = True
        elif line.startswith("visible = false"):
            props["visible"] = False
        elif line.startswith("visible = true"):
            props["visible"] = True
        elif line.startswith("flip_h = true"):
            props["flip_h"] = True
        elif line.startswith("modulate = Color(") or line.startswith(
            "default_color = Color("
        ):
            nums = re.findall(r"[\d.]+", line)
            if len(nums) >= 4:
                key = "default_color" if line.startswith("default_color") else "modulate"
                props[key] = tuple(float(x) for x in nums[:4])
        elif line.startswith("width ="):
            props["width"] = float(line.split("=", 1)[1].strip())
        elif line.startswith("points = PoolVector2Array("):
            inner = line.split("(", 1)[1].rsplit(")", 1)[0]
            nums = [
                float(x)
                for x in re.findall(
                    r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?", inner
                )
            ]
            props["points"] = list(zip(nums[0::2], nums[1::2]))


def apply_skin(res: dict[int, Path], nodes: dict[str, dict], skin_tscn: Path) -> None:
    """Merge a wardrobe skin .tscn (instance overrides + new sprites) onto base nodes."""
    text = skin_tscn.read_text(encoding="utf-8", errors="replace")
    sid_map: dict[int, int] = {}
    next_id = max(res.keys(), default=0) + 1
    for m in re.finditer(
        r'\[ext_resource path="([^"]+)" type="Texture" id=(\d+)\]', text
    ):
        local_id = int(m.group(2))
        path = EXTRACT / m.group(1).replace("res://", "")
        sid_map[local_id] = next_id
        res[next_id] = path
        next_id += 1

    next_seq = max((n.get("seq", 0) for n in nodes.values()), default=0) + 1
    for block in re.split(r"(?=\[node name=)", text):
        if not block.startswith("[node name="):
            continue
        header = block.split("\n", 1)[0]
        hm = re.match(
            r'\[node name="([^"]+)"(?: type="([^"]+)")?(?: parent="([^"]*)")?[^\]]*\]',
            header,
        )
        if not hm:
            continue
        name, ntype, parent = hm.group(1), hm.group(2), hm.group(3)
        # Root instance line — skip
        if parent is None and "instance=ExtResource" in header:
            continue
        if parent is None:
            continue

        full = _node_full_path(name, parent)
        idx_m = re.search(r'\bindex="?(\d+)"?', header)
        child_index = int(idx_m.group(1)) if idx_m else None
        is_new = False
        if full in nodes:
            target = nodes[full]
        elif ntype == "Sprite":
            is_new = True
            target = {
                "name": name,
                "type": "Sprite",
                "parent": parent,
                "path": full,
                "position": (0.0, 0.0),
                "rotation": 0.0,
                "scale": (1.0, 1.0),
                "offset": (0.0, 0.0),
                "z_index": 0,
                "texture_id": None,
                "show_behind_parent": False,
                "modulate": (1.0, 1.0, 1.0, 1.0),
                "visible": True,
                "flip_h": False,
                "seq": float(next_seq),
                "child_index": child_index,
                "points": None,
                "width": 1.0,
                "default_color": (1.0, 1.0, 1.0, 1.0),
            }
            next_seq += 1
            nodes[full] = target
        else:
            # Override on a node we don't model (AnimationPlayer, etc.)
            continue

        changed_tex = bool(re.search(r"^\s*texture\s*=", block, re.M))
        _apply_node_props(target, block)
        # Remap skin-local ExtResource ids → global res ids (only when skin set texture)
        if changed_tex and target.get("texture_id") is not None:
            local = target["texture_id"]
            if local in sid_map:
                target["texture_id"] = sid_map[local]
            elif local not in res:
                target["texture_id"] = None

        # New skin sprites: honor Godot sibling index= among existing children
        if is_new and child_index is not None:
            sibs = sorted(
                (
                    n
                    for n in nodes.values()
                    if n is not target
                    and (
                        (n["parent"] == parent)
                        or (
                            parent in (None, ".")
                            and n["parent"] in (None, ".")
                        )
                    )
                ),
                key=lambda n: n.get("seq", 0),
            )
            if not sibs:
                pass
            elif child_index <= 0:
                target["seq"] = float(sibs[0].get("seq", 0)) - 1.0
            elif child_index >= len(sibs):
                target["seq"] = float(sibs[-1].get("seq", 0)) + 1.0
            else:
                lo = float(sibs[child_index - 1].get("seq", 0))
                hi = float(sibs[child_index].get("seq", 0))
                target["seq"] = (lo + hi) / 2.0


def mat_mul(a, b):
    return [
        a[0] * b[0] + a[1] * b[3],
        a[0] * b[1] + a[1] * b[4],
        a[0] * b[2] + a[1] * b[5] + a[2],
        a[3] * b[0] + a[4] * b[3],
        a[3] * b[1] + a[4] * b[4],
        a[3] * b[2] + a[4] * b[5] + a[5],
    ]


def mat_from_trs(pos, rot, scale):
    c, s = math.cos(rot), math.sin(rot)
    sx, sy = scale
    return [c * sx, -s * sy, pos[0], s * sx, c * sy, pos[1]]


def world_mat(nodes, path: str):
    if path == "" or path not in nodes:
        return IDENTITY[:]
    chain = []
    cur: str | None = path
    while cur is not None and cur != "":
        n = nodes[cur]
        chain.append(n)
        parent = n["parent"]
        if parent in (None, "."):
            cur = ""
        else:
            cur = parent
    m = IDENTITY[:]
    for n in reversed(chain):
        m = mat_mul(m, mat_from_trs(n["position"], n["rotation"], n["scale"]))
    return m


def apply(m, x, y):
    return m[0] * x + m[1] * y + m[2], m[3] * x + m[4] * y + m[5]


def load_part(im: Image.Image) -> Image.Image:
    """Chibi extract parts already ship with real alpha — do not chroma-key black.

    An older knock_black() pass ate legitimate dark clothing/outlines on
    Berserker / Ranger / Reaper / Pyromancer.
    """
    return im.convert("RGBA")


# Kept for bake-chibi-idle.py and any older callers.
knock_black = load_part


def absolute_z(nodes: dict[str, dict], path: str) -> float:
    """Godot z_as_relative: sum z_index from root → node (inclusive)."""
    z = 0.0
    cur: str | None = path
    while cur:
        if cur not in nodes:
            break
        z += float(nodes[cur].get("z_index", 0))
        p = nodes[cur]["parent"]
        cur = "" if p in (None, ".") else p
    return z


def accumulate_z(nodes, path: str, base_z: int, behind: bool) -> float:
    """Legacy helper for bake-chibi-idle.py."""
    z = float(base_z)
    cur = path
    while cur and cur in nodes:
        z += float(nodes[cur].get("z_index", 0))
        p = nodes[cur]["parent"]
        cur = "" if p in (None, ".") else p
    if behind:
        z -= 0.5
    return z


def _ancestor_hidden(nodes: dict[str, dict], path: str) -> bool:
    cur: str | None = path
    while cur:
        if cur in nodes and not nodes[cur].get("visible", True):
            return True
        p = nodes[cur]["parent"] if cur in nodes else None
        cur = "" if p in (None, ".") else p
    return False


def finalize_tree_order(nodes: dict[str, dict]) -> None:
    """Assign stable sibling order from scene/file sequence."""
    by_parent: dict[str, list[dict]] = defaultdict(list)
    for n in nodes.values():
        parent = n["parent"]
        key = "" if parent in (None, ".") else str(parent)
        by_parent[key].append(n)
    for kids in by_parent.values():
        kids.sort(key=lambda n: float(n.get("seq", 0)))
        for i, n in enumerate(kids):
            n["tree_order"] = i


def draw_sort_key(nodes: dict[str, dict], n: dict) -> tuple:
    """Match Godot CanvasItem order: absolute z, then tree order.

    show_behind_parent draws just before the parent’s own absolute z.
    """
    path = n["path"]
    z = absolute_z(nodes, path)
    if n.get("show_behind_parent"):
        parent = n["parent"]
        if parent not in (None, "."):
            z = absolute_z(nodes, parent) - 0.5
    # Path of tree-order indices from root → node for a total order
    order: list[int] = []
    cur: str | None = path
    while cur:
        if cur not in nodes:
            break
        order.append(int(nodes[cur].get("tree_order", nodes[cur].get("seq", 0))))
        p = nodes[cur]["parent"]
        cur = "" if p in (None, ".") else p
    order.reverse()
    return (z, *order)


def iter_drawable_nodes(nodes: dict[str, dict], res: dict[int, Path]):
    """Yield drawable Sprite / Line2D nodes in paint order."""
    finalize_tree_order(nodes)
    items = []
    for n in nodes.values():
        if not n.get("visible", True) or n["name"] == "Shadow":
            continue
        if _ancestor_hidden(nodes, n["path"]):
            continue
        if n["type"] == "Sprite":
            if n["texture_id"] is None:
                continue
            tex_path = res.get(n["texture_id"])
            if not tex_path or not tex_path.exists():
                print(" missing tex", n["name"], tex_path)
                continue
            items.append(n)
        # Line2D (e.g. Ranger bowstring) needs textured ribbon drawing;
        # solid PIL strokes look wrong — skip for now.
    items.sort(key=lambda n: draw_sort_key(nodes, n))
    for n in items:
        parent = n["parent"]
        parent_path = "" if parent in (None, ".") else parent
        m = world_mat(nodes, parent_path)
        m = mat_mul(m, mat_from_trs(n["position"], n["rotation"], n["scale"]))
        yield n, m


def blit_sprite(canvas, n, tex_path: Path, m, cx: int, cy: int) -> None:
    im = load_part(Image.open(tex_path))
    if n.get("flip_h"):
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    ox, oy = n["offset"]
    tw, th = im.size
    corners = [
        (-tw / 2 + ox, -th / 2 + oy),
        (tw / 2 + ox, -th / 2 + oy),
        (tw / 2 + ox, th / 2 + oy),
        (-tw / 2 + ox, th / 2 + oy),
    ]
    world_corners = [apply(m, x, y) for x, y in corners]
    xs = [p[0] for p in world_corners]
    ys = [p[1] for p in world_corners]
    minx, maxx = min(xs), max(xs)
    miny, maxy = min(ys), max(ys)
    dw = max(1, int(math.ceil(maxx - minx)))
    dh = max(1, int(math.ceil(maxy - miny)))
    a, b, c, d, e, f = m
    det = a * e - b * d
    if abs(det) < 1e-8:
        return
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
    w, h = canvas.size
    px = int(round(cx + minx))
    py = int(round(cy + miny))
    if px < w and py < h and px + dw > 0 and py + dh > 0:
        canvas.alpha_composite(piece, (max(0, px), max(0, py)))


def blit_line2d(canvas, n, m, cx: int, cy: int) -> None:
    pts = n.get("points") or []
    if len(pts) < 2:
        return
    world = [apply(m, x, y) for x, y in pts]
    screen = [(cx + x, cy + y) for x, y in world]
    col = n.get("default_color") or (1.0, 1.0, 1.0, 1.0)
    fill = (
        int(max(0, min(255, col[0] * 255))),
        int(max(0, min(255, col[1] * 255))),
        int(max(0, min(255, col[2] * 255))),
        int(max(0, min(255, col[3] * 255))),
    )
    width = max(1, int(round(float(n.get("width") or 1.0))))
    # Draw on a temp layer so alpha blends cleanly
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.line(screen, fill=fill, width=width, joint="curve")
    canvas.alpha_composite(layer)


def composite(class_name: str, skin: str | None = None) -> Path | None:
    tscn = EXTRACT / "CharacterClasses" / class_name / f"{class_name}ChibiSprite.tscn"
    if not tscn.exists():
        print("missing", tscn)
        return None
    res, nodes = parse_tscn(tscn)
    skin_name = skin if skin is not None else SKIN_BY_CLASS.get(class_name)
    if skin_name and skin_name != "Default":
        skin_tscn = (
            EXTRACT
            / "CharacterClasses"
            / class_name
            / "Skins"
            / "Chibi"
            / skin_name
            / f"{skin_name}.tscn"
        )
        if skin_tscn.exists():
            apply_skin(res, nodes, skin_tscn)
            print(f"  skin {skin_name}")
        else:
            print(f"  missing skin {skin_tscn}")

    weapon = WEAPON_BY_CLASS.get(class_name)
    if weapon:
        node_path = weapon["node"]
        tex = EXTRACT / weapon["texture"]
        if node_path in nodes and tex.exists():
            wid = max(res.keys(), default=0) + 1
            res[wid] = tex
            nodes[node_path]["texture_id"] = wid
            if "position" in weapon:
                nodes[node_path]["position"] = weapon["position"]
            if "scale" in weapon:
                nodes[node_path]["scale"] = weapon["scale"]
            if "rotation" in weapon:
                nodes[node_path]["rotation"] = weapon["rotation"]
            print(f"  weapon {tex.name}")
        else:
            print(f"  missing weapon override {node_path} / {tex}")

    w = h = 1800
    cx, cy = w // 2, h // 2 + 160
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))

    for n, m in iter_drawable_nodes(nodes, res):
        if n["type"] == "Line2D":
            blit_line2d(canvas, n, m, cx, cy)
            continue
        tex_path = res.get(n["texture_id"])
        if tex_path:
            blit_sprite(canvas, n, tex_path, m, cx, cy)

    bbox = canvas.getbbox()
    if not bbox:
        print("empty", class_name)
        return None
    cropped = canvas.crop(bbox)
    pad = 10
    out = Image.new("RGBA", (cropped.width + pad * 2, cropped.height + pad * 2), (0, 0, 0, 0))
    out.paste(cropped, (pad, pad))
    max_h = 900
    if out.height > max_h:
        ratio = max_h / out.height
        out = out.resize((max(1, int(out.width * ratio)), max_h), Image.LANCZOS)
    dest = OUT / f"char-{class_name.lower()}.png"
    out.save(dest, optimize=True)
    print("wrote", dest.name, out.size)
    return dest


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    adv = (
        EXTRACT
        / "CharacterClasses"
        / "Adventurer"
        / "Skins"
        / "Chibi"
        / "Adventurer_Chibi.png"
    )
    if adv.exists():
        im = Image.open(adv).convert("RGBA")
        max_h = 900
        if im.height > max_h:
            ratio = max_h / im.height
            im = im.resize((max(1, int(im.width * ratio)), max_h), Image.LANCZOS)
        im.save(OUT / "char-adventurer.png", optimize=True)
        print("copied char-adventurer.png", im.size)

    for c in CLASSES:
        if c == "Adventurer":
            continue
        composite(c)


if __name__ == "__main__":
    main()

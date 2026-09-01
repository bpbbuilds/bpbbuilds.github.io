"""Inventory Guildrun item/relic Texture2D names (demo install)."""
from pathlib import Path
from collections import defaultdict
import UnityPy

ROOT = Path(r"C:\Program Files (x86)\Steam\steamapps\common\Guildrun Demo\Guildrun_Data")
OUT = Path(r"d:\SMOJO\Online\Buisness\BPBWebsite\scripts\_guildrun_tex_names.txt")

files = sorted(ROOT.glob("*.assets"))
# Skip huge companion .resS loads by only opening .assets that likely hold UI
priority = [
    "sharedassets1.assets",
    "sharedassets3.assets",
    "resources.assets",
    "sharedassets8.assets",
    "sharedassets7.assets",
    "sharedassets2.assets",
]

by_file = defaultdict(list)
for name in priority:
    path = ROOT / name
    if not path.exists():
        continue
    print(f"Load {name}...")
    env = UnityPy.load(str(path))
    for obj in env.objects:
        if obj.type.name != "Texture2D":
            continue
        try:
            data = obj.read()
            n = getattr(data, "m_Name", None) or getattr(data, "name", "") or ""
        except Exception:
            continue
        low = n.lower()
        if any(k in low for k in ("item", "relic", "iconatlas", "ui_item")):
            by_file[name].append(
                f"{n}\t{getattr(data, 'm_Width', '?')}x{getattr(data, 'm_Height', '?')}"
            )

lines = []
for name, rows in by_file.items():
    rows = sorted(set(rows), key=str.lower)
    lines.append(f"# {name} ({len(rows)})")
    lines.extend(rows)
    lines.append("")
    print(f"  {name}: {len(rows)} textures")

OUT.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {OUT}")

"""Deeper Guildrun probe: Sprite names + Texture2D Relic_/Item_ patterns."""
from pathlib import Path
from collections import Counter
import UnityPy
import re

ROOT = Path(r"C:\Program Files (x86)\Steam\steamapps\common\Guildrun Demo\Guildrun_Data")
path = ROOT / "sharedassets1.assets"
print(f"Loading {path}...")
env = UnityPy.load(str(path))

tex_names = []
sprite_names = []
for obj in env.objects:
    t = obj.type.name
    if t not in ("Texture2D", "Sprite"):
        continue
    try:
        data = obj.read()
        n = getattr(data, "m_Name", None) or getattr(data, "name", "") or ""
    except Exception:
        continue
    if t == "Texture2D":
        tex_names.append(n)
    else:
        sprite_names.append(n)

print(f"Texture2D={len(tex_names)} Sprite={len(sprite_names)}")

# patterns
for label, names in (("Texture2D", tex_names), ("Sprite", sprite_names)):
    relic = [n for n in names if re.search(r"relic", n, re.I)]
    item = [n for n in names if re.search(r"item", n, re.I)]
    print(f"\n{label} relic-ish={len(relic)} item-ish={len(item)}")
    print(" sample relics:", sorted(relic, key=str.lower)[:20])
    print(" sample items:", sorted(item, key=str.lower)[:20])

# top prefixes
def prefixes(names, n=20):
    c = Counter()
    for name in names:
        part = name.split("_")[0].split(" ")[0].lower()
        c[part] += 1
    return c.most_common(n)

print("\nTexture2D prefixes:", prefixes(tex_names))
print("Sprite prefixes:", prefixes(sprite_names))

# dump all sprite names matching relic/item to file
out = Path(r"d:\SMOJO\Online\Buisness\BPBWebsite\scripts\_guildrun_sprites.txt")
rows = sorted({n for n in sprite_names if re.search(r"relic|item", n, re.I)}, key=str.lower)
out.write_text("\n".join(rows), encoding="utf-8")
print(f"Wrote {len(rows)} sprite names -> {out}")

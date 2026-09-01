from pathlib import Path
import UnityPy

root = Path(r"C:\Program Files (x86)\Steam\steamapps\common\Guildrun Demo\Guildrun_Data")
candidates = [
    "resources.assets",
    "sharedassets3.assets",
    "sharedassets1.assets",
    "sharedassets20.assets",
    "sharedassets0.assets",
    "globalgamemanagers.assets",
]
keywords = ("item", "relic", "icon", "ui_", "equip", "artifact")

for name in candidates:
    path = root / name
    if not path.exists():
        continue
    print(f"Scanning {name} ({path.stat().st_size / 1e6:.1f} MB)...")
    env = UnityPy.load(str(path))
    hits = []
    tex = 0
    for obj in env.objects:
        if obj.type.name != "Texture2D":
            continue
        tex += 1
        try:
            data = obj.read()
            n = (getattr(data, "m_Name", None) or getattr(data, "name", "") or "").lower()
        except Exception:
            continue
        if any(k in n for k in keywords):
            hits.append(
                (
                    n,
                    getattr(data, "m_Width", "?"),
                    getattr(data, "m_Height", "?"),
                )
            )
    print(f"  Texture2D={tex}, keyword hits={len(hits)}")
    for h in hits[:25]:
        print("   ", h)
    if hits:
        # keep scanning a couple files for coverage
        pass

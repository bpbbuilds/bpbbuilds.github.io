"""Extract Guildrun Item_* and Relic_* sprites into the channel assets folder.

Skips files that already exist. Source: Steam Guildrun Demo sharedassets1.assets.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import UnityPy

GAME_ASSETS = Path(
    r"C:\Program Files (x86)\Steam\steamapps\common\Guildrun Demo\Guildrun_Data\sharedassets1.assets"
)
DEFAULT_OUT = Path(
    r"D:\SMOJO\Online\Socials\Youtube\Smojo Main\Videos\Channel\assets\guildrun\extracted"
)


def main() -> int:
    out_root = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_OUT
    items_dir = out_root / "items"
    relics_dir = out_root / "relics"
    items_dir.mkdir(parents=True, exist_ok=True)
    relics_dir.mkdir(parents=True, exist_ok=True)

    if not GAME_ASSETS.exists():
        print(f"Missing game assets: {GAME_ASSETS}")
        return 1

    print(f"Loading {GAME_ASSETS}...")
    env = UnityPy.load(str(GAME_ASSETS))

    saved_i = skipped_i = fail_i = 0
    saved_r = skipped_r = fail_r = 0

    for obj in env.objects:
        if obj.type.name != "Sprite":
            continue
        try:
            data = obj.read()
            name = getattr(data, "m_Name", None) or getattr(data, "name", "") or ""
        except Exception:
            continue

        if re.fullmatch(r"Item_\d+", name, re.I):
            dest = items_dir / f"{name}.png"
            bucket = "item"
        elif re.fullmatch(r"Relic_\d+", name, re.I):
            dest = relics_dir / f"{name}.png"
            bucket = "relic"
        else:
            continue

        if dest.exists() and dest.stat().st_size > 0:
            if bucket == "item":
                skipped_i += 1
            else:
                skipped_r += 1
            continue

        try:
            img = data.image
            if img is None:
                raise RuntimeError("no image")
            img.save(dest)
        except Exception as e:
            print(f"fail {name}: {e}")
            if bucket == "item":
                fail_i += 1
            else:
                fail_r += 1
            continue

        if bucket == "item":
            saved_i += 1
        else:
            saved_r += 1

    print(
        f"items: saved={saved_i} skipped={skipped_i} fail={fail_i} -> {items_dir}\n"
        f"relics: saved={saved_r} skipped={skipped_r} fail={fail_r} -> {relics_dir}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

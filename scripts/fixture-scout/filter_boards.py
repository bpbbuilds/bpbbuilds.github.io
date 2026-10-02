#!/usr/bin/env python3
"""Keep scraped images that look like BPB boards (bag detector hits) and write the inbox manifest.

  python scripts/fixture-scout/filter_boards.py
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[2]
INBOX = ROOT / "fixtures" / "inbox"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--model",
        default=str(ROOT / "assets/ml/screenshot-detector/bags-v1b/screenshot-detector-bags.onnx"),
    )
    ap.add_argument("--min-bags", type=int, default=2)
    ap.add_argument("--conf", type=float, default=0.45)
    args = ap.parse_args()

    posts = {e["file"]: e for e in json.loads((INBOX / "posts.json").read_text("utf8"))}
    manifest_path = INBOX / "manifest.json"
    cached = {}
    if manifest_path.is_file():
        for e in json.loads(manifest_path.read_text("utf8")).get("all", []):
            cached[e["file"]] = e

    model = YOLO(args.model, task="detect")
    rows = []
    files = sorted((INBOX / "raw").iterdir())
    for i, f in enumerate(files):
        if f.name in cached:
            rows.append(cached[f.name])
            continue
        try:
            with Image.open(f) as im:
                w, h = im.size
            res = model.predict(str(f), imgsz=640, conf=args.conf, device="cpu", verbose=False)[0]
            bags = int(len(res.boxes))
        except Exception as err:  # corrupt / unsupported image
            print(f"skip {f.name}: {err}")
            continue
        meta = posts.get(f.name, {})
        rows.append(
            {
                "file": f.name,
                "shot": f"/fixtures/inbox/raw/{f.name}",
                "w": w,
                "h": h,
                "bags": bags,
                "title": meta.get("title", ""),
                "permalink": meta.get("permalink", ""),
                "author": meta.get("author", ""),
                "created": meta.get("created", 0),
            }
        )
        if (i + 1) % 100 == 0:
            print(f"{i + 1}/{len(files)}")

    keep = [r for r in rows if r["bags"] >= args.min_bags]
    keep.sort(key=lambda r: (-r["bags"], -r["created"]))
    manifest_path.write_text(
        json.dumps({"count": len(keep), "scanned": len(rows), "items": keep, "all": rows}, indent=1),
        "utf8",
    )
    print(f"kept {len(keep)}/{len(rows)} -> {manifest_path}")


if __name__ == "__main__":
    main()

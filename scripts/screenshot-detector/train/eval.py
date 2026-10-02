#!/usr/bin/env python3
"""Quick eval / predict smoke on images folder.

  python scripts/screenshot-detector/train/eval.py --weights ... --source path/to.jpg
"""
from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--weights",
        default="scripts/_cache/synth-detector/runs/detect/weights/best.pt",
    )
    ap.add_argument("--source", default="")
    ap.add_argument("--data", default="scripts/_cache/synth-detector/data.yaml")
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--conf", type=float, default=0.15)
    args = ap.parse_args()

    weights = Path(args.weights)
    if not weights.is_file():
        raise SystemExit(f"missing weights: {weights}")

    model = YOLO(str(weights))
    if args.source:
        results = model.predict(
            source=args.source, imgsz=args.imgsz, conf=args.conf, verbose=False
        )
        for r in results:
            names = r.names or {}
            if r.boxes is None:
                print("detections=0")
                continue
            labels = []
            for b in r.boxes:
                cls = int(b.cls.item())
                conf = float(b.conf.item())
                labels.append(f"{names.get(cls, cls)}:{conf:.2f}")
            print(f"detections={len(labels)} {', '.join(labels[:20])}")
    else:
        metrics = model.val(data=args.data, imgsz=args.imgsz, verbose=False)
        print(metrics)


if __name__ == "__main__":
    main()

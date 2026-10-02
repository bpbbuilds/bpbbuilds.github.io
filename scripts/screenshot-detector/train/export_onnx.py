#!/usr/bin/env python3
"""Export trained YOLO weights to ONNX for onnxruntime-web.

  python scripts/screenshot-detector/train/export_onnx.py --weights scripts/_cache/synth-detector/runs/detect/weights/best.pt
"""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from ultralytics import YOLO


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--weights",
        default="scripts/_cache/synth-detector/runs/detect/weights/best.pt",
    )
    ap.add_argument(
        "--out",
        default="scripts/_cache/synth-detector/screenshot-detector.onnx",
    )
    ap.add_argument("--imgsz", type=int, default=640)
    args = ap.parse_args()

    weights = Path(args.weights)
    if not weights.is_file():
        raise SystemExit(f"missing weights: {weights}")

    model = YOLO(str(weights))
    exported = model.export(
        format="onnx",
        imgsz=args.imgsz,
        simplify=True,
        dynamic=False,
        opset=12,
    )
    src = Path(str(exported))
    dst = Path(args.out)
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    print(f"wrote {dst} ({dst.stat().st_size} bytes)")


if __name__ == "__main__":
    main()

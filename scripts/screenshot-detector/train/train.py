#!/usr/bin/env python3
"""Train YOLOv8n on synth detector dataset.

  python scripts/screenshot-detector/train/train.py --data scripts/_cache/synth-detector/data.yaml
"""
from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--data",
        default="scripts/_cache/synth-detector/data.yaml",
        help="path to data.yaml",
    )
    ap.add_argument("--epochs", type=int, default=80)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--lr0", type=float, default=None)
    ap.add_argument("--lrf", type=float, default=None)
    ap.add_argument(
        "--patience",
        type=int,
        default=20,
        help="epochs without improvement before stop; 0 keeps going",
    )
    ap.add_argument("--model", default="yolov8n.pt")
    ap.add_argument(
        "--project",
        default="scripts/_cache/synth-detector/runs",
    )
    ap.add_argument("--name", default="detect")
    ap.add_argument("--device", default="")
    ap.add_argument(
        "--resume",
        action="store_true",
        help="Resume from runs/.../weights/last.pt",
    )
    args = ap.parse_args()

    data = Path(args.data).resolve()
    if not data.is_file():
        raise SystemExit(f"missing data.yaml: {data}")

    last = Path(args.project) / args.name / "weights" / "last.pt"
    if args.resume:
        if not last.is_file():
            raise SystemExit(f"missing checkpoint to resume: {last}")
        model = YOLO(str(last))
        resume_kwargs = dict(resume=True, workers=args.workers, data=str(data))
        results = model.train(**resume_kwargs)
        best = last.parent / "best.pt"
        print(f"best={best} exists={best.is_file()}")
        return results

    model = YOLO(args.model)
    kwargs = dict(
        data=str(data),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        project=str(Path(args.project).resolve()),
        name=args.name,
        exist_ok=True,
        patience=args.patience,
        mosaic=1.0,
        degrees=3.0,
        close_mosaic=10,
        workers=args.workers,
    )
    if args.device:
        kwargs["device"] = args.device
    if args.lr0 is not None:
        kwargs["lr0"] = args.lr0
    if args.lrf is not None:
        kwargs["lrf"] = args.lrf
    results = model.train(**kwargs)
    best = Path(args.project) / args.name / "weights" / "best.pt"
    print(f"best={best} exists={best.is_file()}")
    return results


if __name__ == "__main__":
    main()

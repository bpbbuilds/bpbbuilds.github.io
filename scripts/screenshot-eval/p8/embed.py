"""Offline DINOv2 ViT-S/14 retrieval. No BPB training. Does not touch the site.

Ranks every truth crop against catalog thumbs (four rotations).
Reads raw crops plus normalized folders beside them.

    python scripts/screenshot-eval/p8/embed.py
"""
import json
import time
from pathlib import Path

import torch
from PIL import Image
from torchvision import transforms

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "scripts/_cache/screenshot-eval/baselines/2026-10-01-p8"
MANIFEST = json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))
POOL = json.loads((OUT / "pool.json").read_text(encoding="utf-8"))

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MODEL = torch.hub.load("facebookresearch/dinov2", "dinov2_vits14")
MODEL.eval().to(DEVICE)

TX = transforms.Compose([
    transforms.Resize((224, 224), interpolation=transforms.InterpolationMode.BICUBIC),
    transforms.ToTensor(),
    transforms.Normalize((0.485, 0.456, 0.406), (0.229, 0.224, 0.225)),
])

# Leather-like flat ground so the sprite is not embedded on transparency.
BG = (122, 96, 72)


def embed_batch(images):
    if not images:
        return torch.empty(0, 384)
    batch = torch.stack([TX(im.convert("RGB")) for im in images]).to(DEVICE)
    with torch.inference_mode():
        feat = MODEL(batch)
    feat = torch.nn.functional.normalize(feat, dim=1)
    return feat.cpu()


def sprite_canvas(image, rot):
    im = image.convert("RGBA").rotate(rot, expand=True, resample=Image.BICUBIC)
    canvas = Image.new("RGB", (224, 224), BG)
    scale = 160 / max(im.size)
    resized = im.resize((max(1, int(im.size[0] * scale)), max(1, int(im.size[1] * scale))), Image.BICUBIC)
    x = (224 - resized.size[0]) // 2
    y = (224 - resized.size[1]) // 2
    canvas.paste(resized, (x, y), resized)
    return canvas


print("encoding sprites", len(POOL), DEVICE)
sprite_feats = []  # list of (pool index, rot, tensor)
chunk = []
meta = []
for item in POOL:
    path = ROOT / "assets/item-thumbs/2x" / f"{item['image']}.webp"
    if not path.exists():
        continue
    src = Image.open(path)
    # Oblong is not in pool.json; encode all four rotations and keep the best per class.
    for rot in (0, 90, 180, 270):
        chunk.append(sprite_canvas(src, rot))
        meta.append((item["pool"], rot, item["id"]))
        if len(chunk) == 32:
            feats = embed_batch(chunk)
            sprite_feats.append((meta, feats))
            chunk, meta = [], []
if chunk:
    sprite_feats.append((meta, embed_batch(chunk)))

rows_meta = []
flat = []
for meta, feats in sprite_feats:
    for i, (pool_i, rot, cid) in enumerate(meta):
        rows_meta.append((pool_i, rot, cid))
        flat.append(feats[i])
sprite = torch.stack(flat)
print("sprite vectors", tuple(sprite.shape))


def rank_queries(paths):
    images = []
    keep = []
    for p in paths:
        if p is None or not Path(p).exists():
            images.append(None)
            continue
        images.append(Image.open(p).convert("RGB"))
        keep.append(len(images) - 1)
    out = [None] * len(paths)
    batch_i = []
    batch_at = []
    def flush():
        if not batch_i:
            return
        feats = embed_batch(batch_i)
        sims = feats @ sprite.T
        for row, sim in zip(batch_at, sims):
            order = torch.argsort(sim, descending=True).tolist()
            best = {}
            ranked = []
            for j in order:
                pool_i, rot, cid = rows_meta[j]
                score = float(sim[j])
                if pool_i not in best:
                    best[pool_i] = (score, rot, cid)
                    ranked.append(pool_i)
            out[row] = ranked
        batch_i.clear()
        batch_at.clear()
    for i, im in enumerate(images):
        if im is None:
            continue
        batch_i.append(im)
        batch_at.append(i)
        if len(batch_i) == 32:
            flush()
    flush()
    return out


def main():
    t0 = time.time()
    variants = {"raw": OUT / "crops"}
    norm_root = OUT / "norm"
    if norm_root.exists():
        for d in sorted(norm_root.iterdir()):
            if d.is_dir():
                variants[d.name] = d
    report = {"encoder": "dinov2_vits14", "device": DEVICE, "pool": len(POOL), "variants": {}}
    all_orders = {}
    for name, root in variants.items():
        orders = []
        per_fix = []
        for fix in MANIFEST["fixtures"]:
            if not fix.get("gridOk"):
                continue
            paths = []
            for inst in fix["instances"]:
                if name == "raw":
                    paths.append(OUT / inst["match"] if inst.get("match") else None)
                else:
                    paths.append(root / fix["fixture"] / f"{inst['i']}.png" if inst.get("match") else None)
            ranked = rank_queries(paths)
            for inst, order in zip(fix["instances"], ranked):
                rec = {
                    "fixture": fix["fixture"], "i": inst["i"], "kind": inst.get("kind"),
                    "name": inst.get("name"), "area": inst.get("area"), "largeShot": fix.get("largeShot"),
                    "truthId": inst.get("truthId"),
                }
                if order is None or not inst.get("truthId"):
                    rec["rank"] = 0
                else:
                    ids = [POOL[i]["id"] for i in order]
                    rec["rank"] = ids.index(inst["truthId"]) + 1 if inst["truthId"] in ids else 0
                    rec["top5"] = [POOL[i]["name"] for i in order[:5]]
                    rec["order"] = order
                orders.append(rec)
            per_fix.append(fix["fixture"])
        all_orders[name] = orders
        report["variants"][name] = {"fixtures": per_fix, "n": len(orders)}
        print(name, "queries", len(orders))
    (OUT / "embed-orders.json").write_text(json.dumps(all_orders), encoding="utf-8")
    report["elapsedSec"] = round(time.time() - t0, 1)
    (OUT / "embed-meta.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("elapsed", report["elapsedSec"])


if __name__ == "__main__":
    main()

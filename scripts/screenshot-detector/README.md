# Screenshot detector scripts

See [`docs/features/screenshot-detector.md`](../../docs/features/screenshot-detector.md).

```bash
# Synth (needs .env DB)
node scripts/screenshot-detector/gen-synth.mjs --count 20000

# Bag-only synth (dense/occluded, unique bag IDs)
node scripts/screenshot-detector/gen-synth-bags.mjs --count 12000 --out scripts/_cache/synth-detector-bags

# Train + export (Python)
pip install -r scripts/screenshot-detector/train/requirements.txt
python scripts/screenshot-detector/train/train.py --epochs 80 --device 0
python scripts/screenshot-detector/train/export_onnx.py

# Bag train
python scripts/screenshot-detector/train/train.py --data scripts/_cache/synth-detector-bags/data.yaml --epochs 80 --device 0 --project scripts/_cache/synth-detector-bags/runs --name detect
python scripts/screenshot-detector/train/export_onnx.py --weights scripts/_cache/synth-detector-bags/runs/detect/weights/best.pt --out scripts/_cache/synth-detector-bags/screenshot-detector-bags.onnx
node scripts/screenshot-detector/publish-bag-model.mjs --local --version bags-v1

# Publish (create public Storage bucket `ml` first) or local assets copy
node scripts/screenshot-detector/publish-model.mjs --version v1

# Smoke
node scripts/screenshot-detector/detect-smoke.mjs path/to/shot.png
```

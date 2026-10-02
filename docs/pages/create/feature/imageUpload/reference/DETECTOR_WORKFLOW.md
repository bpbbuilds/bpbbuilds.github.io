# Detector and evaluator reference

The preserved implementation uses a browser ONNX item detector plus a dedicated bag detector. The public v1 item model has 426 classes. The preserved bag model is `bags-v1b` with 27 bag classes.

Relevant commands remain under `scripts/screenshot-detector/` and `scripts/screenshot-eval/`. Training, model publication, manifest writes, and benchmark-truth edits are intentionally out of scope while the feature is paused.

## Preserved command reference

Generate item synth data:

```text
node scripts/screenshot-detector/gen-synth.mjs --count 20000 --out scripts/_cache/synth-detector
```

Generate bag-only synth data:

```text
node scripts/screenshot-detector/gen-synth-bags.mjs --count 12000 --out scripts/_cache/synth-detector-bags
```

The previous item-training path used `train/train.py`, then `train/export_onnx.py`; bag training used the same scripts and `publish-bag-model.mjs`. The item model publication path is `publish-model.mjs`. Treat all of these as explicit, reviewed operations: do not run them merely to reactivate the UI.

The evaluator command is:

```text
node scripts/screenshot-eval/run.mjs [fixture ...]
```

It drives the preserved dev harness and writes cache outputs under `scripts/_cache/screenshot-eval/`. The launch gate makes the harness redirect until temporarily enabled for research.

When resuming, inspect the current script help and the matching cache baseline before running anything. In particular:

- ship a model and class list together;
- never retrain `bags-v1b` without explicit approval;
- restore detector manifests with byte-preserving copy operations;
- never mix `mix-item-real` into an already mixed v5 train folder;
- run the fixed held-out corpus before considering publication.

# Resume guide

1. Read this folder, especially [KNOWN_FAILURES.md](KNOWN_FAILURES.md) and [experiments/README.md](experiments/README.md). Do not restart training by default.
2. Work in an explicit research branch. Keep the launch flag off while running file-level or evaluator experiments.
3. If a browser test is required, temporarily set `SCREENSHOT_IMPORT_ENABLED` to `true` in `js/shared/feature-flags.js`. Enable the Edge Function environment flag only when testing `?vision=edge`.
4. Run the fixed evaluator and record per-fixture outputs under a new `scripts/_cache/screenshot-eval/baselines/<date>-pNN/` folder. Do not modify truth.
5. Preserve P19's real-007 result and test controls before interpreting an aggregate improvement.
6. Do not retrain `bags-v1b`, publish weights, change the live manifest, or build a new solver unless explicitly authorized and supported by the fixed benchmark.
7. Before a public relaunch, remove the temporary research gate only after manual Create, history import, direct route, backend behavior, and the relevant benchmark gate all pass.

## Most justified next research step

Validate the deterministic mirrored-combat-HUD plus bag-component region proposal on more unlabeled combat screenshots. It is smaller and better supported than training a segmentation model or forcing a new real-003 grid.

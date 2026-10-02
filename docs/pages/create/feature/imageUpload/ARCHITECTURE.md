# Architecture

## Preserved pipeline

`board-import` receives an image -> `screenshot-apply` reads it -> preprocessing finds a leather seam grid and crop -> browser ONNX item and bag detectors run -> direct placement / NCC pose repair / bag reconstruction -> optional solver, paint refinement, and gap fill -> placements replace the draft after confirmation.

The legacy `?vision=edge` branch posts an in-memory data URL to `supabase/functions/screenshot-to-build`; it never stores the image.

## Primary paths

| Concern | Path |
|---|---|
| Launch flag | `js/shared/feature-flags.js` |
| Create integration | `js/pages/create/board-import.js`, `board-editor.js`, `board-onboard.js` |
| Import orchestration | `js/pages/create/screenshot-apply.js` |
| Grid / detector | `js/shared/screenshot-grid.js`, `js/shared/screenshot-detector.js` |
| Placement and retrieval | `js/pages/create/screenshot-direct.js`, `screenshot-topk.js`, `screenshot-solver.js`, `screenshot-refine.js` |
| Dev route | `dev/screenshot-import/`, `js/pages/dev-screenshot-import/` |
| Legacy endpoint | `supabase/functions/screenshot-to-build/` |
| Training / eval | `scripts/screenshot-detector/`, `scripts/screenshot-eval/`, `scripts/screenshot-to-build/` |
| Models and class lists | `assets/ml/screenshot-detector/`, `assets/data/detector-*.json` |

## Safety invariants

- The Create editor, persisted drafts, collision, rendering, saving, loading, and publishing use a fixed 9x7 board and must remain independent of this feature.
- Keep item-model weights and their matching class list together. Live v1 has 426 classes; cached research variants can have 518.
- Do not retrain `bags-v1b` unless explicitly requested.
- The evaluator and benchmark truth are research assets, not launch code.

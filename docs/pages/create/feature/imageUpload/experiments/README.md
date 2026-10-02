# Experiment index

All scripts, fixtures, models, and cache artifacts remain where they were created. This index records the conclusion so work can resume without rerunning failed paths.

| Phase | Finding | Preserved evidence |
|---|---|---|
| P01 | Tiled v5-80 inference regressed 64/150 to 63/150; real-003 remained 0/23. | `baselines/2026-09-30-p1-v5-80-tiled/` |
| P02 | Occupancy signal is advisory only; mixed fabric was unreliable. | `baselines/2026-09-30-p2-occupancy/` |
| P03-P06 | NCC retrieval works only on recognizable bright regions; candidate/global selection and small-object work did not yield a deployable path. | `scripts/screenshot-eval/` and P3-P6 baselines |
| P07 | Keep the product board representation fixed at 9x7; do not force seam math. | Create/runtime architecture |
| P08-P12 | Photometry, DINO, registration-window, scale, and cross-shot-transfer tests did not resolve dim/large failures. | `baselines/2026-10-01-p8/` through `p12/` |
| P13-P16 | Registration audits exposed wrong grid geometry; forced corrected maps did not solve real-003, and art/occlusion changes were insufficient. | `baselines/2026-10-01-p13/` through `p16/` |
| P17-P18 | All visual faces improve retrieval; visual-anchor theory alone does not explain real-007. | `baselines/2026-10-01-p17/`, `p18/` |
| P19 | Image-only seam-phase correction for real-007 is a proven +21-item result. | `baselines/2026-10-01-p19/` |
| P20 | Correctly abstained on real-003 and real-008 coordinate recovery. | `baselines/2026-10-01-p20/` |
| P21 | Combat board components/player side can be proposed; grid fitting remains unstable. | `baselines/2026-10-01-p21/` |

`baselines/` above is shorthand for `scripts/_cache/screenshot-eval/baselines/`.

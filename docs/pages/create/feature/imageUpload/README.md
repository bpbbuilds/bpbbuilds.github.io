# Screenshot / image upload reconstruction

This folder is the canonical documentation for the paused Screenshot / Image Upload -> Build feature.

## Launch state

The feature is intentionally paused for launch. Its implementation, ONNX assets, benchmark fixtures, evaluator, training utilities, and research artifacts are preserved in place.

- Browser gate: `SCREENSHOT_IMPORT_ENABLED = false` in `js/shared/feature-flags.js`.
- Server gate: the `screenshot-to-build` Edge Function returns 404 unless `SCREENSHOT_IMPORT_ENABLED=true` is set in its environment.
- Normal users have no Image/Media import control in Create. Manual item/bag placement and `history.db` import remain available.

## Read first

1. [STATUS.md](STATUS.md) - launch disposition and owned surfaces.
2. [ARCHITECTURE.md](ARCHITECTURE.md) - preserved implementation and entry points.
3. [RESEARCH_SUMMARY.md](RESEARCH_SUMMARY.md) and [BENCHMARKS.md](BENCHMARKS.md) - measured state.
4. [KNOWN_FAILURES.md](KNOWN_FAILURES.md) - do not rediscover these findings.
5. [RESUME_GUIDE.md](RESUME_GUIDE.md) - safe reactivation sequence.

The experiment index is [experiments/README.md](experiments/README.md); operational reference material is in [reference/](reference/).

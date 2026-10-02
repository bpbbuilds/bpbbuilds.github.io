# Benchmarks

## Fixed corpus

The ordinary-item benchmark has 150 labeled item cells across real screenshots plus `leather-quad` and `pine-protector`. Truth fixtures are preserved under `fixtures/` and `scripts/screenshot-eval/fixtures/`.

| Result | Top-1 | Top-3 | Top-5 | Top-10 | Top-20 |
|---|---:|---:|---:|---:|---:|
| Live v1 detector / original evaluation | 58 item cells | - | - | - | - |
| Cached v5-80 control | 64 item cells | - | - | - | - |
| Current retrieval research after P19 | 64 | 68 | 72 | 75 | 75 |

P19's image-derived real-007 origin correction accounts for 21 recovered ordinary items and must remain preserved as an eval finding; it was not promoted to the paused importer.

## Publication gate

Do not publish a detector unless it beats live v1 on the held-out eight-shot corpus (at least 58/150, ideally above the cached 64/150 control), ships with the matching class list, and does not regress the controls. No cached research weight is currently approved for publication.

## Running after resumption

Use `node scripts/screenshot-eval/run.mjs` only after temporarily enabling the dev-route gate in a deliberate research branch. Restore the live detector manifest by copying the backup bytes; do not rewrite it with PowerShell UTF-8 output because a BOM breaks evaluation.

# Board stills

Flat board thumbs for catalog / tip / vault surfaces via [`js/shared/board-still/`](../../js/shared/board-still/). Prefer a **pre-baked** Storage WebP when `builds.board_still_path` is set; otherwise paint client-side from placements. Not used for create, sim, or the interactive build-page hero bag.

## Paint order (live-matched)

1. Bag sprites with SE silhouette shadows  
2. Soft `FilledSlot` fabric on bag body cells (above bag Icons)  
3. Non-bag item shadows, then sprites + gems  

## Pre-bake on publish

1. Apply [`docs/db/sql/020_builds_board_still_path.sql`](../db/sql/020_builds_board_still_path.sql) (column + public bucket `board-stills` + RLS).  
2. Redeploy Edge Function `submit-build`.  
3. Create Submit paints → uploads `{author_id}/{uuid}.webp` → stores `board_still_path`. Upload failure still publishes (catalog falls back to canvas).

## Improvements

- [x] **Pre-bake on publish** — Storage URL for new submits; client canvas fallback when path is null  
- [ ] **WebP / AVIF for stored thumbs** — WebP already preferred on bake; AVIF optional later  
- [ ] **Share / OG embed image** — Discord / Twitter / iMessage preview uses the board still (see [`todo.md`](../todo.md))  
- [ ] **Raise / tune LRU** — `STILL_CAP` is 80 in [`cache.js`](../../js/shared/board-still/cache.js); revisit under heavy `/builds/` scroll  
- [ ] **OffscreenCanvas / worker paint** — keep first-pass scroll free of main-thread canvas work (legacy path)  
- [ ] **DPR-aware paint size** — paint denser than `STILL_CELL_PX` (64) on high-DPR, or ship 1x/2x baked files  
- [ ] **Live-art / glow omitted** — thumbs stay still sprites (acceptable); document if export should ever include liquid/glow  
- [ ] **Build-page hero still** — optional swap of main bag to a still when not scrubbing (perf), live grid while scrubbing  
- [ ] **Backfill** — script to bake stills for older builds missing `board_still_path`  
- [ ] **Re-bake on edit** — when build edit exists, re-upload still after board change  

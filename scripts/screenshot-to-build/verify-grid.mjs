/**
 * One-shot: detect bag grid on a screenshot and write debug overlay.
 *   node scripts/screenshot-to-build/verify-grid.mjs path/to/shot.png
 */
import path from 'path';
import {
  detectGridFromShot,
  scaleGridToImage,
  writeGridDebugOverlay,
} from './grid-bridge.mjs';

const shotPath = process.argv[2];
if (!shotPath) {
  console.error('Usage: node scripts/screenshot-to-build/verify-grid.mjs <shot.png>');
  process.exit(1);
}

const { grid, gray, imgW, imgH } = await detectGridFromShot(shotPath, 900);
const full = scaleGridToImage(grid, gray.w, gray.h, imgW, imgH);
console.log(
  JSON.stringify(
    {
      ok: grid.ok,
      match: {
        cellW: Number(grid.cellW.toFixed(2)),
        cellH: Number(grid.cellH.toFixed(2)),
        originX: Number(grid.originX.toFixed(2)),
        originY: Number(grid.originY.toFixed(2)),
        cols: grid.cols,
        rows: grid.rows,
        score: Number(grid.score.toFixed(4)),
      },
      fullRes: {
        cellW: Number(full.cellW.toFixed(2)),
        cellH: Number(full.cellH.toFixed(2)),
        originX: Number(full.originX.toFixed(2)),
        originY: Number(full.originY.toFixed(2)),
        bagRect: full.bagRect,
      },
      shot: { imgW, imgH, matchW: gray.w, matchH: gray.h },
    },
    null,
    2,
  ),
);

const out = path.join(process.cwd(), 'scripts', '_stb-grid-debug.png');
await writeGridDebugOverlay(shotPath, full, out);
console.error(`wrote ${out}`);

/**
 * Paint uploaded builds as screenshot-eval fixtures (diverse bag sets).
 *
 *   node scripts/screenshot-eval/export-build-fixtures.mjs --limit 8
 */
import fs from 'fs';
import path from 'path';
import {
  loadEnv,
  loadCatalogWithTypes,
  loadBuildLayouts,
  ROOT,
} from '../screenshot-detector/sample-layouts.mjs';
import { paintSynthBoard } from '../screenshot-detector/paint-node.mjs';
import { loadShapeIndex } from '../screenshot-to-build/shapes.mjs';
import { placementAabb } from '../screenshot-detector/paint-node.mjs';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const limit = Math.max(1, Number(arg('--limit', '8')) | 0);
const outDir = path.join(ROOT, 'scripts/screenshot-eval/fixtures');
fs.mkdirSync(outDir, { recursive: true });

const env = loadEnv();
const catalog = await loadCatalogWithTypes(env);
const layouts = await loadBuildLayouts(env);
const catalogById = new Map(catalog.map((c) => [c.id, c]));
const shapeIndex = loadShapeIndex(catalog);

const liveArtPath = path.join(ROOT, 'assets/data/item-live-art.json');
const liveArtById = JSON.parse(fs.readFileSync(liveArtPath, 'utf8')).items || {};
const byImage =
  JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/sprite-display.json'), 'utf8'))
    .byImage || {};

/** @type {{ layout: typeof layouts[0], bagNames: Set<string>, bagN: number }[]} */
const scored = [];
for (const layout of layouts) {
  const bags = layout.placements.filter((p) => catalogById.get(p.id)?.type === 'Bag');
  if (bags.length < 3) continue;
  const bagNames = new Set(bags.map((p) => String(catalogById.get(p.id)?.name || p.id)));
  scored.push({ layout, bagNames, bagN: bags.length });
}
scored.sort((a, b) => b.bagNames.size - a.bagNames.size || b.bagN - a.bagN);

const picked = [];
/** @type {Set<string>} */
const seenSig = new Set();
for (const s of scored) {
  const sig = [...s.bagNames].sort().join('|');
  if (seenSig.has(sig)) continue;
  seenSig.add(sig);
  picked.push(s);
  if (picked.length >= limit) break;
}

const exported = [];
for (const { layout, bagNames } of picked) {
  const slug = String(layout.slug || layout.buildId)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const name = `build-${layout.buildId}-${slug || 'board'}`;
  const painted = await paintSynthBoard({
    placements: layout.placements,
    catalogById,
    cellPx: 54,
    liveArtById,
    byImage,
  });
  const png = painted.canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(outDir, `${name}.png`), png);

  /** @type {{ name: string, x: number, y: number, r: number }[]} */
  const bagTruth = [];
  /** @type {string[]} */
  const bagCells = [];
  for (const p of layout.placements) {
    const it = catalogById.get(p.id);
    if (!it || it.type !== 'Bag') continue;
    bagTruth.push({
      name: String(it.name || p.id),
      x: p.x,
      y: p.y,
      r: p.r || 0,
    });
    const aabb = placementAabb(shapeIndex, p.id, p);
    for (let dy = 0; dy < aabb.h; dy++) {
      for (let dx = 0; dx < aabb.w; dx++) {
        bagCells.push(`${aabb.x + dx},${aabb.y + dy}`);
      }
    }
  }
  /** @type {{ name: string, x: number, y: number, r: number | null }[]} */
  const items = [];
  for (const p of layout.placements) {
    const it = catalogById.get(p.id);
    if (!it || it.type === 'Bag') continue;
    if (String(it.type).includes('Gem') || it.type === 'Skill') continue;
    items.push({
      name: String(it.name || p.id),
      x: p.x,
      y: p.y,
      r: p.r || 0,
    });
  }

  const truth = {
    note: `Exported from build ${layout.buildId} (${layout.slug}) for bag variety eval`,
    items,
    bagCells: [...new Set(bagCells)],
    bags: bagTruth,
  };
  fs.writeFileSync(path.join(outDir, `${name}.truth.json`), JSON.stringify(truth, null, 2) + '\n');
  exported.push({ name, bags: bagTruth.length, uniqueBags: bagNames.size, bagNames: [...bagNames] });
  console.error(`wrote ${name} bags=${bagTruth.length} unique=${bagNames.size}`);
}

console.log(JSON.stringify({ exported }, null, 2));

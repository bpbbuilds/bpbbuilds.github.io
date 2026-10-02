/**
 * P9-H. Classify the 518 recognition references from existing bake metadata.
 * Eval only.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const OUT = path.join(ROOT, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p9');

function exists(p) {
  return fs.existsSync(p);
}

function main() {
  const pool = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p8/pool.json'), 'utf8'));
  const names = pool;
  const display = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/sprite-display.json'), 'utf8')).byImage;
  const baked = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/_cache/game-sprites.json'), 'utf8'));
  const byImage = new Map(baked.sprites.map((s) => [s.image, s]));
  const animDir = path.join(ROOT, 'tools/game-extract-full/Items/Animations');
  const anims = fs.existsSync(animDir) ? fs.readdirSync(animDir).filter((f) => f.endsWith('.tscn')) : [];

  const buckets = {
    exactGameTexture: 0,
    layeredComposite: 0,
    precomposedCdnStill: 0,
    siteThumbOnly: 0,
    missingGameRecord: 0,
  };
  const multi = [];
  const missingThumb = [];
  const missingDisplay = [];
  const sharedImage = new Map();
  for (const row of names) {
    const file = `${row.image}.png`;
    const rec = byImage.get(file);
    const thumb = exists(path.join(ROOT, 'assets/item-thumbs/2x', `${row.image}.webp`));
    const gamePng = exists(path.join(ROOT, 'tools/game-extract-full/Items/Sprites', file));
    const sitePng = exists(path.join(ROOT, 'assets/item-sprites', file));
    if (!display[file]) missingDisplay.push(row.name);
    if (!thumb) missingThumb.push(row.name);
    const users = sharedImage.get(row.image) || [];
    users.push(row.name);
    sharedImage.set(row.image, users);
    if (!rec) {
      buckets.missingGameRecord++;
      continue;
    }
    if (rec.precomposed) buckets.precomposedCdnStill++;
    else if (rec.layered || (rec.layers || 1) > 1) buckets.layeredComposite++;
    else if (String(rec.resPath || '').includes('/Sprites/') && (gamePng || sitePng)) buckets.exactGameTexture++;
    else buckets.siteThumbOnly++;
    if ((rec.layers || 1) > 1) multi.push({ name: row.name, image: rec.image, layers: rec.layers, resPath: rec.resPath, precomposed: rec.precomposed });
  }
  const duplicateImages = [...sharedImage.entries()].filter(([, users]) => users.length > 1).map(([image, users]) => ({ image, users }));

  const report = {
    classCount: names.length,
    bake: {
      count: baked.count,
      baked: baked.baked,
      layered: baked.layered,
      precomposed: baked.precomposed,
      mode: baked.mode,
      source: baked.source,
    },
    buckets,
    animationScenes: anims.length,
    layeredExamples: multi.slice(0, 30),
    missingThumb: missingThumb.length,
    missingDisplay: missingDisplay.length,
    duplicateImages,
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'provenance.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main();

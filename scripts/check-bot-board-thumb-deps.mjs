/**
 * Ensures the Discord board-thumbnail renderer's local ESM tree stays present
 * in the production bot Docker image. Run with:
 *   node scripts/check-bot-board-thumb-deps.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dockerfile = fs.readFileSync(path.join(root, 'bot', 'Dockerfile'), 'utf8');
const dockerignore = fs.readFileSync(path.join(root, '.dockerignore'), 'utf8');
const starts = ['bot/board-thumb.js', 'js/shared/board-still/paint.js'];
const seen = new Set();

function visit(rel) {
  const normalized = rel.replaceAll('\\', '/');
  if (seen.has(normalized)) return;
  seen.add(normalized);
  const source = fs.readFileSync(path.join(root, normalized), 'utf8');
  const specs = [
    ...source.matchAll(/(?:import|export)\s+(?:[^'";()]*?\s+from\s+)?['"]([^'"]+)['"]/g),
    ...source.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g),
  ].map((match) => match[1]);
  for (const spec of specs) {
    if (!spec.startsWith('.')) continue;
    let child = path.posix.normalize(path.posix.join(path.posix.dirname(normalized), spec));
    if (!path.posix.extname(child)) child += '.js';
    if (!fs.existsSync(path.join(root, child))) {
      throw new Error(`${normalized} imports missing source file ${child}`);
    }
    visit(child);
  }
}

for (const start of starts) visit(start);

const dockerCoverage = [
  ['bot/board-thumb.js', 'COPY bot ./bot'],
  ['js/pages/build/map-item.js', 'COPY js/pages/build/map-item.js ./js/pages/build/'],
  ['js/shared/board-still/paint.js', 'COPY js/shared/board-still/paint.js ./js/shared/board-still/'],
  ['js/shared/backpack-grid/', 'COPY js/shared/backpack-grid ./js/shared/backpack-grid'],
  ['js/shared/item-live-art/', 'COPY js/shared/item-live-art ./js/shared/item-live-art'],
  ['assets/data/item-shapes.json', 'assets/data/item-shapes.json'],
  ['assets/data/sprite-display.json', 'assets/data/sprite-display.json'],
  ['assets/data/socket-offsets.json', 'assets/data/socket-offsets.json'],
  ['assets/data/item-live-art.json', 'assets/data/item-live-art.json'],
  ['assets/item-sprites/', 'COPY assets/item-sprites ./assets/item-sprites'],
  ['assets/icons/FilledSlot.png', 'COPY assets/icons/FilledSlot.png ./assets/icons/'],
];
for (const [source, copyMarker] of dockerCoverage) {
  if (!dockerfile.includes(copyMarker)) {
    throw new Error(`Dockerfile does not copy ${source}`);
  }
}

for (const blockedPath of ['js', 'js/shared', 'js/shared/board-still']) {
  if (dockerignore.split(/\r?\n/).some((line) => line.trim() === blockedPath)) {
    throw new Error(`.dockerignore excludes required path ${blockedPath}`);
  }
}

console.log(`Board thumbnail Docker dependency check passed (${seen.size} JavaScript modules).`);

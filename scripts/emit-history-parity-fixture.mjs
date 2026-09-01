/**
 * Phase 266 — emit one author-history parity fixture (does not rewrite other boards).
 *   node scripts/emit-history-parity-fixture.mjs 3704 3706
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { emptyLive } from '../js/pages/sim/engine/parity-live.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'fixtures', 'parity');
const history = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../assets/data/author-history-builds.json'), 'utf8'),
);

const FOCUS = {
  3704: ['wand', 'book_of_darkness', 'puzzlebox'],
  3706: ['wolf_emblem', 'armored_courage_puppy', 'speak_with_animals'],
};

const ids = process.argv.slice(2).map(Number).filter((n) => n > 0);
if (!ids.length) {
  console.error('Usage: node scripts/emit-history-parity-fixture.mjs <runId>…');
  process.exit(1);
}

for (const runId of ids) {
  const b = history.builds.find((x) => x.runId === runId);
  if (!b) {
    console.error(`Missing history run ${runId}`);
    process.exitCode = 1;
    continue;
  }
  const slug = b.slug || `history-${runId}`;
  const placements = (b.placements || []).map((p, i) => {
    const id = p.item_id || p.id;
    return {
      id,
      key: p.key || `${slug}:${i}:${id}`,
      x: Number(p.x) || 0,
      y: Number(p.y) || 0,
      r: Number(p.r) || 0,
      gems: Array.isArray(p.gems) ? p.gems : [],
    };
  });
  const fix = {
    name: slug,
    slug,
    source: 'author_history',
    seed: 42,
    durationSec: 30,
    placements,
    expect: {
      playerEndHpMin: null,
      playerEndHpMax: null,
      dummyEndHpMin: null,
      dummyEndHpMax: null,
    },
    live: emptyLive(),
    meta: { focusItemIds: FOCUS[runId] || [], heroClass: b.hero_class || null, runId },
  };
  const out = path.join(OUT_DIR, `${slug}.json`);
  fs.writeFileSync(out, `${JSON.stringify(fix, null, 2)}\n`);
  console.log(`Wrote ${out} (${placements.length} pcs, ${b.hero_class})`);
}

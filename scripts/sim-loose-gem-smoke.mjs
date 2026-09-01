/**
 * Phase 253 — loose gem inventory combat vs socketed prepareWeapon.
 *   node scripts/sim-loose-gem-smoke.mjs
 */
import fs from 'fs';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const GAME_ITEMS = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const byId = new Map();
for (const it of GAME_ITEMS.items || []) {
  byId.set(it.id, {
    id: it.id,
    name: it.name,
    type: it.type,
    extraTypes: it.extraTypes,
    cooldown: it.cooldown,
    damageMin: it.damageMin,
    damageMax: it.damageMax,
    accuracy: it.accuracy,
    staminaCost: it.staminaCost,
    params: it.params,
    shape: it.shape || [[1]],
    chance: it.chance,
  });
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

function count(events, pred) {
  return (events || []).filter(pred).length;
}

{
  const id = 'chipped_ruby';
  ok(getScriptHandler(id)?.onCooldownEffect, 'chipped_ruby has inventory CD');
  const run = simulateEngine({
    placements: [{ id, key: 'gem', x: 0, y: 0, r: 0 }],
    itemsById: byId,
    durationSec: 20,
    seed: 253,
  });
  const acts = count(run.events, (e) => e.type === 'activate' && e.itemId === id);
  ok(acts === 1, `loose ruby activates once (got ${acts})`);
  ok(
    count(run.events, (e) => e.type === 'heal' && e.itemId === id) >= 1,
    'loose ruby heals once (stealLife)',
  );
}

{
  const id = 'chipped_emerald';
  const run = simulateEngine({
    placements: [{ id, key: 'gem', x: 0, y: 0, r: 0 }],
    itemsById: byId,
    durationSec: 10,
    seed: 254,
  });
  const acts = count(run.events, (e) => e.type === 'activate' && e.itemId === id);
  ok(acts === 1, `loose emerald activates once (got ${acts})`);
  ok(
    count(run.events, (e) => e.meta?.handler === id && e.meta?.stack === 'regeneration') >= 1,
    'loose emerald granted regen',
  );
}

{
  const id = 'chipped_sapphire';
  const run = simulateEngine({
    placements: [{ id, key: 'gem', x: 0, y: 0, r: 0 }],
    itemsById: byId,
    durationSec: 10,
    seed: 255,
  });
  const acts = count(run.events, (e) => e.type === 'activate' && e.itemId === id);
  ok(acts === 1, `loose sapphire activates once (got ${acts})`);
  ok(
    count(run.events, (e) => e.meta?.handler === id && e.meta?.stack === 'cold') >= 1,
    'loose sapphire inflicted cold',
  );
}

{
  const id = 'chipped_amethyst';
  const run = simulateEngine({
    placements: [{ id, key: 'gem', x: 0, y: 0, r: 0 }],
    itemsById: byId,
    durationSec: 16,
    seed: 256,
  });
  const acts = count(run.events, (e) => e.type === 'activate' && e.itemId === id);
  ok(acts > 1, `loose amethyst repeats CD (got ${acts})`);
}

{
  const run = simulateEngine({
    placements: [{ id: 'wooden_sword', key: 'w', x: 0, y: 0, r: 0, gems: ['chipped_ruby'] }],
    itemsById: byId,
    durationSec: 8,
    seed: 257,
  });
  const gemActs = count(run.events, (e) => e.itemId === 'chipped_ruby');
  const swordActs = count(
    run.events,
    (e) => e.type === 'activate' && e.itemId === 'wooden_sword',
  );
  ok(gemActs === 0, `socketed ruby is not a board CD (events ${gemActs})`);
  ok(swordActs > 1, `socketed host still strikes (sword activates ${swordActs})`);
}

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nLoose gem smoke passed');

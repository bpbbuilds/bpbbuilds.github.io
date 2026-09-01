/**
 * Phase 252 — one dummy fight per AP wave theme + Wooden Sword CD twin.
 *   node scripts/sim-ap-smoke.mjs
 *
 * Writes compact dump summaries (not full event logs): assets/data/sim-ap-smoke.json
 */
import fs from 'fs';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { buildSimDebugReport } from '../js/pages/sim/engine/log-export.js';
import { AUTO_PORTS } from '../js/pages/sim/engine/scripts/auto-ports.js';

const GAME_ITEMS = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const MAP = JSON.parse(fs.readFileSync('assets/data/sim-auto-ports.json', 'utf8')).byId;

const GENERIC_HANDLERS = new Set([
  'basic_cd',
  'cd_lucky',
  'cd_mana',
  'cd_regen',
  'cd_heat',
  'cd_cold',
  'cd_poison',
  'cd_activate',
  'double_strike',
]);

/** @type {{ wave: number, theme: string, id: string }[]} */
const THEMES = [
  { wave: 244, theme: 'cd_lucky', id: 'leaf_badge' },
  { wave: 245, theme: 'cd_mana_regen', id: 'heart_container' },
  { wave: 246, theme: 'cd_heat_cold_poison', id: 'chili_pepper' },
  { wave: 247, theme: 'basic_cd_uniques', id: 'pumpkin' },
  { wave: 248, theme: 'start_stacks', id: 'lucky_clover' },
  { wave: 249, theme: 'onhit_perm', id: 'torch' },
  { wave: 250, theme: 'aura_food_link', id: 'hero_sword' },
  { wave: 252, theme: 'weapon_cd_port', id: 'wooden_sword' },
];

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

const dumps = [];

for (const row of THEMES) {
  const item = byId.get(row.id);
  ok(!!item, `${row.theme}: catalog ${row.id}`);
  if (!item) continue;

  const h = getScriptHandler(row.id);
  ok(h?.handlerId === row.id, `${row.theme}: handlerId ${h?.handlerId} === ${row.id}`);
  ok(!GENERIC_HANDLERS.has(h?.handlerId), `${row.theme}: not a generic handler`);
  ok(MAP[row.id]?.pattern === 'hand_port', `${row.theme}: MAP hand_port`);
  ok(!!AUTO_PORTS[row.id], `${row.theme}: AUTO_PORTS entry`);

  const placements = [{ id: row.id, key: `ap${row.wave}`, x: 0, y: 0, r: 0 }];
  const run = simulateEngine({
    placements,
    itemsById: byId,
    durationSec: 12,
    seed: 0x25200 + row.wave,
  });
  const report = buildSimDebugReport(run, {
    title: `AP ${row.wave} ${row.theme}`,
    seed: 0x25200 + row.wave,
    placements,
    itemsById: byId,
  });

  const handlers = [...new Set((run.events || []).map((e) => e.meta?.handler).filter(Boolean))];
  const combatish = (run.events || []).some((e) =>
    ['activate', 'buff', 'debuff', 'heal', 'damage', 'stat'].includes(e.type),
  );
  ok(combatish, `${row.theme}: combat events`);
  ok(
    !handlers.some((hid) => GENERIC_HANDLERS.has(hid)),
    `${row.theme}: event handlers ${handlers.join(',') || '(none)'}`,
  );

  dumps.push({
    wave: row.wave,
    theme: row.theme,
    id: row.id,
    handlerId: h.handlerId,
    dummyEndHp: run.dummyEndHp,
    playerEndHp: run.playerEndHp,
    eventCount: run.events?.length || 0,
    eventHandlers: handlers,
    mismatchCount: report.ui?.mismatches?.length || 0,
    paramCheckCount: report.paramChecks?.length || 0,
  });
}

fs.writeFileSync(
  'assets/data/sim-ap-smoke.json',
  `${JSON.stringify({ builtAt: new Date().toISOString(), dumps }, null, 2)}\n`,
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAP milestone smoke passed → assets/data/sim-ap-smoke.json');

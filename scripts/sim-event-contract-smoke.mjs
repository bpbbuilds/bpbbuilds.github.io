/**
 * Package 3 — one representative event corpus must project consistently to
 * causal contract, combat log, damage meters, HUD snapshots, and debug JSON.
 *
 *   node scripts/sim-event-contract-smoke.mjs
 */

import { conformSimEvents } from '../js/pages/sim/sim-events.js';
import { buildSimDebugReport } from '../js/pages/sim/engine/log-export.js';
import { snapAt } from '../js/pages/sim/hud/sim-hud.js';
import { prepareLogEvents } from '../js/pages/sim/log/sim-log-sentences.js';
import { buildMetricSections, buildMetricSources } from '../js/pages/sim/log/sim-meter-metrics.js';

const itemsById = new Map([
  ['stone_golem', { id: 'stone_golem', name: 'Stone Golem' }],
  ['wooden_sword', { id: 'wooden_sword', name: 'Wooden Sword' }],
  ['fire_pit', { id: 'fire_pit', name: 'Fire Pit' }],
  ['pocket_sand', { id: 'pocket_sand', name: 'Pocket Sand' }],
  ['battery', { id: 'battery', name: 'Battery' }],
]);

const events = [
  { t: 0, type: 'fight_start', actor: 'player', label: 'Fight started' },
  {
    t: 2.5,
    type: 'buff',
    actor: 'player',
    target: 'player',
    itemId: 'stone_golem',
    placementKey: 'you:golem',
    amount: 7,
    meta: { eventId: 'grant', stack: 'regeneration' },
  },
  {
    t: 2.5,
    type: 'buff',
    actor: 'player',
    target: 'player',
    itemId: 'stone_golem',
    placementKey: 'you:golem',
    amount: -7,
    meta: { eventId: 'spend', parentId: 'grant', stack: 'regeneration', used: true },
  },
  {
    t: 2.5,
    type: 'buff',
    actor: 'player',
    target: 'player',
    itemId: 'stone_golem',
    placementKey: 'you:golem',
    amount: 150,
    meta: { eventId: 'react', parentId: 'spend', stack: 'block' },
  },
  {
    t: 3,
    type: 'activate',
    actor: 'dummy',
    target: 'dummy',
    itemId: 'pocket_sand',
    placementKey: 'opp:sand',
    meta: { eventId: 'consume', consumed: true },
  },
  {
    t: 3,
    type: 'debuff',
    actor: 'dummy',
    target: 'player',
    itemId: 'pocket_sand',
    placementKey: 'opp:sand',
    amount: 2,
    meta: { eventId: 'blind', parentId: 'consume', stack: 'blind' },
  },
  {
    t: 4,
    type: 'damage',
    actor: 'player',
    target: 'dummy',
    itemId: 'wooden_sword',
    placementKey: 'you:sword',
    amount: 12,
    meta: { eventId: 'critical-hit', critical: true, blocked: 4 },
  },
  {
    t: 4,
    type: 'heal',
    actor: 'player',
    target: 'player',
    itemId: 'wooden_sword',
    placementKey: 'you:sword',
    amount: 3,
    meta: { eventId: 'vamp', parentId: 'critical-hit', systemOrigin: 'Vampirism', stack: 'vampirism' },
  },
  {
    t: 4.5,
    type: 'damage',
    actor: 'player',
    target: 'dummy',
    itemId: 'fire_pit',
    placementKey: 'you:pit',
    amount: 7,
    meta: { eventId: 'effect-hit', phase: 'effect' },
  },
  {
    t: 4.5,
    type: 'miss',
    actor: 'dummy',
    target: 'player',
    itemId: 'wooden_sword',
    placementKey: 'opp:sword',
    meta: { eventId: 'opp-miss' },
  },
  {
    t: 5,
    type: 'heal',
    actor: 'dummy',
    target: 'dummy',
    amount: 4,
    label: 'Regeneration: +4 HP',
    meta: { eventId: 'regen', systemOrigin: 'Regeneration', stack: 'regeneration' },
  },
  {
    t: 5,
    type: 'stamina',
    actor: 'player',
    target: 'player',
    itemId: 'wooden_sword',
    placementKey: 'you:sword',
    amount: -2,
    meta: { eventId: 'stamina-use', kind: 'used' },
  },
  {
    t: 5.2,
    type: 'cooldown',
    actor: 'dummy',
    target: 'dummy',
    itemId: 'wooden_sword',
    placementKey: 'opp:sword',
    amount: 1,
    label: 'Wooden Sword cooldown advanced.',
    meta: { eventId: 'cooldown', systemOrigin: 'CooldownAdvance' },
  },
  {
    t: 5.4,
    type: 'charge',
    actor: 'player',
    target: 'player',
    itemId: 'battery',
    placementKey: 'you:battery',
    label: 'Battery: charge → Wooden Sword',
    meta: { eventId: 'charge', phase: 'cell' },
  },
  { t: 6, type: 'info', actor: 'dummy', target: 'dummy', label: 'Opponent defeated', meta: { eventId: 'death', phase: 'death' } },
  { t: 6.000001, type: 'fight_end', actor: 'player', label: 'Dummy defeated', meta: { eventId: 'end' } },
];

const snapshots = [
  {
    t: 0,
    player: { hp: 100, maxHp: 100, stamina: 10, maxStamina: 10, block: 0, regeneration: 0, poison: 0, dead: false },
    dummy: { hp: 100, maxHp: 100, stamina: 10, maxStamina: 10, block: 0, regeneration: 0, poison: 0, dead: false },
  },
  {
    t: 4,
    player: { hp: 91, maxHp: 100, stamina: 8, maxStamina: 10, block: 150, regeneration: 0, poison: 0, dead: false },
    dummy: { hp: 81, maxHp: 100, stamina: 10, maxStamina: 10, block: 0, regeneration: 4, poison: 0, dead: false },
  },
  {
    t: 6,
    player: { hp: 91, maxHp: 100, stamina: 8, maxStamina: 10, block: 150, regeneration: 0, poison: 0, dead: false },
    dummy: { hp: 0, maxHp: 100, stamina: 10, maxStamina: 10, block: 0, regeneration: 4, poison: 0, dead: true },
  },
];

let failed = 0;
function ok(condition, message) {
  if (condition) console.log(`OK ${message}`);
  else {
    console.error(`FAIL ${message}`);
    failed += 1;
  }
}

const canonical = conformSimEvents(events);
ok(canonical.length === events.length, 'canonical projection retains every corpus event');
for (const event of canonical) {
  const contract = event.meta?.contract;
  ok(
    contract &&
      contract.id != null &&
      contract.rootId != null &&
      Number.isFinite(contract.timestamp) &&
      ['player', 'dummy'].includes(contract.side) &&
      typeof contract.phase === 'string' &&
      typeof contract.origin === 'string',
    `contract fields present for ${event.meta?.eventId}`,
  );
}

const grant = canonical.find((event) => event.meta?.eventId === 'grant');
const spend = canonical.find((event) => event.meta?.eventId === 'spend');
const react = canonical.find((event) => event.meta?.eventId === 'react');
ok(
  grant?.meta?.contract?.rootId === 'grant' &&
    spend?.meta?.contract?.rootId === 'grant' &&
    react?.meta?.contract?.rootId === 'grant' &&
    grant.meta.contract.depth === 0 &&
    spend.meta.contract.depth === 1 &&
    react.meta.contract.depth === 2,
  'nested stack chain retains root and parent depth',
);

const { lines } = prepareLogEvents(events, { dummyEndHp: 0, itemsById, assetRoot: '../' });
const plain = lines.map((line) => line.plain);
const indexOf = (text) => plain.findIndex((line) => line.includes(text));
ok(indexOf('Gained 7 regeneration') < indexOf('Used 7 regeneration') && indexOf('Used 7 regeneration') < indexOf('Gained 150 block'), 'combat log keeps the stack cause/reaction chain contiguous');
ok(indexOf('Dealt 12 critical damage (Wooden Sword).') >= 0, 'combat log renders critical damage');
ok(indexOf('Regenerated 3 health (Vampirism).') >= 0, 'combat log renders vampirism healing');
ok(indexOf('Removed 2 stamina (Wooden Sword).') >= 0, 'combat log renders stamina spend');
ok(indexOf('Battery: charge → Wooden Sword') < 0, 'charge remains a non-log transport event while retaining a contract/export record');
ok(indexOf('Round won.') >= 0, 'combat log projects fight end as outcome');

const playerDamage = buildMetricSources(events, itemsById, 'damage', 'player');
const dummyDamage = buildMetricSources(events, itemsById, 'damage', 'dummy');
const playerBlock = buildMetricSections(events, itemsById, 'block', 'player');
const playerRegeneration = buildMetricSections(events, itemsById, 'regeneration', 'player');
const playerStamina = buildMetricSections(events, itemsById, 'stamina', 'player');
const dummyActivations = buildMetricSources(events, itemsById, 'activations', 'dummy');
ok(playerDamage.reduce((sum, source) => sum + source.total, 0) === 19, 'damage meter totals both player damage sources');
ok(dummyDamage.reduce((sum, source) => sum + source.total, 0) === 0, 'damage meter keeps opponent damage separate');
ok(playerBlock[0]?.sources[0]?.total === 150 && playerRegeneration[2]?.sources[0]?.total === 7, 'stack meter separates gained and used amounts');
ok(playerStamina[0]?.sources[0]?.total === 2, 'stamina meter records the spend');
ok(dummyActivations[0]?.total === 1, 'activation meter attributes the consumed item to opponent');

ok(snapAt(snapshots, 4.8, 'player')?.block === 150, 'HUD selects the latest player snapshot at the scrub time');
ok(snapAt(snapshots, 4.8, 'dummy')?.hp === 81, 'HUD selects the matching opponent snapshot at the scrub time');
ok(snapAt(snapshots, 6, 'dummy')?.dead === true, 'HUD receives the fight-end death snapshot');

const run = {
  mode: 'engine',
  durationSec: 6.000001,
  dummyMaxHp: 100,
  dummyEndHp: 0,
  playerMaxHp: 100,
  playerEndHp: 91,
  events,
  snapshots,
  summary: { seed: 3003, player: snapshots.at(-1).player, dummy: snapshots.at(-1).dummy },
  coverage: null,
};
const report = buildSimDebugReport(run, { itemsById, placements: [], opponentPlacements: [] });
const exportedSpend = report.events.find((event) => event.contract?.id === 'spend');
ok(report.eventCount === events.length && report.events.length === events.length, 'JSON export retains every corpus event');
ok(
  exportedSpend?.contract?.rootId === 'grant' &&
    exportedSpend.contract.parentId === 'grant' &&
    exportedSpend.contract.depth === 1 &&
    exportedSpend.contract.placementKey === 'you:golem',
  'JSON export retains causal identity and source placement',
);

if (failed) {
  console.error(`\n${failed} event-contract assertion(s) failed`);
  process.exit(1);
}
console.log('\nEvent-contract conformance smoke passed');

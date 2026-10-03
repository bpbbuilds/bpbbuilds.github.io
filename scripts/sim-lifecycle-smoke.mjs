/**
 * Shared source-lifecycle fixture: player + opponent passes, sockets, a
 * combat-start listener reaction, a consumable, and same-t causal ordering.
 *
 *   node scripts/sim-lifecycle-smoke.mjs
 */

import fs from 'node:fs';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const catalogRaw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(catalogRaw) ? catalogRaw : catalogRaw.items || [];
const catalogById = new Map(catalog.map((item) => [item.id, item]));

const ids = [
  'wooden_sword',
  'chipped_topaz',
  'healing_herbs',
  'stone_golem',
  'pocket_sand',
];
const itemsById = new Map(ids.map((id) => [id, catalogById.get(id)]));

let failed = 0;
function ok(condition, message) {
  if (condition) console.log(`OK ${message}`);
  else {
    console.error(`FAIL ${message}`);
    failed += 1;
  }
}

function position(side, id, x, y, extra = {}) {
  return { id, x, y, r: 0, key: `${side}:${id}:${x},${y}`, ...extra };
}

function phasesFor(trace, key) {
  return trace.filter((entry) => entry.placementKey === key).map((entry) => entry.phase);
}

function firstIndex(list, predicate) {
  return list.findIndex(predicate);
}

for (const id of ids) ok(itemsById.get(id), `catalog contains ${id}`);

const you = [
  position('you', 'stone_golem', 0, 0),
  position('you', 'healing_herbs', 1, 0),
  position('you', 'healing_herbs', 2, 0),
  position('you', 'healing_herbs', 3, 0),
  position('you', 'healing_herbs', 4, 0),
  position('you', 'wooden_sword', 5, 0, { gems: ['chipped_topaz'] }),
  position('you', 'pocket_sand', 6, 0),
];
const them = [
  position('them', 'stone_golem', 0, 0),
  position('them', 'healing_herbs', 1, 0),
  position('them', 'healing_herbs', 2, 0),
  position('them', 'healing_herbs', 3, 0),
  position('them', 'healing_herbs', 4, 0),
  position('them', 'wooden_sword', 5, 0, { gems: ['chipped_topaz'] }),
  position('them', 'pocket_sand', 6, 0),
];

const run = simulateEngine({
  placements: you,
  opponentPlacements: them,
  itemsById,
  durationSec: 4,
  seed: 20261003,
  dummyAttacks: false,
  captureLifecycle: true,
});
const trace = run.lifecycle || [];
const orderedPhases = [
  'prepare',
  'socket_prepare',
  'cooldown_arm',
  'pre_combat_start',
  'socket_combat_start',
  'combat_start',
  'post_combat_start',
];

ok(trace.length === (you.length + them.length) * orderedPhases.length, 'trace has every shared lifecycle phase');
for (const placement of [...you, ...them]) {
  const key = placement.key.startsWith('them:') ? `opp:${placement.key}` : placement.key;
  ok(
    JSON.stringify(phasesFor(trace, key)) === JSON.stringify(orderedPhases),
    `${key} completes prepare → socket → arm → pre/start/post lifecycle in order`,
  );
}

for (const phase of orderedPhases) {
  const phaseEntries = trace.filter((entry) => entry.phase === phase);
  const firstOpponent = firstIndex(phaseEntries, (entry) => entry.side === 'dummy');
  const lastPlayer = phaseEntries.length - 1 - [...phaseEntries].reverse().findIndex((entry) => entry.side === 'player');
  ok(firstOpponent > lastPlayer, `${phase}: player batch precedes opponent batch`);
}

const playerSword = you.find((entry) => entry.id === 'wooden_sword');
const socketPrepare = firstIndex(trace, (entry) => entry.placementKey === playerSword.key && entry.phase === 'socket_prepare');
const cooldownArm = firstIndex(trace, (entry) => entry.placementKey === playerSword.key && entry.phase === 'cooldown_arm');
ok(socketPrepare >= 0 && socketPrepare < cooldownArm, 'socket preparation precedes host cooldown arm');

const startSnapshot = run.pieceSnapshots.find((snapshot) => Math.abs(snapshot.t - 2.5) < 1e-9);
const socketCd = Number(startSnapshot?.byKey?.[playerSword.key]?.cooldown);
const bare = simulateEngine({
  placements: [position('bare', 'wooden_sword', 0, 0)],
  itemsById,
  durationSec: 2.51,
  seed: 20261003,
  dummyAttacks: false,
});
const bareSnapshot = bare.pieceSnapshots.find((snapshot) => Math.abs(snapshot.t - 2.5) < 1e-9);
const bareCd = Number(bareSnapshot?.byKey?.['bare:wooden_sword:0,0']?.cooldown);
ok(socketCd > 0 && bareCd > 0 && socketCd < bareCd, 'Topaz prepare modifies the first armed cooldown');

for (const side of ['player', 'dummy']) {
  ok(
    run.events.some((event) => event.itemId === 'healing_herbs' && event.type === 'buff' && event.target === side),
    `${side}: own combat-start items grant regeneration`,
  );
}

const spend = run.events.findIndex(
  (event) => event.itemId === 'stone_golem' && event.meta?.used && event.target === 'player',
);
const spendRoot = run.events[spend]?.meta?.causalRootId;
const herbs = run.events.findIndex(
  (event) =>
    event.itemId === 'healing_herbs' &&
    event.type === 'buff' &&
    event.target === 'player' &&
    event.meta?.causalRootId === spendRoot,
);
const block = run.events.findIndex(
  (event) =>
    event.itemId === 'stone_golem' &&
    event.meta?.stack === 'block' &&
    event.target === 'player' &&
    event.meta?.causalRootId === spendRoot,
);
const cause = run.events[herbs];
const spent = run.events[spend];
const granted = run.events[block];
ok(
  herbs >= 0 && spend > herbs && block > spend &&
    cause?.t === spent?.t && spent?.t === granted?.t &&
    cause?.meta?.causalRootId === spent?.meta?.causalRootId &&
    spent?.meta?.causalRootId === granted?.meta?.causalRootId &&
    Number(spent?.meta?.causalDepth) > Number(cause?.meta?.causalDepth) &&
    Number(granted?.meta?.causalDepth) > Number(cause?.meta?.causalDepth),
  'same-t start grant retains its nested Stone Golem spend and Block causal order',
);

const consumableActivations = run.events.filter(
  (event) => event.itemId === 'pocket_sand' && event.type === 'activate',
);
const consumableEffects = run.events.filter(
  (event) => event.itemId === 'pocket_sand' && event.meta?.consumed === true,
);
ok(
  consumableActivations.length === 2 &&
    consumableActivations.some((event) => event.actor === 'player') &&
    consumableActivations.some((event) => event.actor === 'dummy') &&
    consumableActivations.every((event) => event.t === 2.5) &&
    consumableEffects.length === 2 &&
    consumableEffects.every((event) => event.t === 2.5),
  'start consumables activate and consume exactly once per side at the start timestamp',
);

const postStart = trace.filter((entry) => entry.phase === 'post_combat_start');
ok(postStart.length === you.length + them.length, 'post-combat-start pass reaches both boards');

if (failed) {
  console.error(`\n${failed} lifecycle assertion(s) failed`);
  process.exit(1);
}
console.log('\nShared lifecycle smoke passed');

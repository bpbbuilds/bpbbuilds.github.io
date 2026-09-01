/**
 * Phase bag-vs-bag — opponent placements activate; no training-dummy swing.
 *   node scripts/sim-vs-board-smoke.mjs
 */
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

const wooden = {
  id: 'wooden_sword',
  name: 'Wooden Sword',
  type: 'Melee Weapon',
  cooldown: 2.2,
  staminaCost: 1,
  damageMin: 4,
  damageMax: 6,
  accuracy: 90,
  shape: [[1]],
  params: {},
};

const itemsById = new Map([['wooden_sword', wooden]]);

const you = [{ id: 'wooden_sword', x: 0, y: 0, r: 0, key: 'you:sword' }];
const them = [{ id: 'wooden_sword', x: 0, y: 0, r: 0, key: 'them:sword' }];

const vs = simulateEngine({
  placements: you,
  opponentPlacements: them,
  itemsById,
  durationSec: 10,
  seed: 42,
});

const dummy = simulateEngine({
  placements: you,
  itemsById,
  durationSec: 10,
  seed: 42,
});

ok(
  !vs.events.some((e) => /Training Dummy/i.test(String(e.label || ''))),
  'vs-board has no training dummy swings',
);
ok(
  dummy.events.some((e) => /Training Dummy/i.test(String(e.label || ''))),
  'solo dummy still swings',
);

const youHits = vs.events.filter(
  (e) => e.type === 'damage' && e.actor === 'player' && e.target === 'dummy',
);
const themHits = vs.events.filter(
  (e) => e.type === 'damage' && e.actor === 'dummy' && e.target === 'player',
);
ok(youHits.length > 0, `you weapon damaged opponent (${youHits.length})`);
ok(themHits.length > 0, `opponent weapon damaged you (${themHits.length})`);

const youAct = vs.events.filter(
  (e) => e.type === 'activate' && e.itemId === 'wooden_sword' && e.actor === 'player',
);
const themAct = vs.events.filter(
  (e) => e.type === 'activate' && e.itemId === 'wooden_sword' && e.actor === 'dummy',
);
ok(youAct.length > 0, 'you sword activated');
ok(themAct.length > 0, 'opponent sword activated');

const oppDeck = simulateEngine({
  placements: [],
  opponentPlacements: [
    { id: 'deck_of_cards', x: 0, y: 0, r: 0, key: 'opp:deck:0' },
    { id: 'healing_herbs', x: 1, y: 0, r: 0, key: 'opp:herbs:0' },
  ],
  itemsById: new Map([
    [
      'deck_of_cards',
      {
        id: 'deck_of_cards',
        name: 'Deck of Cards',
        type: 'Deck',
        params: { p1: 2 },
      },
    ],
    [
      'healing_herbs',
      {
        id: 'healing_herbs',
        name: 'Healing Herbs',
        type: 'Food',
        params: { p1: 2 },
      },
    ],
  ]),
  durationSec: 4,
  seed: 99,
});

const deckLucky = oppDeck.events.filter(
  (e) =>
    e.type === 'buff' &&
    e.meta?.stack === 'lucky' &&
    e.itemId === 'deck_of_cards',
);
ok(deckLucky.length >= 1, 'opponent deck grants lucky');
ok(
  deckLucky.every((e) => e.target === 'dummy' && e.actor === 'dummy'),
  'opponent deck lucky logs on dummy side',
);
ok(
  !deckLucky.some((e) => /Deck of Cards: \+2 Lucky/i.test(String(e.label || ''))),
  'no duplicate deck lucky port line',
);

const herbsRegen = oppDeck.events.filter(
  (e) => e.itemId === 'healing_herbs' && e.type === 'buff',
);
ok(herbsRegen.length >= 1, 'opponent herbs grant regen');
ok(
  herbsRegen.every((e) => e.target === 'dummy' && e.actor === 'dummy'),
  'opponent herbs regen logs on dummy side',
);

const fightEndIdx = vs.events.findIndex((e) => e.type === 'fight_end');
ok(fightEndIdx === vs.events.length - 1, 'fight_end is the last event');
const lastDmg = [...vs.events].reverse().find((e) => e.type === 'damage');
const fightEnd = vs.events[fightEndIdx];
ok(
  !lastDmg || fightEnd.t + 1e-9 >= lastDmg.t,
  'fight_end timestamp is not before the final damage event',
);

const regenFull = oppDeck.events.filter(
  (e) =>
    e.type === 'heal' &&
    e.meta?.stack === 'regeneration' &&
    String(e.label || '').startsWith('Regeneration:'),
);
ok(regenFull.length >= 1, 'regen tick uses Regeneration label (not generic Heal +N)');
ok(
  !oppDeck.events.some(
    (e) => e.type === 'heal' && e.meta?.flushed && e.meta?.stack === 'regeneration',
  ),
  'no duplicate flushed regen heal line',
);

// Your Heat must not appear on opponent piece tip snapshots.
{
  const burning = {
    id: 'burning_torch',
    name: 'Burning Torch',
    type: 'Melee Weapon',
    cooldown: 1.4,
    staminaCost: 1,
    damageMin: 2,
    damageMax: 3,
    accuracy: 90,
    shape: [[1]],
    params: { heat: 10, p1: 10 },
  };
  const heatRun = simulateEngine({
    placements: [{ id: 'burning_torch', x: 0, y: 0, r: 0, key: 'you:torch' }],
    opponentPlacements: [{ id: 'wooden_sword', x: 0, y: 0, r: 0, key: 'them:sword' }],
    itemsById: new Map([
      ['burning_torch', burning],
      ['wooden_sword', wooden],
    ]),
    durationSec: 6,
    seed: 19,
  });
  const oppKey = Object.keys(heatRun.pieceSnapshots?.[1]?.byKey || {}).find((k) =>
    String(k).startsWith('opp:'),
  );
  const sawPlayerHeat = (heatRun.summary?.player?.heat || 0) > 0;
  let oppHeatMod = false;
  for (const snap of heatRun.pieceSnapshots || []) {
    const live = oppKey ? snap.byKey?.[oppKey] : null;
    if (!live) continue;
    if ((live.statMods || []).some((m) => m.stat === 'speed' && m.source === 'Heat')) {
      oppHeatMod = true;
      break;
    }
  }
  ok(sawPlayerHeat, 'player gained heat from burning torch');
  ok(!oppHeatMod, 'opponent tip snapshots do not list player Heat');
}

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nvs-board smoke passed');

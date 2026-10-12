/**
 * Regression for source-accurate stun application and target state.
 * Run: node scripts/sim-stun-behavior-smoke.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const game = JSON.parse(readFileSync('scripts/_cache/game-items.json', 'utf8'));
const descr = JSON.parse(readFileSync('scripts/_cache/game-descr.json', 'utf8'));
const hammer = structuredClone(game.items.find((item) => item.id === 'hammer'));
assert.ok(hammer, 'catalog Hammer exists');
hammer.chance = 100;
hammer.accuracy = 100;
hammer.effect = descr.items.find((item) => item.id === 'hammer')?.effect;
const canAffect = {
  rulesById: JSON.parse(readFileSync('assets/data/can-affect-rules.json', 'utf8')).byId,
};

const itemsById = new Map([[hammer.id, hammer]]);
const placement = { id: 'hammer', key: 'hammer', x: 0, y: 0, r: 0 };

function stunEvents(result) {
  return result.events.filter((event) => event.meta?.stack === 'stun');
}

const playerHammer = simulateEngine({
  placements: [placement],
  itemsById,
  canAffect,
  seed: 2965184550,
  durationSec: 6,
  dummyAttacks: true,
});
const playerStuns = stunEvents(playerHammer);
assert.equal(playerStuns.length, 1, 'a Hammer proc produces one stun event, not a generic + scripted pair');
assert.equal(playerStuns[0].target, 'dummy', 'player Hammer targets the training dummy');
assert.equal(playerStuns[0].amount, 0.5, 'the stun event carries the actual duration');
assert.equal(playerStuns[0].meta.handler, 'hammer', 'the stun event keeps Hammer provenance');
assert.equal(
  playerHammer.summary.dummy.stunnedUntil,
  playerStuns[0].t + playerStuns[0].amount,
  'the stunned target state ends at the event duration',
);
assert.equal(
  playerHammer.events.some(
    (event) =>
      event.actor === 'dummy' &&
      event.meta?.systemOrigin === 'Training Dummy' &&
      event.t > playerStuns[0].t &&
      event.t < playerStuns[0].t + playerStuns[0].amount,
  ),
  false,
  'the training dummy cannot swing while stunned',
);

const opponentHammer = simulateEngine({
  placements: [],
  opponentPlacements: [{ ...placement, key: 'opp-hammer' }],
  itemsById,
  canAffect,
  seed: 2965184550,
  durationSec: 6,
  dummyAttacks: false,
});
const opponentStuns = stunEvents(opponentHammer);
assert.equal(opponentStuns.length, 1, 'an opponent Hammer proc produces one stun event');
assert.equal(opponentStuns[0].target, 'player', 'an opponent Hammer targets the player, not the dummy');
assert.equal(opponentStuns[0].actor, 'dummy', 'the opponent Hammer event is owned by the opponent board');
assert.equal(
  opponentHammer.summary.player.stunnedUntil,
  opponentStuns[0].t + opponentStuns[0].amount,
  'opponent stun updates the player state used by the simulator',
);

console.log('Simulator stun behavior smoke passed.');

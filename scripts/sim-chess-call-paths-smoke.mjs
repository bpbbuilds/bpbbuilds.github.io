import assert from 'node:assert/strict';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { tickTimedResistances } from '../js/pages/sim/engine/timed-resistance.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { dispatchChessCapture, dispatchChessElimination } from '../js/pages/sim/engine/chess.js';

const IDS = [
  'black_bishop', 'black_king', 'black_knight', 'black_pawn', 'black_queen', 'black_rook',
  'white_bishop', 'white_king', 'white_knight', 'white_pawn', 'white_queen', 'white_rook',
];

const rng = () => 0;

function piece(itemId, side, params = {}) {
  return {
    itemId,
    name: itemId,
    placementKey: `${side}:${itemId}`,
    side,
    params,
    kind: IDS.includes(itemId) ? 'passive' : 'weapon',
    alive: true,
    empowerable: true,
    critChance: 0,
    speedScale: 0,
    staminaCost: 0,
  };
}

function world(youPieces = [], themPieces = []) {
  const board = { speedScale: 0, addSpeed(amount) { this.speedScale += amount; } };
  return {
    you: createActor('player'),
    them: createActor('dummy'),
    youGraph: { pieces: new Map(), filled: new Set() },
    themGraph: { pieces: new Map(), filled: new Set() },
    youPieces,
    themPieces,
    t: 0,
    rng,
    events: [],
    itemsById: new Map(),
    canAffect: null,
    youDeck: { i: 0 },
    themDeck: { i: 0 },
    youCardKeys: [],
    themCardKeys: [],
    bus: createCombatBus(),
    board,
  };
}

function capture(w, capturing, eliminated) {
  dispatchChessCapture(capturing, eliminated, w);
}

function eliminate(w, eliminated, capturing) {
  dispatchChessElimination(eliminated, capturing, w);
}

for (const id of IDS) assert.ok(getScriptHandler(id), `${id} has a registered handler`);

{
  const bishop = piece('black_bishop', 'them', { debuffs: 5, healreduction: 20, healthreduction: 20 });
  const target = piece('white_pawn', 'you');
  const w = world([target], [bishop]);
  capture(w, bishop, target);
  assert.equal(w.you.stacks.poison, 5, 'black bishop inflicts five random debuffs');
  eliminate(w, bishop, target);
  assert.equal(w.you._healAmp, -0.2, 'black bishop reduces the capturer healing efficiency');
  assert.equal(w.you._maxHealthGain, -0.2, 'black bishop reduces the capturer max-health gain');
}

{
  const weapon = piece('wooden_sword', 'them');
  const king = piece('black_king', 'them', { speed: 5, buffs: 2 });
  const target = piece('white_pawn', 'you');
  const w = world([target], [king, weapon]);
  w.you.stacks.lucky = 3;
  capture(w, king, target);
  assert.equal(weapon.speedScale, 0.05, 'black king speeds its side weapons');
  assert.equal(w.you.stacks.lucky, 1, 'black king removes two buffs on the first black capture');
}

{
  const knight = piece('black_knight', 'them', { vampirism: 3, stamina: 2.5 });
  const target = piece('white_pawn', 'you');
  const w = world([target], [knight]);
  w.you.stamina = 5;
  capture(w, knight, target);
  assert.equal(w.them.stacks.vampirism, 3, 'black knight grants vampirism to its owner');
  eliminate(w, knight, target);
  assert.equal(w.you.stamina, 2.5, 'black knight drains the capturer stamina');
}

{
  const pawn = piece('black_pawn', 'them', { mana: 3, poison: 2 });
  const target = piece('white_pawn', 'you');
  const w = world([target], [pawn]);
  capture(w, pawn, target);
  assert.equal(w.them.stacks.mana, 3, 'black pawn grants mana to its owner');
  eliminate(w, pawn, target);
  assert.equal(w.you.stacks.poison, 2, 'black pawn poisons the capturer');
}

{
  const queen = piece('black_queen', 'them', { buffs: 4, dur: 1.3 });
  const target = piece('white_pawn', 'you');
  const w = world([target], [queen]);
  w.you.stacks.lucky = 4;
  capture(w, queen, target);
  assert.equal(w.you.stacks.lucky, 0, 'black queen steals four buffs on the first capture');
  assert.equal(w.them.stacks.lucky, 4, 'black queen gives stolen buffs to its owner');
  eliminate(w, queen, target);
  assert.equal(w.you.stunnedUntil, 1.3, 'black queen stuns the capturer');
}

{
  const rook = piece('black_rook', 'them', { spikes: 3, crit: 35, dur: 3 });
  const weapon = piece('wooden_sword', 'them');
  const target = piece('white_pawn', 'you');
  const w = world([target], [rook, weapon]);
  capture(w, rook, target);
  assert.equal(w.them.stacks.spikes, 3, 'black rook grants spikes to its owner');
  eliminate(w, rook, target);
  assert.equal(weapon.critChance, 35, 'black rook raises its side weapon crit rate');
  w.t = 3;
  getScriptHandler('black_rook').onTick(rook, { ...w, player: w.them, dummy: w.you, pieces: w.themPieces });
  assert.equal(weapon.critChance, 0, 'black rook expires its temporary crit rate');
}

{
  const bishop = piece('white_bishop', 'you', { cleanse: 10, healamp: 25 });
  const target = piece('black_pawn', 'them');
  const w = world([bishop], [target]);
  w.you.stacks.poison = 4;
  capture(w, bishop, target);
  assert.equal(w.you.stacks.poison, 0, 'white bishop cleanses its owner debuffs');
  eliminate(w, bishop, target);
  assert.equal(w.you._healAmp, 0.25, 'white bishop increases its owner healing efficiency');
}

{
  const king = piece('white_king', 'you', { empower: 1, buffs: 2 });
  const target = piece('black_pawn', 'them');
  const w = world([king], [target]);
  capture(w, king, target);
  assert.equal(w.you.stacks.empower, 1, 'white king empowers its owner on capture');
  assert.equal(w.you.stacks.lucky + w.you.stacks.regeneration, 2, 'white king gives two random buffs on first white capture');
}

{
  const knight = piece('white_knight', 'you', { speed: 50, stamina: 2.5 });
  const target = piece('black_pawn', 'them');
  const w = world([knight], [target]);
  capture(w, knight, target);
  assert.equal(w.board.speedScale, 0.5, 'white knight speeds the chess board state');
  eliminate(w, knight, target);
  assert.equal(w.you.temporaryMaxStamina, 2.5, 'white knight grants temporary max stamina');
}

{
  const pawn = piece('white_pawn', 'you', { luck: 1, regen: 2 });
  const target = piece('black_pawn', 'them');
  const w = world([pawn], [target]);
  capture(w, pawn, target);
  assert.equal(w.you.stacks.regeneration, 2, 'white pawn grants regeneration');
  eliminate(w, pawn, target);
  assert.equal(w.you.stacks.lucky, 1, 'white pawn grants luck when eliminated');
}

{
  const queen = piece('white_queen', 'you', { heat1: 8, heat2: 2, dur: 1.3 });
  const target = piece('black_pawn', 'them');
  const second = piece('black_rook', 'them');
  const w = world([queen], [target, second]);
  capture(w, queen, target);
  capture(w, queen, second);
  assert.equal(w.you.stacks.heat, 10, 'white queen grants first-capture heat then normal heat');
  eliminate(w, queen, target);
  assert.equal(w.you.invulnUntil, 1.3, 'white queen grants owner invulnerability');
}

{
  const rook = piece('white_rook', 'you', { dam: 35, dur: 3 });
  const target = piece('black_pawn', 'them');
  const w = world([rook], [target]);
  capture(w, rook, target);
  assert.equal(w.you.block, 35, 'white rook grants its owner block');
  eliminate(w, rook, target);
  assert.equal(w.you.damageResistancePct, 35, 'white rook grants timed owner damage resistance');
  w.t = 3;
  tickTimedResistances([w.you], 3);
  assert.equal(w.you.damageResistancePct, 0, 'white rook expires timed damage resistance');
}

console.log(`sim-chess-call-paths-smoke: ${IDS.length}/${IDS.length} chess handlers and source effects passed`);

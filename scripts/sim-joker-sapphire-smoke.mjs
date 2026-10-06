import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { bindBuffCombatLog, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { dealHit } from '../js/pages/sim/engine/scripts/handlers.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { prepareGemSockets } from '../js/pages/sim/engine/gem-sockets.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';
import { takeDamage } from '../js/pages/sim/engine/damage.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

function card(id, key) {
  const item = byId.get(id);
  return {
    itemId: id,
    placementKey: key,
    name: item.name,
    params: item.params,
    kind: 'card',
    alive: true,
    _revealed: false,
    _revealing: false,
  };
}

function withCombatLog(events, dummy, fn) {
  bindBuffCombatLog({ events, getT: () => 5, dummy });
  try {
    return fn();
  } finally {
    unbindBuffCombatLog();
  }
}

for (const id of ['joker', 'perfect_sapphire', 'flawless_sapphire']) {
  assert.equal(getScriptHandler(id)?.handlerId, id, `${id} has its explicit handler`);
}
assert.equal(inventory.byId.joker.file, 'Exclusive/Joker.gd');
assert.equal(inventory.byId.perfect_sapphire.file, 'Gems/Sapphire.gd');
assert.equal(inventory.byId.flawless_sapphire.file, 'Gems/Sapphire.gd');

// Joker pairs grant a CritResist stack, which cancels (and consumes on) the
// next actual critical hit rather than becoming an outbound crit token.
{
  const attacker = createActor('player');
  const defender = createActor('dummy');
  defender.critResistStacks = 1;
  const events = [];
  const hit = takeDamage(defender, attacker, {
    amount: 20,
    isAttack: true,
    canMiss: false,
    canCrit: true,
    critChance: 100,
    events,
    nowT: 5,
    rng: () => 0,
  });
  assert.equal(hit.critical, false, 'crit-resist stack cancels the critical');
  assert.equal(hit.damage, 20, 'cancelled critical does not double damage');
  assert.equal(defender.critResistStacks, 0, 'crit-resist stack is consumed');
  assert.equal(events.at(-1)?.meta?.stat, 'crit_resist_stacks');
}

// Joker.gd invokes another card's doRevealEffect directly. Four prior Aces
// form one quadruple; the picked Ace applies its effect and logs activation,
// but must remain face-down with its cooldown untouched.
{
  const joker = card('joker', 'joker');
  joker._chainPos = 5;
  const aces = [0, 1, 2, 3].map((i) => {
    const ace = card('ace_of_spades', `ace:${i}`);
    ace.cooldown = 7 + i;
    ace.triggerTime = 7 + i;
    return ace;
  });
  const filler = card('darkest_lotus', 'lotus');
  filler.cooldown = 12;
  filler.triggerTime = 12;
  const deck = { placementKey: 'deck', _cards: [...aces, filler, joker] };
  joker._deckKey = deck.placementKey;
  for (let i = 0; i < deck._cards.length; i += 1) {
    deck._cards[i]._chainPos = i;
    deck._cards[i]._deckKey = deck.placementKey;
  }
  const player = createActor('player');
  const events = [];
  withCombatLog(events, createActor('dummy'), () =>
    getScriptHandler('joker').onCooldownEffect(joker, {
      player,
      dummy: createActor('dummy'),
      events,
      rng: () => 0,
      t: 5,
      pieces: [deck, ...deck._cards],
      itemsById: byId,
    }),
  );
  const chosen = aces[0];
  assert.equal(player.critStacks, 2, 'one quadruple dispatches Joker\'s two source-configured card reveals');
  assert.equal(chosen._revealed, false, 'direct doRevealEffect does not reveal the chosen card');
  assert.equal(chosen._revealing, false, 'direct doRevealEffect does not arm the chosen card');
  assert.equal(chosen.cooldown, 7, 'direct doRevealEffect keeps the chosen cooldown');
  assert.equal(chosen.triggerTime, 7, 'direct doRevealEffect keeps the chosen trigger time');
  const aceActivate = events.find((event) => event.placementKey === chosen.placementKey && event.type === 'activate');
  const jokerActivate = events.find((event) => event.placementKey === joker.placementKey && event.type === 'activate');
  assert.ok(aceActivate && jokerActivate && events.indexOf(aceActivate) < events.indexOf(jokerActivate));
}

// Sapphire.gd rolls in pre_deal_damage_late. Its spectral flag removes Block
// from this host strike, then its `attacked` hook grants Mana and Cold only
// for a spectral hit. Exercise both tiers on both boards through dealHit.
for (const gemId of ['perfect_sapphire', 'flawless_sapphire']) {
  for (const side of ['you', 'them']) {
    const [weapon] = buildCombatPieces(
      [{ id: 'wooden_sword', key: `${side}:${gemId}`, x: 0, y: 0, r: 0, side, gems: [gemId] }],
      byId,
    );
    weapon.side = side;
    weapon.damageMin = 30;
    weapon.damageMax = 30;
    weapon.accuracy = 100;
    const player = createActor(side === 'you' ? 'player' : 'dummy');
    const dummy = createActor(side === 'you' ? 'dummy' : 'player', { block: 999 });
    const bus = createCombatBus();
    const events = [];
    const ctx = {
      player,
      dummy,
      events,
      rng: () => 0,
      t: 5,
      bus,
      itemsById: byId,
      notifyPreDealDamageLate(host, _hitCtx, res) {
        for (const fn of host._preDealLate || []) fn(res);
      },
    };
    withCombatLog(events, side === 'them' ? player : dummy, () => {
      prepareGemSockets(weapon, ctx);
      dealHit(weapon, ctx, 30, `${gemId}: test`);
    });
    assert.equal(dummy.block, 999, `${gemId} on ${side} leaves Block untouched when spectral`);
    assert.ok(dummy.hp < dummy.maxHp, `${gemId} on ${side} damages through Block`);
    assert.ok(player.stacks.mana > 0, `${gemId} on ${side} grants Mana after the spectral hit`);
    assert.ok(dummy.stacks.cold > 0, `${gemId} on ${side} inflicts Cold after the spectral hit`);
  }
}

// Exercise the real scheduler/context path as well: the late callback travels
// through simulateEngine -> ctxForPiece -> combat-activate -> takeDamage.
{
  const run = simulateEngine({
    placements: [{ id: 'wooden_sword', key: 'sapphire:sword', x: 0, y: 0, r: 0, gems: ['perfect_sapphire'] }],
    itemsById: byId,
    durationSec: 8,
    seed: 0x5a77,
    dummyBlock: 999,
    dummyAttacks: false,
  });
  assert.equal(run.dummyStartBlock, 999);
  assert.ok(run.dummyEndHp < run.dummyMaxHp, 'scheduled socketed Sapphire attack bypasses the training dummy Block');
  assert.ok(run.summary.player.mana > 0, 'scheduled socketed Sapphire grants Mana after the hit');
  assert.ok(run.summary.dummy.cold > 0, 'scheduled socketed Sapphire inflicts Cold after the hit');
}

console.log('OK Joker direct reveal dispatch and perfect/flawless Sapphire late spectral sockets');

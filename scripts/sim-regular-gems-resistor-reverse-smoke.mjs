import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { bindBuffCombatLog, collapseDuplicateBuffLogs, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { dealHit } from '../js/pages/sim/engine/scripts/handlers.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { prepareGemSockets } from '../js/pages/sim/engine/gem-sockets.js';
import { deliverCharge } from '../js/pages/sim/engine/charge-delivery.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { collapseDuplicateBuffLogs as collapseLogs } from '../js/pages/sim/engine/buff-log.js';
import { pieceSpeed } from '../js/pages/sim/engine/piece-stats.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

const GEM_CASES = [
  ['regular_emerald', 'Gems/RegularEmerald.tscn', 'Gems/Emerald.gd'],
  ['regular_ruby', 'Gems/RegularRuby.tscn', 'Gems/Ruby.gd'],
  ['regular_sapphire', 'Gems/RegularSapphire.tscn', 'Gems/Sapphire.gd'],
  ['regular_topaz', 'Gems/RegularTopaz.tscn', 'Gems/Topaz.gd'],
];

function itemPiece(id, key, side = 'you') {
  const item = byId.get(id);
  return {
    itemId: id,
    placementKey: key,
    name: item.name,
    params: item.params,
    side,
    alive: true,
    cooldown: item.cooldown ?? 999,
    triggerTime: item.cooldown ?? 999,
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

for (const [id, sceneFile, file] of GEM_CASES) {
  const row = inventory.byId[id];
  assert.equal(row?.sceneFile, sceneFile, `${id} scene alias`);
  assert.equal(row?.file, file, `${id} inherited source script`);
  assert.equal(row?.extends, 'Gem', `${id} inherits Gem`);
  assert.equal(getScriptHandler(id)?.handlerId, id, `${id} explicit runtime handler`);
}
assert.equal(inventory.byId.resistor.file, 'Exclusive/Resistor.gd');
assert.deepEqual(inventory.byId.resistor.overrides, ['onChargeReceived']);
assert.equal(inventory.byId.reverse.file, 'Exclusive/Reverse.gd');
assert.deepEqual(inventory.byId.reverse.overrides, ['doRevealEffect']);

// Backpack effects use each scene's inherited Gem script and consume after
// the effect. Check exact catalog parameters and both actor sides.
for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const foe = createActor(side === 'you' ? 'dummy' : 'player');
  owner.hp = Math.max(1, owner.maxHp - 20);
  const events = [];
  withCombatLog(events, foe, () => {
    const id = 'regular_emerald';
    getScriptHandler(id).onCooldownEffect(itemPiece(id, `${side}:emerald`, side), {
      player: owner,
      dummy: foe,
      events,
      rng: () => 0,
      t: 5,
    });
  });
  collapseLogs(events);
  assert.equal(owner.stacks.regeneration, 3, `Regular Emerald regeneration on ${side}`);
  assert.equal(events.at(-1)?.type, 'activate', `Regular Emerald consumes after effect on ${side}`);
}

{
  const owner = createActor('player');
  const foe = createActor('dummy');
  owner.hp = 50;
  const events = [];
  withCombatLog(events, foe, () => {
    getScriptHandler('regular_ruby').onCooldownEffect(itemPiece('regular_ruby', 'ruby'), {
      player: owner,
      dummy: foe,
      events,
      rng: () => 0,
      t: 5,
    });
  });
  collapseLogs(events);
  assert.equal(foe.hp, foe.maxHp - 10, 'Regular Ruby deals its p3 effect damage');
  assert.equal(owner.hp, 65, 'Regular Ruby heals p3 × lifesteal_factor');
  const damage = events.find((event) => event.type === 'damage' && event.itemId === 'regular_ruby');
  const heal = events.find((event) => event.type === 'heal' && event.itemId === 'regular_ruby');
  assert.ok(damage && heal && events.indexOf(damage) < events.indexOf(heal), 'Ruby damage precedes lifesteal heal');
}

{
  const owner = createActor('player');
  const foe = createActor('dummy');
  const events = [];
  withCombatLog(events, foe, () => {
    getScriptHandler('regular_sapphire').onCooldownEffect(itemPiece('regular_sapphire', 'sapphire'), {
      player: owner,
      dummy: foe,
      events,
      rng: () => 0,
      t: 5,
    });
  });
  collapseLogs(events);
  assert.equal(foe.stacks.cold, 4, 'Regular Sapphire backpack inflicts p5 Cold');
  assert.equal(events.at(-1)?.type, 'activate', 'Regular Sapphire consumes after effect');
}

for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const foe = createActor(side === 'you' ? 'dummy' : 'player');
  const events = [];
  getScriptHandler('regular_topaz').onPrepare(itemPiece('regular_topaz', `${side}:topaz`, side), {
    player: owner,
    dummy: foe,
    events,
    t: 0,
  });
  assert.equal(owner.staminaRegen, 1.2, `Regular Topaz backpack stamina regeneration on ${side}`);
}

// Shared Gem socket lifecycle: Emerald poison, Ruby lifesteal, Sapphire's
// late spectral hit, and Topaz weapon/armor stats all work from both boards.
for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const foe = createActor(side === 'you' ? 'dummy' : 'player');
  const events = [];
  const [weapon] = buildCombatPieces(
    [{ id: 'wooden_sword', key: `${side}:gems`, x: 0, y: 0, r: 0, side, gems: ['regular_emerald', 'regular_ruby'] }],
    byId,
  );
  weapon.side = side;
  weapon.damageMin = 20;
  weapon.damageMax = 20;
  weapon.accuracy = 100;
  const bus = createCombatBus();
  const ctx = {
    player: owner,
    dummy: foe,
    events,
    rng: () => 0,
    t: 5,
    bus,
    itemsById: byId,
    notifyPreDealDamageLate(host, _hitCtx, res) {
      for (const fn of host._preDealLate || []) fn(res);
    },
  };
  withCombatLog(events, foe, () => {
    prepareGemSockets(weapon, ctx);
    dealHit(weapon, ctx, 20, `regular-gems:${side}`);
  });
  assert.equal(foe.stacks.poison, 1, `Regular Emerald weapon poison on ${side}`);
  assert.equal(owner.hp, owner.maxHp, `Regular Ruby weapon lifesteal is capped at max HP on ${side}`);
  assert.ok(events.some((event) => event.type === 'damage'), `socketed gems emit hit damage on ${side}`);
}

for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const foe = createActor(side === 'you' ? 'dummy' : 'player', { block: 999 });
  const events = [];
  const [weapon] = buildCombatPieces(
    [{ id: 'wooden_sword', key: `${side}:sapphire`, x: 0, y: 0, r: 0, side, gems: ['regular_sapphire'] }],
    byId,
  );
  weapon.side = side;
  weapon.damageMin = 30;
  weapon.damageMax = 30;
  weapon.accuracy = 100;
  const ctx = {
    player: owner,
    dummy: foe,
    events,
    rng: () => 0,
    t: 5,
    bus: createCombatBus(),
    itemsById: byId,
    notifyPreDealDamageLate(host, _hitCtx, res) {
      for (const fn of host._preDealLate || []) fn(res);
    },
  };
  withCombatLog(events, foe, () => {
    prepareGemSockets(weapon, ctx);
    dealHit(weapon, ctx, 30, `regular-sapphire:${side}`);
  });
  assert.equal(foe.block, 999, `Regular Sapphire spectral hit bypasses Block on ${side}`);
  assert.ok(owner.stacks.mana > 0 && foe.stacks.cold > 0, `Regular Sapphire post-hit effects on ${side}`);
}

for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const foe = createActor(side === 'you' ? 'dummy' : 'player');
  const events = [];
  const [weapon] = buildCombatPieces(
    [{ id: 'wooden_sword', key: `${side}:topaz`, x: 0, y: 0, r: 0, side, gems: ['regular_topaz'] }],
    byId,
  );
  weapon.side = side;
  prepareGemSockets(weapon, {
    player: owner,
    dummy: foe,
    events,
    rng: () => 0,
    t: 0,
    bus: createCombatBus(),
    itemsById: byId,
  });
  assert.equal(pieceSpeed(weapon, owner.stacks), 1.2, `Regular Topaz weapon speed on ${side}`);
  const [armor] = buildCombatPieces(
    [{ id: 'leather_armor', key: `${side}:topaz-armor`, x: 0, y: 0, r: 0, side, gems: ['regular_topaz'] }],
    byId,
  );
  armor.side = side;
  prepareGemSockets(armor, {
    player: owner,
    dummy: foe,
    events,
    rng: () => 0,
    t: 0,
    bus: createCombatBus(),
    itemsById: byId,
  });
  assert.equal(owner.stunResistance, 20, `Regular Topaz stun resistance on ${side}`);
  assert.equal(owner.critResistance, 10, `Regular Topaz crit resistance on ${side}`);
}

// Resistor.gd reacts to every delivered charge while Heat is below heatt;
// once the threshold is reached it only plays the failed animation and does
// not grant more Heat or a mini activation.
for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const foe = createActor(side === 'you' ? 'dummy' : 'player');
  const piece = itemPiece('resistor', `${side}:resistor`, side);
  const events = [];
  withCombatLog(events, foe, () => {
    deliverCharge(piece, {
      player: owner,
      dummy: foe,
      events,
      rng: () => 0,
      t: 5,
    });
  });
  collapseLogs(events);
  assert.equal(owner.stacks.heat, 3, `Resistor grants heat below threshold on ${side}`);
  assert.ok(events.some((event) => event.meta?.miniActivate), `Resistor emits a VFX-only mini activation on ${side}`);

  owner.stacks.heat = 20;
  const before = events.length;
  deliverCharge(piece, {
    player: owner,
    dummy: foe,
    events,
    rng: () => 0,
    t: 6,
  });
  assert.equal(owner.stacks.heat, 20, `Resistor stops granting at threshold on ${side}`);
  assert.equal(events.length, before, `Resistor failed charge has no combat-log effect on ${side}`);
}

// Reverse.gd grants consumable Reflect stacks (not a percentage chance), and
// steals a random buff only when there are no earlier duplicate cards.
{
  const player = createActor('player');
  const dummy = createActor('dummy');
  dummy.stacks.heat = 2;
  const reverse = itemPiece('reverse', 'reverse:0');
  reverse._deckKey = 'deck';
  reverse._chainPos = 0;
  const deck = { placementKey: 'deck', _cards: [reverse] };
  const events = [];
  withCombatLog(events, dummy, () => {
    getScriptHandler('reverse').onRevealEffect(reverse, {
      player,
      dummy,
      events,
      rng: () => 0,
      t: 5,
      pieces: [deck, reverse],
      itemsById: byId,
    });
  });
  collapseLogs(events);
  assert.equal(player.debuffReflectStacks, 3, 'Reverse grants three Reflect stacks');
  assert.equal(player.debuffReflectChance, 0, 'Reverse does not grant percentage reflect chance');
  assert.equal(dummy.stacks.heat, 0, 'Reverse steals up to its source-configured three buffs');
  assert.equal(player.stacks.heat, 2, 'Reverse gives all available stolen buffs to its owner');
  assert.ok(events.some((event) => event.meta?.stat === 'reflect_stacks'), 'Reverse Reflect change reaches HUD/log stats');

  const duplicate = itemPiece('reverse', 'reverse:2');
  duplicate._deckKey = 'deck2';
  duplicate._chainPos = 2;
  const duplicateDeck = {
    placementKey: 'deck2',
    _cards: [itemPiece('reverse', 'reverse:1'), itemPiece('reverse', 'reverse:prior'), duplicate],
  };
  duplicateDeck._cards.forEach((card, index) => {
    card._deckKey = duplicateDeck.placementKey;
    card._chainPos = index;
  });
  const beforeSteal = player.stacks.heat;
  getScriptHandler('reverse').onRevealEffect(duplicate, {
    player,
    dummy,
    events,
    rng: () => 0,
    t: 6,
    pieces: [duplicateDeck, ...duplicateDeck._cards],
    itemsById: byId,
  });
  assert.equal(player.stacks.heat, beforeSteal, 'Reverse duplicate suppresses its secondary buff steal');
}

console.log('OK Regular Emerald/Ruby/Sapphire/Topaz, Resistor, and Reverse source ports');

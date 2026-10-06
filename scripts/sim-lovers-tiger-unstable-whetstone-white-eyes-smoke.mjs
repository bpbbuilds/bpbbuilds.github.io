import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { bindBuffPowerPieces, unbindBuffPowerPieces } from '../js/pages/sim/engine/buff-power.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { dealHit } from '../js/pages/sim/engine/scripts/handlers.js';
import { prepareGemSockets } from '../js/pages/sim/engine/gem-sockets.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

const CASES = [
  ['the_lovers', 'TheLovers.gd', null],
  ['tiger_rune', 'Exclusive/TigerRune.gd', null],
  ['unstable_recombobulator', 'Exclusive/Recombobulator.gd', 'Exclusive/UnstableRecombobulator.tscn'],
  ['whetstone2', 'Whetstone.gd', 'Exclusive/Whetstone2.tscn'],
  ['white_eyes_blue_dragon', 'White-EyesBlueDragon.gd', null],
];

function itemPiece(id, key, side = 'you') {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item.name,
    params: item.params || {},
    side,
    alive: true,
    charges: 1,
    cooldown: item.cooldown ?? 999,
    triggerTime: item.cooldown ?? 999,
    blockGrant: Number(item.block) || 0,
  };
}

function ctx(player, dummy, events, bus, pieces = [], extra = {}) {
  return {
    player,
    dummy,
    events,
    bus,
    pieces,
    itemsById: byId,
    rng: () => 0,
    t: 5,
    ...extra,
  };
}

for (const [id, sourceFile, sceneFile] of CASES) {
  const row = inventory.byId[id];
  assert.equal(row?.file, sourceFile, `${id} extracted source script`);
  if (sceneFile) assert.equal(row?.sceneFile, sceneFile, `${id} scene alias`);
  assert.equal(getScriptHandler(id)?.handlerId, id, `${id} runtime handler`);
}

// TheLovers.gd: every reveal steals 7 life at 100% lifesteal; even chain
// positions also add 6% healing efficiency and 2 Regeneration.
for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy', { maxHp: 100 });
  const foe = createActor(side === 'you' ? 'dummy' : 'player', { maxHp: 100 });
  owner.hp = 50;
  const card = itemPiece('the_lovers', `${side}:lovers`, side);
  card._deckKey = `${side}:deck`;
  card._chainPos = 0;
  const deck = { placementKey: card._deckKey, _cards: [card] };
  const events = [];
  getScriptHandler('the_lovers').onRevealEffect(card, ctx(owner, foe, events, createCombatBus(), [deck, card]));
  assert.equal(foe.hp, 93, `The Lovers steals source damage on ${side}`);
  assert.ok(owner.hp > 50, `The Lovers lifesteals on ${side}`);
  assert.equal(owner.stacks.regeneration, 2, `The Lovers even-chain regeneration on ${side}`);
  assert.equal(owner._healAmp, 0.06, `The Lovers even-chain healing efficiency on ${side}`);
}

// White-EyesBlueDragon.gd: block scales with its zero-based chain position,
// then it inflicts 4 Cold and reduces opponent effect damage by 10%.
for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const foe = createActor(side === 'you' ? 'dummy' : 'player');
  const card = itemPiece('white_eyes_blue_dragon', `${side}:white-eyes`, side);
  card._chainPos = 2;
  getScriptHandler('white_eyes_blue_dragon').onRevealEffect(
    card,
    ctx(owner, foe, [], createCombatBus(), [card]),
  );
  assert.equal(owner.block, 24, `White-Eyes Blue Dragon chain block on ${side}`);
  assert.equal(foe.stacks.cold, 4, `White-Eyes Blue Dragon Cold on ${side}`);
  assert.equal(foe.effectDmgFactor, -0.1, `White-Eyes Blue Dragon effect damage factor on ${side}`);
}

// Unstable Recombobulator.gd shares Recombobulator.gd's combat path with the
// stable variant; only shop fusion differs and is deliberately outside combat.
for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const foe = createActor(side === 'you' ? 'dummy' : 'player');
  owner.stacks.poison = 2;
  owner.stacks.blind = 1;
  const events = [];
  getScriptHandler('unstable_recombobulator').onCooldownEffect(
    itemPiece('unstable_recombobulator', `${side}:unstable`, side),
    ctx(owner, foe, events, createCombatBus()),
  );
  const buffs = ['lucky', 'regeneration', 'vampirism', 'spikes', 'mana', 'empower', 'heat'];
  assert.equal(buffs.reduce((sum, stack) => sum + owner.stacks[stack], 0), 1,
    `Unstable Recombobulator grants one buff on ${side}`);
  assert.equal(owner.stacks.poison + owner.stacks.blind, 2,
    `Unstable Recombobulator cleanses one debuff on ${side}`);
}

// Whetstone.gd (the Whetstone2 scene alias): every linked empowerable weapon
// receives the source +1 damage at combat start, on either board.
for (const side of ['you', 'them']) {
  const stoneKey = `${side}:whetstone`;
  const swordKey = `${side}:sword`;
  const placements = [
    { id: 'whetstone2', key: stoneKey, x: 0, y: 0, r: 0, side },
    { id: 'wooden_sword', key: swordKey, x: 1, y: 0, r: 0, side },
  ];
  const graph = buildBoardGraph(placements, byId);
  const [stone, sword] = buildCombatPieces(placements, byId);
  stone.side = sword.side = side;
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const foe = createActor(side === 'you' ? 'dummy' : 'player');
  getScriptHandler('whetstone2').onCombatStart(
    stone,
    ctx(owner, foe, [], createCombatBus(), [stone, sword], { graph, canAffect: null }),
  );
  assert.equal(sword.bonusDamage, 1, `Whetstone2 grants linked weapon damage on ${side}`);
}

// TigerRune.gd: backpack preparation amplifies all buff gains, armor sockets
// convert every 10 gained buffs into 5 Block, and weapon sockets grant 1
// Vampirism on a hit when their 50% source roll succeeds.
for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const foe = createActor(side === 'you' ? 'dummy' : 'player');
  const [tiger, source] = buildCombatPieces([
    { id: 'tiger_rune', key: `${side}:tiger`, x: 0, y: 0, r: 0, side },
    { id: 'wooden_sword', key: `${side}:source`, x: 1, y: 0, r: 0, side },
  ], byId);
  tiger.side = source.side = side;
  const prepCtx = ctx(owner, foe, [], createCombatBus(), [tiger, source]);
  getScriptHandler('tiger_rune').onPrepare(tiger, prepCtx);
  assert.equal(source.buffAmpChance, 11, `Tiger Rune amplifies source buff chance on ${side}`);

  // A 55% resistance would stop a 50% roll; Tiger's +11% amplification
  // lowers it to 44%, so the same deterministic roll now grants the buff.
  owner.stackResist.lucky = 55;
  bindBuffPowerPieces([source]);
  const gained = grantStacks(owner, 'lucky', 1, { originKey: source.placementKey, rng: () => 0.5 });
  unbindBuffPowerPieces();
  assert.equal(gained.gained, 1, `Tiger Rune bypasses buff resistance on ${side}`);

  const [armor] = buildCombatPieces([
    { id: 'leather_armor', key: `${side}:tiger-armor`, x: 0, y: 0, r: 0, side, gems: ['tiger_rune'] },
  ], byId);
  armor.side = side;
  prepareGemSockets(armor, ctx(owner, foe, [], createCombatBus(), [armor]));
  grantStacks(owner, 'heat', 10, { rng: () => 0 });
  assert.equal(owner.block, 5, `Socketed Tiger Rune converts buffs to Block on ${side}`);

  const [weapon] = buildCombatPieces([
    { id: 'wooden_sword', key: `${side}:tiger-weapon`, x: 0, y: 0, r: 0, side, gems: ['tiger_rune'] },
  ], byId);
  weapon.side = side;
  weapon.damageMin = 2;
  weapon.damageMax = 2;
  weapon.accuracy = 100;
  const weaponCtx = ctx(owner, foe, [], createCombatBus(), [weapon], {
    notifyPreDealDamageLate(host) {
      for (const fn of host._preDealLate || []) fn({ hasHit: () => true, hit: true });
    },
  });
  prepareGemSockets(weapon, weaponCtx);
  dealHit(weapon, weaponCtx, 2, `tiger:${side}`);
  assert.equal(owner.stacks.vampirism, 1, `Socketed Tiger Rune grants Vampirism on ${side}`);
}

console.log('OK The Lovers, Tiger Rune, Unstable Recombobulator, Whetstone2, and White-Eyes Blue Dragon source ports');

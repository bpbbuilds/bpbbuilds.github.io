import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { prepareGemSockets } from '../js/pages/sim/engine/gem-sockets.js';
import { dealHit } from '../js/pages/sim/engine/scripts/handlers.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

const CASES = [
  ['shortbow', 'Exclusive/Shortbow.tscn', 'Weapon.gd'],
  ['skull', 'Gems/Skull.tscn', 'Gems/Skull.gd'],
  ['stable_recombobulator', 'Exclusive/StableRecombobulator.tscn', 'Exclusive/Recombobulator.gd'],
  ['strong_heroic_potion', 'StrongHeroicPotion.tscn', 'HeroicPotion.gd'],
  ['strong_mana_potion', 'Exclusive/StrongManaPotion.tscn', 'ManaPotion.gd'],
  ['superior_ring', 'Exclusive/SuperiorRing.tscn', 'Exclusive/MagicRing.gd'],
  ['the_fool', 'TheFool.tscn', 'TheFool.gd'],
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
  };
}

function ctx(player, dummy, events, bus, pieces = []) {
  return {
    player,
    dummy,
    events,
    bus,
    pieces,
    itemsById: byId,
    rng: () => 0,
    t: 5,
  };
}

for (const [id, sceneFile, sourceFile] of CASES) {
  const row = inventory.byId[id];
  assert.equal(row?.sceneFile, sceneFile, `${id} scene alias`);
  assert.equal(row?.file, sourceFile, `${id} extracted source script`);
  assert.equal(getScriptHandler(id)?.handlerId, id, `${id} runtime handler`);
}

// Weapon.gd's inherited doCooldownEffect is the canonical Shortbow path:
// spend stamina, deal the ranged hit, then activate once. Exercise both board
// owners so the side-flipped context cannot silently become player-only.
for (const side of ['you', 'them']) {
  const player = createActor(side === 'you' ? 'player' : 'dummy');
  const dummy = createActor(side === 'you' ? 'dummy' : 'player');
  const [piece] = buildCombatPieces(
    [{ id: 'shortbow', key: `${side}:shortbow`, x: 0, y: 0, r: 0, side }],
    byId,
  );
  piece.side = side;
  piece.damageMin = 2;
  piece.damageMax = 2;
  piece.accuracy = 100;
  const events = [];
  const handled = getScriptHandler('shortbow').onCooldownEffect(
    piece,
    ctx(player, dummy, events, createCombatBus(), [piece]),
  );
  assert.equal(handled, true, `Shortbow handles its cooldown on ${side}`);
  assert.equal(player.stamina, 4.3, `Shortbow spends its source stamina cost on ${side}`);
  assert.equal(dummy.hp, dummy.maxHp - 2, `Shortbow deals its source hit on ${side}`);
  assert.ok(events.some((event) => event.type === 'activate' && event.itemId === 'shortbow'),
    `Shortbow activation is logged on ${side}`);
}

// Skull.gd's loose-gem trigger is once-only at opponent relative HP <= p1;
// it heals the owner and grants p3 Empower. Both sides use the same owner /
// opponent relation through the side-flipped context.
for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy', { maxHp: 100 });
  const foe = createActor(side === 'you' ? 'dummy' : 'player', { maxHp: 100 });
  owner.hp = 50;
  foe.hp = 20;
  const events = [];
  const bus = createCombatBus();
  const piece = itemPiece('skull', `${side}:skull`, side);
  getScriptHandler('skull').onCombatStart(piece, ctx(owner, foe, events, bus, [piece]));
  bus.emit('piece_dealt_damage', { piece: itemPiece('shortbow', `${side}:hit`, side), hit: { hit: true }, t: 5 });
  assert.equal(owner.hp, 100, `Skull heals its owner once on ${side}`);
  assert.equal(owner.stacks.empower, 5, `Skull grants source p3 Empower on ${side}`);
  bus.emit('piece_dealt_damage', { piece: itemPiece('shortbow', `${side}:hit2`, side), hit: { hit: true }, t: 6 });
  assert.equal(owner.stacks.empower, 5, `Skull remains once-only on ${side}`);
}

// Skull's socketed paths: weapon hits can steal one buff, while armor grants
// the same gem-power chance to every debuff and to crit resistance.
for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const foe = createActor(side === 'you' ? 'dummy' : 'player');
  foe.stacks.heat = 1;
  const [weapon] = buildCombatPieces(
    [{ id: 'wooden_sword', key: `${side}:skull-weapon`, x: 0, y: 0, r: 0, side, gems: ['skull'] }],
    byId,
  );
  weapon.side = side;
  weapon.damageMin = 5;
  weapon.damageMax = 5;
  weapon.accuracy = 100;
  const weaponCtx = ctx(owner, foe, [], createCombatBus(), [weapon]);
  prepareGemSockets(weapon, weaponCtx);
  dealHit(weapon, weaponCtx, 5, `skull:${side}`);
  assert.equal(foe.stacks.heat, 0, `Socketed Skull steals a buff on ${side}`);
  assert.equal(owner.stacks.heat, 1, `Socketed Skull transfers the stolen buff on ${side}`);

  const [armor] = buildCombatPieces(
    [{ id: 'leather_armor', key: `${side}:skull-armor`, x: 0, y: 0, r: 0, side, gems: ['skull'] }],
    byId,
  );
  armor.side = side;
  prepareGemSockets(armor, ctx(owner, foe, [], createCombatBus(), [armor]));
  assert.equal(owner.critResistance, 25, `Socketed Skull adds crit resistance on ${side}`);
  assert.equal(owner.stackResist.poison, 25, `Socketed Skull resists poison on ${side}`);
  assert.equal(owner.stackResist.blind, 25, `Socketed Skull resists blind on ${side}`);
  assert.equal(owner.stackResist.cold, 25, `Socketed Skull resists cold on ${side}`);
}

// Stable Recombobulator.gd's combat hook is exactly one random buff plus one
// random debuff cleanse. Shop fusion/recombobulation remains outside combat.
for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const foe = createActor(side === 'you' ? 'dummy' : 'player');
  owner.stacks.poison = 2;
  owner.stacks.blind = 1;
  const events = [];
  const piece = itemPiece('stable_recombobulator', `${side}:recomb`, side);
  getScriptHandler('stable_recombobulator').onCooldownEffect(
    piece,
    ctx(owner, foe, events, createCombatBus(), [piece]),
  );
  const buffs = ['lucky', 'regeneration', 'vampirism', 'spikes', 'mana', 'empower', 'heat'];
  assert.equal(buffs.reduce((sum, stack) => sum + owner.stacks[stack], 0), 1,
    `Stable Recombobulator grants one buff on ${side}`);
  assert.equal(owner.stacks.poison + owner.stacks.blind, 2,
    `Stable Recombobulator cleanses one debuff on ${side}`);
  assert.ok(events.some((event) => event.type === 'activate' && event.itemId === 'stable_recombobulator'),
    `Stable Recombobulator activation is logged on ${side}`);
}

// StrongHeroicPotion inherits HeroicPotion.gd: it drinks only when a stamina
// spend would starve, granting p1 stamina and p2 Empower. The catalog p3 is
// not read by the inherited source script and must not grant Lucky.
for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const foe = createActor(side === 'you' ? 'dummy' : 'player');
  owner.stamina = 0;
  const bus = createCombatBus();
  const piece = itemPiece('strong_heroic_potion', `${side}:heroic`, side);
  getScriptHandler('strong_heroic_potion').onCombatStart(piece, ctx(owner, foe, [], bus, [piece]));
  bus.emit('pre_use_stamina', { actor: owner, amount: 4, t: 5 });
  assert.equal(owner.stamina, 4, `Strong Heroic Potion grants source p1 stamina on ${side}`);
  assert.equal(owner.stacks.empower, 1, `Strong Heroic Potion grants source p2 Empower on ${side}`);
  assert.equal(owner.stacks.lucky, 0, `Strong Heroic Potion does not invent a p3 Lucky grant on ${side}`);
  assert.equal(piece.alive, false, `Strong Heroic Potion is consumed on ${side}`);
}

// StrongManaPotion inherits ManaPotion.gd: below p1 HP it grants p2 Mana and
// p3 temporary max health, then consumes. Test both side owners.
for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy', { maxHp: 200 });
  const foe = createActor(side === 'you' ? 'dummy' : 'player', { maxHp: 200 });
  owner.hp = 80;
  const bus = createCombatBus();
  const piece = itemPiece('strong_mana_potion', `${side}:mana`, side);
  getScriptHandler('strong_mana_potion').onCombatStart(piece, ctx(owner, foe, [], bus, [piece]));
  bus.emit('player_damaged', { hit: true, healthDamage: 1, t: 5 });
  assert.equal(owner.stacks.mana, 9, `Strong Mana Potion grants source p2 Mana on ${side}`);
  assert.equal(owner.maxHp, 225, `Strong Mana Potion grants source p3 max health on ${side}`);
  assert.equal(piece.alive, false, `Strong Mana Potion is consumed on ${side}`);
}

// MagicRing.gd / SuperiorRing uses generated trigger+stack effects. Inject
// deterministic effects to exercise Start, Every, own-low, and opponent-low
// source paths without making the smoke depend on a random roll.
for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy', { maxHp: 200 });
  const foe = createActor(side === 'you' ? 'dummy' : 'player', { maxHp: 200 });

  const start = itemPiece('superior_ring', `${side}:ring-start`, side);
  start._ringEffects = [{ trigger: 0, stack: 'lucky' }];
  getScriptHandler('superior_ring').onPreCombatStart(start, ctx(owner, foe, [], createCombatBus(), [start]));
  getScriptHandler('superior_ring').onCombatStart(start, ctx(owner, foe, [], createCombatBus(), [start]));
  assert.equal(owner.stacks.lucky, 5, `Superior Ring Start-of-Battle scales lucky on ${side}`);

  const every = itemPiece('superior_ring', `${side}:ring-every`, side);
  every._ringEffects = [{ trigger: 1, stack: 'poison' }];
  const everyCtx = ctx(owner, foe, [], createCombatBus(), [every]);
  getScriptHandler('superior_ring').onPreCombatStart(every, everyCtx);
  getScriptHandler('superior_ring').onCombatStart(every, everyCtx);
  getScriptHandler('superior_ring').onCooldownEffect(every, everyCtx);
  assert.equal(foe.stacks.poison, 3, `Superior Ring Every inflicts scaled poison on ${side}`);

  const ownLow = itemPiece('superior_ring', `${side}:ring-own-low`, side);
  ownLow._ringEffects = [{ trigger: 2, stack: 'empower' }];
  const ownBus = createCombatBus();
  const ownCtx = ctx(owner, foe, [], ownBus, [ownLow]);
  getScriptHandler('superior_ring').onPreCombatStart(ownLow, ownCtx);
  getScriptHandler('superior_ring').onCombatStart(ownLow, ownCtx);
  owner.hp = 90;
  ownBus.emit('player_damaged', { hit: true, healthDamage: 1, t: 6 });
  assert.equal(owner.stacks.empower, 5, `Superior Ring own-low trigger scales Empower on ${side}`);

  const oppLow = itemPiece('superior_ring', `${side}:ring-opp-low`, side);
  oppLow._ringEffects = [{ trigger: 3, stack: 'cold' }];
  const oppBus = createCombatBus();
  const oppCtx = ctx(owner, foe, [], oppBus, [oppLow]);
  getScriptHandler('superior_ring').onPreCombatStart(oppLow, oppCtx);
  getScriptHandler('superior_ring').onCombatStart(oppLow, oppCtx);
  foe.hp = 139;
  oppBus.emit('piece_dealt_damage', { piece: itemPiece('shortbow', `${side}:miss`, side), hit: { hit: false }, t: 7 });
  assert.equal(foe.stacks.cold, 0, `Superior Ring ignores a miss for opponent-low on ${side}`);
  oppBus.emit('piece_dealt_damage', { piece: itemPiece('shortbow', `${side}:hit`, side), hit: { hit: true }, t: 8 });
  assert.equal(foe.stacks.cold, 8, `Superior Ring opponent-low trigger scales Cold on ${side}`);
}

// TheFool.gd buffs only its own deck.cards, plus Empower when chainPosition 0.
// An unrelated card in another deck must not receive the reveal-speed bonus.
for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const foe = createActor(side === 'you' ? 'dummy' : 'player');
  const fool = itemPiece('the_fool', `${side}:fool`, side);
  const peer = itemPiece('reverse', `${side}:peer`, side);
  const unrelated = itemPiece('joker', `${side}:unrelated`, side);
  fool._deckKey = `${side}:deck`;
  fool._chainPos = 0;
  peer._deckKey = fool._deckKey;
  peer._chainPos = 1;
  unrelated._deckKey = `${side}:other-deck`;
  unrelated._chainPos = 0;
  const deck = { placementKey: fool._deckKey, _cards: [fool, peer] };
  const otherDeck = { placementKey: unrelated._deckKey, _cards: [unrelated] };
  const events = [];
  getScriptHandler('the_fool').onRevealEffect(
    fool,
    ctx(owner, foe, events, createCombatBus(), [deck, otherDeck, fool, peer, unrelated]),
  );
  assert.equal(fool.speedScale, 0.5, `The Fool speeds itself on ${side}`);
  assert.equal(peer.speedScale, 0.5, `The Fool speeds cards in its deck on ${side}`);
  assert.equal(unrelated.speedScale || 0, 0, `The Fool leaves other decks untouched on ${side}`);
  assert.equal(owner.stacks.empower, 1, `The Fool grants secondary Empower on ${side}`);
}

console.log('OK Shortbow, Skull, Stable/Strong potions, Superior Ring, and The Fool source ports');

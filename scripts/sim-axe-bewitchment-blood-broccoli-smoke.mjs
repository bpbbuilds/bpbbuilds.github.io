import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { buildBoardGraph, affectedTargets } from '../js/pages/sim/engine/board-graph.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { dealHit } from '../js/pages/sim/engine/scripts/handlers.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = { rulesById: rules.byId || null };

const CASES = [
  ['axe', 'Exclusive/Axe.tscn', 'Exclusive/Axe.gd'],
  ['bewitchment', 'Exclusive/Bewitchment.tscn', 'Exclusive/Bewitchment.gd'],
  ['blood_amulet', 'BloodAmulet.tscn', 'BloodAmulet.gd'],
  ['bloody_dagger', 'BloodyDagger.tscn', 'BloodyDagger.gd'],
  ['broccoli', 'Exclusive/Broccoli.tscn', 'Exclusive/Broccoli.gd'],
  ['broccotree', 'Exclusive/Broccotree.tscn', 'Exclusive/Broccotree.gd'],
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
    canAffect,
    notifyPreDealDamageEarly(piece, hitCtx, res) {
      getScriptHandler(piece.itemId)?.onPreDealDamageEarly?.(piece, hitCtx, res);
    },
    ...extra,
  };
}

for (const [id, sceneFile, sourceFile] of CASES) {
  const row = inventory.byId[id];
  assert.equal(row?.sceneFile, sceneFile, `${id} scene alias`);
  assert.equal(row?.file, sourceFile, `${id} extracted source script`);
  assert.equal(getScriptHandler(id)?.handlerId, id, `${id} explicit runtime handler`);
}

// Axe.gd: every successful early hit permanently adds p1 damage, including
// the hit currently being rolled. Exercise both board owners and two strikes.
for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const foe = createActor(side === 'you' ? 'dummy' : 'player', { maxHp: 100 });
  const piece = itemPiece('axe', `${side}:axe`, side);
  piece.damageMin = piece.damageMax = 3;
  piece.accuracy = 100;
  const events = [];
  const handler = getScriptHandler('axe');
  const combat = ctx(owner, foe, events, createCombatBus(), [piece]);
  handler.onCooldownEffect(piece, combat);
  handler.onCooldownEffect(piece, combat);
  assert.equal(foe.hp, 100 - 4 - 5, `Axe adds source p1 to each successful hit on ${side}`);
  assert.equal(piece.bonusDamage, 2, `Axe persists its damage bonus on ${side}`);
}

// Bewitchment.gd caches affected Nature/Dark/Ice counts in onPrepare. Its
// cooldown spends one Mana, chooses the least-held debuffs with random tie
// breaking, then rolls each matching type's source bonus. No Mana means no
// activation or debuff changes.
for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const foe = createActor(side === 'you' ? 'dummy' : 'player');
  const placements = [
    { id: 'bewitchment', key: `${side}:bewitchment`, x: 0, y: 0, r: 0, side },
    { id: 'healing_herbs', key: `${side}:nature`, x: -1, y: -2, r: 0, side },
    { id: 'skull', key: `${side}:dark`, x: 1, y: -2, r: 0, side },
    { id: 'snowball', key: `${side}:ice`, x: -2, y: 0, r: 0, side },
  ];
  const graph = buildBoardGraph(placements, byId);
  const links = affectedTargets(graph, placements[0].key, byId, canAffect);
  assert.deepEqual(
    new Set(links.map((link) => link.id)),
    new Set(['healing_herbs', 'skull', 'snowball']),
    `Bewitchment source type links resolve on ${side}`,
  );
  const [piece, nature, dark, ice] = buildCombatPieces(placements, byId);
  piece.side = nature.side = dark.side = ice.side = side;
  const events = [];
  const combat = ctx(owner, foe, events, createCombatBus(), [piece, nature, dark, ice], { graph });
  getScriptHandler('bewitchment').onPrepare(piece, combat);
  assert.deepEqual(piece._bewitchmentTypeCounts, { nature: 1, dark: 1, ice: 1 },
    `Bewitchment caches source type counts on ${side}`);
  foe.stacks.poison = 2;
  foe.stacks.cold = 1;
  grantStacks(owner, 'mana', 1, { rng: () => 0 });
  getScriptHandler('bewitchment').onCooldownEffect(piece, combat);
  assert.equal(owner.stacks.mana, 0, `Bewitchment spends source Mana on ${side}`);
  assert.equal(foe.stacks.poison, 5, `Bewitchment applies least + Nature poison on ${side}`);
  assert.equal(foe.stacks.blind, 3, `Bewitchment applies least + Dark blind on ${side}`);
  assert.equal(foe.stacks.cold, 3, `Bewitchment applies least + Ice cold on ${side}`);
  assert.ok(events.some((event) => event.type === 'activate' && event.itemId === 'bewitchment'),
    `Bewitchment activates after a successful spend on ${side}`);

  const before = { poison: foe.stacks.poison, blind: foe.stacks.blind, cold: foe.stacks.cold };
  getScriptHandler('bewitchment').onCooldownEffect(piece, combat);
  assert.deepEqual(
    { poison: foe.stacks.poison, blind: foe.stacks.blind, cold: foe.stacks.cold },
    before,
    `Bewitchment does not proc without Mana on ${side}`,
  );
  assert.equal(events.filter((event) => event.type === 'activate' && event.itemId === 'bewitchment').length, 1,
    `Bewitchment does not activate without Mana on ${side}`);
}

// BloodAmulet.gd: start-of-battle Vampirism plus temporary maximum health.
for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy', { maxHp: 100 });
  const foe = createActor(side === 'you' ? 'dummy' : 'player');
  owner.hp = 70;
  const events = [];
  const piece = itemPiece('blood_amulet', `${side}:blood-amulet`, side);
  getScriptHandler('blood_amulet').onCombatStart(piece, ctx(owner, foe, events, createCombatBus(), [piece]));
  assert.equal(owner.stacks.vampirism, 2, `Blood Amulet grants source Vampirism on ${side}`);
  assert.equal(owner.maxHp, 120, `Blood Amulet grants source maximum health on ${side}`);
  assert.equal(owner.hp, 90, `Blood Amulet fills the gained health on ${side}`);
  assert.ok(events.some((event) => event.type === 'activate' && event.itemId === 'blood_amulet'),
    `Blood Amulet activates on ${side}`);
}

// BloodyDagger.gd resets its cap in onPrepare, adds p1 Vampirism per hit up
// to p2, and heals p3 per linked Vampiric item on every successful hit.
for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy', { maxHp: 100 });
  const foe = createActor(side === 'you' ? 'dummy' : 'player', { maxHp: 200 });
  owner.hp = 50;
  // Disable the ordinary Vampirism heal so this regression isolates
  // BloodyDagger.gd's explicit linked-Vampiric heal.
  owner.meleeVampirismLimit = 0;
  const placements = [
    { id: 'bloody_dagger', key: `${side}:bloody-dagger`, x: 0, y: 0, r: 0, side },
    { id: 'blood_amulet', key: `${side}:vampiric-link`, x: 0, y: -1, r: 0, side },
  ];
  const graph = buildBoardGraph(placements, byId);
  const [dagger, amulet] = buildCombatPieces(placements, byId);
  dagger.side = amulet.side = side;
  const events = [];
  const combat = ctx(owner, foe, events, createCombatBus(), [dagger, amulet], { graph });
  getScriptHandler('bloody_dagger').onPrepare(dagger, combat);
  for (let i = 0; i < 5; i += 1) dealHit(dagger, combat, 5, `Bloody Dagger ${side}`);
  assert.equal(owner.stacks.vampirism, 5, `Bloody Dagger reaches source Vampirism cap on ${side}`);
  assert.equal(owner.hp, 70, `Bloody Dagger heals one linked Vampiric item per hit on ${side}`);
  dealHit(dagger, combat, 5, `Bloody Dagger ${side} cap`);
  assert.equal(owner.stacks.vampirism, 5, `Bloody Dagger does not exceed source cap on ${side}`);
  assert.equal(owner.hp, 74, `Bloody Dagger keeps healing after the Vampirism cap on ${side}`);
}

// Broccoli.gd inherits Food.prepare (+10% speed per food link), then chooses
// Lucky or Regeneration at cooldown. Broccotree overrides onPrepare, so it
// does not inherit Food.prepare; its regeneration listener uses base stamina
// regen, including when another item has already modified runtime regen.
for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const foe = createActor(side === 'you' ? 'dummy' : 'player');
  const placements = [
    { id: 'broccoli', key: `${side}:broccoli`, x: 0, y: 0, r: 0, side },
    { id: 'banana', key: `${side}:food-link`, x: 1, y: 0, r: 0, side },
  ];
  const graph = buildBoardGraph(placements, byId);
  const [broccoli, food] = buildCombatPieces(placements, byId);
  broccoli.side = food.side = side;
  const events = [];
  const bus = createCombatBus();
  const combat = ctx(owner, foe, events, bus, [broccoli, food], { graph });
  getScriptHandler('broccoli').onPrepare(broccoli, combat);
  assert.equal(broccoli.speedScale, 0.1, `Broccoli inherits Food speed preparation on ${side}`);
  getScriptHandler('broccoli').onCooldownEffect(broccoli, combat);
  assert.equal(owner.stacks.lucky, 2, `Broccoli grants Lucky below source threshold on ${side}`);
  owner.stacks.lucky = 5;
  getScriptHandler('broccoli').onCooldownEffect(broccoli, combat);
  assert.equal(owner.stacks.regeneration, 2, `Broccoli grants Regeneration at source threshold on ${side}`);

  const treeOwner = createActor(side === 'you' ? 'player' : 'dummy', { staminaRegen: 1.5 });
  const treeFoe = createActor(side === 'you' ? 'dummy' : 'player');
  const treePlacements = [
    { id: 'broccotree', key: `${side}:broccotree`, x: 0, y: 0, r: 0, side },
    { id: 'banana', key: `${side}:tree-food-link`, x: 2, y: -1, r: 0, side },
  ];
  const treeGraph = buildBoardGraph(treePlacements, byId);
  const [tree, treeFood] = buildCombatPieces(treePlacements, byId);
  tree.side = treeFood.side = side;
  const treeEvents = [];
  const treeCombat = ctx(treeOwner, treeFoe, treeEvents, createCombatBus(), [tree, treeFood], { graph: treeGraph });
  getScriptHandler('broccotree').onPrepare(tree, treeCombat);
  assert.equal(tree.speedScale || 1, 1, `Broccotree source override skips Food speed preparation on ${side}`);
  grantStacks(treeOwner, 'regeneration', 3, { rng: () => 0 });
  assert.equal(treeOwner.staminaRegen, 1.53, `Broccotree uses base stamina regen for its listener on ${side}`);
  getScriptHandler('broccotree').onCooldownEffect(tree, treeCombat);
  assert.equal(treeOwner.stacks.lucky, 3, `Broccotree always grants source Lucky on ${side}`);
  getScriptHandler('broccotree').onCooldownEffect(tree, treeCombat);
  assert.equal(treeOwner.stacks.lucky, 6, `Broccotree stacks Lucky before its threshold check on ${side}`);
  assert.equal(treeOwner.stacks.regeneration, 6, `Broccotree grants source Regeneration after threshold on ${side}`);
}

console.log('OK Axe, Bewitchment, Blood Amulet, Bloody Dagger, Broccoli, and Broccotree source ports');

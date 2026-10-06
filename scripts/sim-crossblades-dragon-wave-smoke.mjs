import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { isBattleRaging } from '../js/pages/sim/engine/battle-rage.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

const CASES = [
  ['crossblades', 'Crossblades.gd'],
  ['cursed_hair_comb', 'CursedHairComb.gd'],
  ['dark_lantern', 'Exclusive/DarkLantern.gd'],
  ['darksaber', 'Darksaber.gd'],
  ['death_lotus', 'Exclusive/DeathLotus.gd'],
  ['deer_totem', 'Exclusive/DeerTotem.gd'],
  ['djinn_lamp', 'DjinnLamp.gd'],
  ['doom_cap', 'Exclusive/DoomCap.gd'],
  ['double_axe', 'Exclusive/DoubleAxe.gd'],
  ['draconic_orb', 'Exclusive/DraconicOrb.gd'],
  ['dragon_knight', 'Exclusive/DragonKnight.gd'],
  ['dragon_set', 'Exclusive/DragonSet.gd'],
];

function piece(id, key, side, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item?.name || id,
    params: item?.params || {},
    side,
    alive: true,
    cooldown: item?.cooldown ?? 4,
    baseCooldown: item?.cooldown ?? 4,
    triggerTime: item?.cooldown ?? 4,
    damageMin: item?.damageMin || 0,
    damageMax: item?.damageMax || 0,
    accuracy: item?.accuracy ?? 100,
    staminaCost: item?.staminaCost || 0,
    kind: /weapon/i.test(item?.type || '') ? 'weapon' : 'passive',
    ...overrides,
  };
}

function fakeGraph(source, targets = []) {
  const sourcePiece = {
    key: source.placementKey,
    id: source.itemId,
    cells: [],
    affectCells: targets.map((target, i) => ({ cell: `link-${i}`, color: target.color || 'primary' })),
  };
  const pieces = new Map([[source.placementKey, sourcePiece]]);
  const filled = new Map();
  targets.forEach((target, i) => {
    pieces.set(target.piece.placementKey, {
      key: target.piece.placementKey,
      id: target.piece.itemId,
      cells: [],
      affectCells: [],
    });
    filled.set(`link-${i}`, target.piece.placementKey);
  });
  return { pieces, filled };
}

function ctx(owner, foe, pieces, bus = createCombatBus(), graph = { pieces: new Map(), filled: new Map() }) {
  owner._combatBus = bus;
  foe._combatBus = bus;
  owner._eventLog = [];
  foe._eventLog = [];
  return {
    player: owner,
    dummy: foe,
    pieces,
    graph,
    itemsById: byId,
    canAffect: null,
    events: [],
    bus,
    rng: () => 0,
    t: 5,
    activatePiece: () => true,
  };
}

for (const [id, source] of CASES) {
  assert.equal(inventory.byId[id]?.file, source, `${id} source inventory`);
  assert.equal(getScriptHandler(id)?.handlerId, id, `${id} runtime handler`);
}

for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy', { maxHp: 100 });
  const foe = createActor(side === 'you' ? 'dummy' : 'player', { maxHp: 100 });

  const cross = piece('crossblades', `${side}:cross`, side, { kind: 'weapon' });
  const empower = piece('wooden_sword', `${side}:empower`, side, { kind: 'weapon', cooldown: 1, baseCooldown: 1 });
  const secondary = piece('djinn_lamp', `${side}:secondary`, side, { cooldown: 1, baseCooldown: 1 });
  const crossCtx = ctx(owner, foe, [cross, empower, secondary], createCombatBus(), fakeGraph(cross, [
    { piece: empower, color: 'primary' },
    { piece: secondary, color: 'secondary' },
  ]));
  getScriptHandler('crossblades').onCombatStart(cross, crossCtx);
  assert.equal(empower.bonusDamage, 10, `Crossblades primary damage on ${side}`);
  assert.equal(secondary.speedScale, 0.65, `Crossblades secondary speed on ${side}`);
  getScriptHandler('crossblades').onPreDealDamageEarly(cross, crossCtx, { hit: true });
  assert.equal(cross.bonusDamage, 1, `Crossblades hit damage on ${side}`);

  const comb = piece('cursed_hair_comb', `${side}:comb`, side);
  const combWeapon = piece('wooden_sword', `${side}:comb-weapon`, side, { kind: 'weapon' });
  const combVamp = piece('vampiric_collar', `${side}:comb-vamp`, side);
  const combCtx = ctx(owner, foe, [comb, combWeapon, combVamp], createCombatBus(), fakeGraph(comb, [
    { piece: combWeapon, color: 'primary' },
    { piece: combVamp, color: 'secondary' },
  ]));
  getScriptHandler('cursed_hair_comb').onPrepare(comb, combCtx);
  getScriptHandler('cursed_hair_comb').onCombatStart(comb, combCtx);
  assert.equal(owner.stacks.vampirism, 6, `Cursed Hair Comb vampirism on ${side}`);
  owner.hp = 50;
  const hpBeforeComb = owner.hp;
  combCtx.bus.emit('piece_dealt_damage', { piece: combWeapon, hit: { hit: true, damage: 20 }, t: 5 });
  assert.ok(owner.hp > hpBeforeComb, `Cursed Hair Comb lifesteal listener on ${side}`);

  const lantern = piece('dark_lantern', `${side}:lantern`, side);
  const lanternCtx = ctx(owner, foe, [lantern], createCombatBus());
  getScriptHandler('dark_lantern').onPrepare(lantern, lanternCtx);
  getScriptHandler('dark_lantern').onCombatStart(lantern, lanternCtx);
  owner.hp = 0;
  owner.dead = true;
  lanternCtx.bus.emit('character_damaged', { actor: owner, hit: true, healthDamage: 100 });
  assert.equal(owner.hp, 50, `Dark Lantern reincarnates at p2 HP on ${side}`);
  assert.equal(owner.dead, false, `Dark Lantern clears death on ${side}`);
  assert.ok(owner.invulnUntil > lanternCtx.t, `Dark Lantern grants invulnerability on ${side}`);

  const saber = piece('darksaber', `${side}:saber`, side, { kind: 'weapon' });
  const saberCtx = ctx(owner, foe, [saber], createCombatBus());
  getScriptHandler('darksaber').onPrepare(saber, saberCtx);
  grantStacks(foe, 'poison', 2, { rng: () => 0, originId: 'seed' });
  assert.equal(saber.bonusDamage, 1, `Darksaber scales varying damage on ${side}`);
  assert.equal(saber.removableBonusDamage || 0, 0, `Darksaber varying damage is non-removable on ${side}`);
  grantStacks(owner, 'mana', 1, { rng: () => 0, originId: 'seed' });
  getScriptHandler('darksaber').onPreDealDamageEarly(saber, saberCtx, { hit: false });
  assert.equal(foe.stacks.blind, 1, `Darksaber blinds after mana spend on ${side}`);

  const lotus = piece('death_lotus', `${side}:lotus`, side);
  const dark = piece('dark_lantern', `${side}:dark`, side);
  const lotusCtx = ctx(owner, foe, [lotus, dark], createCombatBus(), fakeGraph(lotus, [{ piece: dark, color: 'primary' }]));
  getScriptHandler('death_lotus').onPrepare(lotus, lotusCtx);
  assert.equal(lotus.speedScale, 0.1, `Death Lotus dark speed on ${side}`);
  owner.stacks.lucky = 1;
  foe.stacks.heat = 3;
  getScriptHandler('death_lotus').onCooldownEffect(lotus, lotusCtx);
  assert.equal(owner.stacks.mana, 4, `Death Lotus grants Mana on ${side}`);
  assert.equal(owner.stamina, owner.maxStamina, `Death Lotus stamina is clamped on ${side}`);
  assert.equal(lotusCtx.events.at(-1)?.type, 'activate', `Death Lotus activates after effects on ${side}`);

  const deer = piece('deer_totem', `${side}:deer`, side);
  const nature = piece('carrot', `${side}:nature`, side);
  const deerCtx = ctx(owner, foe, [deer, nature], createCombatBus(), fakeGraph(deer, [{ piece: nature }]));
  getScriptHandler('deer_totem').onPrepare(deer, deerCtx);
  getScriptHandler('deer_totem').onPreCombatStart(deer, deerCtx);
  assert.equal(owner.damageResistancePct, 15, `Deer Totem damage resistance on ${side}`);
  owner.battleRageUntil = 6;
  deerCtx.bus.emit('battle_rage_started', { actor: owner, t: 5 });
  owner.hp = 50;
  const deerManaBefore = owner.stacks.mana;
  getScriptHandler('deer_totem').onCooldownEffect(deer, deerCtx);
  assert.ok(owner.hp > 50 && owner.stacks.mana === deerManaBefore + 4, `Deer Totem heal/Mana on ${side}`);

  const lamp = piece('djinn_lamp', `${side}:lamp`, side);
  const lampWeapon = piece('wooden_sword', `${side}:lamp-weapon`, side, { kind: 'weapon' });
  const lampCtx = ctx(owner, foe, [lamp, lampWeapon], createCombatBus(), fakeGraph(lamp, [{ piece: lampWeapon }]));
  getScriptHandler('djinn_lamp').onPrepare(lamp, lampCtx);
  owner.block = 7;
  owner.stacks.spikes = 7;
  owner.stacks.mana = 7;
  owner.stacks.lucky = 7;
  owner.hp = 50;
  lampCtx.bus.emit('character_block_changed', { actor: owner, amount: 1 });
  assert.equal(lamp._djinnOn, true, `Djinn Lamp threshold activation on ${side}`);
  assert.equal(lampWeapon.bonusDamage, 27, `Djinn Lamp weapon damage on ${side}`);
  assert.equal(owner.hp, 23, `Djinn Lamp health cost on ${side}`);

  const doom = piece('doom_cap', `${side}:doom`, side);
  const doomCtx = ctx(owner, foe, [doom], createCombatBus());
  const doomPoisonBefore = foe.stacks.poison;
  getScriptHandler('doom_cap').onCooldownEffect(doom, doomCtx);
  assert.equal(foe.stacks.poison, doomPoisonBefore + 3, `Doom Cap poison on ${side}`);
  assert.equal(foe._healAmp, -0.1, `Doom Cap healing reduction on ${side}`);
  assert.equal(doomCtx.events.at(-1)?.type, 'activate', `Doom Cap activates after effects on ${side}`);

  const axe = piece('double_axe', `${side}:axe`, side, { kind: 'weapon' });
  const axeCtx = ctx(owner, foe, [axe], createCombatBus());
  owner.battleRageUntil = 0;
  owner._battleRageUntil = 0;
  getScriptHandler('double_axe').onPrepare(axe, axeCtx);
  getScriptHandler('double_axe').onPreDealDamageEarly(axe, axeCtx, { hit: true });
  assert.equal(axe.bonusDamage, 2, `Double Axe normal hit bonus on ${side}`);
  axeCtx.bus.emit('battle_rage_started', { actor: owner, t: 5 });
  getScriptHandler('double_axe').onPreDealDamageEarly(axe, axeCtx, { hit: true });
  assert.equal(axe.bonusDamage, 5, `Double Axe rage hit bonus on ${side}`);

  const orb = piece('draconic_orb', `${side}:orb`, side);
  const orbCtx = ctx(owner, foe, [orb], createCombatBus());
  getScriptHandler('draconic_orb').onPrepare(orb, orbCtx);
  grantStacks(owner, 'heat', 15, { rng: () => 0, originId: orb.itemId });
  assert.equal(owner.critStacks, 3, `Draconic Orb crit tokens on ${side}`);
  foe.stacks.spikes = 2;
  const orbHeatBefore = owner.stacks.heat;
  getScriptHandler('draconic_orb').onCooldownEffect(orb, orbCtx);
  assert.equal(foe.stacks.spikes, 1, `Draconic Orb removes spikes on ${side}`);
  assert.equal(owner.stacks.heat, orbHeatBefore + 1, `Draconic Orb converts spikes to Heat on ${side}`);

  const knight = piece('dragon_knight', `${side}:knight`, side, { kind: 'weapon', damageMin: 2, damageMax: 2 });
  const knightPeer = piece('banana', `${side}:knight-peer`, side, { cooldown: 1, baseCooldown: 1 });
  const knightCtx = ctx(owner, foe, [knight, knightPeer], createCombatBus(), fakeGraph(knight, [{ piece: knightPeer }]));
  getScriptHandler('dragon_knight').onPrepare(knight, knightCtx);
  getScriptHandler('dragon_knight').onPreCombatStart(knight, knightCtx);
  getScriptHandler('dragon_knight').onCombatStart(knight, knightCtx);
  assert.equal(owner.debuffReflectStacks, 4, `Dragon Knight inherited Reflect on ${side}`);
  assert.ok(owner.stacks.heat >= 5, `Dragon Knight inherited Heat on ${side}`);
  knight.triggerTime = 1;
  knight._iterationCd = 1;
  getScriptHandler('dragon_knight').onPeerActivated(knight, knightPeer, knightCtx);
  assert.ok(knight.triggerTime < 1, `Dragon Knight advances its own cooldown on ${side}`);

  const set = piece('dragon_set', `${side}:set`, side);
  const setPieces = [
    set,
    piece('dragonscale_armor', `${side}:armor`, side),
    piece('dragonskin_boots', `${side}:boots`, side),
    piece('dragon_claws', `${side}:claws`, side),
  ];
  const setCtx = ctx(owner, foe, setPieces, createCombatBus());
  getScriptHandler('dragon_set').onPrepare(set, setCtx);
  getScriptHandler('dragon_set').onPreCombatStart(set, setCtx);
  setCtx.bus.emit('battle_rage_started', { actor: owner, t: 5 });
  assert.equal(set._cdLocked, false, `Dragon Set arms during Rage on ${side}`);
  owner.hp = 50;
  setCtx.bus.emit('piece_dealt_damage', {
    piece: piece('wooden_sword', `${side === 'you' ? 'opp' : 'you'}:foe-hit`, side === 'you' ? 'them' : 'you', { kind: 'weapon' }),
    hit: { hit: true, damage: 10 },
    t: 5,
  });
  assert.ok(owner.hp > 50, `Dragon Set heals from opponent attack on ${side}`);
}

console.log('OK Crossblades, Cursed Hair Comb, Dark Lantern, Darksaber, Death Lotus, Deer Totem, Djinn Lamp, Doom Cap, Double Axe, Draconic Orb, Dragon Knight, and Dragon Set source ports');

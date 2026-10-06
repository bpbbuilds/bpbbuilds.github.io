import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { combatStartGemSockets, prepareGemSockets } from '../js/pages/sim/engine/gem-sockets.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

const CASES = [
  ['burning_banner', 'Exclusive/BurningBanner.tscn', 'Exclusive/BurningBanner.gd'],
  ['burning_coal', 'Gems/BurningCoal.tscn', 'BurningCoal.gd'],
  ['burning_sword', 'Exclusive/BurningSword.tscn', 'Exclusive/BurningSword.gd'],
  ['burning_torch', 'BurningTorch.tscn', 'BurningTorch.gd'],
  ['carrot_goobert', 'CarrotGoobert.tscn', 'CarrotGoobert.gd'],
  ['cauldron', 'Exclusive/Cauldron.tscn', 'Exclusive/Cauldron.gd'],
  ['chainsaw', 'Exclusive/Chainsaw.tscn', 'Exclusive/Chainsaw.gd'],
  ['charge_splitter', 'Exclusive/ChargeSplitter.tscn', 'Exclusive/ChargeSplitter.gd'],
  ['chili_pepper', 'Exclusive/ChiliPepper.tscn', 'Exclusive/ChiliPepper.gd'],
  ['coil', 'Exclusive/Coil.tscn', 'Exclusive/Coil.gd'],
];

function piece(id, key, side = 'you', overrides = {}) {
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
    triggerTime: item?.cooldown ?? 4,
    baseCooldown: item?.cooldown ?? 4,
    damageMin: item?.damageMin || 0,
    damageMax: item?.damageMax || 0,
    ...overrides,
  };
}

function context(side, owner, foe, pieces, graph, extra = {}) {
  return {
    player: owner,
    dummy: foe,
    pieces,
    graph,
    itemsById: byId,
    canAffect: { rulesById: JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8')).byId },
    events: [],
    bus: createCombatBus(),
    chargeJobs: [],
    rng: () => 0,
    t: 5,
    ...extra,
    side,
  };
}

for (const [id, sceneFile, sourceFile] of CASES) {
  const row = inventory.byId[id];
  assert.equal(row?.sceneFile, sceneFile, `${id} scene alias`);
  assert.equal(row?.file, sourceFile, `${id} source script`);
  assert.equal(getScriptHandler(id)?.handlerId, id, `${id} runtime handler`);
}

// Run each lifecycle from both board owners. These checks deliberately use
// the same handlers and actor orientation for `you` and `them`.
for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy', { maxHp: 100 });
  const foe = createActor(side === 'you' ? 'dummy' : 'player', { maxHp: 100 });

  const banner = piece('burning_banner', `${side}:banner`, side);
  const holy = piece('holy_spear', `${side}:holy`, side, { kind: 'weapon', damageMin: 2, damageMax: 2 });
  const placements = [
    { id: 'burning_banner', key: banner.placementKey, x: 0, y: 0, r: 0, side },
    { id: 'holy_spear', key: holy.placementKey, x: 0, y: -1, r: 0, side },
  ];
  const graph = buildBoardGraph(placements, byId);
  const bannerCtx = context(side, owner, foe, [banner, holy], graph);
  getScriptHandler('burning_banner').onPrepare(banner, bannerCtx);
  assert.ok(Array.isArray(banner._burningBannerTargets), `Burning Banner caches source targets on ${side}`);
  const beforeBannerEvents = bannerCtx.events.length;
  getScriptHandler('burning_banner').onCooldownEffect(banner, bannerCtx);
  assert.ok(bannerCtx.events.length > beforeBannerEvents, `Burning Banner activates after effects on ${side}`);

  const torch = piece('burning_torch', `${side}:torch`, side, { kind: 'weapon', damageMin: 2, damageMax: 2 });
  const torchCtx = context(side, owner, foe, [torch], graph);
  getScriptHandler('burning_torch').onCombatStart(torch, torchCtx);
  assert.equal(owner.stacks.heat, 2, `Burning Torch grants start Heat on ${side}`);
  const torchBefore = torch.bonusDamage || 0;
  getScriptHandler('burning_torch').onPreDealDamageEarly(torch, torchCtx, { hit: true });
  assert.equal(torch.bonusDamage, torchBefore + 1, `Burning Torch grants hit damage on ${side}`);

  const sword = piece('burning_sword', `${side}:sword`, side, { kind: 'weapon', damageMin: 2, damageMax: 2 });
  const swordCtx = context(side, owner, foe, [sword], graph);
  getScriptHandler('burning_sword').onPrepare(sword, swordCtx);
  grantStacks(owner, 'heat', 7, { rng: () => 0 });
  assert.equal(sword.bonusDamage, 1, `Burning Sword banks source Heat on ${side}`);

  const chili = piece('chili_pepper', `${side}:chili`, side);
  owner.hp = 50;
  const chiliHeatBefore = owner.stacks.heat || 0;
  grantStacks(owner, 'heat', 9, { rng: () => 0 });
  grantStacks(owner, 'poison', 1, { rng: () => 0 });
  const chiliCtx = context(side, owner, foe, [chili], graph);
  getScriptHandler('chili_pepper').onCooldownEffect(chili, chiliCtx);
  assert.equal(owner.stacks.heat, chiliHeatBefore + 10, `Chili Pepper grants source Heat on ${side}`);
  assert.equal(owner.stacks.poison, 0, `Chili Pepper cleanses at threshold on ${side}`);
  assert.ok(chiliCtx.events.at(-1)?.type === 'activate', `Chili Pepper activates after effects on ${side}`);

  const coal = piece('burning_coal', `${side}:coal`, side);
  const coalCtx = context(side, owner, foe, [coal], graph);
  grantStacks(owner, 'poison', 1, { rng: () => 0 });
  getScriptHandler('burning_coal').onCooldownEffect(coal, coalCtx);
  assert.equal(owner.stacks.heat >= 2, true, `Burning Coal grants Heat on ${side}`);
  assert.equal(coal.alive, false, `Burning Coal consumes after its effect on ${side}`);

  const coalWeapon = piece('burning_torch', `${side}:coal-weapon`, side, {
    kind: 'weapon',
    damageMin: 2,
    damageMax: 2,
    gemIds: ['burning_coal'],
  });
  const coalWeaponCtx = context(side, owner, foe, [coalWeapon], graph);
  prepareGemSockets(coalWeapon, coalWeaponCtx);
  const socketBonus = coalWeapon._preDeal?.[0]?.();
  assert.equal(socketBonus, 6, `Burning Coal weapon socket adds source damage on ${side}`);
  assert.ok(owner.stacks.heat >= 3, `Burning Coal weapon socket grants source Heat on ${side}`);
  const coalArmor = piece('cauldron', `${side}:coal-armor`, side, { gemIds: ['burning_coal'] });
  const coalArmorCtx = context(side, owner, foe, [coalArmor], graph);
  prepareGemSockets(coalArmor, coalArmorCtx);
  combatStartGemSockets(coalArmor, coalArmorCtx);
  assert.equal(owner.stackResist.cold, 7, `Burning Coal armor socket adds source Cold resistance on ${side}`);
  assert.ok(owner.block >= 12, `Burning Coal armor socket grants source Block on ${side}`);

  const cauldron = piece('cauldron', `${side}:cauldron`, side);
  const food = piece('banana', `${side}:food`, side);
  const cauldronGraph = buildBoardGraph([
    { id: 'cauldron', key: cauldron.placementKey, x: 0, y: 0, r: 0, side },
    { id: 'banana', key: food.placementKey, x: 0, y: -1, r: 0, side },
  ], byId);
  const cauldronCtx = context(side, owner, foe, [cauldron, food], cauldronGraph);
  getScriptHandler('cauldron').onPrepare(cauldron, cauldronCtx);
  assert.ok(cauldron.speedScale > 0, `Cauldron prepares linked Food speed on ${side}`);
  getScriptHandler('cauldron').onCooldownEffect(cauldron, cauldronCtx);
  assert.ok(cauldronCtx.events.some((event) => event.itemId === 'cauldron'), `Cauldron emits activation on ${side}`);

  const carrot = piece('carrot_goobert', `${side}:carrot`, side);
  const carrotCtx = context(side, owner, foe, [carrot], graph);
  grantStacks(owner, 'poison', 1, { rng: () => 0 });
  getScriptHandler('carrot_goobert').onPrepare(carrot, carrotCtx);
  for (let i = 0; i < 6; i += 1) {
    getScriptHandler('carrot_goobert').onPeerActivated(carrot, { itemId: 'banana' }, carrotCtx);
  }
  assert.equal(owner.stacks.poison, 0, `Carrot Goobert cleanses after inherited activation threshold on ${side}`);
  assert.equal(owner.stacks.empower, 2, `Carrot Goobert grants source Empower on ${side}`);
  assert.ok(carrotCtx.events.some((event) => event.type === 'activate' && event.itemId === 'carrot_goobert'), `Carrot Goobert activates after effects on ${side}`);

  const chainsaw = piece('chainsaw', `${side}:chainsaw`, side, { kind: 'weapon' });
  const chainsawCtx = context(side, owner, foe, [chainsaw], graph);
  grantStacks(foe, 'lucky', 20, { rng: () => 0 });
  getScriptHandler('chainsaw').onPrepare(chainsaw, chainsawCtx);
  getScriptHandler('chainsaw').onPreDealDamageEarly(chainsaw, chainsawCtx, { hit: true });
  assert.ok(foe.stacks.lucky < 20, `Chainsaw strips a source fraction on ${side}`);
  chainsaw.numCharges = 1;
  grantStacks(foe, 'mana', 20, { rng: () => 0 });
  getScriptHandler('chainsaw').onPreDealDamageEarly(chainsaw, chainsawCtx, { hit: true });
  assert.ok(owner.stacks.mana > 0, `Charged Chainsaw steals a source fraction on ${side}`);

  const splitter = piece('charge_splitter', `${side}:splitter`, side);
  const splitterGraph = buildBoardGraph([{ id: 'charge_splitter', key: splitter.placementKey, x: 3, y: 3, r: 0, side }], byId);
  const splitterCtx = context(side, owner, foe, [splitter], splitterGraph);
  getScriptHandler('charge_splitter').onPrepare(splitter, splitterCtx);
  splitter.numCharges = 1;
  getScriptHandler('charge_splitter').onChargeReceived(splitter, splitterCtx);
  assert.equal(splitterCtx.events.filter((event) => event.type === 'charge').length, 16, `Charge Splitter emits both source paths on ${side}`);
  grantStacks(owner, 'heat', 3, { rng: () => 0 });
  getScriptHandler('charge_splitter').onCooldownEffect(splitter, splitterCtx);
  assert.equal(owner.stacks.lucky >= 5, true, `Charge Splitter spends Heat for Lucky on ${side}`);

  const coil = piece('coil', `${side}:coil`, side);
  const coilCtx = context(side, owner, foe, [coil], graph);
  getScriptHandler('coil').onPrepare(coil, coilCtx);
  grantStacks(foe, 'heat', 20, { rng: () => 0 });
  getScriptHandler('coil').onChargeReceived(coil, coilCtx);
  assert.ok(owner.stacks.heat > 0, `Coil steals a buff on ${side}`);
  for (let i = 1; i < 10; i += 1) getScriptHandler('coil').onChargeReceived(coil, coilCtx);
  assert.equal(coil.alive, false, `Coil consumes at source activation cap on ${side}`);
}

console.log('OK Burning Banner, Burning Coal, Burning Sword, Burning Torch, Carrot Goobert, Cauldron, Chainsaw, Charge Splitter, Chili Pepper, and Coil source ports');

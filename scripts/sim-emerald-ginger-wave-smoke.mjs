import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

const CASES = [
  ['emerald_whelp', 'Exclusive/EmeraldWhelp.gd'],
  ['energy_conversion', 'Exclusive/EnergyConversion.gd'],
  ['everburning', 'Exclusive/Everburning.gd'],
  ['fanfare', 'Fanfare.gd'],
  ['flame_badge', 'Exclusive/FlameBadge.gd'],
  ['flame_whip', 'Exclusive/FlameWhip.gd'],
  ['flute', 'Flute.gd'],
  ['fly_agaric', 'FlyAgaric.gd'],
  ['fortunas_kiss', 'Exclusive/FortunasKiss.gd'],
  ['gingerbread_man', 'GingerbreadMan.gd'],
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

function graph(source, targets = []) {
  const pieces = new Map([[source.placementKey, {
    key: source.placementKey,
    id: source.itemId,
    cells: [],
    affectCells: targets.map((_, i) => ({ cell: `link-${i}`, color: 'primary' })),
  }]]);
  const filled = new Map();
  targets.forEach((target, i) => {
    pieces.set(target.placementKey, {
      key: target.placementKey,
      id: target.itemId,
      cells: [],
      affectCells: [],
    });
    filled.set(`link-${i}`, target.placementKey);
  });
  return { pieces, filled };
}

function context(owner, foe, pieces, board, rng = () => 0) {
  const bus = createCombatBus();
  owner._combatBus = bus;
  foe._combatBus = bus;
  owner._eventLog = [];
  foe._eventLog = [];
  for (const p of pieces) p._eventLog = [];
  return {
    player: owner,
    dummy: foe,
    pieces,
    graph: board,
    itemsById: byId,
    canAffect: null,
    events: [],
    bus,
    rng,
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

  const whelp = piece('emerald_whelp', `${side}:whelp`, side, {
    kind: 'weapon', damageMin: 2, damageMax: 2,
  });
  const whelpCtx = context(owner, foe, [whelp], graph(whelp));
  getScriptHandler('emerald_whelp').onCombatStart(whelp, whelpCtx);
  getScriptHandler('emerald_whelp').onPreDealDamageEarly(whelp, whelpCtx, { hit: true });
  assert.equal(owner.stacks.lucky, 3, `Emerald Whelp Lucky on ${side}`);
  assert.equal(foe.stacks.poison, 3, `Emerald Whelp hit Poison on ${side}`);

  const energy = piece('energy_conversion', `${side}:energy`, side);
  const energyFood = piece('banana', `${side}:energy-food`, side);
  const energyCtx = context(owner, foe, [energy, energyFood], graph(energy, [energyFood]));
  getScriptHandler('energy_conversion').onPrepare(energy, energyCtx);
  assert.equal(energy.speedScale, 0.25, `Energy Conversion prepare speed on ${side}`);
  getScriptHandler('energy_conversion').onCooldownEffect(energy, energyCtx);
  assert.equal(owner.stacks.heat, 4, `Energy Conversion heat branch on ${side}`);
  assert.equal(energyCtx.events.at(-1)?.type, 'activate', `Energy Conversion activation order on ${side}`);

  const ever = piece('everburning', `${side}:ever`, side);
  const flame = piece('flame', `${side}:flame`, side);
  const burning = piece('burning_sword', `${side}:burning`, side, { kind: 'weapon', staminaCost: 2 });
  const everCtx = context(owner, foe, [ever, flame, burning], graph(ever));
  getScriptHandler('everburning').onPrepare(ever, everCtx);
  assert.equal(ever._everFlames, 1, `Everburning flame count on ${side}`);
  assert.equal(burning.staminaCost, 0.8, `Everburning stamina reduction on ${side}`);
  getScriptHandler('everburning').onCooldownEffect(ever, everCtx);
  assert.equal(owner.stacks.heat, 5, `Everburning heat on ${side}`);
  assert.equal(ever.alive, false, `Everburning consumes after effect on ${side}`);

  const fanfare = piece('fanfare', `${side}:fanfare`, side);
  const fanfarePeer = piece('banana', `${side}:fanfare-peer`, side);
  const fanfareCtx = context(owner, foe, [fanfare, fanfarePeer], graph(fanfare, [fanfarePeer]), () => 0);
  getScriptHandler('fanfare').onPrepare(fanfare, fanfareCtx);
  assert.equal(fanfare.speedScale, 0.1, `Fanfare prepare speed on ${side}`);
  getScriptHandler('fanfare').onCooldownEffect(fanfare, fanfareCtx);
  assert.equal(owner.stacks.empower, 1, `Fanfare Empower branch on ${side}`);
  assert.equal(fanfareCtx.events.at(-1)?.type, 'activate', `Fanfare activation order on ${side}`);
  fanfare._fanfareOpts = [1];
  foe.stacks.mana = 3;
  getScriptHandler('fanfare').onCooldownEffect(fanfare, fanfareCtx);
  assert.equal(owner.stacks.mana, 3, `Fanfare grants owner Mana on ${side}`);
  assert.equal(foe.stacks.mana, 1, `Fanfare removes opponent Mana on ${side}`);
  fanfare._fanfareOpts = [2];
  foe.stamina = 2;
  getScriptHandler('fanfare').onCooldownEffect(fanfare, fanfareCtx);
  assert.equal(foe.stamina, 1, `Fanfare drains opponent Stamina on ${side}`);
  assert.equal(fanfareCtx.events.some((event) => event.meta?.kind === 'drain'), true, `Fanfare drain event on ${side}`);

  const badge = piece('flame_badge', `${side}:badge`, side);
  const badgeCtx = context(owner, foe, [badge], graph(badge));
  getScriptHandler('flame_badge').onCombatStart(badge, badgeCtx);
  assert.ok(owner.stacks.heat >= 11, `Flame Badge heat on ${side}`);
  assert.equal(badge.alive, false, `Flame Badge consumes on ${side}`);

  const whip = piece('flame_whip', `${side}:whip`, side, {
    kind: 'weapon', damageMin: 5, damageMax: 5, accuracy: 100, staminaCost: 0,
  });
  const whipCtx = context(owner, foe, [whip], graph(whip));
  owner.stacks.spikes = 1;
  getScriptHandler('flame_whip').onCooldownEffect(whip, whipCtx);
  assert.equal(owner.stacks.spikes, 0, `Flame Whip spends Spikes on hit for ${side}`);
  assert.equal(owner.stacks.heat, 15, `Flame Whip grants Heat on ${side}`);
  assert.equal(foe.hp, 86, `Flame Whip applies unrounded hit bonus on ${side}`);
  const miss = piece('flame_whip', `${side}:whip-miss`, side, {
    kind: 'weapon', damageMin: 5, damageMax: 5, accuracy: 0, staminaCost: 0,
  });
  const missCtx = context(owner, foe, [miss], graph(miss));
  owner.stacks.lucky = 0;
  owner.stacks.spikes = 1;
  getScriptHandler('flame_whip').onCooldownEffect(miss, missCtx);
  assert.equal(owner.stacks.spikes, 1, `Flame Whip preserves Spikes on miss for ${side}`);

  const flute = piece('flute', `${side}:flute`, side);
  const flutePeer = piece('banana', `${side}:flute-peer`, side);
  const fluteCtx = context(owner, foe, [flute, flutePeer], graph(flute, [flutePeer]), () => 0);
  getScriptHandler('flute').onPrepare(flute, fluteCtx);
  assert.equal(flute.speedScale, 0.1, `Flute prepare speed on ${side}`);
  flute._fluteOpts = [1];
  owner.stamina = 2;
  getScriptHandler('flute').onCooldownEffect(flute, fluteCtx);
  assert.equal(owner.stamina, 4, `Flute grants stamina on ${side}`);
  assert.equal(fluteCtx.events.at(-1)?.type, 'activate', `Flute activation order on ${side}`);

  const agaric = piece('fly_agaric', `${side}:agaric`, side);
  const agaricFood = piece('banana', `${side}:agaric-food`, side);
  const agaricCtx = context(owner, foe, [agaric, agaricFood], graph(agaric, [agaricFood]));
  getScriptHandler('fly_agaric').onPrepare(agaric, agaricCtx);
  assert.equal(agaric.speedScale, 0.1, `Fly Agaric inherited Food speed on ${side}`);
  getScriptHandler('fly_agaric').onCooldownEffect(agaric, agaricCtx);
  assert.equal(foe.stacks.poison >= 4, true, `Fly Agaric poison on ${side}`);
  assert.equal(agaricCtx.events.at(-1)?.type, 'activate', `Fly Agaric activation order on ${side}`);

  const fortuna = piece('fortunas_kiss', `${side}:fortuna`, side);
  const chancePeer = piece('banana', `${side}:chance`, side);
  const fortunaCtx = context(owner, foe, [fortuna, chancePeer], graph(fortuna, [chancePeer]), () => 0);
  getScriptHandler('fortunas_kiss').onPrepare(fortuna, fortunaCtx);
  assert.equal(chancePeer.bonusChanceMult || 0, 0, `Fortuna does not buff zero-chance item on ${side}`);
  const chancePeer2 = piece('flame_whip', `${side}:chance2`, side, { chance: 10 });
  fortunaCtx.pieces.push(chancePeer2);
  fortunaCtx.graph.pieces.set(chancePeer2.placementKey, { key: chancePeer2.placementKey, id: chancePeer2.itemId, cells: [], affectCells: [] });
  fortunaCtx.graph.filled.set('link-1', chancePeer2.placementKey);
  const fortuna2 = piece('fortunas_kiss', `${side}:fortuna2`, side);
  const fortunaCtx2 = context(owner, foe, [fortuna2, chancePeer2], graph(fortuna2, [chancePeer2]), () => 0);
  getScriptHandler('fortunas_kiss').onPrepare(fortuna2, fortunaCtx2);
  assert.equal(chancePeer2.bonusChanceMult, 35, `Fortuna buffs chance item on ${side}`);
  owner.stacks.lucky = 0;
  getScriptHandler('fortunas_kiss').onCooldownEffect(fortuna2, fortunaCtx2);
  assert.equal(owner.stacks.lucky, 1, `Fortuna Lucky fallback on ${side}`);
  assert.equal(fortunaCtx2.events.at(-1)?.type, 'activate', `Fortuna activation order on ${side}`);

  const ginger = piece('gingerbread_man', `${side}:ginger`, side);
  const gingerFood = piece('banana', `${side}:ginger-food`, side);
  const gingerCtx = context(owner, foe, [ginger, gingerFood], graph(ginger, [gingerFood]));
  getScriptHandler('gingerbread_man').onPrepare(ginger, gingerCtx);
  assert.equal(ginger.speedScale, 0.1, `Gingerbread inherited Food speed on ${side}`);
  getScriptHandler('gingerbread_man').onCombatStart(ginger, gingerCtx);
  assert.equal(owner.maxHp, 140, `Gingerbread start max HP on ${side}`);
  assert.equal(owner.hp, 140, `Gingerbread start HP fill on ${side}`);
  owner.stacks.lucky = 1;
  owner.stacks.heat = 1;
  owner.stacks.mana = 1;
  getScriptHandler('gingerbread_man').onCooldownEffect(ginger, gingerCtx);
  assert.equal(owner.maxHp, 160, `Gingerbread gated max HP on ${side}`);
  assert.equal(owner.stacks.empower, 2, `Gingerbread Empower on ${side}`);
  assert.equal(owner.stacks.regeneration, 3, `Gingerbread Regeneration on ${side}`);
  assert.equal(gingerCtx.events.at(-1)?.type, 'activate', `Gingerbread activation order on ${side}`);
}

console.log('OK Emerald Whelp, Energy Conversion, Everburning, Fanfare, Flame Badge, Flame Whip, Flute, Fly Agaric, Fortuna’s Kiss, and Gingerbread Man source ports');

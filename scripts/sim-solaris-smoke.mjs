import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Solaris.gd', 'utf8');
const sunArmorSource = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SunArmor.gd', 'utf8');
const skillSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ao-skills.js', 'utf8');
const skillPort = skillSource.slice(
  skillSource.indexOf('const solarisPort'),
  skillSource.indexOf('const shieldedSkillPort'),
);
const healSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-b-heal.js', 'utf8');
const sunArmorPort = healSource.slice(
  healSource.indexOf('export const sunArmorPort'),
  healSource.indexOf('/** @type', healSource.indexOf('export const sunArmorPort') + 1),
);

assert.equal(inventory.byId.solaris?.file, 'Exclusive/Solaris.gd');
assert.deepEqual(inventory.byId.solaris?.overrides, ['onPrepare']);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.isA\(sunShieldDescriptor\)[\s\S]*item\.isA\(sunArmorDescriptor\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*changeBuffAmplification_allItems\(Game\.EventType\.Heat, getChance2\(\)\)/);
assert.match(source, /connectForCombat\(item, "blocked", "onShieldBlocked"\)/);
assert.match(source, /connectForCombat\(item, "used_heat", "onArmorUsedHeat"\)/);
assert.match(source, /func onArmorUsedHeat\(event\):[\s\S]*giveBlock\(getBlock\(\), true, event\)[\s\S]*miniActivate\(\)/);
assert.match(source, /func onShieldBlocked\(blockedDamageRes\):[\s\S]*rollChance\(\)[\s\S]*giveHeat\(heatPerShieldBlock\)[\s\S]*activate\(\)/);
assert.match(sunArmorSource, /EventBus\.emitSignal\(self, "used_heat", \[event\]\)[\s\S]*activate\(\)/);
assert.match(sunArmorSource, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Fire\)[\s\S]*item\.hasType\(Type\.Holy\)/);
assert.match(sunArmorSource, /func onAffectedItemAdded\(item, color: int\):[\s\S]*item\.addDynamicType\(Type\.Holy, self\)/);
assert.match(sunArmorSource, /func onCombatStart\(\):[\s\S]*giveBlock\(\)[\s\S]*giveHeat\(getNumAffectedItems\(\) \* getP1\(\)\)/);
assert.doesNotMatch(skillPort, /onCombatStart/);
assert.match(skillPort, /onPrepare/);
assert.match(skillPort, /buffAmplificationChances\.heat/);
assert.match(skillPort, /afterBlock/);
assert.match(skillPort, /used_heat/);
assert.match(skillPort, /miniActivate: true/);
assert.match(skillPort, /Math\.trunc/);
assert.match(sunArmorPort, /used_heat/);
assert.match(sunArmorPort, /pushActivate\(piece, ctx, 'sun_armor'/);

const solaris = {
  ...byId.get('solaris'),
  itemId: 'solaris',
  placementKey: 'solaris',
  name: 'Solaris',
  params: { heat: 1.9, p1: 1.9 },
  chance: 60,
  chance2: 20,
  blockGrant: 16,
  kind: 'skill',
};
const sunShield = {
  ...byId.get('sun_shield'),
  itemId: 'sun_shield',
  placementKey: 'sun-shield',
  name: 'Sun Shield',
  kind: 'shield',
};
const sunArmor = {
  ...byId.get('sun_armor'),
  itemId: 'sun_armor',
  placementKey: 'sun-armor',
  name: 'Sun Armor',
  params: { heat: 1, p1: 1, heatt: 1, p2: 1, heal: 12, p3: 12, cleanse: 2, p4: 2 },
  kind: 'armor',
  blockGrant: 70,
};
const outsideShield = {
  ...byId.get('sun_shield'),
  itemId: 'sun_shield',
  placementKey: 'outside-shield',
  name: 'Outside Sun Shield',
  kind: 'shield',
};
const fireItem = {
  ...byId.get('burning_torch'),
  itemId: 'burning_torch',
  placementKey: 'sun-fire',
  name: 'Burning Torch',
  kind: 'weapon',
  _dynamicTypes: [],
};
const graph = {
  pieces: new Map([
    ['solaris', {
      key: 'solaris',
      id: 'solaris',
      cells: [],
      affectCells: [
        { cell: 'shield-cell', color: 'primary' },
        { cell: 'armor-cell', color: 'primary' },
      ],
    }],
    ['sun-shield', { key: 'sun-shield', id: 'sun_shield', cells: [], affectCells: [] }],
    ['sun-armor', {
      key: 'sun-armor',
      id: 'sun_armor',
      cells: [],
      affectCells: [{ cell: 'fire-cell', color: 'primary' }],
    }],
    ['sun-fire', { key: 'sun-fire', id: 'burning_torch', cells: [], affectCells: [] }],
    ['outside-shield', { key: 'outside-shield', id: 'sun_shield', cells: [], affectCells: [] }],
  ]),
  filled: new Map([
    ['shield-cell', 'sun-shield'],
    ['armor-cell', 'sun-armor'],
    ['fire-cell', 'sun-fire'],
  ]),
};
const player = createActor('player');
const dummy = createActor('dummy');
const bus = createCombatBus();
player._combatBus = bus;
dummy._combatBus = bus;
const events = [];
const ctx = {
  player,
  dummy,
  pieces: [solaris, sunShield, sunArmor, outsideShield, fireItem],
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events,
  bus,
  t: 3,
  rng: () => 0,
};
const handler = getScriptHandler('solaris');
const sunArmorHandler = getScriptHandler('sun_armor');

assert.equal(handler?.handlerId, 'solaris');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof sunArmorHandler?.onPrepare, 'function');
sunArmorHandler.onPrepare(sunArmor, ctx);
assert.ok(fireItem._dynamicTypes.includes('holy'), 'Sun Armor adds dynamic Holy to a linked Fire item');
handler.onPrepare(solaris, ctx);
for (const piece of ctx.pieces) {
  assert.equal(piece.buffAmplificationChances?.heat, 20, `${piece.itemId} receives Solaris Heat amplification`);
}

bus.emit('afterBlock', { piece: outsideShield, t: 3 });
assert.equal(player.stacks.heat, 0, 'an unlinked Sun Shield cannot trigger Solaris');
bus.emit('afterBlock', { piece: sunShield, t: 4 });
assert.equal(player.stacks.heat, 1, 'a linked Sun Shield grants truncated Heat');
assert.equal(events.at(-1)?.type, 'activate', 'Sun Shield response activates Solaris after Heat');
const activationCount = events.filter((event) => event.type === 'activate').length;

bus.emit('used_heat', { piece: outsideShield, event: {}, t: 5 });
assert.equal(player.block, 0, 'an unrelated used_heat signal cannot trigger Solaris');
bus.emit('used_heat', { piece: sunArmor, event: {}, t: 6 });
assert.equal(player.block, 16, 'linked Sun Armor used_heat grants Solaris Block');
assert.equal(events.at(-1)?.meta?.miniActivate, true, 'Sun Armor response is a visual-only miniActivate');
assert.equal(events.filter((event) => event.type === 'activate').length, activationCount, 'miniActivate does not inflate normal activations');

player.stacks.heat = 1;
player.block = 0;
const armorEvents = [];
const armorBus = createCombatBus();
armorBus.on('used_heat', (payload) => armorEvents.push({ type: 'used_heat', payload }));
const armorCtx = { ...ctx, events: armorEvents, bus: armorBus, t: 8 };
sunArmorHandler.onCooldownEffect(sunArmor, armorCtx);
assert.equal(player.stacks.heat, 0, 'Sun Armor spends Heat before emitting used_heat');
assert.ok(armorEvents.some((event) => event.type === 'used_heat'), 'Sun Armor emits used_heat after its effect');
assert.equal(armorEvents.at(-1)?.type, 'activate', 'Sun Armor activates after used_heat');

const startArmor = {
  ...sunArmor,
  placementKey: 'start-sun-armor',
  _sunArmorBound: false,
};
const startFire = {
  ...fireItem,
  placementKey: 'start-sun-fire',
  _dynamicTypes: [],
};
const startGraph = {
  pieces: new Map([
    ['start-sun-armor', {
      key: 'start-sun-armor',
      id: 'sun_armor',
      cells: [],
      affectCells: [{ cell: 'start-fire-cell', color: 'primary' }],
    }],
    ['start-sun-fire', { key: 'start-sun-fire', id: 'burning_torch', cells: [], affectCells: [] }],
  ]),
  filled: new Map([['start-fire-cell', 'start-sun-fire']]),
};
const startPlayer = createActor('player');
const startDummy = createActor('dummy');
const startBus = createCombatBus();
startPlayer._combatBus = startBus;
startDummy._combatBus = startBus;
const startEvents = [];
const startCtx = {
  player: startPlayer,
  dummy: startDummy,
  pieces: [startArmor, startFire],
  graph: startGraph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events: startEvents,
  bus: startBus,
  t: 1,
  rng: () => 0,
};
sunArmorHandler.onPrepare(startArmor, startCtx);
sunArmorHandler.onCombatStart(startArmor, startCtx);
assert.equal(startPlayer.block, 70, 'Sun Armor uses catalog Block at combat start');
assert.equal(startPlayer.stacks.heat, 1, 'Sun Armor grants one Heat for one linked Fire/Holy item');

console.log('OK Solaris source, linked Sun Shield/Sun Armor listeners, Heat amplification, miniActivate, and Sun Armor used_heat ordering regression');

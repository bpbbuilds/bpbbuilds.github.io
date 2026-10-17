import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { emitBatterySpark } from '../js/pages/sim/engine/charge-delivery.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { pushActivate } from '../js/pages/sim/engine/scripts/ports-util.js';

const root = process.cwd();
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const catalogById = new Map(catalog.map((item) => [item.id, item]));

const sourceFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.name.endsWith('.gd')) sourceFiles.push(file);
  }
}
walk(path.join(root, 'tools/game-extract-full/Items'));

const sourceByFile = new Map();
for (const file of sourceFiles) {
  sourceByFile.set(path.basename(file), file);
  sourceByFile.set(
    path.relative(path.join(root, 'tools/game-extract-full/Items'), file).replace(/\\/g, '/'),
    file,
  );
}

const nonCombatHooks = new Set([
  'onShopEntered',
  'onShopOpened',
  'onItemRoll',
  'onItemRolled',
  'onBought',
  'onCraft',
  'onFusingFinished',
  'onDiscarded',
  'onAddedToInventory',
  'onRemovedFromInventory',
  'onCombatEnd',
  'getData',
  'setData',
  'getGatedDescriptor',
  'stopArmAni',
]);

function activationHooks(source) {
  const hooks = [];
  for (const body of source.split(/(?=^func\s+)/m).slice(1)) {
    const match = /^func\s+([A-Za-z0-9_]+)/.exec(body);
    if (!match || nonCombatHooks.has(match[1])) continue;
    if (/\bactivate\s*\(/.test(body)) hooks.push(match[1]);
  }
  return hooks;
}

const sourceActivators = [];
for (const [id, entry] of Object.entries(inventory.byId || {})) {
  const item = catalogById.get(id);
  const sourcePath = sourceByFile.get(entry.file);
  if (!item || !sourcePath) continue;
  if (!(item.cooldown == null || Number(item.cooldown) === 0)) continue;
  const source = fs.readFileSync(sourcePath, 'utf8');
  const hooks = activationHooks(source);
  if (!hooks.length) continue;
  sourceActivators.push({
    id,
    name: item.name,
    source: entry.file,
    extends: entry.extends,
    hooks,
    emitsCombatEvent: entry.extends !== 'Bag',
  });
}

const byId = new Map(sourceActivators.map((row) => [row.id, row]));
const expected = {
  spicy_banana: 'onBananaActivated',
  amulet_of_darkness: 'onItemActivated',
  smelly_barrier: 'onItemGaveBlock',
  amulet_of_steel: 'onCombatStart',
  dragon_nest: 'onCombatStart',
  battery: 'emitCharge',
};
for (const [id, hook] of Object.entries(expected)) {
  assert.ok(byId.has(id), `${id} is present in the extracted no-cooldown activation audit`);
  assert.ok(byId.get(id).hooks.includes(hook), `${id} source activation hook: ${hook}`);
  assert.equal(catalogById.get(id)?.cooldown, null, `${id} source catalog has no normal cooldown`);
}

const portsUtil = fs.readFileSync('js/pages/sim/engine/scripts/ports-util.js', 'utf8');
const combatActivate = fs.readFileSync('js/pages/sim/engine/combat-activate.js', 'utf8');
const vsBoard = fs.readFileSync('js/pages/sim/engine/vs-board.js', 'utf8');
const chargeDelivery = fs.readFileSync('js/pages/sim/engine/charge-delivery.js', 'utf8');
const waveB = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-b.js', 'utf8');
assert.match(portsUtil, /ctx\.notifyPeerActivations\?\.\(piece, ctx\)/);
assert.match(portsUtil, /_scriptCooldownDepth/);
assert.match(combatActivate, /ctx\._scriptCooldownDepth = previousDepth \+ 1/);
assert.match(vsBoard, /notifyPeerActivations: world\.notifyPeerActivations/);
assert.match(chargeDelivery, /Battery\.gd calls activate\(\) before sendCharge/);
assert.match(chargeDelivery, /ctx\.notifyPeerActivations\?\.\(piece, ctx\)/);
assert.match(waveB, /handlerId: 'amulet_of_steel'[\s\S]*?pushActivate\(piece, ctx, 'amulet_of_steel'/);
assert.match(waveB, /handlerId: 'dragon_nest'[\s\S]*?pushActivate\(piece, ctx, 'dragon_nest'/);

const piece = {
  kind: 'accessory',
  itemId: 'spicy_banana',
  placementKey: 'spicy',
  name: 'Spicy Banana',
  cooldown: 0,
  baseCooldown: 0,
};
const ctx = {
  t: 0,
  events: [],
  peerNotifications: 0,
  notifyPeerActivations() {
    this.peerNotifications += 1;
  },
};
pushActivate(piece, ctx, 'spicy_banana', 'Skill: Spicy Banana');
assert.equal(ctx.peerNotifications, 1, 'direct no-cooldown activation notifies peers');

ctx._scriptCooldownDepth = 1;
pushActivate(piece, ctx, 'spicy_banana', 'Skill: Spicy Banana');
assert.equal(ctx.peerNotifications, 1, 'normal cooldown activation is not double-notified');

const bag = { ...piece, kind: 'bag', itemId: 'fanny_pack', placementKey: 'fanny' };
pushActivate(bag, { ...ctx, _scriptCooldownDepth: 0 }, 'fanny_pack', 'Bag: Fanny Pack', { force: true });
assert.equal(ctx.peerNotifications, 1, 'bag-only animation activation does not notify combat listeners');

function activationContext(extra = {}) {
  return {
    t: 0,
    player: createActor('player'),
    dummy: createActor('dummy'),
    events: [],
    notifyPeerActivations(pieceToNotify) {
      this.peerNotifications = (this.peerNotifications || 0) + 1;
      this.notifiedItem = pieceToNotify.itemId;
    },
    ...extra,
  };
}

const steel = {
  kind: 'accessory',
  itemId: 'amulet_of_steel',
  placementKey: 'steel',
  name: 'Amulet of Steel',
  params: { p1: 8 },
  blockGrant: 8,
};
const steelCtx = activationContext();
getScriptHandler('amulet_of_steel').onCombatStart(steel, steelCtx);
assert.equal(steelCtx.events.at(-1)?.itemId, 'amulet_of_steel', 'Amulet of Steel projects source activation');
assert.equal(steelCtx.peerNotifications, 1, 'Amulet of Steel start activation notifies peers');

const nest = {
  kind: 'accessory',
  itemId: 'dragon_nest',
  placementKey: 'nest',
  name: 'Dragon Nest',
  params: { p2: 1, p3: 1, p4: 1, p5: 1 },
};
const nestCtx = activationContext({
  graph: { pieces: new Map(), filled: new Map() },
  pieces: [],
  itemsById: new Map(),
  canAffect: null,
  bus: { on() {} },
});
getScriptHandler('dragon_nest').onCombatStart(nest, nestCtx);
assert.equal(nestCtx.events.at(-1)?.itemId, 'dragon_nest', 'Dragon Nest projects source activation');
assert.equal(nestCtx.peerNotifications, 1, 'Dragon Nest start activation notifies peers');

const batteryCtx = activationContext({ graph: { pieces: new Map(), filled: new Map() }, itemsById: new Map() });
emitBatterySpark({
  kind: 'accessory',
  itemId: 'battery',
  placementKey: 'battery',
  name: 'Battery',
  params: {},
}, batteryCtx);
assert.equal(batteryCtx.events.at(-1)?.itemId, 'battery', 'Battery projects source activation before charge delivery');
assert.equal(batteryCtx.peerNotifications, 1, 'Battery activation notifies peers');

console.log(`OK no-cooldown source activation audit (${sourceActivators.length} candidates; ${sourceActivators.filter((row) => row.emitsCombatEvent).length} non-bag combat emitters)`);
console.log(sourceActivators.filter((row) => row.emitsCombatEvent).map((row) => row.id).join(', '));

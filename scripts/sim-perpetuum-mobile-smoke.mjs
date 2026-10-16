/**
 * Perpetuum Mobile fidelity — preparation target count, stamina expansion,
 * used-buff refund, and fractional stamina refund.
 *   node scripts/sim-perpetuum-mobile-smoke.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import classMasks from '../assets/data/item-class-masks.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor, tryUseStamina } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const sourceItem = catalog.find((entry) => entry.id === 'perpetuum_mobile');
const engineerItem = catalog.find((entry) => entry.id === 'engineer_box');
const neutralItem = catalog.find((entry) => entry.id === 'wooden_sword');
assert.ok(sourceItem && engineerItem && neutralItem);

const inventory = JSON.parse(fs.readFileSync('assets/data/sim-item-inventory.json', 'utf8'));
const row = inventory.byId.perpetuum_mobile;
assert.equal(row?.file, 'Exclusive/PerpetuumMobile.gd');
assert.equal(row?.extends, 'Item');
assert.equal(fs.existsSync('tools/game-extract-full/Items/Exclusive/PerpetuumMobile.tscn'), true);

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/PerpetuumMobile.gd', 'utf8');
assert.match(source, /func canAffect\(item\):[\s\S]*Classes_Full\.Engineer/);
assert.match(source, /func onPrepare\(\):[\s\S]*addSpeed\(speed \* getNumAffectedItems\(\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveMaxStaminaTemporary\(stamina, null, false\)/);
assert.match(source, /toRefund = int\(round\(usedStacks\[buffType\] \* buffRefund\)\)/);
assert.match(source, /giveStamina\(staminaUsed \* staminaRefund\)/);

const perp = { ...sourceItem, shape: sourceItem.shape || [[1]], itemId: 'perpetuum_mobile', placementKey: 'perp', name: 'Perpetuum Mobile', params: sourceItem.params, speedScale: 0 };
const engineer = { ...engineerItem, shape: engineerItem.shape || [[1]] };
const neutral = { ...neutralItem, shape: neutralItem.shape || [[1]] };
const byId = new Map([
  ['perpetuum_mobile', perp],
  ['engineer_box', engineer],
  ['wooden_sword', neutral],
]);
const canAffect = {
  rulesById: canAffectRules.byId,
  classMasks: classMasks.byId,
  classBits: classMasks.classBits,
};
const graph = {
  pieces: new Map([
    ['perp', { key: 'perp', id: 'perpetuum_mobile', affectCells: [{ cell: '1,0', color: 'primary' }] }],
    ['engineer', { key: 'engineer', id: 'engineer_box', affectCells: [] }],
    ['neutral', { key: 'neutral', id: 'wooden_sword', affectCells: [] }],
  ]),
  filled: new Map([['1,0', 'engineer']]),
};

const handler = getScriptHandler('perpetuum_mobile');
assert.equal(handler?.handlerId, 'perpetuum_mobile');
const owner = createActor('player');
const foe = createActor('dummy');
const bus = createCombatBus();
owner._combatBus = bus;
const events = [];
const piece = { ...perp, side: 'you' };
const ctx = {
  player: owner,
  dummy: foe,
  bus,
  events,
  t: 5,
  rng: () => 0,
  graph,
  pieces: [piece, { ...engineer, itemId: 'engineer_box', placementKey: 'engineer', speedScale: 0 }],
  itemsById: byId,
  canAffect,
};

handler.onPrepare(piece, ctx);
assert.equal(piece.speedScale, 0.3, 'Perpetuum Mobile speeds itself once per Engineer target');
assert.equal(ctx.pieces[1].speedScale, 0, 'Perpetuum Mobile does not speed linked Engineer items');

handler.onCombatStart(piece, ctx);
assert.equal(owner.temporaryMaxStamina, 2, 'Perpetuum Mobile adds unfilled temporary stamina');
assert.equal(events.at(-1)?.type, 'activate', 'Perpetuum Mobile activates after combat-start stamina');

grantStacks(owner, 'mana', 5);
spendStacks(owner, 'mana', 3, { piece });
assert.equal(piece._usedStacks.mana, 3, 'Perpetuum Mobile tracks used buff stacks');
assert.equal(tryUseStamina(owner, 2), 'ok');
assert.equal(piece._staminaUsed, 2, 'Perpetuum Mobile tracks used stamina');

const cooldownStart = events.length;
handler.onCooldownEffect(piece, { ...ctx, t: 8 });
assert.equal(owner.stacks.mana, 3, 'Perpetuum Mobile refunds rounded used buff stacks');
assert.equal(owner.stamina, 3.6, 'Perpetuum Mobile preserves fractional stamina refund');
assert.equal(events.length > cooldownStart, true);
assert.equal(events.at(-1)?.type, 'activate', 'Perpetuum Mobile activates after cooldown refunds');

console.log('OK Perpetuum Mobile source and lifecycle regression');

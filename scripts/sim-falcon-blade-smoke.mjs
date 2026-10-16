import assert from 'node:assert/strict';
import fs from 'node:fs';

import rules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const source = fs.readFileSync('tools/game-extract-full/Items/FalconBlade.gd', 'utf8');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasCooldown\(\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*getP1\(\) \/ 100/);
assert.match(source, /onCombatStart\(\):[\s\S]*activate\(null, false\)/);
assert.match(source, /if useStamina\(\) == Character\.StaminaResult\.Sufficient/);
assert.match(source, /var res: DamageResult = dealDamage\(\)[\s\S]*activate\(res, false\)/);
assert.match(source, /var res2 = dealDamage\(\)[\s\S]*activate\(res2, false\)/);

const handler = getScriptHandler('falcon_blade');
assert.equal(handler?.handlerId, 'falcon_blade');
assert.equal(typeof handler?.onCombatStart, 'function');
assert.equal(typeof handler?.onCooldownEffect, 'function');

const linkedSource = {
  itemId: 'falcon_blade',
  placementKey: 'linked-falcon',
  name: 'Falcon Blade',
  params: { speed: 40, p1: 40 },
  side: 'you',
  speedScale: 0,
};
const linkedCooldown = {
  itemId: 'wooden_sword',
  placementKey: 'linked-target',
  name: 'Wooden Sword',
  cooldown: 1.4,
  speedScale: 0,
};
const linkedPassive = {
  itemId: 'passive',
  placementKey: 'linked-passive',
  name: 'Passive',
  cooldown: 0,
  speedScale: 0,
};
const linkedCtx = {
  t: 2.5,
  combatStartSeq: 0,
  events: [],
  pieces: [linkedSource, linkedCooldown, linkedPassive],
  graph: {
    pieces: new Map([
      ['linked-falcon', { key: 'linked-falcon', id: 'falcon_blade', cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }, { cell: '2,0', color: 'primary' }] }],
      ['linked-target', { key: 'linked-target', id: 'wooden_sword', cells: ['1,0'], affectCells: [] }],
      ['linked-passive', { key: 'linked-passive', id: 'passive', cells: ['2,0'], affectCells: [] }],
    ]),
    filled: new Map([['0,0', 'linked-falcon'], ['1,0', 'linked-target'], ['2,0', 'linked-passive']]),
  },
  itemsById: new Map([
    ['falcon_blade', { id: 'falcon_blade', type: 'Melee Weapon' }],
    ['wooden_sword', { id: 'wooden_sword', type: 'Melee Weapon', cooldown: 1.4 }],
    ['passive', { id: 'passive', type: 'Skill', cooldown: null }],
  ]),
  canAffect: { rulesById: rules.byId },
};
handler.onCombatStart(linkedSource, linkedCtx);
assert.ok(Math.abs(linkedCooldown.speedScale - 0.4) < 1e-9, 'primary cooldown link receives Falcon Blade speed');
assert.equal(linkedPassive.speedScale, 0, 'non-cooldown link is excluded by Falcon Blade source targeting');
assert.equal(linkedCtx.events.filter((event) => event.type === 'activate').length, 1, 'start activation follows the speed aura');

const zeroPiece = {
  itemId: 'falcon_blade',
  placementKey: 'falcon',
  name: 'Falcon Blade',
  params: { speed: 0, p1: 0 },
  side: 'you',
  cooldown: 1.7,
  speedScale: 0,
};
const zeroCtx = {
  t: 2.5,
  combatStartSeq: 0,
  events: [],
  pieces: [zeroPiece],
  graph: { pieces: new Map([['falcon', { key: 'falcon', id: 'falcon_blade', cells: ['0,0'], affectCells: [] }]]), filled: new Map([['0,0', 'falcon']]) },
  itemsById: new Map([['falcon_blade', { id: 'falcon_blade', type: 'Melee Weapon' }]]),
  canAffect: { rulesById: rules.byId },
};
handler.onCombatStart(zeroPiece, zeroCtx);
assert.equal(
  zeroCtx.events.filter((event) => event.type === 'activate').length,
  1,
  'typed zero speed still preserves the source combat-start activation',
);

const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const byId = new Map(
  ['falcon_blade'].map((id) => [id, catalog.find((item) => item.id === id)]).filter(([, item]) => item),
);
const run = simulateEngine({
  placements: [{ id: 'falcon_blade', key: 'falcon', x: 4, y: 4, r: 0 }],
  itemsById: byId,
  canAffect: { rulesById: rules.byId },
  durationSec: 7,
  dummyAttacks: false,
  playerMaxStamina: 20,
});
const itemEvents = run.events.filter((event) => event.itemId === 'falcon_blade');
const startActivations = itemEvents.filter(
  (event) => event.type === 'activate' && event.meta?.combatStart === true,
);
const cooldownActivations = itemEvents.filter(
  (event) => event.type === 'activate' && event.meta?.combatStart !== true,
);
const hits = itemEvents.filter((event) => event.type === 'damage');
const staminaUses = itemEvents.filter((event) => event.type === 'stamina' && event.meta?.kind === 'used');
assert.equal(startActivations.length, 1, 'combat-start Falcon Blade activation is logged once');
assert.equal(cooldownActivations.length, 4, 'two cooldowns produce two source activations per cooldown');
assert.equal(hits.length, 4, 'two cooldowns produce two damage calls each');
assert.equal(staminaUses.length, 2, 'each two-hit cooldown spends stamina once');
assert.ok(hits.every((event) => /hit [AB]$/.test(event.label)), 'both damage calls retain hit labels');

console.log('OK Falcon Blade source and double-hit regression');

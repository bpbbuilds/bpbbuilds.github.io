import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { applyStaminaSackInventoryMax, createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/StaminaSack.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ak-bags.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('export const staminaSackPort'),
  handlerSource.indexOf('/** VineweaveBasket.gd', handlerSource.indexOf('export const staminaSackPort') + 1),
);

assert.equal(inventory.byId.stamina_sack?.file, 'StaminaSack.gd');
assert.equal(inventory.byId.stamina_sack?.extends, 'Bag');
assert.deepEqual(inventory.byId.stamina_sack?.overrides, ['onPrepare', 'addToInventory']);
assert.match(source, /^extends Bag/);
assert.match(source, /func addToInventory\([\s\S]*changeBaseMaxStamina\(\)/);
assert.match(source, /func onRemoveFromInventory\(\):[\s\S]*changeBaseMaxStamina\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*isTypeInInventory\(ItemBook\.bagtacularDescriptor\)[\s\S]*getP\(\"stamina\"\) \/ 100\.0[\s\S]*giveStaminaRegeneration/);
assert.match(portBlock, /onPrepare/);
assert.match(portBlock, /hasBagtacular/);
assert.match(portBlock, /applyStaminaRegeneration/);
assert.match(portBlock, /\/ 100/);

const sack = { ...byId.get('stamina_sack'), itemId: 'stamina_sack', placementKey: 'sack', alive: true };
const bagtacular = { ...byId.get('bagtacular'), itemId: 'bagtacular', placementKey: 'bagtacular', alive: true };
const player = createActor('player');
const ctx = {
  player,
  pieces: [sack],
  itemsById: byId,
  events: [],
  t: 2,
};
const handler = getScriptHandler('stamina_sack');

assert.equal(handler?.handlerId, 'stamina_sack');
handler.onPrepare(sack, ctx);
assert.equal(player.staminaRegen, 1, 'a sack alone has no Bagtacular regeneration bonus');
assert.equal(player.maxStamina, 5, 'the actor starts at the base maximum stamina');

applyStaminaSackInventoryMax(player, [sack]);
assert.equal(player.maxStamina, 6, 'each inventory sack adds one maximum stamina');
assert.equal(player.stamina, 6, 'inventory recalculation refills the new maximum');

const withBagtacular = createActor('player');
handler.onPrepare(sack, {
  ...ctx,
  player: withBagtacular,
  pieces: [bagtacular, sack],
});
assert.equal(withBagtacular.staminaRegen, 1.07, 'Bagtacular adds its stamina parameter as regeneration percent');
assert.equal(withBagtacular.maxStamina, 5, 'Bagtacular does not add maximum stamina itself');

console.log('OK Stamina Sack source, Bag inheritance, inventory max-stamina behavior, Bagtacular-only regeneration, and prepare regression');

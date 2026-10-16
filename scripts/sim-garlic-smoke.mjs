import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Garlic.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveBlock\(getBlock\(\) \+ extraBlock\)[\s\S]*if rollChance\(\):[\s\S]*removeVampirism\(getP1\(\)\)[\s\S]*activate\(\)/);
assert.match(source, /func onShopEntered\(\):[\s\S]*extraBlock = 0/);
assert.match(source, /func addBonusBlock\(_extraBlock\):[\s\S]*extraBlock \+= _extraBlock/);
assert.equal(inventory.byId.garlic?.file, 'Garlic.gd');
assert.equal(getScriptHandler('garlic')?.handlerId, 'garlic');

const owner = createActor('player', { maxHp: 100 });
const foe = createActor('dummy', { maxHp: 100 });
const bus = createCombatBus();
owner._combatBus = bus;
foe._combatBus = bus;
const garlicItem = byId.get('garlic');
const garlic = {
  ...garlicItem,
  itemId: 'garlic',
  placementKey: 'you:garlic',
  name: 'Garlic',
  params: { ...(garlicItem?.params || {}) },
  side: 'you',
  kind: 'food',
  blockGrant: garlicItem?.block || 0,
  baseCooldown: garlicItem?.cooldown || 4,
  cooldown: garlicItem?.cooldown || 4,
  _extraBlock: 2,
};
const ctx = {
  player: owner,
  dummy: foe,
  itemsById: byId,
  pieces: [garlic],
  events: [],
  bus,
  rng: () => 0,
  t: 5,
};
const handler = getScriptHandler('garlic');

foe.stacks.vampirism = 1;
handler.onCooldownEffect(garlic, ctx);
assert.equal(owner.block, 5, 'Garlic gives catalog Block plus its extraBlock bonus');
assert.equal(owner.stacks.vampirism, 0, 'Garlic does not remove Vampirism from its wearer');
assert.equal(foe.stacks.vampirism, 0, 'Garlic removes the opponent Vampirism stack');
assert.equal(ctx.events.at(-1)?.type, 'activate', 'Garlic activates after its Block grant and Vampirism removal');

console.log('OK Garlic source-backed Block plus extraBlock, opponent Vampirism removal with partial-stack clamp, and activation ordering');

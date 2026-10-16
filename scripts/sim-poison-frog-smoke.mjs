import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/PoisonFrog.gd', 'utf8');

assert.equal(inventory.byId.poison_frog?.file, 'Exclusive/PoisonFrog.gd');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.gainsBuffs\(\) or item\.usesBuffs\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*connectToCharacterBuffs\("onBuffsChanged"\)/);
assert.match(source, /if amount > 0:[\s\S]*var ticks = gainedBuffs \/ gainedThreshold[\s\S]*heal\(\)[\s\S]*gainedBuffs %= gainedThreshold/);
assert.match(source, /inflictPoison\(ticks \* poison, event\)[\s\S]*giveMana\(ticks \* mana, event\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*inflictPoison\(getP\("poison2"\)\)[\s\S]*giveMana\(getP\("mana2"\)\)[\s\S]*activate\(\)/);

const frog = {
  ...byId.get('poison_frog'),
  itemId: 'poison_frog',
  placementKey: 'frog',
  name: 'Poison Frog',
  params: byId.get('poison_frog').params,
  alive: true,
  kind: 'pet',
  cooldown: 2.1,
  baseCooldown: 2.1,
};
const manaPotion = {
  ...byId.get('mana_potion'),
  itemId: 'mana_potion',
  placementKey: 'mana-potion',
  name: 'Mana Potion',
  params: byId.get('mana_potion').params,
  alive: true,
  kind: 'consumable',
};
const graph = {
  pieces: new Map([
    ['frog', { key: 'frog', id: 'poison_frog', cells: [], affectCells: [
      { cell: 'mana-link', color: 'primary' },
    ] }],
    ['mana-potion', { key: 'mana-potion', id: 'mana_potion', cells: [], affectCells: [] }],
  ]),
  filled: new Map([['mana-link', 'mana-potion']]),
};
const player = createActor('player', { maxHp: 100 });
player.hp = 50;
player._simT = 2.5;
const dummy = createActor('dummy', { maxHp: 100 });
const events = [];
const ctx = {
  player,
  dummy,
  pieces: [frog, manaPotion],
  graph,
  itemsById: byId,
  canAffect: {
    rulesById: canAffectRules.byId,
    gainsBuffsIds: new Set(canAffectRules.gainsBuffsIds || []),
    usesBuffsIds: new Set(canAffectRules.usesBuffsIds || []),
  },
  events,
  t: 2.5,
  rng: () => 0,
};
const handler = getScriptHandler('poison_frog');

assert.equal(handler?.handlerId, 'poison_frog');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(handler?.onCombatStart, undefined);
handler.onPrepare(frog, ctx);

grantStacks(player, 'lucky', 21, {
  originKey: manaPotion.placementKey,
  originId: manaPotion.itemId,
});
assert.equal(player.hp, 62, 'multiple gained thresholds still call source heal() once');
assert.equal(frog._toadState.gained, 1);

player.stacks.lucky = 10;
spendStacks(player, 'lucky', 10, {
  originKey: manaPotion.placementKey,
  originId: manaPotion.itemId,
});
assert.equal(dummy.stacks.poison, 2, 'used threshold grants ticks × poison');
assert.equal(player.stacks.mana, 1, 'used threshold grants ticks × mana');

ctx.t = 5;
player._simT = 5;
handler.onCooldownEffect(frog, ctx);
assert.equal(dummy.stacks.poison, 4, 'cooldown applies poison2');
assert.equal(player.stacks.mana, 2, 'cooldown applies mana2');
assert.equal(events.at(-1)?.type, 'activate', 'cooldown activation follows effects');

console.log('OK Poison Frog source and threshold lifecycle regression');

import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/WoodenSword.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-basic.js', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const sourceItem = catalog.find((item) => item.id === 'wooden_sword');
const portBlock = portSource.slice(
  portSource.indexOf('const woodenSwordPort'),
  portSource.indexOf('export const AP_BASIC_PORTS'),
);

assert.ok(sourceItem, 'Wooden Sword: extracted catalog row');
assert.equal(inventory.byId.wooden_sword?.file, 'WoodenSword.gd');
assert.equal(inventory.byId.wooden_sword?.extends, 'Item');
assert.deepEqual(inventory.byId.wooden_sword?.overrides, ['doCooldownEffect']);
assert.match(source, /func _ready\(\)(?:\s*->\s*void)?\s*:[\s\S]*damageSource = DamageSource\.new\(\)\.setItem\(self\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*if useStamina\(\) == Character\.StaminaResult\.Sufficient:[\s\S]*dealDamage\(\)[\s\S]*activate\(res\)/);
assert.match(portBlock, /onCooldownEffect\(piece, ctx\)/);
assert.match(portBlock, /weaponStrike\(piece, ctx, 'wooden_sword'\)/);
assert.equal(getScriptHandler('wooden_sword')?.handlerId, 'wooden_sword');

function context(stamina = 10) {
  const player = createActor('player', { maxHp: 100, maxStamina: 10 });
  const dummy = createActor('dummy', { maxHp: 100 });
  player.stamina = stamina;
  const events = [];
  const piece = {
    ...sourceItem,
    itemId: 'wooden_sword',
    placementKey: 'you:wooden-sword',
    name: 'Wooden Sword',
    kind: 'weapon',
    side: 'you',
    alive: true,
    accuracy: 100,
    damageMin: 1,
    damageMax: 1,
    staminaCost: 1,
    chanceTag: null,
    params: {},
  };
  return {
    t: 3,
    player,
    dummy,
    events,
    rng: () => 0,
    pieces: [piece],
    itemsById: new Map([['wooden_sword', sourceItem]]),
    piece,
  };
}

const handler = getScriptHandler('wooden_sword');
const combat = context();
assert.equal(handler.onCooldownEffect(combat.piece, combat), true, 'Wooden Sword handles a sufficient-stamina cooldown');
assert.equal(combat.player.stamina, 9, 'Wooden Sword spends its source stamina cost before dealing damage');
assert.equal(combat.dummy.hp, 99, 'Wooden Sword deals its source damage after the stamina spend');
const activation = combat.events.find((event) => event.type === 'activate' && event.meta?.handler === 'wooden_sword');
assert.ok(activation, 'Wooden Sword activates after its damage result');
assert.equal(activation.t, 3, 'Wooden Sword activation uses the cooldown timestamp');

const starved = context(0.5);
assert.equal(handler.onCooldownEffect(starved.piece, starved), false, 'Wooden Sword does not activate when stamina is insufficient');
assert.equal(starved.dummy.hp, 100, 'Wooden Sword does not deal damage after a failed stamina check');
assert.equal(starved.events.filter((event) => event.meta?.starved).length, 1, 'Wooden Sword records its out-of-stamina result');
assert.equal(starved.events.filter((event) => event.type === 'activate').length, 0, 'Wooden Sword does not activate after starvation');

const zeroCost = context();
zeroCost.piece.staminaCost = 0;
assert.equal(handler.onCooldownEffect(zeroCost.piece, zeroCost), true, 'Wooden Sword preserves an explicit zero stamina cost');
assert.equal(zeroCost.player.stamina, 10, 'Wooden Sword does not spend stamina for an explicit zero cost');
assert.equal(zeroCost.dummy.hp, 99, 'Wooden Sword still deals damage with an explicit zero stamina cost');

console.log('OK Wooden Sword source/parity smoke');

import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { takeDamage } from '../js/pages/sim/engine/damage.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/WoodenBuckler.gd', 'utf8');
const shieldSource = fs.readFileSync('tools/game-extract-full/Items/Shield.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ai-hard.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('export const woodenBucklerPort'),
  handlerSource.indexOf('/** ExtraAngy.gd', handlerSource.indexOf('export const woodenBucklerPort')),
);
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const sourceItem = catalog.find((item) => item.id === 'wooden_buckler');

assert.ok(sourceItem, 'Wooden Buckler: extracted catalog row');
assert.equal(inventory.byId.wooden_buckler?.file, 'WoodenBuckler.gd');
assert.equal(inventory.byId.wooden_buckler?.extends, 'Shield');
assert.match(source, /func afterBlock\(\):[\s\S]*drainStamina\(getP2\(\), blockedDamageRes\.event\)[\s\S]*activate\(\)/);
assert.match(shieldSource, /func prepare\(\):[\s\S]*connectForCombat\(character\(\), "pre_take_damage", "preTakeDamage"\)[\s\S]*\.prepare\(\)/);
assert.match(shieldSource, /func getDamageBlock\(\):[\s\S]*return getP_m\("damblock"\)/);
assert.match(shieldSource, /func canBlockDamageRes\(damageRes: DamageResult\) -> bool:[\s\S]*return damageRes\.triggerOnMeleeAttacked\(\)/);
assert.match(portBlock, /onPrepare\(piece, ctx\)/);
assert.doesNotMatch(portBlock, /onCombatStart/);
assert.match(portBlock, /getChance\(\)/);
assert.match(portBlock, /modifiedParamValue\([\s\S]*'damblock'/);
assert.match(portBlock, /drainStamina\(ctx\.player/);
assert.match(fs.readFileSync('js/pages/sim/engine/damage.js', 'utf8'), /typeof sh\.getChance === 'function'/);

const handler = getScriptHandler('wooden_buckler');
assert.equal(typeof handler?.onPrepare, 'function', 'Wooden Buckler uses inherited Shield preparation timing');

function makeContext(overrides = {}) {
  const player = createActor('player', { maxHp: 100, maxStamina: 10 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  const piece = {
    ...sourceItem,
    itemId: 'wooden_buckler',
    placementKey: 'you:buckler',
    name: 'Wooden Buckler',
    params: { ...sourceItem.params },
    kind: 'armor',
    side: 'you',
    alive: true,
    chance: 100,
    ...overrides,
  };
  const events = [];
  return {
    t: 5,
    player,
    dummy,
    bus,
    events,
    pieces: [piece],
    itemsById: new Map([['wooden_buckler', sourceItem]]),
    rng: () => 0,
    piece,
  };
}

const combat = makeContext({
  paramAdd: { damblock: 1 },
  paramMult: { damblock: 2 },
});
handler.onPrepare(combat.piece, combat);
assert.equal(combat.player._shields?.length, 1, 'Wooden Buckler registers before combat starts');
const shield = combat.player._shields[0];
assert.equal(shield.getDamblock(), 16, 'Wooden Buckler applies source placement damage-block modifiers');
assert.equal(shield.getChance(), 100, 'Wooden Buckler preserves the explicit item chance');

combat.player.stamina = 0.2;
const result = takeDamage(combat.player, combat.dummy, {
  amount: 20,
  accuracy: 100,
  canMiss: false,
  canCrit: false,
  canBlock: false,
  isAttack: true,
  isMelee: true,
  nowT: 7,
  events: combat.events,
  bus: combat.bus,
  rng: () => 0,
});
assert.equal(result.reduced, 16, 'Wooden Buckler blocks its modified damage amount');
assert.equal(result.healthDamage, 4, 'Wooden Buckler leaves only post-block damage');
assert.equal(combat.player.stamina, 0, 'Wooden Buckler drains up to available stamina without a sufficient-stamina gate');
const drain = combat.events.find((event) => event.meta?.handler === 'wooden_buckler' && event.meta?.kind === 'drain');
const activation = combat.events.find((event) => event.type === 'activate' && event.meta?.handler === 'wooden_buckler');
assert.equal(drain?.amount, 0.2, 'Wooden Buckler logs the actual drained amount');
assert.equal(drain?.t, 7, 'Wooden Buckler drain uses the blocked hit timestamp');
assert.ok(drain && activation && combat.events.indexOf(drain) < combat.events.indexOf(activation), 'afterBlock drains before activation');
assert.equal(activation?.t, 7, 'Wooden Buckler activation uses the blocked hit timestamp');

const zero = makeContext({ chance: 0 });
handler.onPrepare(zero.piece, zero);
assert.equal(zero.player._shields[0].getChance(), 0, 'Wooden Buckler preserves an explicit zero chance');
const zeroResult = takeDamage(zero.player, zero.dummy, {
  amount: 10,
  accuracy: 100,
  canMiss: false,
  canCrit: false,
  canBlock: false,
  isAttack: true,
  isMelee: true,
  nowT: 2,
  events: zero.events,
  bus: zero.bus,
  rng: () => 0,
});
assert.equal(zeroResult.reduced, 0, 'explicit zero chance does not block a melee hit');
assert.equal(zero.events.filter((event) => event.type === 'activate').length, 0, 'explicit zero chance does not activate');

console.log('OK Wooden Buckler source/parity smoke');

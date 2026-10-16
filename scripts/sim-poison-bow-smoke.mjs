import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const source = fs.readFileSync('tools/game-extract-full/Items/PoisonBow.gd', 'utf8');
const bowBase = fs.readFileSync('tools/game-extract-full/Items/Bow.gd', 'utf8');

assert.equal(inventory.byId.poison_bow?.file, 'PoisonBow.gd');
assert.match(source, /func hasAttackEffect\(\)[^:]*:[\s\S]*return true/);
assert.match(source, /func onPrepare\(\):[\s\S]*character_poison_changed/);
assert.match(source, /damageAcc \+= damageRes\.damage/);
assert.match(source, /var poisonStacks = damageAcc \/ damagePerPoison[\s\S]*inflictPoison\(poisonStacks\)[\s\S]*damageAcc %= damagePerPoison[\s\S]*dealDamage\(\)[\s\S]*activate\(res\)/);
assert.match(source, /changeVaryingDamage\(amount \* getP2\(\)\)/);
assert.match(bowBase, /affectedWeapon = getFirstAffectedItem\(\)/);

const bow = {
  ...byId.get('poison_bow'),
  itemId: 'poison_bow',
  placementKey: 'bow',
  name: 'Poison Bow',
  params: byId.get('poison_bow').params,
  side: 'you',
  kind: 'weapon',
  alive: true,
  damageMin: 11,
  damageMax: 11,
  staminaCost: 1.2,
  cooldown: 3,
  baseCooldown: 3,
  accuracy: 100,
  bonusDamage: 0,
};
const target = {
  ...byId.get('wooden_sword'),
  itemId: 'wooden_sword',
  placementKey: 'target',
  name: 'Wooden Sword',
  side: 'you',
  kind: 'weapon',
  alive: true,
};
const graph = {
  pieces: new Map([
    ['bow', { key: 'bow', id: 'poison_bow', cells: [], affectCells: [
      { cell: 'target-link', color: 'primary' },
    ] }],
    ['target', { key: 'target', id: 'wooden_sword', cells: [], affectCells: [] }],
  ]),
  filled: new Map([['target-link', 'target']]),
};
const bus = createCombatBus();
const player = createActor('player', { maxHp: 100 });
const dummy = createActor('dummy', { maxHp: 100 });
player._combatBus = dummy._combatBus = bus;
const events = [];
const ctx = {
  player,
  dummy,
  bus,
  events,
  graph,
  pieces: [bow, target],
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  rng: () => 0,
  t: 5,
  activatePiece: () => true,
};
const handler = getScriptHandler('poison_bow');

assert.equal(handler?.handlerId, 'poison_bow');
handler.onPrepare(bow, ctx);
assert.equal(bow._bowAffectedWeapon, 'target');
assert.equal(bow._poisonAcc, 0);

bus.emit('item_attacked', { piece: target, hit: { hit: true, damage: 12 }, t: 5 });
bus.emit('item_attacked', { piece: target, hit: { hit: false, damage: 12 }, t: 5 });
assert.equal(bow._poisonAcc, 12, 'only a hit from the prepared weapon is accumulated');

grantStacks(dummy, 'poison', 2, { originId: 'test-poison' });
assert.equal(bow.bonusDamage, 1, 'opponent Poison changes damage by p2 0.5 per stack');

handler.onCooldownEffect(bow, ctx);
assert.equal(dummy.stacks.poison, 4, 'damageAcc 12 converts to floor(12 / p1 5) Poison');
assert.equal(bow._poisonAcc, 2, 'Poison Bow keeps the damage remainder');
assert.ok(events.findIndex((event) => event.type === 'debuff') < events.findIndex((event) => event.type === 'activate'));
assert.equal(player.stamina, 3.8, 'the inherited weapon strike spends catalog stamina 1.2');

console.log('OK Poison Bow source and accumulated-poison lifecycle regression');

import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor, tryUseStamina } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SpellScrollNature.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ao-spells.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('const spellScrollNaturePort'),
  handlerSource.indexOf('function bookPort', handlerSource.indexOf('const spellScrollNaturePort') + 1),
);
const actorSource = fs.readFileSync('js/pages/sim/engine/actor.js', 'utf8');

assert.equal(inventory.byId.spell_scroll_nature?.file, 'Exclusive/SpellScrollNature.gd');
assert.deepEqual(inventory.byId.spell_scroll_nature?.overrides, ['onPrepare']);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.canUseStamina\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*staminaAcc = 0\.0[\s\S]*used_stamina/);
assert.match(source, /func onItemUsedStamina\(amount\):[\s\S]*staminaAcc \+= amount[\s\S]*while staminaAcc >= staminaNeeded - 0\.0001[\s\S]*getMana\(\) >= manaNeeded[\s\S]*useMana\(manaNeeded\)[\s\S]*giveStamina\(stamina, event\)[\s\S]*activate\(\)[\s\S]*staminaAcc -= staminaNeeded/);
assert.match(actorSource, /'stamina_used',[\s\S]*piece: actor\._staminaItem/);
assert.doesNotMatch(portBlock, /onCombatStart/);
assert.match(portBlock, /onPrepare/);
assert.match(portBlock, /stamina_used/);
assert.match(portBlock, /useMana/);
assert.match(portBlock, /giveStamina/);
assert.match(portBlock, /while/);

const scroll = {
  ...byId.get('spell_scroll_nature'),
  itemId: 'spell_scroll_nature',
  placementKey: 'scroll',
  name: 'Spell Scroll Nature',
  params: { staminat: 4, p1: 4, mana: 1, p2: 1, stamina: 1, p3: 1 },
  kind: 'spell',
  alive: true,
};
const weapon = {
  ...byId.get('wooden_sword'),
  itemId: 'wooden_sword',
  placementKey: 'weapon',
  name: 'Wooden Sword',
  kind: 'weapon',
  staminaCost: 1.5,
};
const outsideWeapon = {
  ...byId.get('wooden_sword'),
  itemId: 'wooden_sword',
  placementKey: 'outside-weapon',
  name: 'Outside Wooden Sword',
  kind: 'weapon',
  staminaCost: 1.5,
};
const graph = {
  pieces: new Map([
    ['scroll', {
      key: 'scroll',
      id: 'spell_scroll_nature',
      cells: [],
      affectCells: [{ cell: 'weapon-cell', color: 'primary' }],
    }],
    ['weapon', { key: 'weapon', id: 'wooden_sword', cells: [], affectCells: [] }],
    ['outside-weapon', { key: 'outside-weapon', id: 'wooden_sword', cells: [], affectCells: [] }],
  ]),
  filled: new Map([['weapon-cell', 'weapon']]),
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
  pieces: [scroll, weapon, outsideWeapon],
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events,
  bus,
  t: 2,
  rng: () => 0,
};
const handler = getScriptHandler('spell_scroll_nature');

assert.equal(handler?.handlerId, 'spell_scroll_nature');
assert.equal(typeof handler?.onPrepare, 'function');
handler.onPrepare(scroll, ctx);
assert.equal(scroll._natureStaminaAcc, 0, 'prepare resets the fractional stamina accumulator');

bus.emit('stamina_used', { actor: player, piece: outsideWeapon, amount: 4 });
assert.equal(scroll._natureStaminaAcc, 0, 'unlinked stamina use is ignored');
player.stamina = 5.9;
player.stacks.mana = 2;
player._staminaItem = weapon;
assert.equal(tryUseStamina(player, 3.9), 'ok', 'linked stamina use emits the source piece');
player._staminaItem = null;
assert.equal(scroll._natureStaminaAcc, 3.9, 'linked stamina use accumulates fractionally');
assert.equal(events.filter((event) => event.type === 'activate').length, 0, 'threshold has not been reached');
bus.emit('stamina_used', { actor: player, piece: weapon, amount: 0.2 });
assert.ok(Math.abs(scroll._natureStaminaAcc - 0.1) < 1e-9, 'one threshold is removed while the remainder is retained');
assert.equal(player.stacks.mana, 1, 'one successful proc spends one Mana');
assert.ok(Math.abs(player.stamina - 3) < 1e-9, 'one successful proc grants source Stamina');
assert.equal(events.filter((event) => event.type === 'activate').length, 1, 'one threshold activates the scroll');

bus.emit('stamina_used', { actor: player, piece: weapon, amount: 8.1 });
assert.ok(Math.abs(scroll._natureStaminaAcc - 0.2) < 1e-9, 'multiple thresholds drain the accumulator even when Mana runs out');
assert.equal(player.stacks.mana, 0, 'the second threshold spends the remaining Mana');
assert.ok(Math.abs(player.stamina - 4) < 1e-9, 'only the Mana-funded threshold grants Stamina');
assert.equal(events.filter((event) => event.type === 'activate').length, 2, 'each Mana-funded threshold activates once');

console.log('OK Spell Scroll Nature source, linked stamina filtering, fractional accumulator, multi-threshold loop, Mana gate, and Stamina grants regression');

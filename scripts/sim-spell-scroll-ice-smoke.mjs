import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { takeDamage } from '../js/pages/sim/engine/damage.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SpellScrollIce.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ao-spells.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('const spellScrollIcePort'),
  handlerSource.indexOf('const spellScrollNaturePort'),
);
const damageSource = fs.readFileSync('js/pages/sim/engine/damage.js', 'utf8');

assert.equal(inventory.byId.spell_scroll_ice?.file, 'Exclusive/SpellScrollIce.gd');
assert.deepEqual(inventory.byId.spell_scroll_ice?.overrides, ['onPrepare']);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Shield\)[\s\S]*item\.hasType\(Type\.Armor\) and item\.canActivate\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*activated = false[\s\S]*pre_take_damage_late[\s\S]*getAffectedItems\(\)[\s\S]*activated/);
assert.match(source, /func onCharacterAttacked\(damageRes\):[\s\S]*damageRes\.willBeLethal\(character\(\)\)[\s\S]*opponentCold > 0[\s\S]*loseCold\(opponentCold[\s\S]*giveBlock\(round\(getBlock\(\) \* opponentCold\)[\s\S]*consume\(\)/);
assert.match(source, /func onShieldOrArmorActivated\(event\):[\s\S]*coldInflicted < maxCold[\s\S]*rollChance\(\)[\s\S]*coldInflicted = min\(cold, maxCold - coldInflicted\)[\s\S]*inflictCold\(cold, event\)[\s\S]*miniActivate\(\)/);
assert.match(damageSource, /pre_take_damage_late/);
assert.doesNotMatch(portBlock, /onCombatStart/);
assert.match(portBlock, /onPrepare/);
assert.match(portBlock, /pre_take_damage_late/);
assert.match(portBlock, /getStackAmount\(ctx\.dummy, 'cold'\)/);
assert.match(portBlock, /afterEffectFinished/);
assert.match(portBlock, /onPeerActivated/);
assert.match(portBlock, /miniActivate: true/);
assert.match(portBlock, /Math\.round/);

const scroll = {
  ...byId.get('spell_scroll_ice'),
  itemId: 'spell_scroll_ice',
  placementKey: 'scroll',
  name: 'Spell Scroll Ice',
  params: { cold: 2, p1: 2, max: 3, p2: 3 },
  chance: 100,
  blockGrant: 2,
  kind: 'spell',
  alive: true,
};
const armor = {
  ...byId.get('holy_armor'),
  itemId: 'holy_armor',
  placementKey: 'armor',
  name: 'Holy Armor',
  kind: 'armor',
  cooldown: 2.2,
};
const outsideShield = {
  ...byId.get('wooden_buckler'),
  itemId: 'wooden_buckler',
  placementKey: 'outside-shield',
  name: 'Outside Shield',
  kind: 'shield',
};
const graph = {
  pieces: new Map([
    ['scroll', {
      key: 'scroll',
      id: 'spell_scroll_ice',
      cells: [],
      affectCells: [{ cell: 'armor-cell', color: 'primary' }],
    }],
    ['armor', { key: 'armor', id: 'holy_armor', cells: [], affectCells: [] }],
    ['outside-shield', { key: 'outside-shield', id: 'wooden_buckler', cells: [], affectCells: [] }],
  ]),
  filled: new Map([['armor-cell', 'armor']]),
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
  pieces: [scroll, armor, outsideShield],
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events,
  bus,
  t: 2,
  rng: () => 0,
};
const handler = getScriptHandler('spell_scroll_ice');

assert.equal(handler?.handlerId, 'spell_scroll_ice');
assert.equal(typeof handler?.onPrepare, 'function');
handler.onPrepare(scroll, ctx);
assert.equal(scroll._iceUsed, false, 'prepare resets the lethal-save state');
assert.equal(scroll._iceColdInflicted, 0, 'prepare resets linked activation Cold');

handler.onPeerActivated(scroll, outsideShield, ctx);
assert.equal(dummy.stacks.cold, 0, 'unlinked Shield activation is ignored');
handler.onPeerActivated(scroll, armor, ctx);
assert.equal(dummy.stacks.cold, 2, 'linked Armor activation inflicts source Cold');
assert.equal(events.at(-1)?.meta?.miniActivate, true, 'linked activation is a visual-only miniActivate');
assert.equal(events.filter((event) => event.type === 'activate').length, 0, 'miniActivate does not inflate normal activations');

dummy.stacks.cold = 3;
player.hp = 10;
player.block = 0;
takeDamage(player, dummy, {
  amount: 10,
  canMiss: false,
  canCrit: false,
  isAttack: true,
  nowT: 4,
  events,
  bus,
  rng: () => 0,
});
assert.equal(scroll._iceUsed, true, 'late pre-damage listener arms once on a lethal hit');
assert.equal(dummy.stacks.cold, 0, 'lethal save spends all opponent Cold');
assert.equal(player.hp, 6, 'generated Block is applied before the incoming hit resolves');
assert.equal(scroll.alive, false, 'lethal save consumes the scroll');
assert.ok(events.some((event) => event.type === 'activate' && event.meta?.consume), 'consume activation is recorded after the save effects');

console.log('OK Spell Scroll Ice source, linked activation Cold, late lethal-save bridge, pre-hit Block, and consume ordering regression');

import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SpellScrollLight.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-b-heal.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('export const spellScrollLightPort'),
  handlerSource.indexOf('/** StaffofUnhealing', handlerSource.indexOf('export const spellScrollLightPort') + 1),
);

assert.equal(inventory.byId.spell_scroll_light?.file, 'Exclusive/SpellScrollLight.gd');
assert.deepEqual(inventory.byId.spell_scroll_light?.overrides, ['doCooldownEffect', 'onPrepare']);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Holy\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*addSpeed\(speedBonus \* getNumAffectedItems\(\)\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*cleanseRandomDebuffs\(1\)[\s\S]*getDebuffStacks\(\) == 0[\s\S]*heal\(\)[\s\S]*activate\(\)/);
assert.doesNotMatch(portBlock, /onCombatStart/);
assert.match(portBlock, /onPrepare/);
assert.match(portBlock, /cleanseRandomDebuffs/);
assert.match(portBlock, /modifiedParamValue/);
assert.match(portBlock, /pushActivate/);
assert.match(portBlock, /debuffs/);

const scroll = {
  ...byId.get('spell_scroll_light'),
  itemId: 'spell_scroll_light',
  placementKey: 'scroll',
  name: 'Spell Scroll Light',
  params: { heal: 8.9, p1: 8.9, speed: 10.9, p4: 10.9 },
  paramMult: { heal: 2 },
  kind: 'spell',
  baseCooldown: 2.4,
  cooldown: 2.4,
  alive: true,
};
const holyArmor = {
  ...byId.get('holy_armor'),
  itemId: 'holy_armor',
  placementKey: 'holy-armor',
  name: 'Holy Armor',
  kind: 'armor',
};
const sword = {
  ...byId.get('wooden_sword'),
  itemId: 'wooden_sword',
  placementKey: 'sword',
  name: 'Wooden Sword',
  kind: 'weapon',
};
const graph = {
  pieces: new Map([
    ['scroll', {
      key: 'scroll',
      id: 'spell_scroll_light',
      cells: [],
      affectCells: [
        { cell: 'holy-cell', color: 'primary' },
        { cell: 'sword-cell', color: 'primary' },
      ],
    }],
    ['holy-armor', { key: 'holy-armor', id: 'holy_armor', cells: [], affectCells: [] }],
    ['sword', { key: 'sword', id: 'wooden_sword', cells: [], affectCells: [] }],
  ]),
  filled: new Map([
    ['holy-cell', 'holy-armor'],
    ['sword-cell', 'sword'],
  ]),
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
  pieces: [scroll, holyArmor, sword],
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events,
  bus,
  t: 2,
  rng: () => 0,
};
const handler = getScriptHandler('spell_scroll_light');

assert.equal(handler?.handlerId, 'spell_scroll_light');
assert.equal(typeof handler?.onPrepare, 'function');
handler.onPrepare(scroll, ctx);
assert.equal(scroll.speedScale, 0.109, 'only linked Holy items grant preparation speed');
assert.equal(holyArmor.speedScale, undefined, 'preparation speed applies to the scroll, not its targets');

player.hp = 50;
player.stacks.poison = 1;
handler.onCooldownEffect(scroll, ctx);
assert.equal(player.stacks.poison, 0, 'cooldown cleanses one debuff before healing');
assert.equal(player.hp, 68, 'clear debuffs enable the modified source heal');
assert.equal(events.at(-1)?.type, 'activate', 'activation follows cleanse and heal');
const healCount = events.filter((event) => event.type === 'heal').length;

player.hp = 40;
player.stacks.poison = 1;
player.stacks.blind = 1;
handler.onCooldownEffect(scroll, { ...ctx, t: 3 });
assert.equal(player.stacks.poison, 0, 'second cooldown still cleanses one debuff');
assert.equal(player.stacks.blind, 1, 'remaining debuff prevents the source heal');
assert.equal(events.filter((event) => event.type === 'heal').length, healCount, 'no heal is logged while a debuff remains');
assert.equal(events.at(-1)?.type, 'activate', 'activation remains unconditional and last');

console.log('OK Spell Scroll Light source, Holy-only preparation speed, cleanse-before-heal gate, modified healing, and activation ordering regression');

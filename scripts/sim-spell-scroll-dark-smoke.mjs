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
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SpellScrollDark.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-skill.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('export const spellScrollDarkPort'),
  handlerSource.indexOf('/** Dragon Knight', handlerSource.indexOf('export const spellScrollDarkPort') + 1),
);

assert.equal(inventory.byId.spell_scroll_dark?.file, 'Exclusive/SpellScrollDark.gd');
assert.deepEqual(inventory.byId.spell_scroll_dark?.overrides, ['doCooldownEffect', 'onPrepare']);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasCooldown\(\)/);
assert.match(source, /func canAffect_secondary\(item\):[\s\S]*item\.hasType\(Type\.Dark\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*numActivations = 0[\s\S]*getNumAffectedItems\(Affected\.Secondary\) \* darkSpeed/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*numActivations \+= 1[\s\S]*item\.addSpeed\(speedBonus\)[\s\S]*giveStacks\(character\(\), Game\.EventType\.Blind, 1\)[\s\S]*onAfterEffectFinished\(\)[\s\S]*activate\(\)/);
assert.doesNotMatch(portBlock, /onCombatStart/);
assert.match(portBlock, /onPrepare/);
assert.match(portBlock, /secondary/);
assert.match(portBlock, /speed_dark/);
assert.match(portBlock, /afterEffectFinished/);
assert.match(portBlock, /Math\.trunc/);
assert.doesNotMatch(portBlock, /other\.cooldown > 0/);

const scroll = {
  ...byId.get('spell_scroll_dark'),
  itemId: 'spell_scroll_dark',
  placementKey: 'scroll',
  name: 'Spell Scroll Dark',
  params: { speed: 10.9, p1: 10.9, speed_dark: 15.9, p2: 15.9, max: 2.9, p3: 2.9 },
  kind: 'spell',
  baseCooldown: 3,
  cooldown: 3,
  alive: true,
};
const primary = {
  ...byId.get('wooden_sword'),
  itemId: 'wooden_sword',
  placementKey: 'primary',
  name: 'Wooden Sword',
  kind: 'weapon',
  baseCooldown: 1.4,
  cooldown: 1.4,
};
const dark = {
  ...byId.get('darksaber'),
  itemId: 'darksaber',
  placementKey: 'dark',
  name: 'Darksaber',
  kind: 'weapon',
  baseCooldown: 1.5,
  cooldown: 1.5,
};
const unrelated = {
  ...byId.get('garlic'),
  itemId: 'garlic',
  placementKey: 'unrelated',
  name: 'Garlic',
  kind: 'accessory',
  speedScale: 0,
};
const graph = {
  pieces: new Map([
    ['scroll', {
      key: 'scroll',
      id: 'spell_scroll_dark',
      cells: [],
      affectCells: [
        { cell: 'primary-cell', color: 'primary' },
        { cell: 'dark-cell', color: 'secondary' },
      ],
    }],
    ['primary', { key: 'primary', id: 'wooden_sword', cells: [], affectCells: [] }],
    ['dark', { key: 'dark', id: 'darksaber', cells: [], affectCells: [] }],
    ['unrelated', { key: 'unrelated', id: 'garlic', cells: [], affectCells: [] }],
  ]),
  filled: new Map([
    ['primary-cell', 'primary'],
    ['dark-cell', 'dark'],
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
  pieces: [scroll, primary, dark, unrelated],
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events,
  bus,
  t: 2,
  rng: () => 0,
};
const handler = getScriptHandler('spell_scroll_dark');

assert.equal(handler?.handlerId, 'spell_scroll_dark');
assert.equal(typeof handler?.onPrepare, 'function');
handler.onPrepare(scroll, ctx);
assert.equal(scroll._scrollActs, 0, 'prepare resets the source activation count');
assert.equal(scroll.speedScale, 0.159, 'secondary Dark targets grant the source dark-speed bonus');
assert.equal(primary.speedScale || 0, 0, 'prepare does not speed primary targets');

handler.onCooldownEffect(scroll, ctx);
assert.equal(primary.speedScale, 0.109, 'first cooldown applies source speed to the primary target');
assert.equal(dark.speedScale, 0.109, 'first cooldown applies source speed to the secondary target');
assert.equal(unrelated.speedScale || 0, 0, 'unaffected items are not sped up');
assert.equal(player.stacks.blind, 1, 'each cooldown grants one Blind');
assert.equal(scroll.alive, true, 'the scroll remains active before its final use');
assert.equal(events.at(-1)?.type, 'activate', 'first use activates after all effects');

handler.onCooldownEffect(scroll, { ...ctx, t: 3 });
assert.equal(primary.speedScale, 0.218, 'second cooldown adds another source speed bonus');
assert.equal(dark.speedScale, 0.218, 'second cooldown adds another source speed bonus to Dark targets');
assert.equal(player.stacks.blind, 2, 'second cooldown grants another Blind');
assert.equal(scroll.alive, false, 'the final use consumes the scroll');
assert.equal(scroll.cooldown, 999, 'the final use locks the scroll cooldown');
assert.equal(events.at(-1)?.type, 'activate', 'final consume activation remains after effects');
assert.equal(events.at(-1)?.meta?.consume, true, 'final activation carries consume semantics');

console.log('OK Spell Scroll Dark source, secondary Dark preparation speed, affected-item speed, Blind grants, and final consume ordering regression');

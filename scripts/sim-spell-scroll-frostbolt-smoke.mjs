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
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SpellScrollFrostbolt.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-b.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('export const spellScrollFrostboltPort'),
  handlerSource.indexOf('/** owl_spirit', handlerSource.indexOf('export const spellScrollFrostboltPort') + 1),
);

assert.equal(inventory.byId.spell_scroll_frostbolt?.file, 'Exclusive/SpellScrollFrostbolt.gd');
assert.deepEqual(inventory.byId.spell_scroll_frostbolt?.overrides, ['doCooldownEffect', 'onPrepare']);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Ice\)[\s\S]*not item\.isA\(descriptor\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*uses = 0[\s\S]*int\(getP1\(\)\) \+ getNumAffectedItems\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*uses < maxUses[\s\S]*descriptor\.minDam[\s\S]*giveStacksTemporary\(opponent\(\), Game\.EventType\.Cold, [\s\S]*getP_m\("dur_cold"\)[\s\S]*onAfterEffectFinished\(\)[\s\S]*activate\(\)/);
assert.doesNotMatch(portBlock, /onCombatStart/);
assert.match(portBlock, /onPrepare/);
assert.match(portBlock, /dealEffectDamage/);
assert.match(portBlock, /grantTemporaryStacks/);
assert.match(portBlock, /modifiedParamValue/);
assert.match(portBlock, /afterEffectFinished/);
assert.match(portBlock, /Math\.trunc/);
assert.doesNotMatch(portBlock, /Math\.max\(1, Math\.round\(piece\.damageMin/);

const scroll = {
  ...byId.get('spell_scroll_frostbolt'),
  itemId: 'spell_scroll_frostbolt',
  placementKey: 'scroll',
  name: 'Spell Scroll Frostbolt',
  params: { p1: 3.9, cold: 4.9, p3: 4.9, dur_cold: 3.6, p4: 3.6 },
  paramMult: { dur_cold: 2 },
  damageMin: 7,
  kind: 'spell',
  baseCooldown: 3,
  cooldown: 3,
  alive: true,
};
const iceTarget = {
  ...byId.get('frozen_flame'),
  itemId: 'frozen_flame',
  placementKey: 'ice-target',
  name: 'Frozen Flame',
  kind: 'accessory',
};
const unrelated = {
  ...byId.get('banana'),
  itemId: 'banana',
  placementKey: 'unrelated',
  name: 'Banana',
  kind: 'food',
};
const graph = {
  pieces: new Map([
    ['scroll', {
      key: 'scroll',
      id: 'spell_scroll_frostbolt',
      cells: [],
      affectCells: [{ cell: 'ice-cell', color: 'primary' }],
    }],
    ['ice-target', { key: 'ice-target', id: 'frozen_flame', cells: [], affectCells: [] }],
    ['unrelated', { key: 'unrelated', id: 'banana', cells: [], affectCells: [] }],
  ]),
  filled: new Map([['ice-cell', 'ice-target']]),
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
  pieces: [scroll, iceTarget, unrelated],
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events,
  bus,
  t: 2,
  rng: () => 0,
};
const handler = getScriptHandler('spell_scroll_frostbolt');

assert.equal(handler?.handlerId, 'spell_scroll_frostbolt');
assert.equal(typeof handler?.onPrepare, 'function');
handler.onPrepare(scroll, ctx);
assert.equal(scroll._frostUses, 0, 'prepare resets Frostbolt uses');
assert.equal(scroll._frostMax, 4, 'source max uses is integer p1 plus linked Ice count');

for (let i = 0; i < 4; i += 1) {
  handler.onCooldownEffect(scroll, { ...ctx, t: 2 + i });
  assert.equal(dummy.stacks.cold, (i + 1) * 4, 'each use adds four Cold to the dummy');
  assert.equal(scroll._frostUses, i + 1, 'use count increments once per effect');
  assert.ok(events.some((event) => event.meta?.effect && event.amount === 5), 'effect damage uses descriptor minDam');
  assert.equal(events.at(-1)?.type, 'activate', 'activation follows damage and temporary Cold');
}
assert.equal(scroll.alive, false, 'the final use consumes Frostbolt');
assert.equal(scroll.cooldown, 999, 'the final use locks Frostbolt cooldown');
assert.equal(events.at(-1)?.meta?.consume, true, 'final activation carries consume semantics');
assert.equal(dummy._tempStacks.at(-1)?.amount, 4, 'Cold is temporary and uses the source amount');
assert.equal(dummy._tempStacks.at(-1)?.expiresAt, 2 + 3 + 7.2, 'duration uses the modified dur_cold parameter');

console.log('OK Spell Scroll Frostbolt source, linked Ice max uses, descriptor effect damage, temporary Cold, and consume ordering regression');

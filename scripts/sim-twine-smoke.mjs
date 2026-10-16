import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Twine.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-an-accessories.js', 'utf8');
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));

assert.match(source, /func canAffect\(item\):[\s\S]*item\.canActivate\(\)/);
assert.match(source, /func canAffect_secondary\(item\):[\s\S]*item\.isNeutral\(\)/);
assert.match(source, /onready var maxHealth:[\s\S]*int\(getP\("health"\)\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(triggerItem, "activated", "onTriggerItemActivated"\)/);
assert.match(source, /getNumAffectedItems\(Affected\.Secondary\) \* getBaseChance2\(\)/);
assert.match(source, /giveMaxHealth\(maxHealth, event\)[\s\S]*activate\(\)/);
assert.match(portSource, /twinePort[\s\S]*onPrepare\(piece, ctx\)/);
assert.match(portSource, /twinePort[\s\S]*onPeerActivated\(listener, activated, ctx\)/);
assert.match(portSource, /getP1\(listener\.params/);

const baseTwine = byId.get('twine');
const weapon = byId.get('wooden_sword');
const neutral = byId.get('shield_of_valor');
assert.ok(baseTwine && weapon && neutral);

const makePiece = (item, placementKey, overrides = {}) => ({
  ...item,
  itemId: item.id,
  placementKey,
  name: item.name,
  alive: true,
  side: 'you',
  params: { ...(item.params || {}) },
  ...overrides,
});

const twineCatalog = {
  ...baseTwine,
  chance: 20,
  chance2: 20,
};
const twine = makePiece(twineCatalog, 'twine', {
  params: { health: 99, p1: 2 },
  chance: 0,
  chance2: 0,
});
const trigger = makePiece({ ...weapon, cooldown: 9 }, 'trigger');
const secondary = makePiece(neutral, 'secondary');
const graph = {
  pieces: new Map([
    ['twine', { key: 'twine', id: 'twine', cells: ['0,0'], affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'secondary' },
    ] }],
    ['trigger', { key: 'trigger', id: 'wooden_sword', cells: ['1,0'], affectCells: [] }],
    ['secondary', { key: 'secondary', id: 'shield_of_valor', cells: ['2,0'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', 'twine'],
    ['1,0', 'trigger'],
    ['2,0', 'secondary'],
  ]),
};
const player = createActor('player');
const events = [];
const ctx = {
  t: 3,
  player,
  dummy: createActor('dummy'),
  events,
  graph,
  pieces: [twine, trigger, secondary],
  itemsById: new Map([
    ['twine', twineCatalog],
    ['wooden_sword', { ...weapon, cooldown: 9 }],
    ['shield_of_valor', neutral],
  ]),
  canAffect: { rulesById: rules.byId },
  rng: () => 0,
};

const handler = getScriptHandler('twine');
assert.equal(handler?.handlerId, 'twine');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onPeerActivated, 'function');

handler.onPrepare(twine, ctx);
assert.deepEqual([...twine._twineTriggers], ['trigger'], 'Twine listens only to primary can-activate targets');
assert.equal(twine._twineSecondaryCount, 1, 'Twine counts one neutral secondary target');

const beforeMaxHp = player.maxHp;
handler.onPeerActivated(twine, trigger, ctx);
assert.equal(player.maxHp, beforeMaxHp + 2, 'Twine uses source p1 integer health, not a named fallback');
assert.equal(player.hp, player.maxHp, 'Twine fills the temporary max-health gain');
assert.equal(events.at(-1)?.type, 'activate', 'Twine activates after granting max health');
assert.equal(events.at(-1)?.meta?.handler, 'twine');

const beforeIgnored = player.maxHp;
handler.onPeerActivated(twine, secondary, ctx);
assert.equal(player.maxHp, beforeIgnored, 'secondary activation does not trigger Twine');

const zeroCatalog = { ...twineCatalog, chance: 0, chance2: 0 };
const zero = makePiece(zeroCatalog, 'zero-twine', { params: { p1: 2 } });
const zeroCtx = {
  ...ctx,
  player: createActor('player'),
  events: [],
  pieces: [zero, trigger, secondary],
  itemsById: new Map([
    ['twine', zeroCatalog],
    ['wooden_sword', { ...weapon, cooldown: 9 }],
    ['shield_of_valor', neutral],
  ]),
};
handler.onPrepare(zero, zeroCtx);
handler.onPeerActivated(zero, trigger, zeroCtx);
assert.equal(zeroCtx.player.maxHp, 200, 'zero base chances remain inert');
assert.equal(zeroCtx.events.length, 0, 'zero base chances do not activate');

console.log('OK Twine source can-affect rules, primary activation listener, neutral secondary chance, p1 health, ordering, and zero-safe regression');

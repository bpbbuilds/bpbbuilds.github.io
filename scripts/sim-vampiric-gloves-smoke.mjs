import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/VampiricGloves.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-outliers.js', 'utf8');
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const rawRules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = { ...rawRules, rulesById: rawRules.byId };

assert.equal(inventory.byId.vampiric_gloves?.file, 'VampiricGloves.gd');
assert.deepEqual(inventory.byId.vampiric_gloves?.overrides, ['doCooldownEffect', 'onPrepare']);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasCooldown\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*setState\(false\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*setState\(true\)[\s\S]*giveVampirism\(getP1\(\)[\s\S]*getP2\(\) \/ 100[\s\S]*onAfterEffectFinished\(\)/);
assert.match(portSource, /handlerId: 'vampiric_gloves'/);
assert.match(portSource, /onPrepare\(piece\)[\s\S]*_vampiricGlovesActive = false/);
assert.match(portSource, /afterEffectFinished\(piece, ctx, 'vampiric_gloves'\);/);

const handler = getScriptHandler('vampiric_gloves');
assert.equal(handler?.handlerId, 'vampiric_gloves');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCooldownEffect, 'function');

const gloveCatalog = byId.get('vampiric_gloves');
const swordCatalog = byId.get('wooden_sword');
const passiveCatalog = byId.get('lucky_clover');
assert.ok(gloveCatalog && swordCatalog && passiveCatalog);

const gloves = {
  ...gloveCatalog,
  itemId: 'vampiric_gloves', placementKey: 'gloves', name: 'Vampiric Gloves',
  kind: 'passive', side: 'you', alive: true, cooldown: 4,
  params: { p1: 6, p2: 35 },
};
const sword = {
  ...swordCatalog,
  itemId: 'wooden_sword', placementKey: 'sword', name: 'Wooden Sword',
  kind: 'weapon', side: 'you', alive: true, speedScale: 1,
};
const passive = {
  ...passiveCatalog,
  itemId: 'lucky_clover', placementKey: 'passive', name: 'Lucky Clover',
  kind: 'passive', side: 'you', alive: true, speedScale: 1,
};
const graph = {
  pieces: new Map([
    ['gloves', { key: 'gloves', id: 'vampiric_gloves', affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'primary' },
    ] }],
    ['sword', { key: 'sword', id: 'wooden_sword', affectCells: [] }],
    ['passive', { key: 'passive', id: 'lucky_clover', affectCells: [] }],
  ]),
  filled: new Map([
    ['1,0', 'sword'],
    ['2,0', 'passive'],
  ]),
};
const player = createActor('player', { maxHp: 100 });
const dummy = createActor('dummy', { maxHp: 100 });
const events = [];
const ctx = {
  player,
  dummy,
  events,
  t: 4,
  graph,
  pieces: [gloves, sword, passive],
  itemsById: new Map([
    ['vampiric_gloves', gloveCatalog],
    ['wooden_sword', swordCatalog],
    ['lucky_clover', passiveCatalog],
  ]),
  canAffect,
};

gloves._vampiricGlovesActive = true;
handler.onPrepare(gloves, ctx);
assert.equal(gloves._vampiricGlovesActive, false, 'prepare resets the source active state');

assert.equal(handler.onCooldownEffect(gloves, ctx), true);
assert.equal(gloves._vampiricGlovesActive, true, 'cooldown sets the active visual state');
assert.equal(player.stacks.vampirism, 6, 'cooldown grants exact p1 Vampirism');
assert.equal(sword.speedScale, 1.35, 'p2 speed applies to linked cooldown items');
assert.equal(passive.speedScale, 1, 'non-cooldown links are excluded by source canAffect');
assert.equal(events.at(-1)?.type, 'activate', 'consume activation follows all source effects');
assert.equal(events.at(-1)?.meta?.consume, true, 'onAfterEffectFinished consumes after the effect');
assert.equal(gloves.alive, false, 'source onAfterEffectFinished consumes the item');

const zeroPlayer = createActor('player', { maxHp: 100 });
const zeroEvents = [];
const zero = {
  ...gloves,
  itemId: 'vampiric_gloves', placementKey: 'zero-gloves', alive: true,
  params: { p1: 0, p2: 0 },
};
handler.onPrepare(zero, { ...ctx, player: zeroPlayer, events: zeroEvents });
handler.onCooldownEffect(zero, { ...ctx, player: zeroPlayer, events: zeroEvents });
assert.equal(zeroPlayer.stacks.vampirism, 0, 'zero p1 grants no Vampirism');

console.log('OK Vampiric Gloves source prepare reset, cooldown-only links, exact p1/p2 effects, ordering, consume, and zero-safe regression');

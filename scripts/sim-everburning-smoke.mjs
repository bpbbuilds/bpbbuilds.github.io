import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/Everburning.gd',
  'utf8',
);
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /numFlames = countAllInInventoryOfType\(ItemBook\.flameDescriptor\)/);
assert.match(source, /item\.changeStaminaFactor\(staminaReduction\)/);
assert.match(source, /giveHeat\(getP\("heat"\) \* numFlames\)/);
assert.match(source, /onAfterEffectFinished\(\)/);
assert.equal(byId.get('everburning')?.params?.heat, 1, 'source-shaped catalog Heat parameter');
assert.equal(getScriptHandler('everburning')?.handlerId, 'everburning');

function piece(id, key, overrides = {}) {
  const item = byId.get(id) || { id, name: id, type: 'Accessory', params: {} };
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item.name || id,
    params: { ...(item.params || {}) },
    side: 'you',
    alive: true,
    cooldown: item.cooldown ?? 4,
    baseCooldown: item.cooldown ?? 4,
    triggerTime: item.cooldown ?? 4,
    damageMin: item.damageMin || 0,
    damageMax: item.damageMax || 0,
    accuracy: item.accuracy ?? 100,
    staminaCost: item.staminaCost || 0,
    kind: /weapon/i.test(item.type || '') ? 'weapon' : 'passive',
    ...overrides,
  };
}

function runCase({ flameCount, heat, stamina = 60 }) {
  const ever = piece('everburning', 'ever', { params: { ...byId.get('everburning').params, heat, stamina } });
  const flames = Array.from({ length: flameCount }, (_, i) => piece('flame', `flame-${i}`));
  const sword = piece('burning_sword', 'sword', { kind: 'weapon', staminaCost: 2 });
  const blade = piece('burning_blade', 'blade', { kind: 'weapon', staminaCost: 2 });
  const unrelated = piece('wooden_sword', 'unrelated', { kind: 'weapon', staminaCost: 2 });
  const foeFlame = piece('flame', 'foe-flame', { side: 'them' });
  const foeBlade = piece('burning_blade', 'foe-blade', {
    side: 'them',
    kind: 'weapon',
    staminaCost: 2,
  });
  const pieces = [ever, ...flames, sword, blade, unrelated, foeFlame, foeBlade];
  const placements = pieces.map((p, i) => ({ id: p.itemId, key: p.placementKey, x: i, y: 0, r: 0 }));
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const ctx = {
    t: 5,
    player,
    dummy,
    events: [],
    bus: createCombatBus(),
    rng: () => 0,
    graph: buildBoardGraph(placements, byId),
    pieces,
    itemsById: byId,
    canAffect: null,
  };
  const handler = getScriptHandler('everburning');
  handler.onPrepare(ever, ctx);
  handler.onCooldownEffect(ever, ctx);
  return {
    ever,
    sword,
    blade,
    unrelated,
    foeBlade,
    player,
    events: ctx.events,
    flames: ever._everFlames,
  };
}

{
  const result = runCase({ flameCount: 2, heat: 1.5, stamina: 25 });
  assert.equal(result.flames, 2, 'counts every Flame in inventory');
  assert.equal(result.sword.staminaCost, 1.5, 'Burning Sword stamina factor follows source');
  assert.equal(result.blade.staminaCost, 1.5, 'Burning Blade stamina factor follows source');
  assert.equal(result.unrelated.staminaCost, 2, 'unrelated weapons are not modified');
  assert.equal(result.foeBlade.staminaCost, 2, 'opponent inventory is not modified');
  assert.equal(result.player.stacks.heat, 3, 'Heat is exact heat-per-flame multiplication');
  assert.equal(result.ever.alive, false, 'Everburning consumes after its effect');
  assert.equal(result.events.at(-1)?.meta?.consume, true, 'consume activation follows Heat grant');
}

{
  const result = runCase({ flameCount: 1, heat: 0 });
  assert.equal(result.player.stacks.heat, 0, 'typed zero Heat remains zero');
  assert.equal(result.ever.alive, false, 'zero-Heat Everburning still completes and consumes');
}

{
  const result = runCase({ flameCount: 0, heat: 9 });
  assert.equal(result.flames, 0, 'no Flame count is zero');
  assert.equal(result.player.stacks.heat, 0, 'no Flame produces no Heat');
  assert.equal(result.ever.alive, false, 'no-Flame Everburning still consumes after effect');
}

console.log('OK Everburning source and regression smoke');

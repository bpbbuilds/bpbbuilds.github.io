import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const sourceItem = catalog.find((entry) => entry.id === 'ruby_chonk');
assert.ok(sourceItem, 'Ruby Chonk catalog fixture');

const source = fs.readFileSync('tools/game-extract-full/Items/RubyChonk.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-basic.js', 'utf8');
assert.match(source, /onready var heatThreshold: = int\(getP1\(\)\)/);
assert.match(source, /func onPrepare\(\):\s*\n\s*setState\(false\)[\s\S]*?connectForCombat\(character\(\), "character_heat_changed", "onHeatChanged"\)/);
assert.match(source, /func onDealtDamage\(damageRes: DamageResult\):[\s\S]*?giveHeat\(1, damageRes\.event\)[\s\S]*?if heatThresholdReached:[\s\S]*?rollChance\(\)[\s\S]*?stun\(getP_m\("dur_stun"\), damageRes\.event\)/);
assert.match(port, /rubyChonkPort[\s\S]*?onPrepare\(piece, ctx\)[\s\S]*?onDealtDamage\(piece, ctx, hit\)/);
assert.doesNotMatch(port, /rubyChonkHeatReady = Math\.max\(1/);

assert.equal(sourceItem.chance, 30);
assert.equal(sourceItem.params.heatt, 12);
assert.equal(sourceItem.params.dur_stun, 0.4);

const handler = getScriptHandler('ruby_chonk');
assert.equal(handler?.handlerId, 'ruby_chonk');

{
  const player = createActor('player');
  const dummy = createActor('dummy');
  player.stacks.heat = 1;
  const piece = {
    itemId: 'ruby_chonk',
    placementKey: 'ruby-cross',
    name: 'Ruby Chonk',
    params: { p1: 2.9, p2: 0.4, dur_stun: 0.4 },
    chance: 30,
    paramMult: { dur_stun: 2 },
    side: 'you',
  };
  const ctx = { player, dummy, events: [], rng: () => 0, t: 5 };
  handler.onPrepare(piece, ctx);
  assert.equal(piece._rubyChonkHeatReady, false, 'source starts below-threshold state even at preloaded heat');
  handler.onDealtDamage(piece, ctx, { hit: true, damage: 10 });
  assert.equal(player.stacks.heat, 2, 'hit grants one source Heat');
  assert.equal(piece._rubyChonkHeatReady, true, 'int-truncated source threshold is reached');
  assert.equal(dummy.stunnedUntil, 5.8, 'stun uses modified source duration');
}

{
  const player = createActor('player');
  const dummy = createActor('dummy');
  const piece = {
    itemId: 'ruby_chonk',
    placementKey: 'ruby-zero',
    name: 'Ruby Chonk',
    params: { p1: 0, p2: 0, dur_stun: 0 },
    chance: 30,
    side: 'you',
  };
  const ctx = { player, dummy, events: [], rng: () => 0, t: 1 };
  handler.onPrepare(piece, ctx);
  assert.equal(piece._rubyChonkHeatReady, false, 'zero threshold begins in source inactive state');
  handler.onDealtDamage(piece, ctx, { hit: true, damage: 10 });
  assert.equal(player.stacks.heat, 1, 'zero threshold still grants source Heat');
  assert.equal(piece._rubyChonkHeatReady, true, 'zero threshold becomes active through the heat-change event');
  assert.equal(dummy.stunnedUntil, 0, 'zero stun duration is safe and has no duration');
}

{
  const player = createActor('player');
  const dummy = createActor('dummy');
  const piece = {
    itemId: 'ruby_chonk',
    placementKey: 'ruby-miss',
    name: 'Ruby Chonk',
    params: sourceItem.params,
    chance: sourceItem.chance,
    side: 'you',
  };
  const ctx = { player, dummy, events: [], rng: () => 0, t: 1 };
  handler.onPrepare(piece, ctx);
  handler.onDealtDamage(piece, ctx, { hit: false, damage: 0 });
  assert.equal(player.stacks.heat, 0, 'miss does not grant Heat or evaluate the stun branch');
}

console.log('Ruby Chonk source/parity smoke passed.');

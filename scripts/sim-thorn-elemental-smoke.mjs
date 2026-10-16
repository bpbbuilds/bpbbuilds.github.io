import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { takeDamage } from '../js/pages/sim/engine/damage.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/ThornElemental.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ai-c2.js', 'utf8');
const port = handlerSource.slice(
  handlerSource.indexOf('export const thornElementalPort'),
  handlerSource.indexOf('export const turtlePort'),
);

assert.equal(inventory.byId.thorn_elemental?.file, 'Exclusive/ThornElemental.gd');
assert.deepEqual(inventory.byId.thorn_elemental?.overrides, ['doCooldownEffect', 'onPrepare']);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Nature\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*changeEffectSpikesLimit\(spikesLimit\)[\s\S]*changeRangedSpikesLimit\(spikesLimit\)[\s\S]*changeSpikesCritChancePercent\(getChance\(\) \* getNumAffectedItems\(\)\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveSpikes\(spikes\)[\s\S]*activate\(\)/);
assert.match(port, /onPrepare\(piece, ctx\)/);
assert.match(port, /effectSpikesLimit/);
assert.match(port, /rangedSpikesLimit/);
assert.match(port, /_spikesCritChance/);
assert.match(port, /grantStacks\(ctx\.player, 'spikes', spikes/);
assert.match(port, /pushActivate\(piece, ctx, 'thorn_elemental'/);

function makeContext(params = { spikedam: 50, p1: 50, spikes: 3, p2: 3 }) {
  const piece = {
    itemId: 'thorn_elemental',
    name: 'Thorn Elemental',
    placementKey: 'thorn-elemental',
    params,
    chance: 10,
  };
  const nature = { itemId: 'nature_weapon', placementKey: 'nature', kind: 'weapon' };
  const neutral = { itemId: 'neutral_weapon', placementKey: 'neutral', kind: 'weapon' };
  const graph = {
    pieces: new Map([
      [piece.placementKey, { id: piece.itemId, cells: ['0,0'], affectCells: [{ cell: '1,0' }, { cell: '2,0' }] }],
      ['nature', { id: nature.itemId, cells: ['1,0'], affectCells: [] }],
      ['neutral', { id: neutral.itemId, cells: ['2,0'], affectCells: [] }],
    ]),
    filled: new Map([['0,0', piece.placementKey], ['1,0', 'nature'], ['2,0', 'neutral']]),
  };
  return {
    piece,
    ctx: {
      t: 1,
      player: createActor('player'),
      dummy: createActor('dummy'),
      bus: createCombatBus(),
      events: [],
      rng: () => 0,
      graph,
      itemsById: new Map([
        [piece.itemId, { id: piece.itemId, type: 'Pet', extraTypes: ['Nature'] }],
        [nature.itemId, { id: nature.itemId, type: 'Weapon', extraTypes: ['Nature'] }],
        [neutral.itemId, { id: neutral.itemId, type: 'Weapon', extraTypes: [] }],
      ]),
      pieces: [piece, nature, neutral],
    },
  };
}

const runtime = getScriptHandler('thorn_elemental');
assert.equal(runtime?.handlerId, 'thorn_elemental');

{
  const { piece, ctx } = makeContext();
  runtime.onPrepare(piece, ctx);
  assert.equal(ctx.player.effectSpikesLimit, 0.5, 'source P1 raises effect spike limit');
  assert.equal(ctx.player.rangedSpikesLimit, 0.5, 'source P1 raises ranged spike limit');
  assert.equal(ctx.player.meleeSpikesLimit, 1, 'Thorn Elemental does not raise melee spike limit');
  assert.equal(ctx.player._spikesCritChance, 10, 'spike crit chance uses affected Nature count');
  runtime.onCooldownEffect(piece, ctx);
  assert.equal(ctx.player.stacks.spikes, 3, 'cooldown grants source P2 Spikes');
  assert.equal(ctx.events.at(-1)?.type, 'activate', 'cooldown activation follows the Spike grant');
}

{
  const defender = createActor('player', { maxHp: 100 });
  const attacker = createActor('dummy', { maxHp: 100 });
  defender.rangedSpikesLimit = 0.5;
  defender._spikesCritChance = 10;
  grantStacks(defender, 'spikes', 3);
  const result = takeDamage(defender, attacker, {
    amount: 10,
    accuracy: 100,
    canMiss: false,
    canCrit: false,
    isAttack: true,
    isMelee: false,
    rng: () => 0,
  });
  assert.equal(result.spikeDamage, 6, 'ranged spikes use the limit and spike crit chance');
  assert.equal(attacker.hp, 94, 'critical reflected ranged spikes damage the attacker');
}

{
  const defender = createActor('player', { maxHp: 100 });
  const attacker = createActor('dummy', { maxHp: 100 });
  defender.effectSpikesLimit = 0.5;
  defender._spikesCritChance = 10;
  grantStacks(defender, 'spikes', 3);
  const result = takeDamage(defender, attacker, {
    amount: 10,
    canMiss: false,
    canCrit: false,
    isAttack: false,
    isEffectDamage: true,
    rng: () => 0,
  });
  assert.equal(result.spikeDamage, 6, 'effect spikes use the effect limit and spike crit chance');
  assert.equal(attacker.hp, 94, 'critical reflected effect spikes damage the attacker');
}

{
  const { piece, ctx } = makeContext({ spikedam: 0, p1: 0, spikes: 0, p2: 0 });
  runtime.onPrepare(piece, ctx);
  runtime.onCooldownEffect(piece, ctx);
  assert.equal(ctx.player.effectSpikesLimit, 0, 'zero source limit remains zero');
  assert.equal(ctx.player.stacks.spikes, 0, 'zero source Spikes remain zero');
  assert.equal(ctx.events.at(-1)?.type, 'activate', 'zero-valued cooldown still activates');
}

console.log('OK Thorn Elemental source, Nature filtering, ranged/effect spike limits, spike crits, cooldown ordering, and zero-safe values regression');

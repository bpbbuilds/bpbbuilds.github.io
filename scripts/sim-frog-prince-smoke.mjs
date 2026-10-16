import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/FrogPrince.gd', 'utf8');
const toadSource = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Toad.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /extends "res:\/\/Items\/Exclusive\/Toad\.gd"/);
assert.match(toadSource, /func onPrepare\(\):[\s\S]*affectedItemsDict = Util\.arrayAsIndexDict\(getAffectedItems\(\)\)[\s\S]*connectToCharacterBuffs\("onBuffsChanged"\)/);
assert.match(source, /func onGainThresholdReached\(ticks, event\):[\s\S]*cleanseBlind\(blind, event\)[\s\S]*heal\(ticks \* getP_m\("heal"\), event\)[\s\S]*miniActivate\(\)/);
assert.match(source, /func onUseThresholdReached\(ticks, event\):[\s\S]*frogState == FrogState\.Inactive[\s\S]*giveLucky\(luck, event\)[\s\S]*giveMana\(mana, event\)[\s\S]*makeInvulnerable\(invuDur, self, event\)[\s\S]*miniActivate\(\)/);
assert.equal(inventory.byId.frog_prince?.file, 'Exclusive/FrogPrince.gd');
assert.equal(getScriptHandler('frog_prince')?.handlerId, 'frog_prince');

function piece(id, key, side, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item?.name || id,
    params: item?.params || {},
    side,
    alive: true,
    cooldown: item?.cooldown ?? 4,
    baseCooldown: item?.cooldown ?? 4,
    triggerTime: item?.cooldown ?? 4,
    kind: 'pet',
    ...overrides,
  };
}

function graph(sourcePiece, targets) {
  const pieces = new Map([[sourcePiece.placementKey, {
    key: sourcePiece.placementKey,
    id: sourcePiece.itemId,
    cells: [],
    affectCells: targets.map((_, index) => ({ cell: `link-${index}`, color: 'primary' })),
  }]]);
  const filled = new Map();
  for (const [index, target] of targets.entries()) {
    pieces.set(target.placementKey, {
      key: target.placementKey,
      id: target.itemId,
      cells: [],
      affectCells: [],
    });
    filled.set(`link-${index}`, target.placementKey);
  }
  return { pieces, filled };
}

function context(owner, foe, pieces, board) {
  const bus = createCombatBus();
  owner._combatBus = bus;
  foe._combatBus = bus;
  return {
    player: owner,
    dummy: foe,
    pieces,
    graph: board,
    itemsById: byId,
    canAffect: { rulesById: null },
    events: [],
    bus,
    rng: () => 0,
    t: 5,
    activatePiece: () => true,
  };
}

for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy', { maxHp: 100 });
  const foe = createActor(side === 'you' ? 'dummy' : 'player', { maxHp: 100 });
  const frog = piece('frog_prince', `${side}:frog`, side);
  const affected = piece('broom', `${side}:affected`, side, { kind: 'weapon' });
  const ctx = context(owner, foe, [frog, affected], graph(frog, [affected]));
  const handler = getScriptHandler('frog_prince');

  owner.hp = 50;
  owner.stacks.blind = 3;
  handler.onPrepare(frog, ctx);
  assert.equal(frog._frogState, 'Inactive', `Frog Prince starts inactive during preparation on ${side}`);
  assert.deepEqual(frog._toadState?.affected, new Set([affected.placementKey]), `Frog Prince tracks affected buff origins on ${side}`);

  grantStacks(owner, 'lucky', 20, { originKey: affected.placementKey, originId: affected.itemId });
  assert.equal(owner.hp, 90, `Frog Prince heals ticks times source heal on ${side}`);
  assert.equal(owner.stacks.blind, 2, `Frog Prince cleanses one source Blind amount per threshold callback on ${side}`);
  assert.equal(ctx.events.filter((event) => event.meta?.miniActivate).length, 1, `Frog Prince emits one gain mini activation for multiple ticks on ${side}`);

  owner.stacks.lucky = 30;
  spendStacks(owner, 'lucky', 30, { originKey: affected.placementKey, originId: affected.itemId });
  assert.equal(frog._frogState, 'Active', `Frog Prince activates on first used threshold on ${side}`);
  assert.equal(owner.stacks.lucky, 5, `Frog Prince grants source Lucky on use threshold on ${side}`);
  assert.equal(owner.stacks.mana, 5, `Frog Prince grants source Mana on use threshold on ${side}`);
  assert.equal(owner.invulnUntil, 7.5, `Frog Prince uses source invulnerability duration on ${side}`);

  owner.stacks.lucky = 30;
  spendStacks(owner, 'lucky', 30, { originKey: affected.placementKey, originId: affected.itemId });
  assert.equal(owner.stacks.lucky, 0, `Frog Prince does not reactivate after first use on ${side}`);
  assert.equal(owner.stacks.mana, 5, `Frog Prince does not duplicate Mana after first use on ${side}`);

  const zero = piece('frog_prince', `${side}:frog-zero`, side, {
    params: {
      gained: 0, p1: 0, blind: 0, p2: 0, heal: 0, p3: 0, used: 0, p4: 0,
      luck: 0, p5: 0, mana: 0, p6: 0, dur_1: 0, p7: 0, luck2: 0, p8: 0, mana2: 0, p9: 0,
    },
  });
  const zeroCtx = context(owner, foe, [zero, affected], graph(zero, [affected]));
  handler.onPrepare(zero, zeroCtx);
  const zeroHp = owner.hp;
  const zeroMana = owner.stacks.mana;
  handler.onCooldownEffect(zero, zeroCtx);
  assert.equal(owner.hp, zeroHp, `Frog Prince zero parameters do not invent healing on ${side}`);
  assert.equal(owner.stacks.mana, zeroMana, `Frog Prince zero parameters do not invent Mana on ${side}`);
  assert.equal(zeroCtx.events.at(-1)?.type, 'activate', `Frog Prince still activates its cooldown with zero effects on ${side}`);
}

console.log('OK Frog Prince source-backed Toad thresholds, multi-tick cleanse/heal, first-use invulnerability, both sides, and zero parameters');

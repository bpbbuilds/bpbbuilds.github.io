import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/FortunasKiss.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func canAffect\(item\):[\s\S]*return item\.canModifyChance\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*item\.addBonusChance\(bonusChance\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*getLucky\(\) >= luckNeeded[\s\S]*giveRandomBuffs\(1, null, stackTypes\)[\s\S]*giveLucky\(1\)[\s\S]*activate\(\)/);
assert.equal(inventory.byId.fortunas_kiss?.file, 'Exclusive/FortunasKiss.gd');
assert.equal(getScriptHandler('fortunas_kiss')?.handlerId, 'fortunas_kiss');

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
    kind: 'passive',
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
  const fortune = piece('fortunas_kiss', `${side}:fortune`, side);
  const chanceItem = piece('broom', `${side}:chance`, side, { kind: 'weapon' });
  const noChanceItem = piece('wooden_sword', `${side}:plain`, side, { kind: 'weapon' });
  const ctx = context(owner, foe, [fortune, chanceItem, noChanceItem], graph(fortune, [chanceItem, noChanceItem]));
  const handler = getScriptHandler('fortunas_kiss');

  handler.onPrepare(fortune, ctx);
  assert.equal(chanceItem.bonusChanceMult, 35, `Fortuna's Kiss modifies chance-bearing linked items on ${side}`);
  assert.equal(noChanceItem.bonusChanceMult || 0, 0, `Fortuna's Kiss ignores non-chance linked items on ${side}`);

  handler.onCooldownEffect(fortune, ctx);
  assert.equal(owner.stacks.lucky, 1, `Fortuna's Kiss grants Lucky below threshold on ${side}`);
  assert.equal(ctx.events.at(-1)?.type, 'activate', `Fortuna's Kiss activates after Lucky on ${side}`);

  owner.stacks.lucky = 5;
  ctx.events.length = 0;
  handler.onCooldownEffect(fortune, ctx);
  assert.equal(owner.stacks.lucky, 5, `Fortuna's Kiss does not spend Lucky on random-buff branch on ${side}`);
  assert.equal(owner.stacks.regeneration, 1, `Fortuna's Kiss excludes Lucky and selects the first buff at rng 0 on ${side}`);
  assert.equal(ctx.events.at(-1)?.type, 'activate', `Fortuna's Kiss activates after random buff on ${side}`);

  const zero = piece('fortunas_kiss', `${side}:fortune-zero`, side, {
    params: { chance: 0, p1: 0, luckt: 0, p2: 0 },
  });
  const zeroCtx = context(owner, foe, [zero], graph(zero, []));
  owner.stacks.lucky = 0;
  owner.stacks.regeneration = 0;
  handler.onPrepare(zero, zeroCtx);
  zeroCtx.events.length = 0;
  handler.onCooldownEffect(zero, zeroCtx);
  assert.equal(owner.stacks.lucky, 0, `Fortuna's Kiss zero threshold does not invent Lucky on ${side}`);
  assert.equal(owner.stacks.regeneration, 1, `Fortuna's Kiss zero threshold still follows the random-buff branch on ${side}`);
  assert.equal(zeroCtx.events.at(-1)?.type, 'activate', `Fortuna's Kiss zero threshold still activates on ${side}`);
}

console.log('OK Fortuna\'s Kiss source-backed chance targeting, Lucky/random-buff branches, activation order, both sides, and zero parameters');

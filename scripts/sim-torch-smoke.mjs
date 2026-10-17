import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Torch.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-perm.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'torch');

assert.ok(sourceItem, 'Torch: extracted catalog row');
assert.match(source, /onready var permDamBonus = getP1\(\)/);
assert.match(source, /func onPreDealDamage_early\(damageRes[^)]*\):[\s\S]*damageRes\.hasHit\(\)[\s\S]*rollChance\(\)[\s\S]*addBonusDamage\(permDamBonus\)/);

const port = portSource.match(/const torchPort = \{[\s\S]*?\n\};/u)?.[0] || '';
assert.match(port, /onPreDealDamageEarly\(piece, ctx, res\)/);
assert.match(port, /getPName\(piece\.params, 'p1'/);
assert.doesNotMatch(port, /Math\.max\(1, Math\.round\(getP1/);
assert.ok(getScriptHandler('torch'), 'Torch handler is registered');

function makeContext(params = sourceItem.params) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  const events = [];
  const piece = {
    itemId: 'torch',
    placementKey: 'torch',
    name: 'Torch',
    kind: 'weapon',
    side: 'you',
    alive: true,
    params: { ...params },
    damageMin: sourceItem.damageMin,
    damageMax: sourceItem.damageMax,
    damageKind: 'melee',
    accuracy: 100,
    staminaCost: 0,
    chance: sourceItem.chance,
    chanceTag: sourceItem.chanceTag,
    bonusDamage: 0,
    damageBonus: 0,
    bonusDamageFactor: 1,
    vampiric: false,
    _eventLog: events,
    _owner: player,
  };
  player._simT = 2;
  return {
    t: 2,
    player,
    dummy,
    events,
    piece,
    rng: () => 0,
    bus: { emit() {} },
    notifyPreDealDamageEarly(hookPiece, hookCtx, res) {
      getScriptHandler('torch')?.onPreDealDamageEarly?.(hookPiece, hookCtx, res);
    },
  };
}

const ctx = makeContext();
const handler = getScriptHandler('torch');
handler.onCooldownEffect(ctx.piece, ctx);
assert.equal(ctx.piece.bonusDamage, 1, 'successful Torch chance adds the exact source P1 damage');
assert.equal(ctx.events.at(-1)?.type, 'activate', 'Torch activates after its weapon strike');

const zero = makeContext({ p1: 0 });
handler.onCooldownEffect(zero.piece, zero);
assert.equal(zero.piece.bonusDamage, 0, 'explicit zero Torch damage bonus remains zero');

console.log('OK Torch source/parity smoke');

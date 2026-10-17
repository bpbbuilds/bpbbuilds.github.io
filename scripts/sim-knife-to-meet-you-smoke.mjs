import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/KnifetoMeetYou.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const knifeData = byId.get('knife_to_meet_you');

assert.match(source, /func canAffect\(item\):[\s\S]*item is Dagger/);
assert.match(source, /func onPrepare\(\):[\s\S]*item is Dagger[\s\S]*item\.addSpeed\(daggerSpeed\)[\s\S]*addSpeed\(speedPerDagger \* getNumAffectedItems\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*item\.canBeEmpowered\(\)[\s\S]*item\.addBonusDamageFactor\(damFactor\)[\s\S]*onAfterEffectFinished\(\)/);
assert.equal(inventory.byId.knife_to_meet_you?.file, 'Exclusive/KnifetoMeetYou.gd');
assert.equal(getScriptHandler('knife_to_meet_you')?.handlerId, 'knife_to_meet_you');

function piece(itemId, placementKey, side, overrides = {}) {
  const item = byId.get(itemId);
  return {
    ...item,
    itemId,
    placementKey,
    name: item?.name || itemId,
    side,
    alive: true,
    params: { ...(item?.params || {}) },
    ...overrides,
  };
}

const knife = piece('knife_to_meet_you', 'knife', 'you', { kind: 'skill' });
const dagger = piece('dagger', 'dagger', 'you', { kind: 'weapon', damageMin: 8, damageMax: 10, cooldown: 2 });
const daggerang = piece('daggerang', 'daggerang', 'you', { kind: 'weapon', damageMin: 6, damageMax: 9, cooldown: 2 });
const opponentDagger = piece('dagger', 'opponent-dagger', 'them', { kind: 'weapon', damageMin: 8, damageMax: 10, cooldown: 2 });
const sword = piece('wooden_sword', 'sword', 'you', { kind: 'weapon', damageMin: 10, damageMax: 12, cooldown: 2 });
const opponentSword = piece('wooden_sword', 'opponent-sword', 'them', { kind: 'weapon', damageMin: 10, damageMax: 12, cooldown: 2 });
const graph = {
  pieces: new Map([
    ['knife', { key: 'knife', id: 'knife_to_meet_you', cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }] }],
    ['dagger', { key: 'dagger', id: 'dagger', cells: ['1,0'], affectCells: [] }],
    ['daggerang', { key: 'daggerang', id: 'daggerang', cells: ['2,0'], affectCells: [] }],
    ['opponent-dagger', { key: 'opponent-dagger', id: 'dagger', cells: ['3,0'], affectCells: [] }],
    ['sword', { key: 'sword', id: 'wooden_sword', cells: ['4,0'], affectCells: [] }],
    ['opponent-sword', { key: 'opponent-sword', id: 'wooden_sword', cells: ['5,0'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', 'knife'],
    ['1,0', 'dagger'],
    ['2,0', 'daggerang'],
    ['3,0', 'opponent-dagger'],
    ['4,0', 'sword'],
    ['5,0', 'opponent-sword'],
  ]),
};
const ctx = { pieces: [knife, dagger, daggerang, opponentDagger, sword, opponentSword], graph, itemsById: byId, canAffect: null, events: [], t: 4 };
const handler = getScriptHandler('knife_to_meet_you');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(handler?.onCombatStart, undefined, 'Knife to Meet You uses source prepare');
handler.onPrepare(knife, ctx);
assert.equal(dagger.speedScale, 0.4, 'Knife to Meet You gives every same-side Dagger p1 speed');
assert.equal(daggerang.speedScale, 0.4, 'Knife to Meet You includes Daggerang as a Dagger subclass');
assert.equal(opponentDagger.speedScale, undefined, 'Knife to Meet You excludes opponent daggers');
assert.equal(knife.speedScale, 0.75, 'Knife to Meet You adds p3 speed per linked Dagger');

const handled = handler.onCooldownEffect(knife, ctx);
assert.equal(handled, true);
assert.equal(sword.bonusDamageFactor, 1.5, 'Knife to Meet You applies p2 as a damage factor to same-side empowerable items');
assert.equal(opponentSword.bonusDamageFactor, undefined, 'Knife to Meet You does not empower the opponent inventory');
assert.equal(knife.alive, false, 'Knife to Meet You consumes after its one cooldown effect');
assert.equal(knife.cooldown, 999, 'Knife to Meet You deactivates its cooldown after the effect');

const zero = piece('knife_to_meet_you', 'zero-knife', 'you', {
  kind: 'skill',
  params: { speed: 0, p1: 0, dam: 0, p2: 0, speed2: 0, p3: 0 },
});
const zeroSword = piece('wooden_sword', 'zero-sword', 'you', { kind: 'weapon', damageMin: 10, damageMax: 12, cooldown: 2 });
const zeroCtx = {
  ...ctx,
  pieces: [zero, zeroSword],
  graph: {
    pieces: new Map([
      ['zero-knife', { key: 'zero-knife', id: 'knife_to_meet_you', cells: ['0,0'], affectCells: [] }],
      ['zero-sword', { key: 'zero-sword', id: 'wooden_sword', cells: ['1,0'], affectCells: [] }],
    ]),
    filled: new Map([['0,0', 'zero-knife'], ['1,0', 'zero-sword']]),
  },
};
handler.onPrepare(zero, zeroCtx);
assert.equal(zero.speedScale, undefined, 'Knife to Meet You honors explicit zero speed');
handler.onCooldownEffect(zero, zeroCtx);
assert.equal(zeroSword.bonusDamageFactor, undefined, 'Knife to Meet You honors explicit zero damage factor');

console.log('OK Knife to Meet You source-backed prepare dagger filter, same-side speed, linked dagger count, p2 damage factor, consume order, and zero parameters');

import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/TheLovers.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ao-cards.js', 'utf8');
const port = handlerSource.slice(
  handlerSource.indexOf('const theLoversPort'),
  handlerSource.indexOf('const whiteEyesPort'),
);

assert.equal(inventory.byId.the_lovers?.file, 'TheLovers.gd');
assert.deepEqual(inventory.byId.the_lovers?.overrides, ['doRevealEffect']);
assert.match(source, /func cardSecondaryEffectActive\(\):[\s\S]*return chainPosition % 2 == 0/);
assert.match(source, /func doRevealEffect\(\):[\s\S]*addHealingEfficiency\(healAmp\)[\s\S]*stealLife\(dam, getP_m\("lifesteal"\) \/ 100\.0\)[\s\S]*giveRegeneration\(regen\)[\s\S]*activate\(\)/);
assert.match(port, /applyHealEfficiency\(/);
assert.match(port, /modifiedParamValue\(/);
assert.match(port, /stealLife\(piece, ctx, dam, ls\)/);
assert.match(port, /Math\.trunc\(getPName\(piece\.params, 'regen'/);
assert.match(port, /pushActivate\(piece, ctx, 'the_lovers'/);

function makeLovers(overrides = {}) {
  return {
    itemId: 'the_lovers',
    placementKey: overrides.placementKey || 'lovers',
    name: 'The Lovers',
    params: { dam: 7, p1: 7, regen: 2, p2: 2, lifesteal: 100, p3: 100, healamp: 6, p4: 6 },
    paramMult: { lifesteal: 0.5 },
    _deckKey: overrides.deckKey || 'deck',
    _chainPos: overrides.chainPos ?? 0,
  };
}

function makeContext(piece, deckKey = piece._deckKey) {
  const deck = { itemId: 'deck_of_cards', placementKey: deckKey, _cards: [piece] };
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  player.hp = 50;
  const events = [];
  return {
    player,
    dummy,
    pieces: [deck, piece],
    events,
    t: 2,
    rng: () => 0,
  };
}

const runtime = getScriptHandler('the_lovers');
assert.equal(runtime?.handlerId, 'the_lovers');

const lovers = makeLovers();
const ctx = makeContext(lovers);
const dummyBefore = ctx.dummy.hp;
const playerBefore = ctx.player.hp;
runtime.onRevealEffect(lovers, ctx);
assert.equal(ctx.player._healAmp, 0.06, 'even-chain Lovers applies healing efficiency');
assert.equal(ctx.dummy.hp, dummyBefore - 7, 'Lovers deals exact effect damage');
assert.equal(ctx.player.stacks.regeneration, 2, 'even-chain Lovers grants regeneration');
assert.equal(ctx.player.hp, playerBefore + 4, 'placement-modified lifesteal is applied after damage');
assert.equal(ctx.events.at(-1)?.type, 'activate', 'Lovers activates after its reveal effect');
assert.ok(ctx.events.some((event) => event.type === 'heal' && event.amount === 4));

const odd = makeLovers({ placementKey: 'odd-lovers', deckKey: 'odd-deck', chainPos: 1 });
const oddCtx = makeContext(odd, 'odd-deck');
const oddDummyBefore = oddCtx.dummy.hp;
runtime.onRevealEffect(odd, oddCtx);
assert.equal(oddCtx.player._healAmp, 0, 'odd-chain Lovers skips healing efficiency');
assert.equal(oddCtx.player.stacks.regeneration, 0, 'odd-chain Lovers skips regeneration');
assert.equal(oddCtx.dummy.hp, oddDummyBefore - 7, 'odd-chain Lovers still steals life through damage');

const zero = makeLovers({ placementKey: 'zero-lovers', deckKey: 'zero-deck' });
zero.params = { dam: 0, p1: 0, regen: 0, p2: 0, lifesteal: 0, p3: 0, healamp: 0, p4: 0 };
const zeroCtx = makeContext(zero, 'zero-deck');
runtime.onRevealEffect(zero, zeroCtx);
assert.equal(zeroCtx.dummy.hp, 100, 'zero damage remains zero');
assert.equal(zeroCtx.player.stacks.regeneration, 0, 'zero regeneration remains zero');
assert.equal(zeroCtx.events.at(-1)?.type, 'activate', 'zero-valued Lovers still activates');

console.log('OK The Lovers source, even/odd chain effects, modified lifesteal, exact damage, zero-safe values, and activation regression');

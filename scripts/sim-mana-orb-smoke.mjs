import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/ManaOrb.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-an-accessories.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'mana_orb');

assert.ok(sourceItem, 'Mana Orb: extracted catalog row');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.canActivate\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(character\(\), "character_mana_changed", "onManaChanged"\)/);
assert.match(source, /func onManaChanged\(amount, triggerEvent\):[\s\S]*amount > 0[\s\S]*getMana\(\) >= manaNeeded[\s\S]*useMana\(manaNeeded, triggerEvent\)[\s\S]*giveRandomBuffs\(buffs \+ bonusBuffs/);
assert.match(port, /handlerId: 'mana_orb'/);
assert.match(port, /onPrepare\(piece, ctx\)/);
assert.match(port, /onPeerActivated\(listener, _a, ctx\)/);

function makeContext(id = 'player') {
  return {
    t: 0,
    player: createActor(id),
    dummy: createActor('dummy'),
    events: [],
    rng: () => 0,
    pieces: [],
    itemsById: new Map([['mana_orb', sourceItem]]),
  };
}

const handler = getScriptHandler('mana_orb');
assert.equal(handler?.handlerId, 'mana_orb');

const ctx = makeContext();
const orb = {
  itemId: 'mana_orb',
  placementKey: 'orb',
  name: 'Mana Orb',
  params: sourceItem.params,
  side: 'you',
  alive: true,
};
handler.onPrepare(orb, ctx);
grantStacks(ctx.player, 'mana', 35, { originKey: 'setup', originId: 'setup' });
assert.equal(ctx.player.stacks.mana, 0,
  'Mana Orb: source threshold spends the exact named Mana cost');
assert.equal(ctx.player.stacks.lucky, 20,
  'Mana Orb: source random-buff count is the exact catalog value');
assert.equal(ctx.events.at(-1)?.type, 'activate',
  'Mana Orb: threshold activation follows the random buff grant');

const peerCtx = makeContext('peer-player');
const peer = { ...orb, placementKey: 'peer-orb' };
handler.onPeerActivated(peer, { itemId: 'shortbow' }, peerCtx);
assert.equal(peerCtx.player.stacks.mana, 1,
  'Mana Orb: linked activation grants the exact p1 Mana amount');

const zeroCtx = makeContext('zero-player');
const zero = {
  ...orb,
  placementKey: 'zero-orb',
  params: { ...sourceItem.params, p1: 0, manat: 0, p2: 0, buffs: 0, p3: 0 },
};
handler.onPrepare(zero, zeroCtx);
grantStacks(zeroCtx.player, 'mana', 1, { originKey: 'setup', originId: 'setup' });
assert.equal(zeroCtx.player.stacks.mana, 1,
  'Mana Orb: explicit zero threshold/cost does not invent a Mana spend');
assert.equal(zeroCtx.player.stacks.lucky, 0,
  'Mana Orb: explicit zero buff count does not invent a buff');
assert.equal(zeroCtx.events.at(-1)?.type, 'activate',
  'Mana Orb: zero-cost threshold still activates once');

const zeroPeerCtx = makeContext('zero-peer-player');
handler.onPeerActivated({ ...zero }, { itemId: 'shortbow' }, zeroPeerCtx);
assert.equal(zeroPeerCtx.player.stacks.mana, 0,
  'Mana Orb: explicit zero p1 does not invent a linked Mana grant');

console.log('Mana Orb source/parity smoke passed.');

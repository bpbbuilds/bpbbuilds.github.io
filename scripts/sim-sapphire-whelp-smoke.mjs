import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SapphireWhelp.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-start.js', 'utf8');
const sapphirePort = port.slice(
  port.indexOf('const sapphireWhelpPort'),
  port.indexOf('/** WalrusTusk.gd'),
);

assert.match(source, /extends Weapon/);
assert.match(source, /func _ready\(\):[\s\S]*stackTypes = Game\.getBuffs\(\)[\s\S]*stackTypes\.erase\(Game\.EventType\.Mana\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveMana\(getP1\(\)\)[\s\S]*activate\(null, false\)/);
assert.match(
  source,
  /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*if damageRes\.hasHit\(\):[\s\S]*var event = tryUseMana\(getP2\(\)\)[\s\S]*if event:[\s\S]*giveBlock\(getBlock\(\), true, event\)[\s\S]*giveRandomBuffs\(1, event, stackTypes\)/,
);
assert.match(sapphirePort, /onCombatStart\(piece, ctx\)/);
assert.match(sapphirePort, /onPreDealDamageEarly\(piece, ctx, res\)/);
assert.match(sapphirePort, /getP1\(piece\.params, 0\)/);
assert.match(sapphirePort, /getP2\(piece\.params, 0\)/);
assert.match(sapphirePort, /useMana\(ctx\.player/);
assert.match(sapphirePort, /giveRandomBuffs\(ctx\.player, 1, ctx\.rng/);
assert.doesNotMatch(sapphirePort, /Math\.max\(1/);
assert.doesNotMatch(sapphirePort, /getPName\(piece\.params, 'mana'/);
assert.doesNotMatch(sapphirePort, /getPName\(piece\.params, 'manat'/);

function item(params, placementKey = 'sapphire-whelp') {
  const base = byId.get('sapphire_whelp');
  assert.ok(base, 'catalog item sapphire_whelp exists');
  return {
    ...base,
    itemId: 'sapphire_whelp',
    name: 'Sapphire Whelp',
    placementKey,
    params,
    alive: true,
  };
}

function context(piece) {
  return {
    player: createActor('player'),
    dummy: createActor('dummy'),
    events: [],
    itemsById: byId,
    pieces: [piece],
    t: 4,
    rng: () => 0,
  };
}

const handler = getScriptHandler('sapphire_whelp');
assert.equal(handler?.handlerId, 'sapphire_whelp');
assert.equal(typeof handler?.onCooldownEffect, 'function');

const indexed = item({ mana: 9, p1: 6, manat: 5, p2: 1 });
const indexedCtx = context(indexed);
handler.onCombatStart(indexed, indexedCtx);
assert.equal(indexedCtx.player.stacks.mana, 6, 'source getP1 uses the indexed Mana value');
assert.equal(indexedCtx.events.at(-1)?.type, 'activate', 'Mana is applied before start activation');
handler.onPreDealDamageEarly(indexed, indexedCtx, { hit: true });
assert.equal(indexedCtx.player.stacks.mana, 5, 'source getP2 spends one indexed Mana');
assert.equal(indexedCtx.player.block, 10, 'a successful Mana spend gives the catalog Block amount');
assert.equal(indexedCtx.player.stacks.lucky, 1, 'successful hit gives one random non-Mana buff');

const miss = item({ p1: 6, p2: 1 }, 'miss-sapphire-whelp');
const missCtx = context(miss);
missCtx.player.stacks.mana = 1;
handler.onPreDealDamageEarly(miss, missCtx, { hit: false });
assert.equal(missCtx.player.stacks.mana, 1, 'a miss does not spend Mana');
assert.equal(missCtx.player.block, 0, 'a miss does not give Block');
assert.equal(missCtx.player.stacks.lucky, 0, 'a miss does not give a random buff');

const insufficient = item({ p1: 6, p2: 2 }, 'insufficient-sapphire-whelp');
const insufficientCtx = context(insufficient);
insufficientCtx.player.stacks.mana = 1;
handler.onPreDealDamageEarly(insufficient, insufficientCtx, { hit: true });
assert.equal(insufficientCtx.player.stacks.mana, 1, 'insufficient Mana does not spend anything');
assert.equal(insufficientCtx.player.block, 0, 'insufficient Mana does not give Block');
assert.equal(insufficientCtx.player.stacks.lucky, 0, 'insufficient Mana does not give a random buff');

const sparse = item({}, 'sparse-sapphire-whelp');
const sparseCtx = context(sparse);
handler.onCombatStart(sparse, sparseCtx);
assert.equal(sparseCtx.player.stacks.mana || 0, 0, 'missing start Mana does not fabricate a stack');
assert.equal(sparseCtx.events.at(-1)?.type, 'activate', 'start activation still follows the source hook');

console.log('OK Sapphire Whelp source and handler regression');

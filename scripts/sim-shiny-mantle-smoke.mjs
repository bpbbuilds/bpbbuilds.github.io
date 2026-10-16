import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor, isInvulnerable } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/ShinyMantle.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ai-hard.js', 'utf8');
const mantlePort = port.slice(
  port.indexOf('function shinyMantleGemDurationFactor'),
  port.indexOf('/** WoodenBuckler.gd', port.indexOf('function shinyMantleGemDurationFactor')),
);

assert.match(source, /extends Item/);
assert.match(source, /func canAffect\(item\):[\s\S]*not item\.isBag\(\)/);
assert.ok(source.includes('func onPrepare():'));
assert.ok(
  source.includes('character_invulnerable_start') &&
    source.includes('manaNeeded = manaNeeded_base') &&
    source.includes('gemDurFactor = floor(getCounterValue() / getP("gold"))'),
);
assert.ok(
  source.includes('func doCooldownEffect():') &&
    source.includes('isVulnerable()') &&
    source.includes('getMana() >= manaNeeded') &&
    source.includes('makeInvulnerable') &&
    source.includes('useMana(manaNeeded,') &&
    source.includes('manaNeeded += manaCostIncrease'),
);
assert.match(source, /func onInvuStarted\(event\):[\s\S]*inflictBlind\(blind, event\)/);
assert.match(mantlePort, /onPrepare\(piece, ctx\)/);
assert.match(mantlePort, /isInvulnerable/);
assert.match(mantlePort, /gemIds/);
assert.match(mantlePort, /Math\.trunc/);
assert.match(mantlePort, /afterEffectFinished/);
assert.doesNotMatch(mantlePort, /onCombatStart\(piece, ctx\)/);
assert.ok(
  mantlePort.indexOf('useMana(') < mantlePort.indexOf('pushActivate('),
  'Shiny Mantle activates after its successful Mana/invulnerability effect',
);

function createBus() {
  const listeners = new Map();
  return {
    on(name, fn) {
      const list = listeners.get(name) || [];
      list.push(fn);
      listeners.set(name, list);
    },
    emit(name, payload) {
      for (const fn of listeners.get(name) || []) fn(payload);
    },
  };
}

const mantle = {
  ...byId.get('shiny_mantle'),
  itemId: 'shiny_mantle',
  placementKey: 'mantle',
  name: 'Shiny Mantle',
  kind: 'armor',
  params: {
    dur_base: 1,
    p1: 1,
    dur_bonus: 0.2,
    p2: 0.2,
    gold: 10,
    p3: 10,
    blind: 2,
    p4: 5,
    manat: 3,
    p5: 9,
    mana: 2,
    p6: 7,
    max: 2,
    p7: 0,
  },
  gemIds: ['regular_ruby'],
  alive: true,
};
const gemHost = {
  ...byId.get('holy_armor'),
  itemId: 'holy_armor',
  placementKey: 'gem-host',
  name: 'Holy Armor',
  kind: 'armor',
  gemIds: ['perfect_ruby'],
};
const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
const bus = createBus();
player._eventLog = events;
const ctx = {
  t: 5,
  player,
  dummy,
  events,
  bus,
  pieces: [mantle, gemHost],
  itemsById: byId,
  rng: () => 0,
};

const handler = getScriptHandler('shiny_mantle');
assert.equal(handler?.handlerId, 'shiny_mantle');
handler.onPrepare(mantle, ctx);
assert.equal(mantle._mantleMana, 3, 'named Mana threshold takes precedence over conflicting p5');
assert.equal(mantle._mantleGemDur, 2, 'gem value factor counts all socketed gem prices');
assert.equal(mantle._mantleUses, 0);

grantStacks(player, 'mana', 10, { originKey: mantle.placementKey, originId: mantle.itemId });
handler.onCooldownEffect(mantle, ctx);
assert.equal(player.stacks.mana, 7, 'first use spends the named Mana threshold');
assert.equal(isInvulnerable(player, 5), true);
assert.equal(player.invulnUntil, 6.4, 'gem value extends the base invulnerability duration');
assert.equal(dummy.stacks.blind, 2, 'invulnerability start inflicts the named Blind amount');
assert.equal(mantle._mantleMana, 5, 'the named Mana increase is applied after the first use');
assert.equal(mantle._mantleUses, 1);
assert.equal(events.at(-1)?.type, 'activate', 'successful first use activates after the effect');

const blockedEvents = events.length;
const blockedMana = player.stacks.mana;
handler.onCooldownEffect(mantle, { ...ctx, t: 5.5 });
assert.equal(player.stacks.mana, blockedMana, 'an invulnerable character cannot spend Mana again');
assert.equal(events.length, blockedEvents, 'an invulnerability-gated attempt does not activate');

handler.onCooldownEffect(mantle, { ...ctx, t: 7 });
assert.equal(player.stacks.mana, 2, 'second use spends the escalated Mana threshold');
assert.equal(dummy.stacks.blind, 4);
assert.equal(mantle._mantleUses, 2);
assert.equal(mantle.alive, false, 'max uses finalize the item through the after-effect path');
assert.equal(events.at(-1)?.type, 'activate', 'final use activates after Mana and invulnerability');

console.log('OK Shiny Mantle source and cooldown regression');

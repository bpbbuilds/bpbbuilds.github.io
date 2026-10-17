import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Manathirst.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-c-mana.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'manathirst');

assert.ok(sourceItem, 'Manathirst: extracted catalog row');
assert.match(source, /func onPrepare\(\):[\s\S]*manaGained = 0[\s\S]*connectForCombat\(character\(\), "character_mana_changed", "onManaChanged"\)/);
assert.match(source, /func onManaChanged\(amount, event\):[\s\S]*amount > 0[\s\S]*manaGained \+= amount[\s\S]*manaGained >= manaNeededForLifesteal[\s\S]*stealLife\(dam \+ character\(\).getVampirism\(\), getP_m\("lifesteal"\) \/ 100\.0, event\)/);
assert.match(source, /func onDealtDamage\(damageRes: DamageResult\):[\s\S]*hasHit\(\)[\s\S]*giveMana\(mana, damageRes\.event\)/);
assert.match(port, /handlerId: 'manathirst'/);
assert.match(port, /onPrepare\(piece, ctx\)/);

const piece = {
  itemId: 'manathirst',
  placementKey: 'manathirst',
  name: 'Manathirst',
  params: sourceItem.params,
  side: 'you',
  alive: true,
  kind: 'weapon',
  damageMin: sourceItem.damageMin,
  damageMax: sourceItem.damageMax,
  accuracy: sourceItem.accuracy,
  critChance: 0,
};
const ctx = {
  t: 0,
  player: createActor('player'),
  dummy: createActor('dummy'),
  events: [],
  rng: () => 0,
};
ctx.player.hp = 180;
ctx.player._simT = 0;
const handler = getScriptHandler('manathirst');
assert.equal(handler?.handlerId, 'manathirst');
handler.onPrepare(piece, ctx);
assert.equal(piece._manaGained, 0, 'Manathirst: preparation resets the Mana progress');

grantStacks(ctx.player, 'mana', 30, { originKey: 'setup', originId: 'setup' });
assert.equal(piece._manaGained, 0,
  'Manathirst: one exact threshold is consumed from Mana progress');
assert.equal(ctx.dummy.hp, 1190,
  'Manathirst: threshold Mana triggers exact source lifesteal damage');
assert.equal(ctx.player.hp, 190,
  'Manathirst: threshold Mana heals from the exact lifesteal result');

grantStacks(ctx.player, 'mana', 5, { originKey: 'setup-2', originId: 'setup' });
assert.equal(piece._manaGained, 5,
  'Manathirst: Mana leftover remains after one threshold crossing');
const beforeHitMana = ctx.player.stacks.mana;
handler.onDealtDamage(piece, ctx, { hit: true });
assert.equal(ctx.player.stacks.mana, beforeHitMana + 2,
  'Manathirst: a hit grants the exact named Mana amount');
handler.onDealtDamage(piece, ctx, { hit: false });
assert.equal(ctx.player.stacks.mana, beforeHitMana + 2,
  'Manathirst: a miss does not grant Mana');

const zero = {
  ...piece,
  placementKey: 'zero-manathirst',
  params: { ...sourceItem.params, manat: 0, dam: 0, lifesteal: 0, mana: 0 },
};
const zeroCtx = {
  ...ctx,
  player: createActor('zero-player'),
  dummy: createActor('zero-dummy'),
  events: [],
};
handler.onPrepare(zero, zeroCtx);
handler.onDealtDamage(zero, zeroCtx, { hit: true });
assert.equal(zeroCtx.player.stacks.mana, 0,
  'Manathirst: explicit zero Mana-on-hit does not invent a grant');

console.log('Manathirst source/parity smoke passed.');

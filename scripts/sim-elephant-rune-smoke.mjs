import assert from 'node:assert/strict';
import fs from 'node:fs';

import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/ElephantRune.gd', 'utf8');
assert.match(source, /func combatStartInventory\(\):[\s\S]*giveMaxHealth\(\)[\s\S]*consume\(\)/);
assert.match(source, /func hasCooldown\(\):[\s\S]*return false/);

const handler = getScriptHandler('elephant_rune');
assert.equal(typeof handler?.onCombatStart, 'function', 'Elephant Rune applies its inventory combat-start hook');

function makeRune(params = { maxhealth: 10 }, maxHealthGain = 0.2) {
  return {
    itemId: 'elephant_rune',
    placementKey: 'you:elephant',
    name: 'Elephant Rune',
    params,
    kind: 'gem',
    alive: true,
    cooldown: 0,
    triggerTime: 0,
  };
}

function makeContext(piece, maxHealthGain = 0.2) {
  return {
    t: 0,
    player: {
      id: 'you',
      hp: 70,
      maxHp: 100,
      _maxHealthGain: maxHealthGain,
      stacks: {},
    },
    dummy: { id: 'them', hp: 100, maxHp: 100, stacks: {} },
    events: [],
    pieces: [piece],
  };
}

const rune = makeRune();
const ctx = makeContext(rune);
handler.onCombatStart(rune, ctx);
assert.equal(ctx.player.maxHp, 112, 'giveMaxHealth applies the owner temporary max-health multiplier');
assert.equal(ctx.player.hp, 82, 'giveMaxHealth fills the same amount of current health');
assert.equal(ctx.events.find((event) => event.itemId === 'elephant_rune')?.amount, 12, 'the HUD projection records the amplified gain');
assert.equal(rune.alive, false, 'source consume removes the inventory rune');
assert.ok(ctx.events.some((event) => event.type === 'activate' && event.itemId === 'elephant_rune'), 'consume retains the activation projection');

const zeroRune = makeRune({ maxhealth: 0 });
const zeroCtx = makeContext(zeroRune, 0.5);
handler.onCombatStart(zeroRune, zeroCtx);
assert.equal(zeroCtx.player.maxHp, 100, 'typed zero max health remains zero');
assert.equal(zeroCtx.player.hp, 70, 'typed zero max health does not heal');
assert.equal(zeroCtx.events.some((event) => event.type === 'heal'), false, 'zero max health emits no fabricated heal');
assert.equal(zeroRune.alive, false, 'zero-gain inventory rune still consumes at combat start');

console.log('OK Elephant Rune source port');

import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { combatStartPriority, PRIORITY } from '../js/pages/sim/engine/combat-start-priority.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/JustStats.gd', 'utf8');
assert.match(source, /func onCombatStart\(\):[\s\S]*giveMaxHealth\(round\(getP_m\("maxhealth"\) \/ 100\.0 \* character\(\)\.getMaxHealth\(\)\)\)[\s\S]*giveStaminaRegeneration\(staminaRegen\)[\s\S]*activate\(\)/);
assert.match(source, /func getTriggerPriority\(\) -> int:[\s\S]*return Priority\.Low/);
assert.equal(inventory.byId.just_stats?.file, 'Exclusive/JustStats.gd');
assert.equal(getScriptHandler('just_stats')?.handlerId, 'just_stats');
assert.equal(combatStartPriority('just_stats'), PRIORITY.Low, 'Just Stats keeps source low start priority');

const handler = getScriptHandler('just_stats');
assert.equal(typeof handler?.onCombatStart, 'function');

function makePiece(params, overrides = {}) {
  return {
    itemId: 'just_stats',
    placementKey: 'just-stats',
    name: 'Just Stats',
    kind: 'passive',
    side: 'you',
    alive: true,
    params,
    ...overrides,
  };
}

const player = createActor('player', { maxHp: 200 });
const ctx = { t: 2.5, player, events: [] };
const piece = makePiece(
  { maxhealth: 12, p1: 12, stamina: 10, p2: 10 },
  { paramAdd: { maxhealth: 2 }, paramMult: { maxhealth: 1.5 } },
);
handler.onCombatStart(piece, ctx);
assert.equal(player.maxHp, 242, 'Just Stats applies modified max-health percent');
assert.equal(player.hp, 242, 'Just Stats grants matching current health');
assert.equal(player.staminaRegen, 1.1, 'Just Stats applies source stamina regeneration');
assert.equal(ctx.events.at(-1)?.meta?.handler, 'just_stats', 'Just Stats activates after start grants');

const zeroPlayer = createActor('player', { maxHp: 200 });
const zeroCtx = { t: 2.5, player: zeroPlayer, events: [] };
const zeroPiece = makePiece({ maxhealth: 0, p1: 0, stamina: 0, p2: 0 }, { placementKey: 'zero-just-stats' });
handler.onCombatStart(zeroPiece, zeroCtx);
assert.equal(zeroPlayer.maxHp, 200, 'Just Stats honors explicit zero max health');
assert.equal(zeroPlayer.staminaRegen, 1, 'Just Stats honors explicit zero stamina regeneration');
assert.equal(zeroCtx.events.at(-1)?.meta?.handler, 'just_stats', 'Just Stats still activates with zero parameters');

console.log('OK Just Stats source-backed modified max-health, stamina regeneration, low priority, activation ordering, and zero parameters');

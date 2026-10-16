import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/ExtraAngy.gd',
  'utf8',
);
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func onPrepare\(\):/);
assert.match(source, /connectForCombat\(character\(\), "battle_rage_started", "onBattleRageStarted"\)/);
assert.match(source, /connectForCombat\(character\(\), "battle_rage_ended", "onBattleRageEnded"\)/);
assert.match(source, /func preCombatStart\(\):/);
assert.match(source, /deactivateCooldown\(\)/);
assert.match(source, /battleRageDur \* getP_m\("dur"\) \/ 100\.0/);
assert.match(source, /onAfterEffectFinished\(\)/);

const item = byId.get('extra_angy');
assert.equal(item?.params?.dur, 100, 'catalog Rage duration factor');
assert.equal(getScriptHandler('extra_angy')?.handlerId, 'extra_angy');

function makeCase(durPct = 50) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  const piece = {
    ...item,
    itemId: 'extra_angy',
    placementKey: 'angy',
    name: item.name,
    kind: 'skill',
    side: 'you',
    alive: true,
    baseCooldown: 0.5,
    cooldown: 0.5,
    triggerTime: 0.5,
    params: { dur: durPct, p1: durPct },
  };
  const ctx = {
    t: 2.5,
    player,
    dummy,
    events: [],
    bus: createCombatBus(),
    rng: () => 0.5,
    itemsById: byId,
    pieces: [piece],
  };
  return { piece, player, dummy, ctx };
}

const handler = getScriptHandler('extra_angy');
assert.equal(typeof handler?.onPrepare, 'function', 'source onPrepare is ported');
assert.equal(typeof handler?.onPreCombatStart, 'function', 'source preCombatStart is ported');

{
  const { piece, player, dummy, ctx } = makeCase();
  handler.onPrepare(piece, ctx);
  handler.onPreCombatStart(piece, ctx);
  assert.equal(piece.cooldown, 999, 'source preCombatStart deactivates cooldown');
  assert.equal(piece.triggerTime, 999, 'deactivated cooldown is not triggerable');

  ctx.bus.emit('battle_rage_started', { actor: dummy, duration: 9 });
  assert.equal(piece._angyRageDur, 0, 'opponent rage is ignored');
  ctx.bus.emit('battle_rage_started', { actor: player, duration: 4 });
  assert.equal(piece._angyRageDur, 4, 'owner rage duration is captured');

  ctx.bus.emit('battle_rage_ended', { actor: dummy, duration: 9 });
  assert.equal(piece._angyActivated, false, 'opponent rage end does not unlock the skill');
  ctx.bus.emit('battle_rage_ended', { actor: player, duration: 4 });
  assert.equal(piece._angyActivated, true, 'owner rage end unlocks once');
  assert.equal(piece.cooldown < 500, true, 'unlock re-arms a normal cooldown');
  assert.equal(piece.triggerTime > 0 && piece.triggerTime < 500, true, 'unlock sets a fresh trigger time');

  handler.onCooldownEffect(piece, ctx);
  assert.equal(player.battleRage, true, 'cooldown effect starts Battle Rage');
  assert.equal(player.battleRageUntil, 4.5, 'duration scales from captured rage duration');
  assert.equal(piece.alive, false, 'source onAfterEffectFinished consumes the skill');
  assert.equal(ctx.events.at(-1)?.meta?.consume, true, 'consume activation follows rage start');
  assert.equal(ctx.events.at(-1)?.label, 'Skill: Extra Angy', 'consume activation projects Skill label');
}

{
  const { piece, player, ctx } = makeCase(0);
  handler.onPrepare(piece, ctx);
  handler.onPreCombatStart(piece, ctx);
  ctx.bus.emit('battle_rage_started', { actor: player, duration: 4 });
  ctx.bus.emit('battle_rage_ended', { actor: player, duration: 4 });
  handler.onCooldownEffect(piece, ctx);
  assert.equal(Boolean(player.battleRage), false, 'typed zero duration does not fabricate Rage');
  assert.equal(piece.alive, false, 'zero-duration skill still completes and consumes');
}

console.log('OK Extra Angy source and regression smoke');

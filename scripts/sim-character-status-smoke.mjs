/**
 * Source-backed regression for Character status helpers: invulnerability,
 * stun resistance/zero-duration events, and Battle Rage restart/notifications.
 * Run: node scripts/sim-character-status-smoke.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createActor,
  grantInvuln,
  grantStun,
  isInvulnerable,
  isStunned,
} from '../js/pages/sim/engine/actor.js';
import {
  endBattleRage,
  isBattleRaging,
  startBattleRage,
  tickBattleRage,
} from '../js/pages/sim/engine/battle-rage.js';

const source = readFileSync('tools/game-extract-full/Core/Character.gd', 'utf8');
assert.match(source, /func makeInvulnerable\([\s\S]*?Util\.changeTimer\(invulnerabilityTimer, invuDur\)/);
assert.match(source, /func makeInvulnerable\([\s\S]*?emitEvent\(self, "character_invulnerable_start"/);
assert.match(source, /func stun\([\s\S]*?if stunResisted\(\)[\s\S]*?stunnedDuration = max\(stunnedDuration, duration\)/);
assert.match(source, /func startBattleRage\([\s\S]*?fullDur \+= battleRageBonusDur[\s\S]*?battleRageTimer\.start\(fullDur\)/);
assert.match(source, /func startBattleRage\([\s\S]*?emitEvent\(self, "battle_rage_started"/);
assert.match(source, /func endBattleRage\([\s\S]*?battleRageTimer\.stop\(\)[\s\S]*?emitEvent\(self, "battle_rage_ended"/);

const busEvents = [];
const bus = { emit(type, payload) { busEvents.push({ type, ...payload }); } };

const invulnerable = createActor('player');
invulnerable._eventLog = [];
grantInvuln(invulnerable, 2, 3, { bus, sourceId: 'crown' });
assert.equal(invulnerable.invulnUntil, 5, 'initial invulnerability ends at source duration');
grantInvuln(invulnerable, 2, 4, { bus, sourceId: 'holy_spear' });
assert.equal(invulnerable.invulnUntil, 7, 'active invulnerability adds the new duration to remaining time');
assert.equal(
  busEvents.filter((event) => event.type === 'character_invulnerable_start').length,
  2,
  'every source makeInvulnerable call emits its start event',
);
assert.equal(invulnerable._eventLog.length, 2, 'every invulnerability grant keeps its visual event');
assert.equal(isInvulnerable(invulnerable, 6.99), true, 'extended invulnerability remains active');
assert.equal(isInvulnerable(invulnerable, 7), false, 'extended invulnerability expires at its new end');

const zeroStun = createActor('dummy');
const zeroStunEvents = [];
zeroStun._combatBus = { emit(type, payload) { zeroStunEvents.push({ type, ...payload }); } };
grantStun(zeroStun, 0, 2, { rng: () => 0.5 });
assert.equal(zeroStunEvents.filter((event) => event.type === 'actor_stunned').length, 1, 'zero stun still emits the source stun event');
assert.equal(isStunned(zeroStun, 2), false, 'zero stun does not leave the target stunned');

const activeZeroStun = createActor('dummy');
activeZeroStun.stunnedUntil = 6;
grantStun(activeZeroStun, 0, 2, { rng: () => 0.5 });
assert.equal(activeZeroStun.stunnedUntil, 6, 'zero stun does not extend an active stun');
assert.equal(isStunned(activeZeroStun, 5.99), true, 'zero stun preserves the active source stun');

const resisted = createActor('dummy');
resisted.stunResistance = 100;
const resistedEvents = [];
resisted._combatBus = { emit(type, payload) { resistedEvents.push({ type, ...payload }); } };
grantStun(resisted, 1, 2, { rng: () => 0.5 });
assert.equal(resistedEvents.length, 0, 'fully resisted stun emits no stunned event');
assert.equal(isStunned(resisted, 2), false, 'fully resisted stun leaves the target active');

const raging = createActor('player');
raging.battleRageBonusDur = 1;
const rageEvents = [];
const rageBus = { emit(type, payload) { rageEvents.push({ type, ...payload }); } };
startBattleRage(raging, 4, 2, { bus: rageBus, sourceId: 'toolbox' });
assert.equal(raging.battleRageUntil, 7, 'Battle Rage applies its source bonus duration');
startBattleRage(raging, 2, 3, { bus: rageBus, sourceId: 'extra_angy', applyBonus: false });
assert.equal(raging.battleRageUntil, 5, 'restarting Battle Rage resets the timer to the new source duration');
assert.equal(
  rageEvents.filter((event) => event.type === 'battle_rage_started').length,
  2,
  'every source startBattleRage call emits its start event',
);
assert.equal(isBattleRaging(raging, 4.99), true, 'Battle Rage remains active before its restarted end');
tickBattleRage(raging, 5, { bus: rageBus });
assert.equal(isBattleRaging(raging, 5), false, 'Battle Rage expires at the restarted end');
assert.equal(rageEvents.filter((event) => event.type === 'battle_rage_ended').length, 1, 'timer expiry emits one end event');
endBattleRage(raging, 6, { bus: rageBus });
assert.equal(rageEvents.filter((event) => event.type === 'battle_rage_ended').length, 2, 'explicit source end emits its end event');

console.log('OK Character status source/timer/event parity smoke');

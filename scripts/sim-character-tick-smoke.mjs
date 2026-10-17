/**
 * Source/runtime regression for Character.onTick and blockable fatigue/poison.
 *
 *   node scripts/sim-character-tick-smoke.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { applyFatigueDamage } from '../js/pages/sim/engine/fatigue.js';
import { runCharacterTick } from '../js/pages/sim/engine/ticks.js';

const characterSource = fs.readFileSync('tools/game-extract-full/Core/Character.gd', 'utf8');
const characterScene = fs.readFileSync('tools/game-extract-full/Core/Character.tscn', 'utf8');
const gameSource = fs.readFileSync('tools/game-extract-full/Core/Game.gd', 'utf8');
const damageSource = fs.readFileSync('tools/game-extract-full/Utility/DamageSource.gd', 'utf8');

assert.match(characterSource, /func combatStart\(\):[\s\S]*tickCounter = 0[\s\S]*tickTimer\.start\(\)/);
assert.match(characterSource, /func combatEnd\(\):[\s\S]*tickTimer\.stop\(\)/);
assert.match(characterSource, /func onTick\(\):[\s\S]*tickCounter % 2 == 0[\s\S]*getRegeneration\(\)[\s\S]*getPoison\(\)[\s\S]*tickCounter \+= 1/);
assert.match(characterScene, /\[node name="TickTimer" type="Timer" parent="\."\]/);
assert.match(characterScene, /\[connection signal="timeout" from="TickTimer" to="\." method="onTick"\]/);
assert.match(gameSource, /fatigueDamageSource\.flags = DamageSource\.Flags\.CanBeBlocked/);
assert.match(damageSource, /const chipDamageFlags = Flags\.CanBeBlocked/);

const events = [];
const bus = createCombatBus();
const healed = createActor('player', { maxHp: 100 });
healed._combatBus = bus;
healed._eventLog = events;
healed.hp = 90;
healed.stacks.regeneration = 5;
runCharacterTick(healed, 3.5, 0, events, () => 0);
assert.equal(healed.hp, 95, 'even Character tick applies regeneration');
assert.equal(events.at(-1)?.type, 'heal', 'regeneration is projected as a heal event');

const poisonEvents = [];
const damageSignals = [];
const poisoned = createActor('player', { maxHp: 100, block: 2 });
poisoned._combatBus = bus;
bus.on('character_damaged', (payload) => damageSignals.push(payload));
poisoned.hp = 100;
poisoned.stacks.poison = 3;
runCharacterTick(poisoned, 4.5, 1, poisonEvents, () => 0);
assert.equal(poisoned.hp, 99, 'odd Character tick applies poison after Block');
assert.equal(poisoned.block, 0, 'poison consumes the extracted chip-damage Block');
assert.equal(damageSignals.at(-1)?.blocked, 2, 'poison damage exposes its Block result');
assert.equal(damageSignals.at(-1)?.healthDamage, 1, 'poison damage exposes health damage after Block');

const fatigueActor = createActor('player', { maxHp: 100, block: 2 });
const fatigueAttacker = createActor('dummy');
fatigueActor._combatBus = bus;
const fatigueLost = applyFatigueDamage(fatigueActor, 5, {
  attacker: fatigueAttacker,
  t: 6,
  bus,
  events: poisonEvents,
});
assert.equal(fatigueLost, 3, 'fatigue applies only damage remaining after Block');
assert.equal(fatigueActor.block, 0, 'fatigue consumes extracted Block');
assert.equal(fatigueActor._lastFatigueDamage?.blocked, 2, 'fatigue retains its Block result');

const invulnerable = createActor('player', { maxHp: 100 });
invulnerable._combatBus = bus;
invulnerable.invulnUntil = 10;
const invulnLost = applyFatigueDamage(invulnerable, 5, { attacker: fatigueAttacker, t: 6, bus });
assert.equal(invulnLost, 0, 'fatigue respects active invulnerability');
assert.equal(invulnerable.hp, 100, 'invulnerability preserves health during fatigue');

console.log('OK Character tick source cadence, alternating effects, and blockable fatigue/poison');

/**
 * Character tick — Regen / Poison / Heat DoT-HoT (Character.onTick family).
 */

import { applyDamageToActor, healActor, requestedHealAmount } from './actor.js';

/**
 * @param {import('./actor.js').SimActor} actor
 * @param {number} t
 * @param {number} tickCounter
 * @param {import('../sim-events.js').SimEvent[]} events
 */
export function runCharacterTick(actor, t, tickCounter, events, rng) {
  if (actor.dead) return;

  if (tickCounter % 2 === 0) {
    const regen = actor.stacks.regeneration;
    if (regen > 0) {
      const want = requestedHealAmount(actor, regen);
      const healed = healActor(actor, regen);
      // Game heal(regen, Regeneration) logs the meter amount even at full HP.
      if (want > 0) {
        if (actor._lastHeal) actor._lastHeal.meterAttached = true;
        events.push({
          t,
          type: 'heal',
          actor: actor.id,
          target: actor.id,
          amount: want,
          label: `Regeneration: +${want} health`,
          meta: {
            stack: 'regeneration',
            category: 'hot',
            systemOrigin: 'Regeneration',
            loggedAmount: want,
            overheal: Math.max(0, want - healed),
            playerHp: actor.id === 'player' ? actor.hp : undefined,
            dummyHp: actor.id === 'dummy' ? actor.hp : undefined,
          },
        });
      }
    }
  } else {
    const poison = actor.stacks.poison;
    if (poison > 0) {
      // Poison ignores block (Character.onTick → poison DamageSource)
      let critical = false;
      let critChance = Math.max(0, Math.min(100, Number(actor.poisonCritChance) || 0));
      critChance = Math.max(0, critChance - (Number(actor.critResistance) || 0));
      if (critChance > 0 && typeof rng === 'function' && rng() * 100 < critChance) {
        if ((Number(actor.critResistStacks) || 0) > 0) {
          actor.critResistStacks -= 1;
        } else {
          critical = true;
        }
      }
      const res = applyDamageToActor(actor, critical ? Math.round(poison * 2) : poison, { ignoreBlock: true });
      events.push({
        t,
        type: 'debuff',
        actor: actor.id === 'player' ? 'dummy' : 'player',
        target: actor.id,
        amount: res.healthDamage,
        label: `Poison: ${res.healthDamage} damage`,
        meta: {
          stack: 'poison',
          category: 'dot',
          systemOrigin: 'Poison',
          critical,
          playerHp: actor.id === 'player' ? actor.hp : undefined,
          dummyHp: actor.id === 'dummy' ? actor.hp : undefined,
        },
      });
    }
  }

  // Heat is a buff stack in-game (Character.onTick does not burn HP from Heat).
  // Keep stacks for HUD / item scripts; no free DoT here (Band G Phase 43).
}

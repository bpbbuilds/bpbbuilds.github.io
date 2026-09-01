/**
 * Character.heal → Unhealing: ceil(logged × getUnhealing() × type factor),
 * then opponent.takeDamage (not a flat HP chip).
 */

import { unhealingFromLoggedHeal } from './actor.js';
import { takeDamage } from './damage.js';

/**
 * @param {import('./actor.js').SimActor} healer
 * @param {number} loggedHeal
 */
export function unhealingAmount(healer, loggedHeal) {
  return unhealingFromLoggedHeal(healer, loggedHeal);
}

/**
 * Game Heal tab still logs the rounded request when HP is already full.
 * @param {import('./actor.js').SimActor} actor
 * @param {import('../sim-events.js').SimEvent[]} events
 * @param {number} t
 */
export function flushUnloggedHeal(actor, events, t) {
  const last = actor?._lastHeal;
  if (!last || last.meterAttached) return;
  const logged = Number(last.loggedAmount) || 0;
  if (logged <= 0) return;
  events.push({
    t,
    type: 'heal',
    actor: actor.id,
    target: actor.id,
    amount: logged,
    label: `Heal +${logged}`,
    meta: {
      category: 'heal',
      loggedAmount: logged,
      overheal: last.overheal,
      flushed: true,
    },
  });
  last.meterAttached = true;
}

/**
 * @param {{
 *   healer: import('./actor.js').SimActor,
 *   foe: import('./actor.js').SimActor,
 *   logged: number,
 *   t: number,
 *   events: import('../sim-events.js').SimEvent[],
 *   rng: () => number,
 * }} opts
 */
export function applyUnhealingHit(opts) {
  const { healer, foe, logged, t, events, rng } = opts;
  if (!healer || !foe || healer === foe || foe.dead) return;
  const raw = unhealingAmount(healer, logged);
  if (raw <= 0) return;
  const res = takeDamage(foe, healer, {
    amount: raw,
    canMiss: false,
    canCrit: false,
    isAttack: false,
    skipSpikes: true,
    rng,
    nowT: t,
  });
  const dealt = Number(res.damage) || 0;
  if (dealt <= 0) return;
  const row = {
    t,
    type: 'damage',
    actor: healer.id,
    target: foe.id,
    amount: dealt,
    label: `Unhealing ${dealt}`,
    meta: {
      category: 'damage',
      systemOrigin: 'Unhealing',
      kind: 'unhealing',
      dummyHp: foe.id === 'dummy' ? foe.hp : undefined,
      playerHp: healer.id === 'player' ? healer.hp : foe.id === 'player' ? foe.hp : undefined,
    },
  };
  if (opts.parentId != null) {
    row.meta.parentId = opts.parentId;
    if (opts.eventId != null) row.meta.eventId = opts.eventId;
    events.push(row);
    return;
  }
  if (opts.deferLog) {
    healer._deferredUnhealLog = row;
    return;
  }
  events.push(row);
}

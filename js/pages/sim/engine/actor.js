/**
 * Sim actor shell — player / dummy HP, stamina, block, stacks, armor DR.
 */

import { collectActorHudStats } from './actor-stats.js';
import { gainStacks as gainStacksImpl } from './stacks.js';
import { summarizeTemporaryStacks } from './temp-stacks.js';
import { pushStunLabel } from './item-fx-log.js';

/** @typedef {'player' | 'dummy'} SimActorId */

/**
 * @typedef {{
 *   regeneration: number,
 *   poison: number,
 *   heat: number,
 *   cold: number,
 *   blind: number,
 *   spikes: number,
 *   vampirism: number,
 *   empower: number,
 *   lucky: number,
 *   mana: number,
 * }} SimStacks
 */

/**
 * @typedef {{
 *   id: SimActorId,
 *   maxHp: number,
 *   hp: number,
 *   maxStamina: number,
 *   stamina: number,
 *   temporaryMaxStamina?: number,
 *   staminaRegen: number,
 *   block: number,
 *   damageReduction: number,
 *   damageResistancePct: number,
 *   critResistance: number,
 *   stunResistance: number,
 *   buffNullifyChance: number,
 *   dodgeStacks: number,
 *   debuffReflectChance: number,
 *   debuffReflectStacks: number,
 *   debuffResistStacks: number,
 *   meleeSpikesLimit: number,
 *   rangedSpikesLimit: number,
 *   meleeVampirismLimit: number,
 *   rangedVampirismLimit: number,
 *   stackResist: Record<string, number>,
 *   stacks: SimStacks,
 *   dead: boolean,
 *   invulnUntil?: number,
 *   invulnCharges?: number,
 *   buffProtect?: number,
 *   stunnedUntil?: number,
 * }} SimActor
 */

export const PLAYER_MAX_HP = 200;
/** Game Character.gd / classResource.stamina default — not 20. */
export const PLAYER_MAX_STAMINA = 5;
export const PLAYER_STAMINA_REGEN = 1.0;

export const DUMMY_MAX_HP = 1200;
/** Same base pool as the player when history vitals omit stamina. */
export const DUMMY_MAX_STAMINA = 5;
export const DUMMY_STAMINA_REGEN = 1.0;

export const DUMMY_ATTACK_CD = 2.15;
export const DUMMY_ATTACK_DAMAGE = 13;
export const DUMMY_ATTACK_ACCURACY = 88;

/** @returns {SimStacks} */
function emptyStacks() {
  return {
    regeneration: 0,
    poison: 0,
    heat: 0,
    cold: 0,
    blind: 0,
    spikes: 0,
    vampirism: 0,
    empower: 0,
    lucky: 0,
    mana: 0,
  };
}

/**
 * @param {SimActorId} id
 * @param {{ maxHp?: number, maxStamina?: number, staminaRegen?: number, block?: number }} [opts]
 * @returns {SimActor}
 */
export function createActor(id, opts = {}) {
  const maxHp =
    opts.maxHp ?? (id === 'player' ? PLAYER_MAX_HP : DUMMY_MAX_HP);
  const maxStamina =
    opts.maxStamina ??
    (id === 'player' ? PLAYER_MAX_STAMINA : DUMMY_MAX_STAMINA);
  const staminaRegen =
    opts.staminaRegen ??
    (id === 'player' ? PLAYER_STAMINA_REGEN : DUMMY_STAMINA_REGEN);
  const block = Math.max(0, Math.round(Number(opts.block) || 0));
  return {
    id,
    maxHp,
    hp: maxHp,
    maxStamina,
    stamina: maxStamina,
    temporaryMaxStamina: 0,
    staminaRegen,
    block,
    damageReduction: 0,
    damageResistancePct: 0,
    critResistance: 0,
    stunResistance: 0,
    buffNullifyChance: 0,
    dodgeStacks: 0,
    critStacks: 0,
    critResistStacks: 0,
    meleeDmgFactor: 0,
    rangedDmgFactor: 0,
    effectDmgFactor: 0,
    debuffReflectChance: 0,
    debuffReflectStacks: 0,
    debuffResistStacks: 0,
    meleeSpikesLimit: 1,
    rangedSpikesLimit: 0,
    meleeVampirismLimit: 1,
    rangedVampirismLimit: 0,
    stackResist: {},
    stacks: emptyStacks(),
    dead: false,
    invulnUntil: 0,
    invulnCharges: 0,
    buffProtect: 0,
    buffCleanseProtectChance: 0,
    stunnedUntil: 0,
    _healAmp: 0,
    unhealing: 0,
  };
}

/**
 * Grant invulnerability (duration and/or charges).
 * @param {SimActor} actor
 * @param {number} durationSec
 * @param {number} nowT
 * @param {{ charges?: number }} [opts]
 */
export function grantInvuln(actor, durationSec, nowT, opts = {}) {
  const dur = Math.max(0, Number(durationSec) || 0);
  const was = isInvulnerable(actor, nowT);
  if (dur > 0) {
    const until = (Number(nowT) || 0) + dur;
    actor.invulnUntil = Math.max(Number(actor.invulnUntil) || 0, until);
  }
  const charges = Math.max(0, Math.round(Number(opts.charges) || 0));
  if (charges > 0) {
    actor.invulnCharges = (Number(actor.invulnCharges) || 0) + charges;
  }
  if (!was && isInvulnerable(actor, nowT)) {
    opts.bus?.emit?.('character_invulnerable_start', {
      t: nowT,
      untilT: actor.invulnUntil,
      sourceId: opts.sourceId ?? null,
    });
  }
}

/**
 * @param {SimActor} actor
 * @param {number} [nowT]
 */
export function isInvulnerable(actor, nowT = 0) {
  const until = Number(actor.invulnUntil) || 0;
  if (until > 0 && (Number(nowT) || 0) < until) return true;
  return (Number(actor.invulnCharges) || 0) > 0;
}

/**
 * Spend one invuln charge after a blocked hit (duration-only invuln does not spend).
 * @param {SimActor} actor
 * @param {number} [nowT]
 */
export function consumeInvulnHit(actor, nowT = 0) {
  const until = Number(actor.invulnUntil) || 0;
  if (until > 0 && (Number(nowT) || 0) < until) return;
  if ((Number(actor.invulnCharges) || 0) > 0) {
    actor.invulnCharges -= 1;
  }
}

/**
 * @param {SimActor} actor
 * @param {number} durationSec
 * @param {number} nowT
 */
export function grantStun(actor, durationSec, nowT, opts = {}) {
  const dur = Math.max(0, Number(durationSec) || 0);
  if (dur <= 0) return;
  const resist = Number(actor.stunResistance) || 0;
  const rng = opts.rng;
  if (resist > 0 && typeof rng === 'function') {
    // LeatherHelm: chance to ignore stun entirely
    if (rng() * 100 < resist) {
      pushStunLabel(actor, nowT, dur, opts, 'stun_resisted');
      return;
    }
  }
  const until = (Number(nowT) || 0) + dur;
  actor.stunnedUntil = Math.max(Number(actor.stunnedUntil) || 0, until);
  actor._combatBus?.emit?.('actor_stunned', { actor, t: nowT, duration: dur });
  pushStunLabel(actor, nowT, dur, opts, 'stunned');
}

/**
 * @param {SimActor} actor
 * @param {number} [nowT]
 */
export function isStunned(actor, nowT = 0) {
  const until = Number(actor.stunnedUntil) || 0;
  return until > 0 && (Number(nowT) || 0) < until;
}

/**
 * @param {SimActor} actor
 * @param {number} amount
 */
export function grantBuffProtect(actor, amount = 1) {
  const n = Math.max(0, Math.round(Number(amount) || 0));
  if (n <= 0) return;
  actor.buffProtect = (Number(actor.buffProtect) || 0) + n;
}

/**
 * @param {SimActor} actor
 * @param {number} amount
 * @returns {'ok' | 'starve'}
 */
export function tryUseStamina(actor, amount) {
  const cost = Math.max(0, Number(amount) || 0);
  if (cost <= 0) return 'ok';
  // Character.useStamina → character_pre_use_stamina (Heroic Potion, …)
  actor._combatBus?.emit?.('pre_use_stamina', {
    amount: cost,
    actor,
    t: actor._simT,
  });
  if (actor.stamina + 1e-9 < cost) return 'starve';
  actor.stamina = Math.max(0, actor.stamina - cost);
  actor._combatBus?.emit?.('stamina_used', {
    amount: cost,
    actor,
    t: actor._simT,
  });
  const log = actor._eventLog;
  const src = actor._staminaItem;
  if (Array.isArray(log) && actor.id === 'player') {
    const shown = Number.isInteger(cost) ? String(cost) : cost.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    log.push({
      t: Number(actor._simT) || 0,
      type: 'stamina',
      actor: 'player',
      itemId: src?.itemId ?? null,
      placementKey: src?.placementKey ?? null,
      amount: cost,
      label: src?.name ? `${src.name}: −${shown} stamina` : `−${shown} stamina`,
      meta: { category: 'stamina', kind: 'used', stamina: actor.stamina },
    });
  }
  return 'ok';
}

/**
 * Character.drainStamina — remove up to the requested amount from the
 * opponent without the sufficient-stamina gate used by tryUseStamina.
 *
 * @param {SimActor} actor
 * @param {number} amount
 * @param {{ events?: object[], t?: number, actorSide?: string, itemId?: string, placementKey?: string, label?: string, handler?: string }} [opts]
 * @returns {number} amount actually removed
 */
export function drainStamina(actor, amount, opts = {}) {
  const want = Math.max(0, Number(amount) || 0);
  if (!(want > 0)) return 0;
  const drained = Math.min(Math.max(0, Number(actor.stamina) || 0), want);
  actor.stamina = Math.max(0, (Number(actor.stamina) || 0) - drained);
  actor._combatBus?.emit?.('stamina_drained', {
    actor,
    amount: drained,
    t: opts.t ?? actor._simT,
    itemId: opts.itemId ?? null,
    placementKey: opts.placementKey ?? null,
  });
  if (Array.isArray(opts.events) && drained > 0) {
    opts.events.push({
      t: Number(opts.t ?? actor._simT) || 0,
      type: 'stamina',
      actor: opts.actorSide ?? actor.id,
      amount: drained,
      itemId: opts.itemId ?? null,
      placementKey: opts.placementKey ?? null,
      label: opts.label || `Removed ${drained} stamina`,
      meta: {
        category: 'stamina',
        kind: 'drain',
        script: true,
        ...(opts.handler ? { handler: opts.handler } : {}),
      },
    });
  }
  return drained;
}

/**
 * Game Character.getMaxStamina — permanent + temporary fight bonus.
 * @param {SimActor} actor
 */
export function effectiveMaxStamina(actor) {
  return (
    (Number(actor.maxStamina) || PLAYER_MAX_STAMINA) +
    (Number(actor.temporaryMaxStamina) || 0)
  );
}

/**
 * Game Item.giveMaxStaminaTemporary / Character.gainMaxStaminaTemporary.
 * @param {SimActor} actor
 * @param {number} amount
 * @param {{ filled?: boolean }} [opts]
 */
export function gainMaxStaminaTemporary(actor, amount, opts = {}) {
  const a = Number(amount) || 0;
  if (!a) return;
  actor.temporaryMaxStamina = (Number(actor.temporaryMaxStamina) || 0) + a;
  if (opts.filled !== false && a > 0) {
    actor.stamina = Math.min(effectiveMaxStamina(actor), actor.stamina + a);
  }
}

/**
 * Game Character.gainStamina — clamp to getMaxStamina().
 * @param {SimActor} actor
 * @param {number} amount
 */
export function giveStamina(actor, amount) {
  const a = Number(amount) || 0;
  if (!a) return;
  actor.stamina = Math.min(effectiveMaxStamina(actor), actor.stamina + a);
}

/**
 * Game Character.recalculateMaxStamina — base +1 permanent max per Stamina Sack on board.
 * @param {import('./actor.js').SimActor} actor
 * @param {import('./pieces.js').CombatPiece[]} youPieces
 */
export function applyStaminaSackInventoryMax(actor, youPieces) {
  const sacks = (youPieces || []).filter(
    (p) => p.itemId === 'stamina_sack' && p.alive !== false,
  ).length;
  actor.maxStamina = PLAYER_MAX_STAMINA + sacks;
  actor.stamina = actor.maxStamina;
}

/**
 * @param {SimActor} actor
 * @param {number} dt
 */
export function regenStamina(actor, dt) {
  if (actor.dead) return;
  actor.stamina = Math.min(
    effectiveMaxStamina(actor),
    actor.stamina + actor.staminaRegen * dt,
  );
}

/**
 * Flat DR → block → HP (legacy helper for ticks / non-attack). Prefer damage.js.
 * @param {SimActor} actor
 * @param {number} rawDamage
 * @param {{ ignoreBlock?: boolean }} [opts]
 */
export function applyDamageToActor(actor, rawDamage, opts = {}) {
  if (isInvulnerable(actor, opts.nowT)) {
    consumeInvulnHit(actor, opts.nowT);
    return { blocked: 0, reduced: 0, healthDamage: 0, hpAfter: actor.hp, invuln: true };
  }
  let dmg = Math.max(0, Math.round(rawDamage));
  let reduced = 0;
  const pct = Math.max(-10, Math.min(1, (actor.damageResistancePct || 0) / 100));
  if (pct !== 0) {
    const after = Math.round(dmg * (1 - pct));
    dmg = after;
  }
  if (actor.damageReduction > 0 && dmg > 0 && !opts.ignoreBlock) {
    reduced = Math.min(dmg, actor.damageReduction);
    dmg -= reduced;
  }
  let blocked = 0;
  if (!opts.ignoreBlock && actor.block > 0 && dmg > 0) {
    if (dmg > actor.block) {
      blocked = actor.block;
      dmg -= actor.block;
      actor.block = 0;
    } else {
      blocked = dmg;
      actor.block -= dmg;
      dmg = 0;
    }
  }
  actor.hp = Math.max(0, actor.hp - dmg);
  if (actor.hp <= 0) actor.dead = true;
  return { blocked, reduced, healthDamage: dmg, hpAfter: actor.hp };
}

/**
 * Heal amount the game would log on the Heal meter (after efficiency, before HP cap).
 * @param {SimActor} actor
 * @param {number} amount
 */
export function requestedHealAmount(actor, amount) {
  if (actor?.dead) return 0;
  let want = Math.max(0, Number(amount) || 0);
  const amp = Number(actor._healAmp) || 0;
  if (amp) want *= 1 + amp;
  return Math.round(want);
}

/**
 * Character.heal: ceil(loggedHeal × getUnhealing()). Does not shrink the heal.
 * @param {SimActor} actor
 * @param {number} loggedHeal
 */
export function unhealingFromLoggedHeal(actor, loggedHeal) {
  const rate = Number(actor.unhealing) || 0;
  const amt = Number(loggedHeal) || 0;
  if (rate <= 0 || amt <= 0) return 0;
  return Math.ceil(amt * rate);
}

/**
 * @param {SimActor} actor
 * @param {number} amount
 */
export function healActor(actor, amount) {
  if (actor.dead) return 0;
  const want = requestedHealAmount(actor, amount);
  const before = actor.hp;
  const room = Math.max(0, actor.maxHp - actor.hp);
  const applied = Math.min(room, want);
  actor.hp += applied;
  const overheal = want - applied;
  if (overheal > 0) {
    const gainAmp = Number(actor._maxHealthGain) || 0;
    if (actor._overhealToMaxHp || gainAmp) {
      const gain = Math.max(0, Math.round(overheal * (1 + gainAmp)));
      if (gain > 0) {
        actor.maxHp += gain;
        actor.hp += gain;
      }
    }
  }
  const gained = actor.hp - before;
  actor._lastHeal = {
    applied: gained,
    loggedAmount: want,
    overheal: Math.max(0, overheal),
    t: actor._simT,
    meterAttached: false,
  };
  if (want > 0) {
    actor._combatBus?.emit?.('actor_healed', {
      actor,
      amount: gained,
      loggedAmount: want,
      overheal: Math.max(0, overheal),
      t: actor._simT,
    });
  }
  return gained;
}

/**
 * Simple stack add (no resist). Prefer gainStacks from stacks.js in combat.
 * @param {SimActor} actor
 * @param {keyof SimStacks} stack
 * @param {number} amount
 */
export function addStack(actor, stack, amount) {
  gainStacksImpl(actor, stack, amount);
}

export { gainStacksImpl as gainStacks };

/**
 * @param {SimActor} actor
 */
export function snapshotActor(actor) {
  const temp = summarizeTemporaryStacks(actor);
  return {
    hp: actor.hp,
    maxHp: actor.maxHp,
    stamina: actor.stamina,
    maxStamina: effectiveMaxStamina(actor),
    block: actor.block,
    damageReduction: actor.damageReduction,
    regeneration: actor.stacks.regeneration,
    poison: actor.stacks.poison,
    heat: actor.stacks.heat,
    cold: actor.stacks.cold,
    blind: actor.stacks.blind,
    spikes: actor.stacks.spikes,
    vampirism: actor.stacks.vampirism,
    empower: actor.stacks.empower,
    lucky: actor.stacks.lucky,
    mana: actor.stacks.mana,
    dead: actor.dead,
    buffProtect: Number(actor.buffProtect) || 0,
    invulnCharges: Number(actor.invulnCharges) || 0,
    stunnedUntil: Number(actor.stunnedUntil) || 0,
    invulnUntil: Number(actor.invulnUntil) || 0,
    healAmp: Number(actor._healAmp) || 0,
    unhealing: Number(actor.unhealing) || 0,
    combatStats: collectActorHudStats(actor),
    ...(Object.keys(temp).length ? { temp } : {}),
  };
}

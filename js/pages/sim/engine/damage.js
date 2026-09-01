/**
 * Attack / takeDamage pipeline aligned with Character.takeDamage + dealDamage
 * (Band G Phase 44). Simplified: no full EventBus hooks / Fatigue.
 */

import { healActor, isInvulnerable, consumeInvulnHit, requestedHealAmount } from './actor.js';
import { attackEffectCount } from './attack-effects.js';
import { loseStacks } from './stacks.js';
import { rollPercent } from './rng.js';

/** @param {{ amount?: number | (() => number) }} src */
function resolveDamageAmount(src) {
  const a = typeof src.amount === 'function' ? src.amount() : src.amount;
  return Math.max(0, Math.round(Number(a) || 0));
}

/**
 * @typedef {{
 *   hit: boolean,
 *   critical: boolean,
 *   raw: number,
 *   damage: number,
 *   healthDamage: number,
 *   blocked: number,
 *   reduced: number,
 *   percentReduced: number,
 *   spikeDamage: number,
 *   vampHeal: number,
 *   attackEffectCount?: number,
 * }} DamageResult
 */

/**
 * Apply incoming attack/effect to defender.
 * Order: miss/dodge → roll → crit → shield chance-block → % resist → flat DR → block → HP → spikes.
 *
 * @param {import('./actor.js').SimActor} defender
 * @param {import('./actor.js').SimActor} attacker
 * @param {{
 *   amount: number | (() => number),
 *   onPreDealDamageEarly?: (res: DamageResult) => void,
 *   originPiece?: object,
 *   accuracy?: number,
 *   canMiss?: boolean,
 *   canCrit?: boolean,
 *   critChance?: number,
 *   canBlock?: boolean,
 *   ignoreBlock?: boolean,
 *   isAttack?: boolean,
 *   isMelee?: boolean,
 *   isPoison?: boolean,
 *   isSpikes?: boolean,
 *   skipSpikes?: boolean,
 *   vampiricItem?: boolean,
 *   nowT?: number,
 *   bus?: { emit?: (type: string, payload?: object) => void },
 *   rng: () => number,
 * }} src
 * @returns {DamageResult}
 */
export function takeDamage(defender, attacker, src) {
  /** @type {DamageResult} */
  const res = {
    hit: true,
    critical: false,
    raw: 0,
    damage: 0,
    healthDamage: 0,
    blocked: 0,
    reduced: 0,
    percentReduced: 0,
    spikeDamage: 0,
    vampHeal: 0,
    attackEffectCount: 1,
  };

  if (defender.dead) {
    res.hit = false;
    return res;
  }

  if (isInvulnerable(defender, src.nowT ?? 0) && !src.isPoison) {
    res.hit = true;
    res.raw = resolveDamageAmount(src);
    consumeInvulnHit(defender, src.nowT ?? 0);
    return res;
  }

  const canMiss = src.canMiss !== false && !src.isPoison && !src.isSpikes;
  if (canMiss) {
    let accuracy = Number(src.accuracy);
    if (!Number.isFinite(accuracy)) accuracy = 90;
    res.hit = rollPercent(accuracy, src.rng);
    if (res.hit && (defender.dodgeStacks || 0) > 0) {
      defender.dodgeStacks -= 1;
      res.hit = false;
    }
  }

  // Game: attackEffectCount = 1 + item.rollDoubleAttackEffect(); then
  // loop onPreDealDamage_early / onPreDealDamage_late / onDealtDamage.
  if (src.isAttack !== false && src.originPiece) {
    res.attackEffectCount = attackEffectCount(src.originPiece, src.rng);
  }
  const earlyN = src.isAttack !== false ? res.attackEffectCount || 1 : 1;
  for (let i = 0; i < earlyN; i += 1) {
    src.onPreDealDamageEarly?.(res);
  }

  if (!res.hit) return res;

  let dmg = resolveDamageAmount(src);
  res.raw = dmg;

  let critChance = Number(src.critChance) || 0;
  const critRes = Number(defender.critResistance) || 0;
  if (critRes > 0) critChance = Math.max(0, critChance - critRes);
  if (src.canCrit && critChance > 0 && rollPercent(critChance, src.rng)) {
    res.critical = true;
    dmg = Math.round(dmg * 2);
  }

  // Shield.gd — chance melee block applies flat damblock, then afterBlock
  /** @type {null | { piece?: object, damblock: number, afterBlock?: Function }} */
  let shieldHit = null;
  const melee =
    src.isMelee !== false && src.isAttack !== false && !src.isPoison && !src.isSpikes;
  if (melee && Array.isArray(defender._shields) && defender._shields.length && dmg > 0) {
    for (const sh of defender._shields) {
      if (!sh || sh.disabled) continue;
      const chance = Number(sh.chance) || 0;
      if (chance > 0 && rollPercent(chance, src.rng)) {
        shieldHit = sh;
        break;
      }
    }
  }
  if (shieldHit) {
    const cut = Math.min(dmg, Math.max(0, Math.round(Number(shieldHit.damblock) || 0)));
    if (cut > 0) {
      dmg -= cut;
      res.reduced = (res.reduced || 0) + cut;
    }
  }

  // % damage resistance (Character.damageResistance / 100)
  const pct = Math.max(-10, Math.min(1, (defender.damageResistancePct || 0) / 100));
  if (pct !== 0) {
    const after = Math.round(dmg * (1 - pct));
    res.percentReduced = dmg - after;
    dmg = after;
  }

  // Flat DR on attacks
  if (src.isAttack !== false && !src.isPoison && !src.isSpikes) {
    const flat = Math.max(0, defender.damageReduction || 0);
    if (flat > 0 && dmg > 0) {
      const cut = Math.min(dmg, flat);
      dmg -= cut;
      res.reduced = (res.reduced || 0) + cut;
    }
  }

  dmg = Math.max(0, dmg);
  res.damage = dmg;
  res.healthDamage = dmg;

  const canBlock = src.canBlock !== false && !src.ignoreBlock && !src.isPoison;
  if (canBlock && defender.block > 0 && dmg > 0) {
    if (dmg > defender.block) {
      res.blocked = defender.block;
      res.healthDamage = dmg - defender.block;
      loseStacks(defender, 'block', defender.block);
    } else {
      res.blocked = dmg;
      res.healthDamage = 0;
      loseStacks(defender, 'block', dmg);
    }
  }

  defender.hp = Math.max(0, defender.hp - res.healthDamage);
  if (defender.hp <= 0) defender.dead = true;

  if (shieldHit) {
    const payload = {
      t: src.nowT ?? 0,
      defender,
      attacker,
      damage: res,
      piece: shieldHit.piece ?? null,
      blockedFlat: Number(shieldHit.damblock) || 0,
    };
    try {
      shieldHit.afterBlock?.(payload);
    } catch (err) {
      console.error('[sim] shield afterBlock', err);
    }
    src.bus?.emit?.('afterBlock', payload);
  }

  // Spikes reflect (melee limit 1.0 → full spikes stacks, capped by damage * limit)
  if (
    !src.skipSpikes &&
    !src.isSpikes &&
    !src.isPoison &&
    src.isAttack !== false &&
    (defender.stacks.spikes || 0) > 0 &&
    res.damage > 0 &&
    !attacker.dead
  ) {
    const limit =
      src.isMelee === false
        ? defender.rangedSpikesLimit ?? 0
        : defender.meleeSpikesLimit ?? 1;
    const spikeDam = Math.min(
      defender.stacks.spikes,
      Math.round(res.damage * limit),
    );
    if (spikeDam > 0) {
      const back = takeDamage(attacker, defender, {
        amount: spikeDam,
        canMiss: false,
        canCrit: false,
        canBlock: true,
        isAttack: false,
        isSpikes: true,
        rng: src.rng,
      });
      res.spikeDamage = back.healthDamage;
    }
  }

  return res;
}

/**
 * Character.dealDamage path: opponent.takeDamage then applyVampirism.
 * @param {import('./actor.js').SimActor} attacker
 * @param {import('./actor.js').SimActor} defender
 * @param {Parameters<typeof takeDamage>[2]} src
 */
export function dealDamage(attacker, defender, src) {
  const res = takeDamage(defender, attacker, src);
  if (!res.hit || res.damage <= 0) return res;

  // Character.applyVampirism — only if DamageSource.CanTriggerVampirism.
  // Melee/ranged weapons have it; Effect (stealLife) uses effectFlags (no vamp).
  // Vampiric extra-type only grants stacks — it is not bonus heal on the hit.
  const triggersVamp =
    src.canTriggerVampirism != null
      ? !!src.canTriggerVampirism
      : src.isAttack !== false;
  const vampStacks = attacker.stacks.vampirism || 0;
  if (triggersVamp && vampStacks > 0) {
    const limit =
      src.isMelee === false
        ? attacker.rangedVampirismLimit ?? 0
        : attacker.meleeVampirismLimit ?? 1;
    const healAmt = Math.min(vampStacks, Math.round(res.damage * limit));
    if (healAmt > 0) {
      healActor(attacker, healAmt);
      // Game Heal tab logs post-efficiency amount (Character.heal after getHealingEfficiency).
      res.vampHeal =
        Number(attacker._lastHeal?.loggedAmount) ||
        requestedHealAmount(attacker, healAmt);
    }
  }
  return res;
}

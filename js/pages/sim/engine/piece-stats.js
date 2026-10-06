/**
 * Display / tip combat stats — mirrors Item.getSpeed / getModifiedCooldown /
 * empower + luck accuracy rules (simplified).
 */

import { recordPieceMod, summarizeStatMods } from './stat-mods.js';
import { effectiveChance } from './chance.js';
import { pushItemOverlayEvent } from './item-fx-log.js';

/** @typedef {import('./pieces.js').CombatPiece} CombatPiece */
/** @typedef {import('./actor.js').SimActor} SimActor */

/**
 * Game Item.getSpeed() — speedScale + (Heat − Cold)×0.02, clamped 0.1…10.
 * @param {import('./pieces.js').CombatPiece} piece
 * @param {{ heat?: number, cold?: number } | null | undefined} stacks
 */
export function pieceSpeed(piece, stacks) {
  const heat = Number(stacks?.heat) || 0;
  const cold = Number(stacks?.cold) || 0;
  const speed_ = (Number(piece.speedScale) || 0) + (heat - cold) * 0.02;
  let modifiedSpeed;
  if (speed_ >= 0) {
    modifiedSpeed = 1 + speed_;
  } else {
    modifiedSpeed = 1 / (1 - speed_);
  }
  return Math.max(0.1, Math.min(10, modifiedSpeed));
}

/**
 * Catalog/base CD ÷ speed (display cooldown row).
 * @param {CombatPiece} piece
 * @param {{ heat?: number, cold?: number } | null | undefined} stacks
 */
export function modifiedCooldown(piece, stacks) {
  const base = Number(piece.baseCooldown ?? piece.cooldown) || 0;
  if (!(base > 0) || base >= 500) return base;
  return Math.max(0.35, base / pieceSpeed(piece, stacks));
}

/**
 * Tip / hit damage range after bonuses + Empower.
 * @param {CombatPiece} piece
 * @param {{ empower?: number } | null | undefined} stacks
 */
export function modifiedDamageRange(piece, stacks) {
  const bonus =
    (Number(piece.damageBonus) || 0) + (Number(piece.bonusDamage) || 0);
  const emp =
    piece.empowerable !== false ? Math.max(0, Number(stacks?.empower) || 0) : 0;
  const lo = (Number(piece.damageMin) || 0) + bonus + emp;
  const hi = (Number(piece.damageMax) || 0) + bonus + emp;
  const min = applyBonusDamageFactor(piece, lo);
  const max = applyBonusDamageFactor(piece, hi);
  return { min, max: Math.max(min, max) };
}

/**
 * Tip accuracy: base + bonusAccuracy + (Lucky - Blind) * 5
 * @param {CombatPiece} piece
 * @param {{ lucky?: number, blind?: number } | null | undefined} stacks
 */
export function modifiedAccuracy(piece, stacks) {
  const base = Number(piece.accuracy);
  const acc = Number.isFinite(base) ? base : 90;
  const bonus = Number(piece.bonusAccuracy) || 0;
  const lucky = Number(stacks?.lucky) || 0;
  const blind = Number(stacks?.blind) || 0;
  return Math.max(0, Math.min(100, acc + bonus + (lucky - blind) * 5));
}

/**
 * @param {CombatPiece} piece
 * @param {number} frac e.g. 0.10 for +10% speed
 */
export function addSpeed(piece, frac) {
  const n = Number(frac) || 0;
  if (!n) return;
  recordPieceMod(piece, { stat: 'speed', amount: n, unit: 'factor' });
  piece.speedScale = (Number(piece.speedScale) || 0) + n;
  // Item.addSpeed — speedScale only; triggerTime unchanged (getSpeed() affects tick rate).
}

/**
 * @param {CombatPiece} piece
 * @param {number} amount
 * @param {{
 *   via?: string | null,
 *   originKey?: string | null,
 *   originId?: string | null,
 *   originName?: string | null,
 *   removable?: boolean,
 * }} [opts]
 */
export function addBonusDamage(piece, amount, opts = {}) {
  const n = Number(amount) || 0;
  if (!n) return;
  const removable = opts.removable !== false;
  piece._removableBonusDamageInitialized = true;
  recordPieceMod(piece, {
    stat: 'damage',
    amount: n,
    unit: 'flat',
    via: opts.via || null,
    originKey: opts.originKey,
    originId: opts.originId,
    originName: opts.originName,
  });
  piece.bonusDamage = (Number(piece.bonusDamage) || 0) + n;
  // Item.changeVaryingDamage(...), unlike addBonusDamage(...), deliberately
  // marks the change as non-removable. Keep both totals so purge/strip effects
  // remove only the game's `removableDam` pool while damage still includes the
  // full accumulated bonus.
  if (removable) {
    piece.removableBonusDamage =
      (Number(piece.removableBonusDamage) || 0) + n;
  }
  if (opts.silentLabel) return;
  pushItemOverlayEvent(piece, {
    type: 'info',
    amount: n,
    label: `${n > 0 ? '+' : ''}${n} damage`,
    meta: { category: 'item_label', kind: 'damage_buff' },
  });
}

/**
 * Item.purgeDamage — remove only the removable damage accumulated through
 * addBonusDamage. Catalog/gem damage (`damageBonus`) and base damage remain
 * intact, matching Item.removableDam rather than shrinking the weapon itself.
 *
 * @param {CombatPiece} piece
 * @param {number} amount
 * @returns {number} amount actually removed
 */
export function purgeBonusDamage(piece, amount) {
  const want = Math.max(0, Number(amount) || 0);
  const tracked = piece._removableBonusDamageInitialized === true;
  const current = Math.max(
    0,
    tracked ? Number(piece.removableBonusDamage) || 0 : Number(piece.bonusDamage) || 0,
  );
  const removed = Math.min(current, want);
  if (!(removed > 0)) return 0;
  piece.removableBonusDamage = current - removed;
  piece.bonusDamage = Math.max(0, (Number(piece.bonusDamage) || 0) - removed);
  recordPieceMod(piece, {
    stat: 'damage',
    amount: -removed,
    unit: 'flat',
    via: 'purgeDamage',
  });
  pushItemOverlayEvent(piece, {
    type: 'info',
    amount: -removed,
    label: `${-removed} damage`,
    meta: { category: 'item_label', kind: 'damage_buff_purge' },
  });
  return removed;
}

/**
 * Bloodthorne-style: +damage when a buff stack changes (attribute to stack + grant origin).
 * @param {CombatPiece} piece
 * @param {import('./buff-economy.js').BuffChange} ch
 * @param {number} [mult]
 */
export function addBonusDamageFromBuffChange(piece, ch, mult = 1) {
  const amount = Math.round((Number(ch.amount) || 0) * (Number(mult) || 1));
  if (!amount || !ch.stack) return;
  addBonusDamage(piece, amount, {
    via: ch.stack,
    originKey: ch.originKey,
    originId: ch.originId,
  });
}

/**
 * Item.addBonusDamageFactor — accumulate multiplier (starts at 1).
 * Relic Case passes 0.05 per tick, not a flattened +1.
 * @param {CombatPiece} piece
 * @param {number} frac
 */
export function addBonusDamageFactor(piece, frac) {
  const f = Number(frac) || 0;
  if (!f) return;
  recordPieceMod(piece, { stat: 'damage', amount: f, unit: 'factor' });
  const cur = Number(piece.bonusDamageFactor);
  piece.bonusDamageFactor = (Number.isFinite(cur) && cur > 0 ? cur : 1) + f;
}

/**
 * Game getMinDamage / getMaxDamage: round(amount * bonusDamageFactor).
 * @param {CombatPiece} piece
 * @param {number} amount
 */
export function applyBonusDamageFactor(piece, amount) {
  const n = Number(amount) || 0;
  const cur = Number(piece.bonusDamageFactor);
  const f = Number.isFinite(cur) && cur > 0 ? cur : 1;
  return Math.max(0, Math.round(n * f));
}

/**
 * @param {CombatPiece} piece
 * @param {number} amount
 */
export function addAccuracy(piece, amount) {
  const n = Number(amount) || 0;
  if (!n) return;
  recordPieceMod(piece, { stat: 'accuracy', amount: n, unit: 'flat' });
  piece.bonusAccuracy = (Number(piece.bonusAccuracy) || 0) + n;
}

function refreshStaminaCost(piece) {
  const base = Number(piece.baseStaminaCost);
  const fac = Number(piece.staminaFactor);
  const f = Number.isFinite(fac) && fac >= 0 ? fac : 1;
  const b = Number.isFinite(base) ? base : Number(piece.staminaCost) || 0;
  piece.staminaCost = Math.max(0, Math.round(b * f * 100) / 100);
}

/**
 * Item.changeStaminaFactor — `frac` is already a fraction (0.10 = +10%).
 * Accumulates on staminaFactor (starts at 1), like the game — do not round to int each tick.
 * @param {CombatPiece} piece
 * @param {number} frac
 */
export function multiplyStaminaCost(piece, frac) {
  const f = Number(frac) || 0;
  if (!f) return;
  if (!Number.isFinite(Number(piece.baseStaminaCost))) {
    piece.baseStaminaCost = Number(piece.staminaCost) || 0;
  }
  const cur = Number(piece.staminaFactor);
  piece.staminaFactor = Math.max(0, (Number.isFinite(cur) ? cur : 1) + f);
  refreshStaminaCost(piece);
  recordPieceMod(piece, { stat: 'stamina', amount: f, unit: 'factor' });
}

/**
 * @param {CombatPiece} piece
 * @param {number} next
 */
export function setStaminaCost(piece, next) {
  const n = Math.max(0, Number(next) || 0);
  const prev = Number(piece.staminaCost) || 0;
  piece.baseStaminaCost = n;
  refreshStaminaCost(piece);
  const delta = (Number(piece.staminaCost) || 0) - prev;
  if (Math.abs(delta) < 1e-6) return;
  recordPieceMod(piece, { stat: 'stamina', amount: delta, unit: 'flat' });
}

/**
 * Snapshot fields for tip merge + scrubber.
 * @param {CombatPiece} piece
 * @param {{ heat?: number, cold?: number, empower?: number, lucky?: number, blind?: number } | null} [stacks]
 */
export function snapshotPieceStats(piece, stacks = null, opts = {}) {
  const dmg = modifiedDamageRange(piece, stacks);
  return {
    itemId: piece.itemId,
    damageMin: dmg.min,
    damageMax: dmg.max,
    damageBonus: 0,
    bonusDamage: Number(piece.bonusDamage) || 0,
    bonusAccuracy: Number(piece.bonusAccuracy) || 0,
    speedScale: Number(piece.speedScale) || 0,
    baseCooldown: Number(piece.baseCooldown ?? piece.cooldown) || 0,
    cooldown: modifiedCooldown(piece, stacks),
    loopCd: Number(piece.cooldown) || 0,
    // Engine triggerTime is iteration units; chrome expects wall-clock remaining
    // (Item._physics_process subtracts delta×speed — remaining wall = trig/speed).
    triggerTime: (() => {
      const trig = Number(piece.triggerTime);
      if (!Number.isFinite(trig) || trig >= 500 || !(trig > 0)) return trig;
      const spd = pieceSpeed(piece, stacks);
      return spd > 0 ? trig / spd : trig;
    })(),
    staminaCost: piece.staminaCost,
    accuracy: modifiedAccuracy(piece, stacks),
    chance: effectiveChance(piece),
    chanceBase: Number(piece.chance) || 0,
    chanceRolls: Number(piece.chanceRolls) || 0,
    chanceProcs: Number(piece.chanceProcs) || 0,
    critChance: Math.max(0, Number(piece.critChance) || 0),
    bonusDamageFactor: Number(piece.bonusDamageFactor) || 1,
    statMods: summarizeStatMods(piece, stacks, opts),
    empowerable: piece.empowerable !== false,
    kind: piece.kind,
    revealing: !!piece._revealing,
    revealed: !!piece._revealed,
    chainPos: Number.isFinite(Number(piece._chainPos)) ? Number(piece._chainPos) : -1,
    secondaryActive: !!piece._secondaryActive,
  };
}

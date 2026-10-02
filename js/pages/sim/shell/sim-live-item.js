/**
 * Merge catalog item tip stats with sim combat-modified Damage / CD / Accuracy / Chance.
 */

import {
  isAfterBasedItem,
  phaseListForItem,
  rewriteEffectCooldown,
} from '../../create/board-live-stats.js';

/**
 * @param {{ t: number, byKey: Record<string, object> }[] | undefined} pieceSnapshots
 * @param {number} t
 * @param {string} placementKey
 */
export function pieceSnapAt(pieceSnapshots, t, placementKey) {
  if (!Array.isArray(pieceSnapshots) || !pieceSnapshots.length || !placementKey) {
    return null;
  }
  let best = null;
  for (const snap of pieceSnapshots) {
    if (snap.t <= t + 1e-6) best = snap;
    else break;
  }
  return best?.byKey?.[placementKey] || null;
}

/**
 * @param {number} n
 */
function fmtChancePct(n) {
  const x = Math.round(Number(n) * 100) / 100;
  if (!Number.isFinite(x)) return '';
  return Number.isInteger(x) ? String(x) : String(x);
}

/**
 * Rewrite baked catalog `N%` chance in effect text to live (tinted) value.
 * @param {string} effect
 * @param {number} baseChance
 * @param {number} liveChance
 */
function rewriteEffectChance(effect, baseChance, liveChance) {
  const text = String(effect || '');
  if (!text || !(baseChance > 0)) return text;
  const baseStr = fmtChancePct(baseChance);
  if (!baseStr) return text;
  const liveStr = fmtChancePct(liveChance);
  if (!liveStr) return text;
  const re = new RegExp(`(?<![\\d.])${baseStr.replace(/\./g, '\\.')}%`, 'g');
  const delta = liveChance - baseChance;
  if (Math.abs(delta) < 1e-4) return text;
  const tint = delta > 0 ? 'green' : 'red';
  return text.replace(re, `{${tint}}${liveStr}%{/${tint}}`);
}

/**
 * Scale multi-phase catalog CDs by the same speed ratio as primary live CD.
 * @param {number[]} phases
 * @param {number} baseCd
 * @param {number} liveCd
 */
function scalePhases(phases, baseCd, liveCd) {
  if (!phases.length) return [];
  if (!(baseCd > 0) || !(liveCd > 0)) {
    return phases.map(() => Math.round(liveCd * 100) / 100);
  }
  const ratio = liveCd / baseCd;
  return phases.map((p) => Math.round(Math.max(0.35, p * ratio) * 100) / 100);
}

/**
 * @param {object | null | undefined} catalogItem
 * @param {object | null | undefined} live from pieceSnapshots (already includes empower/luck/heat)
 * @param {number} [_t]
 * @param {{ placementCounters?: Record<string, number> | null }} [extra]
 */
export function mergeLiveItemStats(catalogItem, live, _t, extra = {}) {
  if (!catalogItem) return null;
  const counters = extra.placementCounters || null;
  const withCounters = (out) => {
    if (counters) out.placementCounters = counters;
    return out;
  };

  if (!live) return withCounters({ ...catalogItem });

  // Ignore a snapshot from a different piece (e.g. hovered sprite walked up to a bag).
  if (live.itemId && catalogItem.id && String(live.itemId) !== String(catalogItem.id)) {
    return withCounters({ ...catalogItem });
  }

  const out = { ...catalogItem };
  const baseChance = Number(catalogItem.chance);
  const catalogCd = Number(catalogItem.cooldown);
  const baseCdRaw = Number(live.baseCooldown);
  const baseCd =
    Number.isFinite(baseCdRaw) && baseCdRaw > 0 && baseCdRaw < 500
      ? baseCdRaw
      : Number.isFinite(catalogCd) && catalogCd > 0 && catalogCd < 500
        ? catalogCd
        : 0;

  out.catalogStats = {
    damageMin: Number(catalogItem.damageMin ?? catalogItem.damage_min),
    damageMax: Number(catalogItem.damageMax ?? catalogItem.damage_max),
    cooldown: baseCd || catalogCd,
    staminaCost: Number(catalogItem.staminaCost ?? catalogItem.stamina_cost),
    accuracy: Number(catalogItem.accuracy),
    chance: Number.isFinite(baseChance) ? baseChance : NaN,
    critChance: 0,
  };

  const dMin = Number(live.damageMin);
  const dMax = Number(live.damageMax);
  if (Number.isFinite(dMin) || Number.isFinite(dMax)) {
    out.damageMin = Math.max(0, Number.isFinite(dMin) ? dMin : dMax);
    out.damageMax = Math.max(0, Number.isFinite(dMax) ? dMax : dMin);
  }

  const cd = Number(live.cooldown);
  const hasCombatCd = Number.isFinite(cd) && cd > 0 && cd < 500;
  const afterBased = isAfterBasedItem(catalogItem);
  if (hasCombatCd) {
    out.cooldown = Math.round(cd * 100) / 100;
    // Game: After-based items (Lab, multi-phase potions) keep times in effect only.
    // Every-based non-weapons still get a live Cooldown row when combat-modified.
    if (!afterBased) {
      out.showCooldownRow = true;
    }

    const phases = phaseListForItem(catalogItem);
    const catalogPhases =
      phases.length > 1 ? phases : baseCd > 0 ? [baseCd] : [];
    if (!afterBased && catalogPhases.length > 1) {
      out.extraCooldownsCatalog = catalogPhases;
      out.extraCooldownsLive = scalePhases(
        catalogPhases,
        baseCd || catalogPhases[0],
        out.cooldown,
      );
    }

    if (catalogPhases.length > 1) {
      const livePhases = afterBased
        ? scalePhases(catalogPhases, baseCd || catalogPhases[0], out.cooldown)
        : out.extraCooldownsLive || [];
      const pairs = catalogPhases
        .map((b, i) => ({
          base: b,
          live: livePhases[i] ?? out.cooldown,
        }))
        .filter((p) => Math.abs(p.live - p.base) > 1e-4)
        .sort((a, b) => String(b.base).length - String(a.base).length);
      let effect = String(out.effect || '');
      for (const pair of pairs) {
        effect = rewriteEffectCooldown(effect, pair.base, pair.live);
      }
      out.effect = effect;
    } else if (baseCd > 0 && Math.abs(out.cooldown - baseCd) > 1e-4) {
      out.effect = rewriteEffectCooldown(String(out.effect || ''), baseCd, out.cooldown);
    }
  }

  const type = String(out.type || '');
  const extras = Array.isArray(out.extraTypes)
    ? out.extraTypes
    : Array.isArray(out.extra_types)
      ? out.extra_types
      : [];
  const isWeapon =
    /weapon/i.test(type) || extras.some((t) => /^weapon$/i.test(String(t)));
  const acc = Number(live.accuracy);
  if (isWeapon && Number.isFinite(acc)) {
    out.accuracy = Math.round(acc * 10) / 10;
  }

  const stam = Number(live.staminaCost);
  if (Number.isFinite(stam) && stam >= 0) {
    out.staminaCost = stam;
  }

  const liveChance = Number(live.chance);
  if (Number.isFinite(liveChance) && Number.isFinite(baseChance) && baseChance > 0) {
    out.chance = Math.round(liveChance * 100) / 100;
    out.effect = rewriteEffectChance(out.effect, baseChance, out.chance);
  }

  // Runtime critChancePercent (accessories / auras) — not CSV `chance`.
  const liveCrit = Number(live.critChance);
  if (Number.isFinite(liveCrit) && liveCrit > 0) {
    out.critChance = Math.round(liveCrit * 10) / 10;
  }

  if (Array.isArray(live.statMods) && live.statMods.length) {
    out.statMods = live.statMods;
  }

  const rolls = Number(live.chanceRolls) || 0;
  const procs = Number(live.chanceProcs) || 0;
  if (rolls > 0) {
    out.chanceRolls = rolls;
    out.chanceProcs = procs;
  }

  return withCounters(out);
}

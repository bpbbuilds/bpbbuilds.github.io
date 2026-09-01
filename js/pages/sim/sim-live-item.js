/**
 * Merge catalog item tip stats with sim combat-modified Damage / CD / Accuracy / Chance.
 */

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
 * @param {object | null | undefined} catalogItem
 * @param {object | null | undefined} live from pieceSnapshots (already includes empower/luck/heat)
 * @param {number} [_t]
 */
export function mergeLiveItemStats(catalogItem, live, _t) {
  if (!catalogItem) return null;
  if (!live) return catalogItem;

  // Ignore a snapshot from a different piece (e.g. hovered sprite walked up to a bag).
  if (live.itemId && catalogItem.id && String(live.itemId) !== String(catalogItem.id)) {
    return catalogItem;
  }

  const out = { ...catalogItem };
  const baseChance = Number(catalogItem.chance);
  out.catalogStats = {
    damageMin: Number(catalogItem.damageMin ?? catalogItem.damage_min),
    damageMax: Number(catalogItem.damageMax ?? catalogItem.damage_max),
    cooldown: Number(catalogItem.cooldown),
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
  if (Number.isFinite(cd) && cd > 0 && cd < 500) {
    out.cooldown = Math.round(cd * 100) / 100;
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

  return out;
}

/**
 * Socketed gems modify host combat stats (catalog numbers).
 *
 * Catalog `block` on coal gems is **armor-socket only** (LumpofCoal /
 * BurningCoal `combatStartArmor`). Weapon sockets use on-hit damage instead.
 */

/**
 * @typedef {{
 *   damageBonus: number,
 *   accuracyBonus: number,
 *   staminaDelta: number,
 *   blockBonus: number,
 *   gemNames: string[],
 * }} GemMods
 */

/**
 * @param {string[] | undefined} gemIds
 * @param {Map<string, object>} itemsById
 * @param {{ hostKind?: 'weapon' | 'armor' | 'other' }} [opts]
 * @returns {GemMods}
 */
export function gemModsFor(gemIds, itemsById, opts = {}) {
  /** @type {GemMods} */
  const mods = {
    damageBonus: 0,
    accuracyBonus: 0,
    staminaDelta: 0,
    blockBonus: 0,
    gemNames: [],
  };
  const hostKind = opts.hostKind || 'other';
  if (!Array.isArray(gemIds)) return mods;
  for (const gid of gemIds) {
    if (!gid) continue;
    const gem = itemsById.get(gid);
    if (!gem) continue;
    mods.gemNames.push(String(gem.name || gid));
    const dMin = Number(gem.damageMin);
    const dMax = Number(gem.damageMax);
    if (Number.isFinite(dMin) || Number.isFinite(dMax)) {
      const a = Number.isFinite(dMin) ? dMin : dMax;
      const b = Number.isFinite(dMax) ? dMax : dMin;
      mods.damageBonus += Math.round((a + b) / 2);
    }
    if (Number.isFinite(Number(gem.accuracy))) {
      mods.accuracyBonus += Number(gem.accuracy) > 100
        ? Number(gem.accuracy) - 100
        : Math.max(0, Number(gem.accuracy) - 90);
    }
    if (Number.isFinite(Number(gem.staminaCost))) {
      mods.staminaDelta += Number(gem.staminaCost);
    }
    // Game GemMode.Weapon never applies catalog block (coal → on-hit dmg instead)
    if (hostKind !== 'weapon' && Number.isFinite(Number(gem.block))) {
      mods.blockBonus += Math.round(Number(gem.block));
    }
  }
  return mods;
}

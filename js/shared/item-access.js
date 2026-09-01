/**
 * Create-page item access — loose class rules.
 * Hard-block Class Uniques / wrong-class skills; soft-warn other-class shop items.
 * Does not track badge ownership (sold unlockers are OK).
 */

/** ItemDescriptor.StuffedClasses — keep in sync with filter-logic CLASS_BITS. */
export const ACCESS_CLASS_BITS = {
  None: 0,
  Ranger: 1,
  Reaper: 2,
  Berserker: 4,
  Pyromancer: 8,
  Mage: 16,
  Adventurer: 32,
  Engineer: 64,
  Neutral: 127,
};

/**
 * Dual-shop Unique skills. Game `shop` is e.g. "Pyromancer,Engineer 1";
 * DB `items.class` stores only the first name, so Engineer + Energy Conversion
 * would fail without this (keep in sync with submit-build).
 */
export const STUFFED_CLASS_MASK_OVERRIDES = {
  critical_poison: 3,
  burning_spikes: 12,
  hogus_bogus: 48,
  spin_to_win: 96,
  energy_conversion: 72,
  inner_power: 5,
  bewitchment: 18,
};

/**
 * @typedef {'ok' | 'soft-cross-class' | 'illegal-class-unique' | 'illegal-skill'} AccessVerdict
 */

/**
 * @param {string | null | undefined} hero
 * @returns {number}
 */
export function heroClassBit(hero) {
  const key = String(hero || '').trim();
  const bit = ACCESS_CLASS_BITS[key];
  return typeof bit === 'number' && bit > 0 && bit !== ACCESS_CLASS_BITS.Neutral
    ? bit
    : 0;
}

/**
 * @param {object | null | undefined} item
 * @returns {number}
 */
export function itemClassMask(item) {
  if (!item) return ACCESS_CLASS_BITS.None;
  if (typeof item.classMask === 'number') return item.classMask;
  const id = String(item.id || '');
  if (id && STUFFED_CLASS_MASK_OVERRIDES[id] != null) {
    return STUFFED_CLASS_MASK_OVERRIDES[id];
  }
  return fallbackClassMask(item);
}

/**
 * @param {object | null | undefined} item
 * @returns {number}
 */
function fallbackClassMask(item) {
  const raw = item?.class;
  const parts = Array.isArray(raw)
    ? raw.map((c) => String(c || '').trim()).filter(Boolean)
    : String(raw || '')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
  if (parts.length === 1 && parts[0] === 'Neutral') return ACCESS_CLASS_BITS.Neutral;
  let bits = 0;
  for (const c of parts) {
    if (c === 'Neutral') continue;
    bits |= ACCESS_CLASS_BITS[c] || 0;
  }
  return bits || ACCESS_CLASS_BITS.None;
}

/**
 * Class Unique = Unique rarity that is not a treasure Unique.
 * @param {object | null | undefined} item
 * @returns {boolean}
 */
export function isClassUniqueItem(item) {
  if (!item || String(item.rarity || '') !== 'Unique') return false;
  if (typeof item.isTreasure === 'boolean') return !item.isTreasure;
  return true;
}

/**
 * @param {object | null | undefined} item
 * @returns {boolean}
 */
export function isSkillItem(item) {
  return String(item?.type || '') === 'Skill';
}

/**
 * Does this item’s class mask include the hero (or Neutral / None)?
 * @param {string | null | undefined} hero
 * @param {object | null | undefined} item
 * @returns {boolean}
 */
export function itemMatchesHero(hero, item) {
  const mask = itemClassMask(item);
  if (mask === ACCESS_CLASS_BITS.Neutral || mask === ACCESS_CLASS_BITS.None) {
    return true;
  }
  const bit = heroClassBit(hero);
  if (!bit) return true;
  return (mask & bit) > 0;
}

/**
 * @param {string | null | undefined} hero
 * @param {object | null | undefined} item
 * @returns {AccessVerdict}
 */
export function accessVerdict(hero, item) {
  if (!item) return 'ok';
  const matches = itemMatchesHero(hero, item);
  if (matches) return 'ok';

  if (isSkillItem(item)) return 'illegal-skill';
  if (isClassUniqueItem(item)) return 'illegal-class-unique';
  return 'soft-cross-class';
}

/**
 * @param {AccessVerdict} verdict
 * @returns {boolean}
 */
export function isHardIllegalAccess(verdict) {
  return verdict === 'illegal-class-unique' || verdict === 'illegal-skill';
}

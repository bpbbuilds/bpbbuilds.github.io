/**
 * Classify catalog items for sim systems (cards, pets, spells, armor, …).
 */

/**
 * @param {object | null | undefined} item
 */
export function isBagLike(item) {
  if (!item) return false;
  const t = String(item.type || '').toLowerCase();
  return t.includes('bag') || item.extraTypes?.includes?.('Bag');
}

/**
 * @param {object} item
 * @param {string} needle
 */
function hasType(item, needle) {
  const n = needle.toLowerCase();
  if (String(item.type || '').toLowerCase().includes(n)) return true;
  const extra = item.extraTypes;
  if (Array.isArray(extra) && extra.some((x) => String(x).toLowerCase().includes(n))) {
    return true;
  }
  const tags = item.tags;
  if (Array.isArray(tags) && tags.some((x) => String(x).toLowerCase().includes(n))) {
    return true;
  }
  return false;
}

/**
 * @param {object} item
 */
export function itemKind(item) {
  if (!item || isBagLike(item)) return 'bag';
  if (hasType(item, 'card')) return 'card';
  if (hasType(item, 'skill') || hasType(item, 'spell') || hasType(item, 'book')) {
    const cd = Number(item.cooldown);
    if (Number.isFinite(cd) && cd > 0) return 'gadget';
    return 'passive';
  }
  if (hasType(item, 'pet')) return 'pet';
  if (hasType(item, 'gem')) return 'gem';
  if (
    hasType(item, 'spell') ||
    hasType(item, 'scroll') ||
    hasType(item, 'consumable') ||
    hasType(item, 'potion') ||
    hasType(item, 'food')
  ) {
    return 'consumable';
  }
  const dMin = Number(item.damageMin);
  const dMax = Number(item.damageMax);
  const hasDamage =
    (Number.isFinite(dMin) && dMin > 0) || (Number.isFinite(dMax) && dMax > 0);
  const cd = Number(item.cooldown);
  // Catalog `block` alone is not armor (Cog / badges use it for giveBlock scripts).
  // Flat DR only for typed armor / shields — otherwise Cog gets DR 1 forever.
  if (hasType(item, 'shield') || hasType(item, 'armor')) return 'armor';
  if (Number.isFinite(cd) && cd > 0) return hasDamage ? 'weapon' : 'gadget';
  if (hasDamage) return 'weapon';
  return 'passive';
}

/**
 * DamageSource.setItem: Item.Type.Ranged → Type.Ranged (rangedVampirismLimit 0).
 * @param {object | null | undefined} item
 * @returns {'melee'|'ranged'}
 */
export function damageKindFromItem(item) {
  if (!item) return 'melee';
  const ranged = hasType(item, 'ranged');
  const melee = hasType(item, 'melee');
  if (ranged && !melee) return 'ranged';
  if (melee) return 'melee';
  if (ranged) return 'ranged';
  return 'melee';
}

/**
 * @param {{ damageKind?: string } | null | undefined} piece
 */
export function pieceIsMelee(piece) {
  return piece?.damageKind !== 'ranged';
}

/**
 * @param {object} item
 */
export function isVampiric(item) {
  if (!item) return false;
  if (hasType(item, 'vampir')) return true;
  const effect = String(item.effect || '');
  return /vampir|lifesteal/i.test(effect);
}

/**
 * @param {object} item
 */
export function rarityPriority(item) {
  const rank = {
    Common: 0,
    Rare: 1,
    Epic: 2,
    Legendary: 3,
    Godly: 4,
    Unique: 5,
  };
  return rank[item?.rarity] ?? 0;
}

/**
 * Effect-text stack hints (catalog fallback until scripts).
 * @param {object} item
 * @returns {string[]}
 */
export function effectStackHints(item) {
  const text = String(item?.effect || '');
  /** @type {string[]} */
  const out = [];
  for (const name of [
    'Poison',
    'Regeneration',
    'Heat',
    'Cold',
    'Blind',
    'Spikes',
    'Vampirism',
    'Empower',
    'Lucky',
    'Mana',
    'Block',
  ]) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(text)) out.push(name.toLowerCase());
  }
  return out;
}

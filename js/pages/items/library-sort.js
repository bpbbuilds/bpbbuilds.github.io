/**
 * Item Library sort — mirrors game ItemLibrary.getSortScore.
 *
 * Game calls Util.sortArrayByDict_reverse, whose comparator is
 * `score(a) < score(b)` → **lower score first** (Commons / early items at top).
 *
 * Grouping modes only change the primary multiplier (Price / Version / Class);
 * Rarity and None share the same base score terms.
 */

const RARITY_SCORE = {
  Common: 0,
  Rare: 1,
  Epic: 2,
  Legendary: 3,
  Godly: 4,
  Unique: 5,
};

/** ItemDescriptor.StuffedClasses bit values */
const CLASS_BITS = {
  Ranger: 1,
  Reaper: 2,
  Berserker: 4,
  Pyromancer: 8,
  Mage: 16,
  Adventurer: 32,
  Engineer: 64,
  Neutral: 127,
  None: 0,
};

const NEUTRAL = CLASS_BITS.Neutral;

/**
 * Game.versionToInt — "1.1.7" → 1001007
 * @param {string | number | null | undefined} ver
 */
export function versionToInt(ver) {
  if (ver == null || ver === '') return 0;
  if (typeof ver === 'number' && Number.isFinite(ver)) return Math.trunc(ver);
  const parts = String(ver).trim().split('.');
  const a = parseInt(parts[0], 10) || 0;
  const b = parseInt(parts[1], 10) || 0;
  const c = parseInt(parts[2], 10) || 0;
  return a * 1000000 + b * 1000 + c;
}

/**
 * @param {string} rawClass
 */
function stuffedClassesFromString(rawClass) {
  const parts = String(rawClass || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length || (parts.length === 1 && parts[0] === 'Neutral')) {
    return NEUTRAL;
  }
  let bits = 0;
  for (const c of parts) {
    if (c === 'Neutral') continue;
    bits |= CLASS_BITS[c] || 0;
  }
  return bits || CLASS_BITS.None;
}

/**
 * Prefer game class mask from item-class-masks.json.
 * @param {object} item
 */
export function itemClassMask(item) {
  if (typeof item.classMask === 'number') return item.classMask;
  return stuffedClassesFromString(item.class);
}

/**
 * Pack / line-break key — mirrors ItemLibrary.addItem group comparisons.
 * @param {object} item
 * @param {string} grouping
 */
export function groupBreakKey(item, grouping) {
  switch (grouping) {
    case 'rarity':
      return RARITY_SCORE[item.rarity] ?? 50;
    case 'price':
      return Number(item.cost) || 0;
    case 'version':
      return versionToInt(item.gameVersion ?? item.version);
    case 'class':
      return itemClassMask(item);
    default:
      return 0;
  }
}

/**
 * @param {object} item — mapped catalog item
 * @param {{
 *   craftedIds?: Set<string>,
 *   gatedIds?: Set<string>,
 *   itemCount?: number,
 *   grouping?: string,
 * }} [opts]
 */
export function librarySortScore(item, opts = {}) {
  const craftedIds = opts.craftedIds;
  const gatedIds = opts.gatedIds;
  const itemCount = Math.max(1, opts.itemCount || 1);
  const grouping = opts.grouping || 'none';
  const type = String(item.type || '');
  const extra = Array.isArray(item.extraTypes) ? item.extraTypes : [];
  const has = (t) => type === t || type.includes(t) || extra.includes(t);

  let score = 0;

  // Primary grouping multipliers (ItemLibrary.getSortScore)
  if (grouping === 'price') {
    score += (Number(item.cost) || 0) * 1000000;
  } else if (grouping === 'version') {
    score += -versionToInt(item.gameVersion ?? item.version) * 1000000;
  }

  score += (RARITY_SCORE[item.rarity] ?? 0) * 100000;

  if (type === 'Bag' || has('Bag')) {
    score += 20000;
  }

  const classes = itemClassMask(item);
  const isSkill = type === 'Skill' || has('Skill');

  if (grouping === 'class') {
    score += classes * 1000000;
  } else if (classes !== NEUTRAL) {
    score += isSkill ? classes * 0.01 : classes * 1000;
  }

  if (craftedIds?.has(item.id)) {
    score += 100;
  }
  if (gatedIds?.has(item.id)) {
    score += 90;
  }

  const isMeleeWeapon = type === 'Melee Weapon' || (has('Melee') && has('Weapon'));
  const isRangedWeapon = type === 'Ranged Weapon' || (has('Ranged') && has('Weapon'));

  if (isMeleeWeapon) {
    score -= 2;
  } else if (isRangedWeapon) {
    score -= 1;
  } else if (type === 'Shield' || has('Shield')) {
    score += 1;
  } else if (type === 'Armor' || has('Armor')) {
    score += 2;
  } else if (type === 'Accessory' || has('Accessory')) {
    score += 4;
  } else if (isSkill) {
    // appearRounds not in DB — mid skill penalty (game: -1 / -2 / -3)
    score -= 1;
  } else {
    score += 3;
  }

  const index = item.gid != null ? Number(item.gid) : itemCount;
  score += (index / itemCount) * 0.1;

  return score;
}

/**
 * @param {object[]} items
 * @param {{
 *   craftedIds?: Set<string>,
 *   gatedIds?: Set<string>,
 *   grouping?: string,
 * }} [opts]
 * @returns {object[]} new array, library order (low score first — matches game)
 */
export function sortByItemLibrary(items, opts = {}) {
  const itemCount = Math.max(
    1,
    ...items.map((i) => (i.gid != null ? Number(i.gid) + 1 : 0)),
    items.length,
  );
  const scored = items.map((item, i) => ({
    item,
    i,
    score: librarySortScore(item, { ...opts, itemCount }),
  }));
  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.i - b.i;
  });
  return scored.map((s) => s.item);
}

/**
 * Simulate Backpack Battles Item Library membership + getSortScore (Grouping.None).
 * Used by compute-library-layout.mjs for 1:1 catalog order.
 */

export const RARITY = {
  Common: 0,
  Rare: 1,
  Epic: 2,
  Legendary: 3,
  Godly: 4,
  Unique: 5,
};

export const CLASS = {
  Undefined: -1,
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

const SKILL_ROUND1 = 3;

/**
 * @param {string} raw stuffed enum name(s) e.g. "Ranger" or "Ranger,Reaper"
 */
export function parseStuffedClasses(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  let bits = 0;
  for (const part of s.split(',')) {
    const name = part.trim();
    if (name in CLASS) bits |= CLASS[name];
  }
  return bits;
}

/**
 * Initial classes + skill appear round numbers from ItemData shop column.
 * @returns {{ classes: number, appearRounds: number[], treasure: boolean }}
 */
export function classesFromShop(shop, type) {
  const s = String(shop ?? '').trim();
  const isSkill = String(type || '') === 'Skill';

  if (s === '') {
    return { classes: CLASS.Neutral, appearRounds: [], treasure: false };
  }
  if (s === 'no') {
    return { classes: CLASS.None, appearRounds: [], treasure: false };
  }
  if (s === 'unique' || s === 'special') {
    return {
      classes: CLASS.Neutral,
      appearRounds: [],
      treasure: s === 'unique',
    };
  }
  if (s.includes('>')) {
    const className = s.split('>')[0].trim();
    return {
      classes: CLASS[className] || CLASS.None,
      appearRounds: [],
      treasure: false,
    };
  }
  if (isSkill && /\d/.test(s) && s.includes(' ')) {
    const [classPart, roundPart] = s.split(/\s+/);
    let classes = CLASS.None;
    for (const c of classPart.split(',')) {
      classes |= CLASS[c.trim()] || 0;
    }
    const appearRounds = (roundPart || '')
      .split(',')
      .map((x) => Number(x.trim()))
      .filter((n) => n === 1 || n === 2)
      .map((n) => (n === 1 ? SKILL_ROUND1 : 10));
    return { classes, appearRounds, treasure: false };
  }
  if (CLASS[s] != null) {
    return { classes: CLASS[s], appearRounds: [], treasure: false };
  }
  // "Ranger,Reaper" without rounds
  if (s.includes(',')) {
    let classes = CLASS.None;
    for (const c of s.split(',')) classes |= CLASS[c.trim()] || 0;
    return { classes, appearRounds: [], treasure: false };
  }
  return { classes: CLASS.Neutral, appearRounds: [], treasure: false };
}

/**
 * Build library descriptors from game-items + recipes (+ optional class_override map).
 *
 * @param {object[]} items game-items.json items
 * @param {{ resultName: string, ingredientNames: string[] }[]} recipes
 * @param {Map<string, string>} [classOverrides] internalName → stuffed string
 */
export function buildLibraryDescriptors(items, recipes, classOverrides = new Map()) {
  /** @type {Map<string, object>} */
  const byName = new Map();
  for (const it of items) {
    const key = it.internalName || it.name;
    const shopInfo = classesFromShop(it.shop, it.type);
    byName.set(key, {
      id: it.id,
      gid: it.gid,
      name: key,
      displayName: it.displayName || key,
      rarity: it.rarity || 'Common',
      type: it.type || '',
      extraTypes: it.extraTypes || [],
      shop: it.shop || '',
      gateItem: it.gateItem || null,
      releaseState: it.releaseState || 'demo',
      shape: it.shape,
      classes: shopInfo.classes,
      appearRounds: shopInfo.appearRounds,
      treasure: shopInfo.treasure,
      originating: /** @type {string[][]} */ ([]),
      crafted: false,
      gated: Boolean(it.gateItem),
    });
  }

  // Recipes: owner recipes produce results → originating for result
  for (const r of recipes) {
    const result = r.resultName;
    const ings = r.ingredientNames || [];
    if (!result || !byName.has(result)) continue;
    byName.get(result).originating.push(ings);
  }

  // Cauldron: Potion → Strong Potion
  for (const it of items) {
    if (it.type !== 'Potion') continue;
    const strongName = `Strong ${it.internalName || it.name}`;
    if (!byName.has(strongName)) continue;
    const baseName = it.internalName || it.name;
    byName.get(strongName).originating.push([baseName, 'Cauldron']);
  }

  for (const d of byName.values()) {
    d.crafted = d.originating.length > 0;
  }

  function craftingDepth(name, seen = new Set()) {
    const d = byName.get(name);
    if (!d || !d.originating.length) return 0;
    if (seen.has(name)) return 0;
    seen.add(name);
    let depth = 0;
    for (const ings of d.originating) {
      for (const ing of ings) {
        if (!byName.has(ing)) continue;
        depth = Math.max(depth, craftingDepth(ing, seen));
      }
    }
    return depth + 1;
  }

  const depths = [...byName.keys()]
    .map((name) => ({ name, depth: craftingDepth(name) }))
    .sort((a, b) => a.depth - b.depth);

  for (const { name } of depths) {
    const d = byName.get(name);
    if (d.gateItem && byName.has(d.gateItem) && d.classes === CLASS.None) {
      d.classes = byName.get(d.gateItem).classes;
    }
    if (d.originating.length) {
      if (d.classes === CLASS.Undefined) d.classes = CLASS.None;
      for (const ings of d.originating) {
        let recipeClasses = CLASS.Neutral;
        for (const ing of ings) {
          const idesc = byName.get(ing);
          if (!idesc) continue;
          recipeClasses &= idesc.classes;
        }
        d.classes |= recipeClasses;
      }
    }
    if (d.classes === CLASS.Undefined) d.classes = CLASS.None;
  }

  // class_override last (ItemBook)
  for (const [name, raw] of classOverrides) {
    const d = byName.get(name);
    const bits = parseStuffedClasses(raw);
    if (d && bits != null) d.classes = bits;
  }

  return byName;
}

/**
 * Default ItemLibrary.refresh() membership (all origin/class/rarity toggles on).
 * Origin always passes when Shop+Crafted+Gated are on; class filter drops
 * shop=no items left at classes=None after calcClassAvailability.
 */
export function passesDefaultLibraryFilter(d) {
  if (d.releaseState === 'unreleased') return false;
  if (d.classes === CLASS.Neutral) return true;
  if (d.classes === CLASS.None || d.classes === 0) return false;
  return true;
}

/**
 * getSortScore — Grouping.None. Lower sorts first (sort_reverse).
 */
export function librarySortScore(d, itemCount) {
  let score = 0;
  score += (RARITY[d.rarity] ?? 0) * 100000;

  if (d.type === 'Bag') score += 20000;

  if (d.classes !== CLASS.Neutral) {
    if (d.type === 'Skill') score += d.classes * 0.01;
    else score += d.classes * 1000;
  }

  if (d.crafted) score += 100;
  if (d.gated) score += 90;

  const extras = d.extraTypes || [];
  const has = (t) => d.type === t || d.type.includes(t) || extras.includes(t);
  const melee = d.type === 'Melee Weapon' || (has('Melee') && has('Weapon'));
  const ranged = d.type === 'Ranged Weapon' || (has('Ranged') && has('Weapon'));

  if (melee) score -= 2;
  else if (ranged) score -= 1;
  else if (d.type === 'Shield' || has('Shield')) score += 1;
  else if (d.type === 'Armor' || has('Armor')) score += 2;
  else if (d.type === 'Accessory' || has('Accessory')) score += 4;
  else if (d.type === 'Skill') {
    const rounds = d.appearRounds || [];
    if (rounds[0] === SKILL_ROUND1) {
      score -= rounds.length === 2 ? 2 : 3;
    } else {
      score -= 1;
    }
  } else {
    score += 3;
  }

  const index = d.gid != null ? Number(d.gid) : itemCount;
  score += (index / Math.max(1, itemCount)) * 0.1;
  return score;
}

/**
 * @param {Map<string, object>} byName
 * @returns {object[]} descriptors in library pack order
 */
export function sortLibraryDescriptors(byName) {
  const list = [...byName.values()].filter(passesDefaultLibraryFilter);
  const itemCount = Math.max(
    1,
    ...list.map((d) => (d.gid != null ? Number(d.gid) + 1 : 0)),
    byName.size,
  );
  list.sort((a, b) => {
    const sa = librarySortScore(a, itemCount);
    const sb = librarySortScore(b, itemCount);
    if (sa !== sb) return sa - sb;
    return (a.gid ?? 0) - (b.gid ?? 0);
  });
  return list;
}

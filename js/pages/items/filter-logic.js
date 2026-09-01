/**
 * Item Library filter state + matching (game semantics).
 */

import { groupBreakKey, sortByItemLibrary } from './library-sort.js';

export const RARITY_CORE = ['Common', 'Rare', 'Epic', 'Legendary', 'Godly'];

/** Display order matches game Item Library (Neutral → … → Engineer). */
export const CLASS_ORDER = [
  'Neutral',
  'Ranger',
  'Reaper',
  'Pyromancer',
  'Berserker',
  'Mage',
  'Adventurer',
  'Engineer',
];

/** Playable hero classes for builds (Neutral is item affinity, not a hero). */
export const HERO_CLASSES = CLASS_ORDER.filter((c) => c !== 'Neutral');

/** ItemDescriptor.StuffedClasses bit values (Neutral = all class bits). */
export const CLASS_BITS = {
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

export const TYPE_ORDER = [
  'Melee',
  'Ranged',
  'Effect',
  'Nature',
  'Magic',
  'Holy',
  'Dark',
  'Vampiric',
  'Fire',
  'Ice',
  'Musical',
];

export const BUFF_ORDER = [
  'Block',
  'Regeneration',
  'Lucky',
  'Spikes',
  'Vampirism',
  'Mana',
  'Heat',
  'Empower',
];

export const DEBUFF_ORDER = ['Poison', 'Blind', 'Cold'];

export const GROUPING_OPTS = [
  { id: 'none', label: 'No Grouping' },
  { id: 'rarity', label: 'Group by Rarity' },
  { id: 'price', label: 'Group by Price' },
  { id: 'version', label: 'Group by Version' },
  { id: 'class', label: 'Group by Class' },
];

/** Homepage / deep-link category keys → Item Library focus. */
export const ITEM_CATEGORY_IDS = [
  'weapons',
  'armor',
  'bags',
  'skills',
  'treasures',
];

/**
 * @param {string | null | undefined} raw
 * @returns {string | null}
 */
export function normalizeItemCategory(raw) {
  const key = String(raw || '')
    .trim()
    .toLowerCase();
  return ITEM_CATEGORY_IDS.includes(key) ? key : null;
}

/**
 * Primary-kind match for `?category=` (not affinity TYPE_ORDER toggles).
 * @param {object} item
 * @param {string | null | undefined} category
 * @param {Set<string>} [treasureIds]
 */
export function itemMatchesCategory(item, category, treasureIds) {
  const cat = normalizeItemCategory(category);
  if (!cat) return true;
  const type = String(item.type || '').trim();
  const extras = Array.isArray(item.extraTypes) ? item.extraTypes : [];
  const hasExtra = (name) => extras.some((t) => String(t) === name);

  if (cat === 'weapons') return /Weapon/i.test(type);
  if (cat === 'armor') {
    // Body armor, shields, helmets, boots (game type "Shoes")
    return (
      type === 'Armor' ||
      type === 'Shield' ||
      type === 'Helmet' ||
      type === 'Shoes' ||
      hasExtra('Armor') ||
      hasExtra('Shield') ||
      hasExtra('Helmet') ||
      hasExtra('Shoes')
    );
  }
  if (cat === 'bags') return type === 'Bag';
  if (cat === 'skills') return type === 'Skill';
  if (cat === 'treasures') return isTreasureItem(item, treasureIds);
  return true;
}

/**
 * Fallback when item-mentioned-stacks.json is missing: match converted icon tags
 * only (not English freeze/chill — that over-matches Magic/Superior Ring wiki text).
 * Game source of truth is DESCR `$` tokens → assets/data/item-mentioned-stacks.json.
 */
const STACK_ICON_TAGS = {
  Block: 'Block',
  Regeneration: 'Regeneration',
  Lucky: 'Luck',
  Spikes: 'Spikes',
  Vampirism: 'Vampirism',
  Mana: 'Mana',
  Heat: 'Heat',
  Empower: 'Empower',
  Poison: 'Poison',
  Blind: 'Blind',
  Cold: 'Cold',
};

export function defaultFilterState() {
  /** @type {Record<string, boolean>} */
  const classes = {};
  for (const c of CLASS_ORDER) classes[c] = true;

  /** @type {Record<string, boolean>} */
  const rarities = {};
  for (const r of RARITY_CORE) rarities[r] = true;

  /** @type {Record<string, boolean>} */
  const types = {};
  for (const t of TYPE_ORDER) types[t] = false;

  /** @type {Record<string, boolean>} */
  const stacks = {};
  for (const s of [...BUFF_ORDER, ...DEBUFF_ORDER]) stacks[s] = false;

  return {
    q: '',
    grouping: 'none',
    classes,
    rarities,
    classItems: true,
    treasure: true,
    types,
    shop: true,
    crafted: true,
    gated: true,
    stacks,
    /** @type {string | null} homepage deep-link focus */
    category: null,
  };
}

/**
 * @param {string} raw
 */
export function classList(raw) {
  if (!raw) return ['Neutral'];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Game ItemLibrary class filter:
 * - Neutral items (mask === 127) only when Neutral toggle is on
 * - Class items when (mask & enabledClassBits) > 0
 * - classes === None (0) never shown
 *
 * @param {object} item
 * @param {Record<string, boolean>} classToggles
 */
export function itemPassesClassFilter(item, classToggles) {
  const mask =
    typeof item.classMask === 'number'
      ? item.classMask
      : fallbackClassMask(item);

  if (mask === CLASS_BITS.Neutral) {
    return Boolean(classToggles.Neutral);
  }
  if (mask === CLASS_BITS.None || mask === 0) {
    return false;
  }

  // Neutral toggle is separate — not OR'd into the stuffed mask for class items
  let stuffed = 0;
  for (const name of CLASS_ORDER) {
    if (name === 'Neutral') continue;
    if (classToggles[name]) stuffed |= CLASS_BITS[name] || 0;
  }
  return (mask & stuffed) > 0;
}

/**
 * Fallback when item-class-masks.json is missing — approximate from class string.
 * @param {object} item
 */
function fallbackClassMask(item) {
  const classes = classList(item.class);
  if (classes.length === 1 && classes[0] === 'Neutral') return CLASS_BITS.Neutral;
  let bits = 0;
  for (const c of classes) {
    if (c === 'Neutral') continue;
    bits |= CLASS_BITS[c] || 0;
  }
  return bits || CLASS_BITS.None;
}

/**
 * Game ItemDescriptor.isTreasure → randomUniquePool (shop column == "unique").
 * Prefer item.isTreasure / treasureIds from item-origins.json; legacy fallback kept
 * only when that data is missing.
 * @param {object} item
 * @param {Set<string>} [treasureIds]
 */
export function isTreasureItem(item, treasureIds) {
  if (item.rarity !== 'Unique') return false;
  if (typeof item.isTreasure === 'boolean') return item.isTreasure;
  if (treasureIds) return treasureIds.has(item.id);
  // Legacy fallback (over-matches Neutral skills) — only if origins JSON missing
  const types = itemTypes(item);
  if (types.has('Treasure')) return true;
  const classes = classList(item.class);
  return classes.length === 1 && classes[0] === 'Neutral';
}

/**
 * Catalog types on the item (footer), normalized like the game tooltip.
 * @param {object} item
 * @returns {Set<string>}
 */
function itemTypes(item) {
  const set = new Set();
  const type = String(item.type || '').trim();
  if (type) set.add(type);
  const weapon = type.match(/^(Melee|Ranged)\s+Weapon$/i);
  if (weapon) set.add(weapon[1]);
  for (const t of item.extraTypes || []) {
    if (t) set.add(String(t));
  }
  return set;
}

/** Precompiled — avoid `new RegExp` per item when type filters are on. */
const TYPE_MENTION_RE = Object.fromEntries(
  TYPE_ORDER.map((t) => [
    t,
    new RegExp(`(?:\\$|<)${t}(?![A-Za-z0-9])`, 'i'),
  ]),
);

const STACK_ICON_RE = Object.fromEntries(
  Object.entries(STACK_ICON_TAGS).map(([stack, tag]) => [
    stack,
    new RegExp(`<${tag}\\b`, 'i'),
  ]),
);

/**
 * Game ItemBook.mentionedTypes — `$Melee` / `<Melee>` tokens in description.
 * @param {object} item
 * @param {string} type
 */
function itemMentionsType(item, type) {
  const effect = String(item.effect || '');
  if (!effect || !type) return false;
  const re = TYPE_MENTION_RE[type];
  return re ? re.test(effect) : false;
}

/**
 * @param {object} item
 * @param {string} type
 */
function itemHasTypeFilter(item, type) {
  return itemTypes(item).has(type) || itemMentionsType(item, type);
}

/**
 * Game: `stack in descriptor.mentionedStacks` (from `$cold` etc. in DESCR).
 * @param {object} item
 * @param {string} stack
 */
function itemMentionsStack(item, stack) {
  // Authoritative when present (including [] — means “no $stack in DESCR”).
  if (Array.isArray(item.mentionedStacks)) {
    return item.mentionedStacks.includes(stack);
  }
  // JSON missing only: icon tags in effect (can over-match wiki-only rings).
  const re = STACK_ICON_RE[stack];
  if (!re) return false;
  return re.test(String(item.effect || ''));
}

/**
 * @param {object[]} items
 * @param {ReturnType<typeof defaultFilterState>} state
 * @param {{ craftedIds?: Set<string>, gatedIds?: Set<string>, shopItemIds?: Set<string>, treasureIds?: Set<string> }} [meta]
 */
export function filterItems(items, state, meta = {}) {
  const q = state.q.trim().toLowerCase();
  const craftedIds = meta.craftedIds || new Set();
  const gatedIds = meta.gatedIds || new Set();
  const shopItemIds = meta.shopItemIds || new Set();
  const treasureIds = meta.treasureIds;

  const activeTypes = TYPE_ORDER.filter((t) => state.types[t]);
  const activeStacks = [...BUFF_ORDER, ...DEBUFF_ORDER].filter((s) => state.stacks[s]);

  return items.filter((item) => {
    const id = item.id;
    const crafted = craftedIds.has(id);
    const gated = gatedIds.has(id);
    // Game ItemDescriptor.isShopItem: shopItem || (!crafted && !gated)
    const shop = shopItemIds.has(id) || (!crafted && !gated);

    let originOk = false;
    if (state.shop && shop) originOk = true;
    if (state.crafted && crafted) originOk = true;
    if (state.gated && gated) originOk = true;
    if (!originOk) return false;

    if (!itemPassesClassFilter(item, state.classes)) return false;

    const treasure = isTreasureItem(item, treasureIds);
    const classUnique = item.rarity === 'Unique' && !treasure;
    const rarityOk =
      (item.rarity !== 'Unique' && state.rarities[item.rarity]) ||
      (treasure && state.treasure) ||
      (classUnique && state.classItems);
    if (!rarityOk) return false;

    if (activeTypes.length) {
      for (const t of activeTypes) {
        if (!itemHasTypeFilter(item, t)) return false;
      }
    }

    if (activeStacks.length) {
      for (const s of activeStacks) {
        if (!itemMentionsStack(item, s)) return false;
      }
    }

    if (q) {
      const hay = `${item.name} ${item.type} ${item.class} ${(item.extraTypes || []).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    if (!itemMatchesCategory(item, state.category, treasureIds)) return false;

    return true;
  });
}

/**
 * Pack line-break key (game addItem group comparisons).
 * @param {object} item
 * @param {string} grouping
 */
export function groupSortKey(item, grouping) {
  return groupBreakKey(item, grouping);
}

/**
 * Sort like ItemLibrary.getSortScore for the active grouping mode.
 * @param {object[]} items
 * @param {string} grouping
 * @param {{ craftedIds?: Set<string>, gatedIds?: Set<string> }} [meta]
 */
export function sortForGrouping(items, grouping, meta = {}) {
  if (!grouping || grouping === 'none') return items;
  return sortByItemLibrary(items, {
    grouping,
    craftedIds: meta.craftedIds,
    gatedIds: meta.gatedIds,
  });
}

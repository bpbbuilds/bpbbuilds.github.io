/**
 * Parse / match build catalog search: free text, @user, [Item] / [[item_id]].
 */

import { matchMentionItems, normalizeItemKey } from './item-mentions.js';

/**
 * @typedef {{
 *   free: string[],
 *   users: string[],
 *   itemIds: string[],
 *   itemQueries: string[],
 * }} ParsedBuildSearch
 */

/**
 * @param {string} raw serialized search (chips as [[id]])
 * @returns {ParsedBuildSearch}
 */
export function parseBuildSearchQuery(raw) {
  /** @type {ParsedBuildSearch} */
  const out = { free: [], users: [], itemIds: [], itemQueries: [] };
  let s = String(raw || '').replace(/\u200b/g, ' ').trim();
  if (!s) return out;

  // Picked author chips: {@Display Name}
  s = s.replace(/\{@([^{}]+)\}/g, (_, user) => {
    const u = String(user).replace(/[{}]/g, '').trim().toLowerCase();
    if (u && !out.users.includes(u)) out.users.push(u);
    return ' ';
  });

  // Resolved chips: [[item_id]]
  s = s.replace(/\[\[([a-z0-9_]+)\]\]/gi, (_, id) => {
    const key = String(id).toLowerCase();
    if (key && !out.itemIds.includes(key)) out.itemIds.push(key);
    return ' ';
  });

  // Bracket names: [Wooden Sword]
  s = s.replace(/\[([^\[\]]+)\]/g, (_, name) => {
    const q = String(name).trim();
    if (q && !out.itemQueries.includes(q)) out.itemQueries.push(q);
    return ' ';
  });

  // @user tokens
  s = s.replace(/(^|\s)@([^\s[\]]+)/g, (_, sp, user) => {
    const u = String(user).replace(/^@+/, '').trim().toLowerCase();
    if (u && !out.users.includes(u)) out.users.push(u);
    return ' ';
  });

  for (const part of s.split(/\s+/)) {
    const t = part.trim().toLowerCase();
    if (!t || t === '@') continue;
    if (!out.free.includes(t)) out.free.push(t);
  }
  return out;
}

/**
 * Resolve [name] queries to item ids when a catalog is available.
 * @param {ParsedBuildSearch} parsed
 * @param {object[]} items
 * @returns {ParsedBuildSearch}
 */
export function resolveBuildSearchItems(parsed, items) {
  if (!parsed.itemQueries.length || !items?.length) return parsed;
  const itemIds = parsed.itemIds.slice();
  const leftover = [];
  for (const q of parsed.itemQueries) {
    const hits = matchMentionItems(q, items, { limit: 1 });
    if (hits[0]?.id) {
      const id = String(hits[0].id).toLowerCase();
      if (!itemIds.includes(id)) itemIds.push(id);
    } else {
      leftover.push(q);
    }
  }
  return { ...parsed, itemIds, itemQueries: leftover };
}

/**
 * Collect placement item ids (and gem ids) on a build.
 * @param {object} build
 * @returns {Set<string>}
 */
export function buildItemIdSet(build) {
  /** @type {Set<string>} */
  const ids = new Set();
  for (const p of build?.placements || []) {
    const id = String(p?.item?.id || p?.id || '').trim().toLowerCase();
    if (id) ids.add(id);
    const gems = p?.gems;
    if (Array.isArray(gems)) {
      for (const g of gems) {
        if (typeof g === 'string' && g) ids.add(g.toLowerCase());
        else if (g && typeof g === 'object' && g.id) ids.add(String(g.id).toLowerCase());
      }
    }
  }
  return ids;
}

/**
 * Haystack of item display names for free-text search.
 * @param {object} build
 */
function itemNameHaystack(build) {
  const parts = [];
  for (const p of build?.placements || []) {
    const name = p?.item?.name;
    if (name) parts.push(String(name));
    const id = p?.item?.id || p?.id;
    if (id) parts.push(String(id).replace(/_/g, ' '));
  }
  return parts.join(' ').toLowerCase();
}

/**
 * @param {object} build
 * @param {ParsedBuildSearch} parsed
 * @param {object[]} [items] catalog to resolve leftover itemQueries
 */
export function buildMatchesSearch(build, parsed, items = []) {
  const p =
    parsed.itemQueries.length && items.length
      ? resolveBuildSearchItems(parsed, items)
      : parsed;

  if (
    !p.free.length &&
    !p.users.length &&
    !p.itemIds.length &&
    !p.itemQueries.length
  ) {
    return true;
  }

  const author = String(build?.author_name || '').toLowerCase();
  const title = String(build?.title || '').toLowerCase();
  const slug = String(build?.slug || '').toLowerCase();
  const hero = String(build?.hero_class || '').toLowerCase();
  const itemsHay = itemNameHaystack(build);
  const boardIds = buildItemIdSet(build);

  for (const u of p.users) {
    if (!author.includes(u)) return false;
  }

  for (const id of p.itemIds) {
    if (!boardIds.has(id)) return false;
  }

  // Unresolved [Name] — match by normalized name on board
  for (const q of p.itemQueries) {
    const nq = normalizeItemKey(q);
    if (!nq) continue;
    let ok = false;
    for (const pRow of build?.placements || []) {
      const name = normalizeItemKey(pRow?.item?.name || '');
      const idKey = normalizeItemKey(String(pRow?.item?.id || pRow?.id || '').replace(/_/g, ' '));
      if (name === nq || idKey === nq || name.includes(nq) || idKey.includes(nq)) {
        ok = true;
        break;
      }
    }
    if (!ok) return false;
  }

  for (const t of p.free) {
    const hay = `${title} ${slug} ${author} ${hero} ${itemsHay}`;
    if (!hay.includes(t)) return false;
  }

  return true;
}

/**
 * Unique authors on the loaded builds, for @user suggestions.
 * @param {object[]} builds
 * @returns {{ name: string, avatar_url: string | null, equipped_avatar: string | null }[]}
 */
export function usersFromBuilds(builds) {
  /** @type {Map<string, { name: string, avatar_url: string | null, equipped_avatar: string | null }>} */
  const by = new Map();
  for (const b of builds || []) {
    const name = String(b?.author_name || '').trim();
    if (!name || /^unknown$/i.test(name)) continue;
    const key = name.toLowerCase();
    if (by.has(key)) continue;
    by.set(key, {
      name,
      avatar_url: b?.author_avatar_url ? String(b.author_avatar_url) : null,
      equipped_avatar:
        b?.author_equipped_avatar != null ? String(b.author_equipped_avatar) : null,
    });
  }
  return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * @param {string} query text after @
 * @param {{ name: string }[]} users
 * @param {number} [limit]
 */
export function matchSearchUsers(query, users, limit = 8) {
  const q = String(query || '').trim().toLowerCase();
  /** @type {{ user: { name: string }, score: number }[]} */
  const hits = [];
  for (const user of users || []) {
    const name = String(user?.name || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    let score = 0;
    if (!q) score = 1;
    else if (key === q) score = 100;
    else if (key.startsWith(q)) score = 80;
    else if (key.includes(q)) score = 45;
    else continue;
    hits.push({ user, score });
  }
  hits.sort(
    (a, b) => b.score - a.score || a.user.name.localeCompare(b.user.name),
  );
  return hits.slice(0, limit).map((h) => h.user);
}

/**
 * How closely a typed word matches one item name.
 * Exact name ("stone" → Stone) outranks a longer name that only contains it
 * ("stone skin potion", "stones").
 * @param {string} query
 * @param {string} name
 */
export function itemQueryRank(query, name) {
  const q = normalizeItemKey(query);
  const key = normalizeItemKey(name);
  if (!q || !key || !key.includes(q)) return 0;
  if (key === q) return 100;
  if (key.startsWith(`${q} `)) return 80;
  const word = new RegExp(`(?:^|\\s)${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`);
  if (word.test(key)) return 60;
  if (key.startsWith(q)) return 40;
  return 15;
}

/**
 * Higher when the board has a closer item-name match for the typed words.
 * @param {object} build
 * @param {ParsedBuildSearch} parsed
 */
export function buildSearchRank(build, parsed) {
  const tokens = parsed?.free || [];
  if (!tokens.length) return 0;
  const title = String(build?.title || '').toLowerCase();
  const hero = String(build?.hero_class || '').toLowerCase();
  let total = 0;
  for (const token of tokens) {
    let best = 0;
    if (`${title} ${hero}`.includes(token)) best = 10;
    for (const row of build?.placements || []) {
      const name = row?.item?.name || '';
      const idKey = String(row?.item?.id || row?.id || '').replace(/_/g, ' ');
      best = Math.max(best, itemQueryRank(token, name), itemQueryRank(token, idKey));
    }
    total += best;
  }
  return total;
}

/**
 * Unique items from loaded builds (for autocomplete without a full catalog fetch).
 * @param {object[]} builds
 * @returns {object[]}
 */
export function itemsFromBuilds(builds) {
  /** @type {Map<string, object>} */
  const map = new Map();
  for (const b of builds || []) {
    for (const p of b.placements || []) {
      const item = p?.item;
      if (item?.id && !map.has(String(item.id))) map.set(String(item.id), item);
    }
  }
  return [...map.values()];
}

/**
 * @param {string} assetRoot
 * @param {object} item
 */
export function itemSpriteUrl(assetRoot, item) {
  const base = assetRoot.endsWith('/') ? assetRoot : `${assetRoot}/`;
  const image = String(item?.image || '').trim();
  if (!image) return '';
  if (/^https?:\/\//i.test(image)) return image;
  return `${base}assets/item-sprites/${image}`;
}

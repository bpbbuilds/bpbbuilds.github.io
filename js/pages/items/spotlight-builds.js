/**
 * Items spotlight — bottom strip of public builds that use the focused item.
 */

import { getSupabase } from '../../shared/supabase.js';
import { syncEventBuildVisibility } from '../events/event-gallery-sync.js';
import { classIconPath } from '../../shared/class-icons.js';
import { mountFeedBoardThumbs } from '../builds/board-thumbs.js';
import { buildViewHref } from '../builds/post-row.js';

const THUMB_CELL_PX = 18;
const MAX_BUILDS = 10;
const LOOKUP_LIMIT = 80;

const ITEM_SELECT =
  'id, gid, name, rarity, type, class, extra_types, tags, cost, effect, image, shape, sockets, accuracy, cooldown, stamina_cost, damage_min, damage_max, block, chance, chance_tag, params';

/**
 * @param {{
 *   assetRoot?: string,
 *   getShapes?: () => object | null,
 *   getSockets?: () => object | null,
 *   getSpriteDisplay?: () => object | null,
 * }} opts
 */
export function createSpotlightBuilds(opts = {}) {
  const root = document.createElement('aside');
  root.className = 'il-spotlight-builds';
  root.setAttribute('aria-label', 'Builds using this item');
  root.hidden = true;
  document.body.appendChild(root);

  const pageRoot = (() => {
    const raw =
      opts.assetRoot ?? document.body?.dataset?.root ?? '../';
    return raw.endsWith('/') ? raw : `${raw}/`;
  })();

  /** @type {Map<string, object[]>} */
  const cache = new Map();
  /** @type {(() => void) | null} */
  let unmountThumbs = null;
  let showGen = 0;
  /** @type {string | null} */
  let activeItemId = null;

  function clearThumbs() {
    if (unmountThumbs) {
      try {
        unmountThumbs();
      } catch {
        /* ignore */
      }
      unmountThumbs = null;
    }
  }

  function hide() {
    showGen += 1;
    activeItemId = null;
    clearThumbs();
    root.hidden = true;
    root.innerHTML = '';
  }

  /**
   * @param {string} itemId
   * @param {object[]} builds
   */
  function paintBuilds(itemId, builds) {
    if (activeItemId !== itemId) return;
    clearThumbs();

    if (!builds.length) {
      hide();
      return;
    }

    const n = builds.length;
    const title = n === 1 ? '1 Build' : `${n} Builds`;
    const cards = builds
      .map((b) => {
        const slug = String(b.slug || '').trim();
        if (!slug) return '';
        const href = buildViewHref(slug, pageRoot);
        const name = String(b.title || 'Build').trim() || 'Build';
        const icon = classIconPath(pageRoot, b.hero_class);
        const hero = String(b.hero_class || '').trim();
        return `
          <li class="il-spotlight-builds__card">
            <a
              class="il-spotlight-builds__link"
              href="${escapeAttr(href)}"
              data-spotlight-build-tip
              aria-label="${escapeAttr(hero ? `${name} · ${hero}` : name)}"
            >
              <span
                class="il-spotlight-builds__board"
                data-spotlight-board="${escapeAttr(slug)}"
                aria-hidden="true"
              ></span>
              <span class="il-spotlight-builds__meta">
                ${
                  icon
                    ? `<img class="il-spotlight-builds__class" src="${escapeAttr(icon)}" alt="" width="22" height="22" draggable="false" />`
                    : ''
                }
                <span class="il-spotlight-builds__name">${escapeHtml(name)}</span>
              </span>
            </a>
          </li>`;
      })
      .join('');

    root.innerHTML = `
      <div class="il-spotlight-builds__panel il-filter__shade">
        <h3 class="il-spotlight-builds__heading">${escapeHtml(title)}</h3>
        <div class="il-spotlight-builds__scroll">
          <ul class="il-spotlight-builds__list">${cards}</ul>
        </div>
      </div>`;
    root.hidden = false;

    unmountThumbs = mountStripThumbs(root, {
      builds,
      root: pageRoot,
      shapes: opts.getShapes?.() || null,
      sockets: opts.getSockets?.() || null,
      spriteDisplay: opts.getSpriteDisplay?.() || null,
    });
  }

  /**
   * @param {string} itemId
   */
  async function showFor(itemId) {
    const id = String(itemId || '').trim();
    if (!id) {
      hide();
      return;
    }

    const gen = ++showGen;
    activeItemId = id;
    // Stay hidden until we know this item has builds (no skeleton flash).
    clearThumbs();
    root.hidden = true;
    root.innerHTML = '';

    if (cache.has(id)) {
      paintBuilds(id, cache.get(id) || []);
      return;
    }

    try {
      const builds = await fetchBuildsForItem(id);
      if (gen !== showGen || activeItemId !== id) return;
      cache.set(id, builds);
      paintBuilds(id, builds);
    } catch (err) {
      if (gen !== showGen || activeItemId !== id) return;
      console.error(err);
      hide();
    }
  }

  root.addEventListener(
    'wheel',
    (e) => {
      e.stopPropagation();
    },
    { passive: true },
  );

  return {
    el: root,
    showFor,
    hide,
    destroy() {
      hide();
      root.remove();
    },
  };
}

/**
 * Essentials tier weight for the focused item on a build.
 * @param {string | null | undefined} priority
 */
function priorityWeight(priority) {
  if (priority === 'needed') return 4;
  if (priority === 'nice') return 2.5;
  if (priority === 'optional') return 1;
  return 0.5; // placed but uncategorized
}

/**
 * @param {string | null | undefined} a
 * @param {string | null | undefined} b
 */
function betterPriority(a, b) {
  return priorityWeight(b) > priorityWeight(a) ? b || null : a || null;
}

/**
 * Relevance (item emphasis) dominates; quality (votes) is secondary.
 * @param {{
 *   build: {
 *     vote_score?: number,
 *     is_op?: boolean,
 *     is_featured?: boolean,
 *     build_tag?: string | null,
 *     created_at?: string,
 *   },
 *   count: number,
 *   bestPriority: string | null,
 * }} entry
 */
export function sortScoreForItem(entry) {
  const b = entry.build || {};
  const relevance =
    priorityWeight(entry.bestPriority) + Math.min(entry.count || 0, 4) * 0.5;

  let quality = Number(b.vote_score) || 0;
  if (b.is_op) quality += 2;
  if (b.is_featured) quality += 1;
  const tag = b.build_tag === 'theorycraft' ? 'theory' : b.build_tag;
  if (tag === 'feasible' || tag === 'real') quality += 0.25;

  // Mild recency — only breaks near-ties (~0..1 over ~60 days)
  const ageDays = Math.max(
    0,
    (Date.now() - Date.parse(String(b.created_at || ''))) / 86400000,
  );
  const recency = Number.isFinite(ageDays) ? 1 / (1 + ageDays / 30) : 0;

  return relevance * 10 + quality + recency;
}

/**
 * @param {string} itemId
 * @returns {Promise<object[]>}
 */
async function fetchBuildsForItem(itemId) {
  await syncEventBuildVisibility();
  const supabase = getSupabase();
  const { data: hits, error: hitErr } = await supabase
    .from('build_placements')
    .select(
      `
      build_id,
      priority,
      build:builds!inner (
        id, slug, is_public, is_op, is_featured, vote_score, build_tag, created_at
      )
    `,
    )
    .eq('item_id', itemId)
    .eq('build.is_public', true)
    .limit(LOOKUP_LIMIT);

  if (hitErr) throw hitErr;

  /** @type {Map<number | string, { build: object, count: number, bestPriority: string | null }>} */
  const byId = new Map();
  for (const row of hits || []) {
    const b = row?.build;
    if (!b?.id || !b.slug) continue;
    let entry = byId.get(b.id);
    if (!entry) {
      entry = { build: b, count: 0, bestPriority: null };
      byId.set(b.id, entry);
    }
    entry.count += 1;
    entry.bestPriority = betterPriority(entry.bestPriority, row.priority);
  }

  const ranked = [...byId.values()].sort((a, b) => {
    const d = sortScoreForItem(b) - sortScoreForItem(a);
    if (d) return d;
    return (
      Date.parse(String(b.build.created_at || '')) -
      Date.parse(String(a.build.created_at || ''))
    );
  });
  const ids = ranked.slice(0, MAX_BUILDS).map((e) => e.build.id);
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from('builds')
    .select(
      `
      id, slug, title, hero_class, blurb, is_op, is_featured, build_tag, vote_score,
      author_name, rank, gold_count, created_at, board_still_path,
      profile:profiles!builds_author_id_fkey (
        discord_id, display_name, avatar_url, equipped_avatar
      ),
      placements:build_placements (
        id, x, y, r, gems, priority,
        item:items ( ${ITEM_SELECT} )
      )
    `,
    )
    .in('id', ids)
    .eq('is_public', true);

  if (error) throw error;

  const order = new Map(ids.map((id, i) => [id, i]));
  return (data || [])
    .map(withAuthorFace)
    .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
}

/**
 * Tip faces read author_avatar_url / author_equipped_avatar, not the nested profile.
 * @param {object} row
 */
function withAuthorFace(row) {
  const raw = row?.profile;
  const profile =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? raw
      : Array.isArray(raw)
        ? raw[0]
        : null;
  const liveName = String(profile?.display_name || '').trim();
  return {
    ...row,
    author_discord_id: String(profile?.discord_id || '').trim() || null,
    author_avatar_url: String(profile?.avatar_url || '').trim() || null,
    author_equipped_avatar:
      profile?.equipped_avatar != null ? String(profile.equipped_avatar) : null,
    author_name: liveName || row.author_name || 'Unknown',
  };
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   builds: object[],
 *   root: string,
 *   shapes?: object | null,
 *   sockets?: object | null,
 *   spriteDisplay?: object | null,
 * }} opts
 */
function mountStripThumbs(host, opts) {
  return mountFeedBoardThumbs(host, {
    builds: opts.builds,
    root: opts.root,
    spriteDisplay: opts.spriteDisplay,
    shapes: opts.shapes,
    sockets: opts.sockets,
    boardAttr: 'data-spotlight-board',
    tipSelector: '[data-spotlight-build-tip]',
    cellPx: THUMB_CELL_PX,
    emptyHtml: `<span class="il-spotlight-builds__empty">No board</span>`,
  });
}

/** @param {string} s */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @param {string} s */
function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

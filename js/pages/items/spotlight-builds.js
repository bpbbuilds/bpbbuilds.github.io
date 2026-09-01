/**
 * Items spotlight — bottom strip of public builds that use the focused item.
 */

import { getSupabase } from '../../shared/supabase.js';
import { skelBlock, skelRegion } from '../../shared/skeleton.js';
import { mountPlacedGrid } from '../../shared/backpack-grid/index.js';
import { classIconPath } from '../../shared/class-icons.js';
import {
  mapItem,
  makeSpriteUrl,
  applyShapes,
  applySocketOffsets,
} from '../build/map-item.js';
import { bindMoreBuildTips, registerMoreBuildTip } from '../build/more-build-tip.js';
import { buildViewHref } from '../builds/post-row.js';

const BOARD_COLS = 9;
const BOARD_ROWS = 7;
const THUMB_CELL_PX = 16;
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
   */
  function paintSkeleton(itemId) {
    activeItemId = itemId;
    clearThumbs();
    root.innerHTML = `
      <div class="il-spotlight-builds__panel">
        <h3 class="il-spotlight-builds__heading">Builds</h3>
        ${skelRegion(
          `<div class="il-spotlight-builds__skel">
            ${skelBlock({ className: 'il-spotlight-builds__skel-card' })}
            ${skelBlock({ className: 'il-spotlight-builds__skel-card' })}
            ${skelBlock({ className: 'il-spotlight-builds__skel-card' })}
          </div>`,
          { label: 'Loading builds' },
        )}
      </div>`;
    root.hidden = false;
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
      <div class="il-spotlight-builds__panel">
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

    if (cache.has(id)) {
      paintBuilds(id, cache.get(id) || []);
      return;
    }

    paintSkeleton(id);

    try {
      const builds = await fetchBuildsForItem(id);
      if (gen !== showGen || activeItemId !== id) return;
      cache.set(id, builds);
      paintBuilds(id, builds);
    } catch (err) {
      if (gen !== showGen || activeItemId !== id) return;
      console.error(err);
      clearThumbs();
      root.innerHTML = `
        <div class="il-spotlight-builds__panel">
          <h3 class="il-spotlight-builds__heading">Builds</h3>
          <p class="il-spotlight-builds__status" role="status">Could not load builds.</p>
        </div>`;
      root.hidden = false;
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
      author_name, rank, gold_count, created_at,
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
    .slice()
    .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
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
  const getSpriteUrl = makeSpriteUrl(opts.root, opts.spriteDisplay || null);
  const bySlug = new Map(
    (opts.builds || []).map((b) => [String(b.slug || ''), b]),
  );
  /** @type {{ destroy?: () => void }[]} */
  const grids = [];
  /** @type {Map<string, object>} */
  const tipItemsById = new Map();

  host.querySelectorAll('[data-spotlight-board]').forEach((boardHost) => {
    if (!(boardHost instanceof HTMLElement)) return;
    const slug = boardHost.getAttribute('data-spotlight-board') || '';
    const build = bySlug.get(slug);
    if (!build) return;

    const { placements, itemsById } = placementsForBuild(build, {
      shapes: opts.shapes,
      sockets: opts.sockets,
      getSpriteUrl,
    });
    if (!placements.length) {
      boardHost.innerHTML = `<span class="il-spotlight-builds__empty">No board</span>`;
      return;
    }

    for (const [id, item] of itemsById) tipItemsById.set(id, item);

    boardHost.replaceChildren();
    const grid = mountPlacedGrid(boardHost, {
      placements,
      itemsById,
      cols: BOARD_COLS,
      rows: BOARD_ROWS,
      getSpriteUrl,
      fillWidth: false,
      exactBoard: true,
      reserveScrollGap: false,
      cellPx: THUMB_CELL_PX,
    });
    const bg = boardHost.querySelector(':scope > .bpb-bg');
    if (bg instanceof HTMLElement) {
      bg.classList.add('bpb-bg--feed-thumb');
      bg.style.overflow = 'visible';
      bg.style.maxHeight = 'none';
      bg.style.setProperty('--bpb-bg-scroll-gap', '0px');
    }
    grids.push(grid);

    const tipEl = boardHost.closest('[data-spotlight-build-tip]');
    if (tipEl instanceof HTMLElement) {
      registerMoreBuildTip(tipEl, build, placements);
    }
  });

  const unbindTip = bindMoreBuildTips(host, {
    itemsById: tipItemsById,
    getSpriteUrl,
    root: opts.root,
    overEl: null,
    thumbSelector: '[data-spotlight-build-tip]',
  });

  return () => {
    try {
      unbindTip();
    } catch {
      /* ignore */
    }
    for (const g of grids) g.destroy?.();
    grids.length = 0;
  };
}

/**
 * @param {object} build
 * @param {{
 *   shapes?: object | null,
 *   sockets?: object | null,
 *   getSpriteUrl: (item: object) => string,
 * }} opts
 */
function placementsForBuild(build, opts) {
  /** @type {Map<string, object>} */
  const itemsById = new Map();
  const placements = [];

  for (const [i, p] of (build.placements || []).entries()) {
    const item = mapItem(p.item);
    if (!item?.id) continue;
    itemsById.set(item.id, item);
    placements.push({
      id: item.id,
      x: Number(p.x) || 0,
      y: Number(p.y) || 0,
      r: Number(p.r) || 0,
      key: String(p.id ?? `${item.id}:${i}:${p.x},${p.y}:${p.r || 0}`),
      gems: Array.isArray(p.gems) ? p.gems : undefined,
    });
  }

  const items = [...itemsById.values()];
  applyShapes(items, opts.shapes || null);
  applySocketOffsets(items, opts.sockets || null);
  for (const item of items) opts.getSpriteUrl(item);

  return { placements, itemsById };
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

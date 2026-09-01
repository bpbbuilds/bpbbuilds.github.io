/**
 * Interactive mini backpack thumbnails for “More builds” (author rail).
 * Item tooltips disabled — hovering a thumb shows a build preview tip instead.
 *
 * Source: Supabase public builds by author_id (Hot, cap 6).
 */

import { getSupabase } from '../../shared/supabase.js';
import { mountPlacedGrid } from '../../shared/backpack-grid/index.js';
import { classIconPath } from '../../shared/class-icons.js';
import { bindMoreBuildTips, registerMoreBuildTip } from './more-build-tip.js';

const BOARD_COLS = 9;
const BOARD_ROWS = 7;
/** Small enough to fit 3 thumbs in the author column; still readable for hover. */
const THUMB_CELL_PX = 14;

/** Max thumbs in the author rail (3×2). */
export const MORE_BUILDS_CAP = 6;

const ITEM_SELECT =
  'id, gid, name, rarity, type, class, extra_types, tags, cost, effect, image, shape, sockets, accuracy, cooldown, stamina_cost, damage_min, damage_max, block, chance, chance_tag, params';

/**
 * @param {number | string | null | undefined} runId
 * @param {string} root
 */
export function historyBuildHref(runId, root) {
  const id = Number(runId);
  if (!Number.isFinite(id)) return null;
  const base = root.endsWith('/') ? root : `${root}/`;
  return `${base}builds/history/?run=${id}`;
}

/**
 * @param {string} slug
 * @param {string} root
 */
export function slugBuildHref(slug, root) {
  const s = String(slug || '').trim();
  if (!s) return null;
  const base = root.endsWith('/') ? root : `${root}/`;
  return `${base}builds/view/?slug=${encodeURIComponent(s)}`;
}

/**
 * @param {object} build
 * @param {string} root
 */
function moreBuildHref(build, root) {
  const bySlug = slugBuildHref(build?.slug, root);
  if (bySlug) return bySlug;
  return historyBuildHref(build?.runId, root);
}

/**
 * Public builds by author, Hot-sorted, capped (exclude current slug).
 * @param {{
 *   authorId: string,
 *   excludeSlug?: string | null,
 *   fetchLimit?: number,
 *   limit?: number,
 * }} opts
 * @returns {Promise<{ builds: object[], items: object[] } | null>}
 */
export async function fetchAuthorMoreBuilds(opts) {
  const authorId = String(opts.authorId || '').trim();
  if (!authorId) return null;

  const excludeSlug = String(opts.excludeSlug || '').trim();
  const fetchLimit = Math.max(1, Number(opts.fetchLimit) || 20);
  const limit = Math.max(1, Number(opts.limit) || MORE_BUILDS_CAP);

  try {
    const supabase = getSupabase();
    let q = supabase
      .from('builds')
      .select(
        `
        slug, title, hero_class, is_op, is_featured, build_tag, vote_score, created_at,
        placements:build_placements (
          id, x, y, r, gems,
          item:items ( ${ITEM_SELECT} )
        )
      `,
      )
      .eq('author_id', authorId)
      .eq('is_public', true)
      .limit(fetchLimit);

    if (excludeSlug) q = q.neq('slug', excludeSlug);

    const { data, error } = await q;
    if (error) throw error;

    const rows = (data || [])
      .map(normalizeAuthorMoreRow)
      .filter((b) => b.placements?.length);

    const sorted = sortBuildsHot(rows).slice(0, limit);
    /** @type {Map<string, object>} */
    const itemsById = new Map();
    for (const b of sorted) {
      for (const item of b._items || []) {
        if (item?.id) itemsById.set(item.id, item);
      }
    }

    return {
      builds: sorted.map(({ _items, ...rest }) => rest),
      items: [...itemsById.values()],
    };
  } catch (err) {
    console.error(err);
    return null;
  }
}

/**
 * @param {object} row
 */
function normalizeAuthorMoreRow(row) {
  /** @type {object[]} */
  const items = [];
  /** @type {object[]} */
  const placements = [];

  for (const [i, p] of (row.placements || []).entries()) {
    const item = p?.item;
    if (!item?.id) continue;
    items.push(item);
    placements.push({
      id: item.id,
      x: Number(p.x) || 0,
      y: Number(p.y) || 0,
      r: Number(p.r) || 0,
      key: String(p.id ?? `${item.id}:${i}:${p.x},${p.y}:${p.r || 0}`),
      gems: Array.isArray(p.gems) ? p.gems : undefined,
    });
  }

  return {
    slug: row.slug,
    title: row.title,
    hero_class: row.hero_class,
    is_op: Boolean(row.is_op),
    is_featured: Boolean(row.is_featured),
    build_tag: row.build_tag,
    vote_score: Number(row.vote_score) || 0,
    created_at: row.created_at,
    placements,
    _items: items,
  };
}

/** @param {object} b */
function qualityScore(b) {
  let s = Number(b.vote_score) || 0;
  if (b.is_op) s += 2;
  if (b.is_featured) s += 1;
  const tag = b.build_tag === 'theorycraft' ? 'theory' : b.build_tag;
  if (tag === 'feasible' || tag === 'real') s += 0.25;
  return s;
}

/** @param {object} b */
function ageHours(b) {
  const n = Date.parse(String(b.created_at || ''));
  const ts = Number.isFinite(n) ? n : 0;
  return Math.max(0, (Date.now() - ts) / 3600000);
}

/** @param {object[]} rows */
function sortBuildsHot(rows) {
  return rows.slice().sort((a, b) => {
    const sa = qualityScore(a) / Math.pow(ageHours(a) + 2, 1.5);
    const sb = qualityScore(b) / Math.pow(ageHours(b) + 2, 1.5);
    return sb - sa;
  });
}

/**
 * @param {HTMLElement} railEl
 * @param {{
 *   builds: object[],
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   root?: string,
 *   overEl?: HTMLElement | null,
 * }} opts
 */
export function mountAuthorMoreBuilds(railEl, opts) {
  const list = railEl?.querySelector?.('.build-author__more-list');
  if (!(list instanceof HTMLElement)) return () => {};

  const builds = (opts.builds || []).slice(0, MORE_BUILDS_CAP);
  const itemsById = opts.itemsById;
  const getSpriteUrl = opts.getSpriteUrl;
  const root = opts.root || '../../';
  const grids = [];

  list.replaceChildren();

  for (const build of builds) {
    if (!build?.placements?.length) continue;
    const li = document.createElement('li');
    li.className = 'build-author__more-item';

    const icon = classIconPath(root, build.hero_class);
    const heroClass = String(build.hero_class || '').trim();
    const title = moreBuildLabel(build);
    const href = moreBuildHref(build, root);
    const isOp = Boolean(build.is_op);
    const openTag = href
      ? `<a class="build-author__thumb" href="${escapeAttr(href)}"${
          build.runId != null
            ? ` data-run-id="${escapeAttr(String(build.runId))}"`
            : ''
        }${build.slug ? ` data-build-slug="${escapeAttr(String(build.slug))}"` : ''}>`
      : `<div class="build-author__thumb">`;
    const closeTag = href ? '</a>' : '</div>';

    li.innerHTML = `
      ${openTag}
        <div class="build-author__thumb-grid" aria-label="${escapeAttr(title)} backpack"></div>
        <div class="build-author__thumb-meta">
          ${
            icon
              ? `<img class="build-author__more-icon" src="${escapeAttr(icon)}" alt="${escapeAttr(heroClass)}" title="${escapeAttr(heroClass)}" width="28" height="28" />`
              : ''
          }
          <span class="build-author__more-name build-info__ui-text">${escapeHtml(title)}</span>
          ${
            isOp
              ? `<span class="build-author__more-op" title="OP">OP</span>`
              : ''
          }
        </div>
      ${closeTag}
    `;
    list.appendChild(li);

    const gridHost = li.querySelector('.build-author__thumb-grid');
    const thumb = li.querySelector('.build-author__thumb');
    if (!(gridHost instanceof HTMLElement)) continue;

    const placements = (build.placements || []).map((p, i) => ({
      id: p.id,
      x: Number(p.x) || 0,
      y: Number(p.y) || 0,
      r: Number(p.r) || 0,
      key: p.key != null ? String(p.key) : `${p.id}:${i}:${p.x},${p.y}:${p.r || 0}`,
      gems: Array.isArray(p.gems) ? p.gems : undefined,
    }));

    const grid = mountPlacedGrid(gridHost, {
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
    grids.push(grid);

    if (thumb instanceof HTMLElement) {
      registerMoreBuildTip(thumb, build, placements);
    }
  }

  const unbindTip = bindMoreBuildTips(list, {
    itemsById,
    getSpriteUrl,
    root,
    overEl: opts.overEl,
  });

  const section = railEl.querySelector('.build-author__more');
  if (section instanceof HTMLElement) {
    section.hidden = !list.childElementCount;
  }

  return () => {
    try {
      unbindTip();
    } catch {
      /* ignore */
    }
    for (const g of grids) {
      try {
        g.destroy?.({ keepHost: true });
      } catch {
        /* ignore */
      }
    }
  };
}

/**
 * Label beside the class icon — drop a leading class name when the icon already shows it.
 * @param {{ title?: string, slug?: string, hero_class?: string, runId?: number }} build
 */
function moreBuildLabel(build) {
  const raw = String(build.title || build.slug || '').trim();
  const cls = String(build.hero_class || '').trim();
  const runFallback =
    build.runId != null && Number.isFinite(Number(build.runId))
      ? `Run ${build.runId}`
      : 'Build';

  if (!raw) return runFallback;

  if (cls) {
    const prefix = `${cls} · `;
    if (raw.startsWith(prefix)) {
      const rest = raw.slice(prefix.length).trim();
      return rest || runFallback;
    }
    if (raw === cls) return runFallback;
  }

  return raw;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

/**
 * Homepage create promo — fly items from the catalog onto the empty board,
 * assembling public `build_tag = 'real'` builds in a loop.
 *
 *   import { playAssemble } from './home-promo-assemble.js';
 *   void playAssemble({ grid, boardHost, catalogRoot, root });
 */

import { getSupabase } from '../../shared/supabase.js';
import {
  mountPlacedGrid,
  shapeForItem,
  bodyBounds,
  prefersReducedMotion,
} from '../../shared/backpack-grid/index.js';
import {
  applyShapes,
  applySocketOffsets,
  makeSpriteUrl,
  mapItem,
} from '../build/map-item.js';
import { BOARD_COLS, BOARD_ROWS, isBagItem } from '../create/collision.js';
import {
  hidePromoCatalogItem,
  restorePromoCatalogItems,
  seekPromoCatalogItem,
} from './home-promo-catalog.js';
import { normalizePromoBuild, paintPromoCaption } from './home-promo-caption.js';

const FETCH_LIMIT = 12;
const FLY_MS = 420;
const FLY_STAGGER_MS = 110;
const HOLD_MS = 2500;
const SEEK_BEAT_MS = 80;
const BOARD_DEPART_MS = 400;
const BOARD_STAGGER_MS = 2;
const BOARD_STAGGER_MAX_MS = 400;
const BOARD_CELL_PX = 26;

const ITEM_SELECT =
  'id, gid, name, rarity, type, class, extra_types, tags, cost, effect, image, shape, sockets, accuracy, cooldown, stamina_cost, damage_min, damage_max, block, chance, chance_tag, params';

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * @param {string} url
 */
async function fetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * @param {string} root
 */
async function loadAssetExtras(root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const [shapes, sockets, spriteDisplay] = await Promise.all([
    fetchJson(`${base}assets/data/item-shapes.json`),
    fetchJson(`${base}assets/data/socket-offsets.json`),
    fetchJson(`${base}assets/data/sprite-display.json`),
  ]);
  return { shapes, sockets, spriteDisplay };
}

/**
 * Public boards tagged real that have at least one placement.
 * @returns {Promise<object[]>}
 */
async function fetchRealBuilds() {
  const supabase = getSupabase();
  const placementSelect = `
    placements:build_placements (
      id, x, y, r, gems, priority,
      item:items ( ${ITEM_SELECT} )
    )
  `;
  const withProfile = `
    id, slug, title, hero_class, blurb, gold_count, rank, is_op, is_featured, build_tag, updated_at,
    author_id, author_name,
    profile:profiles!builds_author_id_fkey (
      discord_id, display_name, avatar_url
    ),
    ${placementSelect}
  `;
  const bare = `
    id, slug, title, hero_class, blurb, gold_count, rank, is_op, is_featured, build_tag, updated_at,
    author_id, author_name,
    ${placementSelect}
  `;

  let { data, error } = await supabase
    .from('builds')
    .select(withProfile)
    .eq('is_public', true)
    .eq('build_tag', 'real')
    .order('updated_at', { ascending: false })
    .limit(FETCH_LIMIT);

  if (error) {
    const retry = await supabase
      .from('builds')
      .select(bare)
      .eq('is_public', true)
      .eq('build_tag', 'real')
      .order('updated_at', { ascending: false })
      .limit(FETCH_LIMIT);
    if (retry.error) throw retry.error;
    data = retry.data;
  }

  return (data || [])
    .map(normalizePromoBuild)
    .filter((b) => (b.placements || []).length);
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
  const items = [];
  const placements = [];

  for (const [i, p] of (build.placements || []).entries()) {
    const item = mapItem(p.item);
    if (!item?.id) continue;
    items.push(item);
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

  applyShapes(items, opts.shapes || null);
  applySocketOffsets(items, opts.sockets || null);
  for (const item of items) opts.getSpriteUrl(item);

  return { placements, itemsById };
}

/**
 * Bags first so pouches exist before cargo.
 * @param {object[]} placements
 * @param {Map<string, object>} itemsById
 */
function orderPlacements(placements, itemsById) {
  const bags = [];
  const rest = [];
  for (const p of placements) {
    const item = itemsById.get(p.id);
    if (isBagItem(item)) bags.push(p);
    else rest.push(p);
  }
  return bags.concat(rest);
}

/**
 * First-seen order after bags-first; every copy of an id in one group.
 * @param {object[]} placements
 * @returns {object[][]}
 */
function groupPlacements(placements) {
  const groups = [];
  const seen = new Set();
  for (const p of placements) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    groups.push(placements.filter((q) => q.id === p.id));
  }
  return groups;
}

/**
 * @param {number | undefined} r
 */
function faceDeg(r) {
  return ((((Number(r) || 0) % 4) + 4) % 4) * 90;
}

/**
 * Remount so landed items use a real sprite URL (the empty board starts blank).
 * @param {HTMLElement} boardHost
 * @param {(item: object) => string} getSpriteUrl
 * @param {{ destroy?: Function } | null} prevGrid
 */
function remountBoard(boardHost, getSpriteUrl, prevGrid) {
  prevGrid?.destroy?.({ keepHost: true });
  boardHost.replaceChildren();
  const grid = mountPlacedGrid(boardHost, {
    placements: [],
    itemsById: new Map(),
    cols: BOARD_COLS,
    rows: BOARD_ROWS,
    getSpriteUrl,
    fillWidth: true,
    exactBoard: true,
    reserveScrollGap: false,
    cellPx: BOARD_CELL_PX,
  });
  if (grid?.el instanceof HTMLElement) {
    grid.el.style.overflow = 'visible';
    grid.el.style.scrollbarGutter = 'auto';
  }
  return grid;
}

/**
 * Viewport rect → document box so fly ghosts scroll with the page.
 * @param {{ left: number, top: number, width: number, height: number }} r
 */
function docBox(r) {
  return {
    left: r.left + window.scrollX,
    top: r.top + window.scrollY,
    width: r.width,
    height: r.height,
  };
}

/**
 * @param {HTMLElement} node
 */
function originFromNode(node) {
  const sprite = node.querySelector(
    '.bpb-bg__sprite:not(.bpb-bg__sprite--shadow)',
  );
  const el = sprite instanceof HTMLElement ? sprite : node;
  return docBox(el.getBoundingClientRect());
}

/**
 * @param {HTMLElement | null} catalogRoot
 * @param {string} itemId
 * @returns {{ left: number, top: number, width: number, height: number }}
 */
function catalogOrigin(catalogRoot, itemId) {
  const clip =
    catalogRoot instanceof HTMLElement
      ? catalogRoot.getBoundingClientRect()
      : null;
  const fallback = clip
    ? docBox({
        left: clip.right - 28,
        top: clip.top + clip.height / 2 - 14,
        width: 28,
        height: 28,
      })
    : docBox({ left: 40, top: 200, width: 28, height: 28 });

  if (!catalogRoot || !itemId) return fallback;

  const nodes = catalogRoot.querySelectorAll(
    `.bpb-bg__item[data-item-id="${CSS.escape(itemId)}"]`,
  );
  if (!nodes.length) return fallback;

  const midY = clip ? (clip.top + clip.bottom) / 2 : 0;
  let best = null;
  let bestScore = Infinity;
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.classList.contains('home-promo__item--depart')) continue;
    const r = node.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cy = (r.top + r.bottom) / 2;
    const visible = clip
      ? cy >= clip.top - 8 && cy <= clip.bottom + 8
      : true;
    const score = (visible ? 0 : 10000) + Math.abs(cy - midY);
    if (score < bestScore) {
      bestScore = score;
      best = r;
    }
  }
  if (!best) return fallback;
  return docBox(best);
}

/**
 * Visual sprite size on the board (sprite-display cells × cellPx), not the
 * occupancy AABB — art often spills past the footprint.
 * @param {object | null} item
 * @param {number} cellPx
 */
function spriteDisplayPx(item, cellPx) {
  const sw = Number(item?.spriteW);
  const sh = Number(item?.spriteH);
  if (sw > 0 && sh > 0) {
    return { width: sw * cellPx, height: sh * cellPx };
  }
  const bounds = item
    ? bodyBounds(shapeForItem(item, 0))
    : { w: 1, h: 1 };
  return {
    width: Math.max(1, bounds.w) * cellPx,
    height: Math.max(1, bounds.h) * cellPx,
  };
}

/**
 * Fly destination: unrotated sprite box centered on the placement AABB, then CSS-rotated.
 * @param {HTMLElement} boardHost
 * @param {{ x: number, y: number, r?: number, id: string }} p
 * @param {object | null} item
 */
function cellTarget(boardHost, p, item) {
  const board =
    boardHost.querySelector('.bpb-bg__board') || boardHost;
  const br = board.getBoundingClientRect();
  const cellPx = br.width / BOARD_COLS;
  const face = Number(p.r) || 0;
  let rotW = 1;
  let rotH = 1;
  if (item) {
    const bounds = bodyBounds(shapeForItem(item, face));
    rotW = Math.max(1, bounds.w);
    rotH = Math.max(1, bounds.h);
  }
  const size = spriteDisplayPx(item, cellPx);
  const cx = br.left + (p.x + rotW / 2) * cellPx;
  const cy = br.top + (p.y + rotH / 2) * cellPx;
  return docBox({
    left: cx - size.width / 2,
    top: cy - size.height / 2,
    width: size.width,
    height: size.height,
  });
}

/**
 * @param {{
 *   src: string,
 *   from: { left: number, top: number, width: number, height: number },
 *   to: { left: number, top: number, width: number, height: number },
 *   rotate?: number,
 * }} opts
 */
function flyGhost(opts) {
  const { src, from, to, rotate = 0 } = opts;
  return new Promise((resolve) => {
    const img = document.createElement('img');
    img.className = 'home-promo__fly';
    img.src = src || '';
    img.alt = '';
    img.draggable = false;
    img.setAttribute('aria-hidden', 'true');
    img.style.left = `${from.left}px`;
    img.style.top = `${from.top}px`;
    img.style.width = `${from.width}px`;
    img.style.height = `${from.height}px`;
    img.style.transform = 'rotate(0deg)';
    document.body.appendChild(img);

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      img.remove();
      resolve();
    };

    img.addEventListener('transitionend', (e) => {
      if (e.target === img && e.propertyName === 'left') finish();
    });
    window.setTimeout(finish, FLY_MS + 120);

    img.style.transition = 'none';
    void img.getBoundingClientRect();
    img.style.transition = '';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        img.style.left = `${to.left}px`;
        img.style.top = `${to.top}px`;
        img.style.width = `${to.width}px`;
        img.style.height = `${to.height}px`;
        img.style.transform = `rotate(${rotate}deg)`;
      });
    });
  });
}

/**
 * Reverse AppearInLibrary wave on the live board, then caller clears placements.
 * @param {HTMLElement} boardHost
 */
function departBoardItems(boardHost) {
  const items = [...boardHost.querySelectorAll(
    '.bpb-bg__item:not(.bpb-bg__item--parked)',
  )].filter((el) => el instanceof HTMLElement);
  if (!items.length) return Promise.resolve();

  items.sort((a, b) => {
    const dy = a.offsetTop - b.offsetTop;
    if (dy) return dy;
    return a.offsetLeft - b.offsetLeft;
  });

  for (const el of items) {
    el.classList.remove('home-promo__item--appear');
    el.style.removeProperty('--home-promo-wave-delay');
  }
  void boardHost.offsetWidth;
  items.forEach((el, i) => {
    const delay = Math.min(i * BOARD_STAGGER_MS, BOARD_STAGGER_MAX_MS);
    el.style.setProperty('--home-promo-wave-delay', `${delay}ms`);
    el.classList.add('home-promo__item--depart');
  });

  const lastDelay = Math.min(
    (items.length - 1) * BOARD_STAGGER_MS,
    BOARD_STAGGER_MAX_MS,
  );
  return sleep(BOARD_DEPART_MS + lastDelay + 16);
}

/** Occupied FilledSlot cells already faded in this board cycle. */
const fabricSeen = new Set();

/**
 * Pool reuse keeps the same DOM nodes. Depart fill-mode would leave them at scale(0)
 * on the next loop of the same build.
 * @param {HTMLElement} boardHost
 */
function clearPromoWave(boardHost) {
  boardHost.querySelectorAll('.home-promo__item--depart, .home-promo__item--appear').forEach((el) => {
    el.classList.remove('home-promo__item--depart', 'home-promo__item--appear');
    if (el instanceof HTMLElement) el.style.removeProperty('--home-promo-wave-delay');
  });
}

/**
 * Fade FilledSlot fabric + bag silhouette in for newly occupied cells.
 * @param {HTMLElement} boardHost
 */
function fadeNewBagChrome(boardHost) {
  const next = new Set();
  boardHost.querySelectorAll('.bpb-bg__fabric .bpb-bg__cell--bag').forEach((cell) => {
    if (!(cell instanceof HTMLElement)) return;
    const key = `${cell.style.left}|${cell.style.top}`;
    next.add(key);
    if (!fabricSeen.has(key)) cell.classList.add('home-promo__fabric-in');
  });
  fabricSeen.clear();
  next.forEach((k) => fabricSeen.add(k));
  boardHost.querySelectorAll('.bpb-bg__item--bag').forEach((el) => {
    el.classList.toggle(
      'home-promo__bag-chrome-in',
      !el.classList.contains('bpb-bg__item--parked'),
    );
  });
}

/**
 * @param {{
 *   grid?: { update: Function, destroy?: Function } | null,
 *   boardHost: HTMLElement,
 *   catalogRoot: HTMLElement | null,
 *   captionEl?: HTMLElement | null,
 *   boardLink?: HTMLAnchorElement | null,
 *   infoEl?: HTMLElement | null,
 *   root: string,
 *   catalogReady?: Promise<unknown>,
 * }} opts
 */
export async function playAssemble(opts) {
  const { boardHost, catalogRoot, captionEl, boardLink, infoEl, root } = opts;
  if (!(boardHost instanceof HTMLElement)) return;

  const base = root.endsWith('/') ? root : `${root}/`;
  let builds = [];
  /** @type {Awaited<ReturnType<typeof loadAssetExtras>>} */
  let extras;
  try {
    const extrasP = loadAssetExtras(base);
    const buildsP = fetchRealBuilds();
    if (opts.catalogReady) await opts.catalogReady;
    extras = await extrasP;
    builds = await buildsP;
  } catch (err) {
    console.warn('[home-promo] assemble fetch failed', err);
    paintPromoCaption(captionEl, null, base, boardLink, infoEl);
    boardHost.replaceChildren();
    return;
  }
  if (!builds.length) {
    paintPromoCaption(captionEl, null, base, boardLink, infoEl);
    boardHost.replaceChildren();
    return;
  }

  const getSpriteUrl = makeSpriteUrl(base, extras.spriteDisplay);
  const grid = remountBoard(boardHost, getSpriteUrl, opts.grid);
  if (!grid) return;
  const reduced = prefersReducedMotion();

  while (boardHost.isConnected) {
    for (const build of builds) {
      if (!boardHost.isConnected) return;
      const mapped = placementsForBuild(build, {
        shapes: extras.shapes,
        sockets: extras.sockets,
        getSpriteUrl,
      });
      const ordered = orderPlacements(mapped.placements, mapped.itemsById);
      if (!ordered.length) continue;

      paintPromoCaption(captionEl, build, base, boardLink, infoEl);
      grid.update([], mapped.itemsById);
      clearPromoWave(boardHost);
      fabricSeen.clear();

      if (reduced) {
        grid.update(ordered, mapped.itemsById);
        await sleep(HOLD_MS);
        grid.update([], mapped.itemsById);
        continue;
      }

      const placed = [];
      for (const group of groupPlacements(ordered)) {
        if (!boardHost.isConnected) return;
        const first = group[0];
        const item = mapped.itemsById.get(first.id);
        const src = item ? getSpriteUrl(item) : '';
        const node = await seekPromoCatalogItem(catalogRoot, first.id);
        await sleep(SEEK_BEAT_MS);
        const from =
          node instanceof HTMLElement
            ? originFromNode(node)
            : catalogOrigin(catalogRoot, first.id);
        const hideP = hidePromoCatalogItem(catalogRoot, first.id);
        const arrived = group.map(() => null);
        const landPs = group.map((p, i) =>
          sleep(i * FLY_STAGGER_MS).then(async () => {
            if (!boardHost.isConnected) return;
            if (src) {
              await flyGhost({
                src,
                from,
                to: cellTarget(boardHost, p, item || null),
                rotate: faceDeg(p.r),
              });
            } else await sleep(FLY_MS);
            if (!boardHost.isConnected) return;
            arrived[i] = p;
            const prefix = [];
            for (let k = 0; k < group.length; k += 1) {
              if (!arrived[k]) break;
              prefix.push(arrived[k]);
            }
            clearPromoWave(boardHost);
            grid.update(placed.concat(prefix), mapped.itemsById);
            fadeNewBagChrome(boardHost);
          }),
        );
        await Promise.all([hideP, ...landPs]);
        placed.push(...group);
      }

      await sleep(HOLD_MS);
      if (!boardHost.isConnected) return;
      await Promise.all([
        departBoardItems(boardHost),
        restorePromoCatalogItems(catalogRoot),
      ]);
      if (!boardHost.isConnected) return;
      grid.update([], mapped.itemsById);
      clearPromoWave(boardHost);
      fabricSeen.clear();
    }
  }
}

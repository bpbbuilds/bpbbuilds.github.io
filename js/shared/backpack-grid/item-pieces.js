/**
 * Build item + rarity-under DOM nodes for the Itemiary pool.
 */

import { shapeForItem, bodyBounds } from './shape.js';
import { spriteSizeStyle } from './sprite-size.js';
import { animateSpinRotate, prefersReducedMotion, readRotateDeg, writeSpinRotate } from './face-spin.js';
import { liveInnerHtml, mountLiveArt, syncLiveArtFace, unmountLiveArt } from '../item-live-art/index.js';

const CDN = 'https://awerc.github.io/bpb-cdn';
/** Off-board park X (em), mirrors game clear() parking. */
export const PARK_X_EM = -10000;
/** Extra rows above/below the viewport that still join the appear wave / sprite warm. */
export const APPEAR_VIEW_PAD_EM = 1;

const RARITIES = new Set(['Common', 'Rare', 'Epic', 'Legendary', 'Godly', 'Unique']);

function assetPrefix() {
  const raw = document.body?.dataset?.root ?? './';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function bagSlotUrl() {
  return `${assetPrefix()}assets/icons/FilledSlot.png`;
}

function gridIconUrl(name) {
  return `${assetPrefix()}assets/icons/grid/${name}.png`;
}

function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rarityKey(r) {
  const v = String(r || 'Common');
  return RARITIES.has(v) ? v : 'Common';
}

function isBagItem(item) {
  return String(item?.type || '') === 'Bag';
}

/**
 * Game Bag.getBagLayerPriority — Unique > effect bags > plain space bags.
 * Effect ≈ Icon/Border present (non-trivial bag effect text).
 * @param {object | null | undefined} item
 */
export function bagLayerPriority(item) {
  if (!isBagItem(item)) return 0;
  if (String(item?.rarity || '') === 'Unique') return 2;
  const effect = String(item?.effect || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!effect) return 0;
  // Leather / Stamina Sack style: only capacity (+ optional max stamina)
  if (
    /^Add \d+ backpack slots\.?( Gain \d+ maximum stamina\.?)?$/i.test(effect)
  ) {
    return 0;
  }
  return 1;
}

/**
 * Stacking z for placed boards: bags under items; among bags, higher priority on top.
 * Mirrors Bag.resetZ (-2 under items) + move_child by getBagLayerPriority.
 * @param {object | null | undefined} item
 * @param {number} [orderIndex]
 */
export function placedStackZ(item, orderIndex = 0) {
  const i = Number.isFinite(orderIndex) ? orderIndex : 0;
  if (isBagItem(item)) {
    return bagLayerPriority(item) * 100 + (i % 100);
  }
  return 10000 + i;
}

/**
 * @param {{ x: number, y: number }[]} cells
 * @param {{ minX: number, minY: number }} bounds
 * @param {string} className
 * @param {string} cellUrl
 */
function cellSpans(cells, bounds, className, cellUrl, withLocal = false) {
  return cells
    .map((c) => {
      const left = c.x - bounds.minX;
      const top = c.y - bounds.minY;
      const local = withLocal ? ` data-ox="${left}" data-oy="${top}"` : '';
      return `<span class="${className}"${local} style="left:${left}em;top:${top}em;background-image:url('${escapeAttr(cellUrl)}')" aria-hidden="true"></span>`;
    })
    .join('');
}

function bodyCellSpans(shape, bounds, className, cellUrl) {
  return cellSpans(shape.body, bounds, className, cellUrl);
}

/**
 * Socket center styles (shared by empty hover sockets + always-visible gems).
 * @param {object} item
 * @param {ReturnType<typeof shapeForItem>} shape
 * @param {{ minX: number, minY: number }} bounds
 * @param {number} slotCount
 * @returns {{ i: number, posStyle: string }[]}
 */
function socketPositions(item, shape, bounds, slotCount) {
  /** @type {{ i: number, posStyle: string }[]} */
  const out = [];
  const offsets = Array.isArray(item.socketOffsets) ? item.socketOffsets : null;
  if (offsets?.length) {
    for (let i = 0; i < offsets.length; i += 1) {
      const x = Number(offsets[i]?.x);
      const y = Number(offsets[i]?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      out.push({
        i,
        posStyle: `left:calc(50% + ${x} * var(--bpb-bg-cell));top:calc(50% + ${y} * var(--bpb-bg-cell));`,
      });
    }
    return out;
  }

  const n = Math.max(0, Math.floor(slotCount) || 0);
  if (!n || !shape.body.length) return out;
  const body = shape.body;
  for (let i = 0; i < n; i += 1) {
    const idx =
      n === 1
        ? Math.floor(body.length / 2)
        : Math.round((i * (body.length - 1)) / Math.max(1, n - 1));
    const c = body[Math.min(body.length - 1, Math.max(0, idx))];
    const left = c.x - bounds.minX + 0.5;
    const top = c.y - bounds.minY + 0.5;
    out.push({ i, posStyle: `left:${left}em;top:${top}em;` });
  }
  return out;
}

/**
 * @param {string | { url?: string, w?: number, h?: number, id?: string, name?: string, rarity?: string } | null | undefined} g
 * @returns {{ url: string, w: number, h: number, id: string, name: string, rarity: string, r: number } | null}
 */
function normalizeGem(g) {
  if (!g) return null;
  if (typeof g === 'string') {
    return { url: g, w: 0.72, h: 0.72, id: '', name: '', rarity: '', r: 0 };
  }
  const url = g.url;
  if (!url) return null;
  const w = Number(g.w);
  const h = Number(g.h);
  const face = Math.round(Number(g.r));
  return {
    url,
    w: Number.isFinite(w) && w > 0 ? w : 0.72,
    h: Number.isFinite(h) && h > 0 ? h : 0.72,
    id: g.id ? String(g.id) : '',
    name: g.name ? String(g.name) : '',
    rarity: g.rarity ? String(g.rarity) : '',
    r: Number.isFinite(face) ? ((face % 4) + 4) % 4 : 0,
  };
}

/**
 * Socket chrome for every socket (empty + occupied). Shown board-wide when a
 * gem is hovered (game Game.showSockets), not on host-item hover.
 * @param {object} item
 * @param {ReturnType<typeof shapeForItem>} shape
 * @param {{ minX: number, minY: number }} bounds
 * @param {(string | { url?: string } | null | undefined)[]} [gems]
 */
function socketChromeSpans(item, shape, bounds, gems = []) {
  const emptyUrl = gridIconUrl('Socket');
  const n = Math.max(
    Math.floor(Number(item.sockets) || 0),
    gems.length,
    Array.isArray(item.socketOffsets) ? item.socketOffsets.length : 0,
  );
  if (!n) return '';
  return socketPositions(item, shape, bounds, n)
    .map(({ i, posStyle }) => {
      // Filled slots hide Socket.png (see .is-occupied). The gem paints above.
      const occupied = normalizeGem(gems[i]) ? ' is-occupied' : '';
      return `<span class="bpb-bg__mark bpb-bg__mark--socket${occupied}" data-socket-slot="${i}" style="${posStyle}background-image:url('${escapeAttr(emptyUrl)}')" aria-hidden="true"></span>`;
    })
    .join('');
}

/**
 * @param {object} item
 * @param {ReturnType<typeof shapeForItem>} shape
 * @param {{ minX: number, minY: number }} bounds
 * @param {(string | { url?: string } | null | undefined)[]} [gems]
 */
function socketLayerHtml(item, shape, bounds, gems = []) {
  const parts = socketChromeSpans(item, shape, bounds, gems);
  if (!parts) return '';
  return `<div class="bpb-bg__sockets" aria-hidden="true">${parts}</div>`;
}

/**
 * Socketed gems — always visible (game shows gems without hover).
 * Sized from sprite-display (w/h in cells) so tall gems like Corrupted Crystal aren't cropped.
 * @param {object} item
 * @param {ReturnType<typeof shapeForItem>} shape
 * @param {{ minX: number, minY: number }} bounds
 * @param {(string | { url?: string, w?: number, h?: number } | null | undefined)[]} [gems]
 * @param {number} [hostFace] host quarter-turns; gems sit inside that spin
 */
function gemLayerHtml(item, shape, bounds, gems = [], hostFace = 0) {
  if (!gems.some((g) => normalizeGem(g))) return '';
  const n = Math.max(
    Math.floor(Number(item.sockets) || 0),
    gems.length,
    Array.isArray(item.socketOffsets) ? item.socketOffsets.length : 0,
  );
  const hostDeg = (((Number(hostFace) || 0) % 4) + 4) % 4 * 90;
  const parts = socketPositions(item, shape, bounds, n)
    .map(({ i, posStyle }) => {
      const gem = normalizeGem(gems[i]);
      if (!gem) return '';
      const idAttr = gem.id
        ? ` data-item-id="${escapeAttr(gem.id)}"`
        : '';
      const rarityAttr = gem.rarity
        ? ` data-rarity="${escapeAttr(gem.rarity)}"`
        : '';
      const label = gem.name || 'Gem';
      // data-gem-deg is the held-item facing. Local rotate undoes the host spin.
      const world = gem.r * 90;
      const rot = `rotate:${world - hostDeg}deg;`;
      return `<img class="bpb-bg__mark bpb-bg__mark--socket bpb-bg__mark--gem" data-gem-slot="${i}" data-gem-deg="${world}"${idAttr}${rarityAttr} src="${escapeAttr(gem.url)}" alt="${escapeAttr(label)}" title="" draggable="false" style="${posStyle}${rot}width:${gem.w}em;height:${gem.h}em" />`;
    })
    .filter(Boolean);
  if (!parts.length) return '';
  return `<div class="bpb-bg__gems">${parts.join('')}</div>`;
}

/**
 * @param {object} item
 * @param {ReturnType<typeof shapeForItem>} shape
 * @param {{ minX: number, minY: number }} bounds
 */
function hoverMarkersHtml(item, shape, bounds) {
  const parts = [
    // Inventory Above tiles: noEffect → CanAffect (primary stars / secondary diamonds / …)
    cellSpans(
      shape.stars,
      bounds,
      'bpb-bg__mark bpb-bg__mark--star',
      gridIconUrl('AffectedTile_noEffect'),
      true,
    ),
    cellSpans(
      shape.diamonds,
      bounds,
      'bpb-bg__mark bpb-bg__mark--diamond',
      gridIconUrl('AffectedTile_secondary_noEffect'),
      true,
    ),
    cellSpans(
      shape.extensions,
      bounds,
      'bpb-bg__mark bpb-bg__mark--extension',
      gridIconUrl('Extension'),
      true,
    ),
    cellSpans(
      shape.tertiaries,
      bounds,
      'bpb-bg__mark bpb-bg__mark--tertiary',
      gridIconUrl('AffectedTile_tertiary_noEffect'),
      true,
    ),
    cellSpans(
      shape.lightnings,
      bounds,
      'bpb-bg__mark bpb-bg__mark--lightning',
      gridIconUrl('AffectedTile_lightning_noEffect'),
      true,
    ),
  ].filter(Boolean);
  if (!parts.length) return '';
  return `<div class="bpb-bg__markers" aria-hidden="true">${parts.join('')}</div>`;
}

/**
 * @param {string} html
 * @returns {HTMLElement | null}
 */
function elementFromHtml(html) {
  const wrap = document.createElement('div');
  wrap.innerHTML = html.trim();
  const el = wrap.firstElementChild;
  return el instanceof HTMLElement ? el : null;
}

/** Cap so a stuck decode cannot block catalog init / filter bind. */
const SPRITE_WARM_TIMEOUT_MS = 2500;

/** Baked still only — Itemiary scroll must not pull glow layers (potions stay live). */
const BROWSE_STILL_ATTACH =
  'img.bpb-bg__sprite[data-src]:not(.bpb-live__layer), img.bpb-live__base[data-src]';
const BROWSE_STILL_PENDING =
  'img.bpb-bg__sprite[data-src]:not([src]):not(.bpb-live__layer), img.bpb-live__base[data-src]:not([src])';
const BROWSE_STILL_SRC =
  'img.bpb-bg__sprite[src]:not(.bpb-live__layer), img.bpb-live__base[src]';
const FULL_LAYER_ATTACH =
  'img.bpb-bg__sprite[data-src], img.bpb-live__layer[data-src]';
const FULL_LAYER_PENDING =
  'img.bpb-bg__sprite[data-src]:not([src]), img.bpb-live__layer[data-src]:not([src])';
const FULL_LAYER_SRC = 'img.bpb-bg__sprite[src], img.bpb-live__layer[src]';

/**
 * Itemiary bag (not spotlight clone) — stills while scrolling (except potions).
 * @param {HTMLElement} itemEl
 */
function isItemiaryBrowseItem(itemEl) {
  return Boolean(
    itemEl.closest('.bpb-bg--itemiary') && !itemEl.closest('.il-spotlight'),
  );
}

/** @param {HTMLElement} itemEl */
function isPotionLiveItem(itemEl) {
  return Boolean(itemEl.querySelector('.bpb-live[data-live-kind="potion"]'));
}

/**
 * @param {HTMLElement} itemEl
 * @param {string} selector
 * @returns {HTMLImageElement[]}
 */
function attachMatchingSrc(itemEl, selector) {
  /** @type {HTMLImageElement[]} */
  const attached = [];
  for (const img of itemEl.querySelectorAll(selector)) {
    if (!(img instanceof HTMLImageElement)) continue;
    const url = img.getAttribute('data-src');
    if (!url || img.getAttribute('src')) continue;
    img.loading = 'eager';
    img.src = url;
    attached.push(img);
  }
  return attached;
}

/**
 * Copy data-src → src on browse stills only (thumb / base). Potions use full live.
 * @param {HTMLElement} itemEl
 * @returns {HTMLImageElement[]}
 */
export function attachBrowseStills(itemEl) {
  if (!(itemEl instanceof HTMLElement)) return [];
  return attachMatchingSrc(itemEl, BROWSE_STILL_ATTACH);
}

/**
 * Copy data-src → src on main + all live layers (boards / focus / spotlight).
 * Forces eager — native lazy + --sprite-pending (visibility:hidden) never fetches,
 * so decode() hangs and the catalog stays blank.
 * @param {HTMLElement} itemEl
 * @returns {HTMLImageElement[]} imgs that received a new src
 */
export function attachSpriteSrc(itemEl) {
  if (!(itemEl instanceof HTMLElement)) return [];
  return attachMatchingSrc(itemEl, FULL_LAYER_ATTACH);
}

/**
 * True when deferred sprites needed for the current mode are not attached yet.
 * Itemiary browse ignores dormant glow data-src; potions need full flask/overlay.
 * @param {HTMLElement} itemEl
 */
export function needsSpriteAttach(itemEl) {
  if (!(itemEl instanceof HTMLElement)) return false;
  if (isItemiaryBrowseItem(itemEl)) {
    if (isPotionLiveItem(itemEl)) {
      return Boolean(itemEl.querySelector(FULL_LAYER_PENDING));
    }
    return Boolean(itemEl.querySelector(BROWSE_STILL_PENDING));
  }
  return Boolean(itemEl.querySelector(FULL_LAYER_PENDING));
}

/**
 * Hide until sprites attach (avoids empty flash before warm / IO).
 * @param {HTMLElement} itemEl
 */
export function markSpritePending(itemEl) {
  if (needsSpriteAttach(itemEl)) {
    itemEl.classList.add('bpb-bg__item--sprite-pending');
  }
}

/**
 * @param {HTMLImageElement} img
 * @returns {Promise<void>}
 */
function waitSpriteReady(img) {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      img.removeEventListener('load', done);
      img.removeEventListener('error', done);
      resolve();
    };
    img.addEventListener('load', done);
    img.addEventListener('error', done);
    // decode() can hang when the browser deferred the fetch; load/error are the source of truth.
    if (typeof img.decode === 'function') {
      img.decode().then(done, done);
    }
    window.setTimeout(done, SPRITE_WARM_TIMEOUT_MS);
  });
}

/**
 * Attach deferred srcs and await load/decode for the given item roots.
 * Itemiary: potions full live; other browse stills only. Boards/spotlight: full live.
 * Clears --sprite-pending after ready (or timeout) so init cannot stall.
 * @param {Iterable<HTMLElement>} itemEls
 * @returns {Promise<void>}
 */
export function warmItemSprites(itemEls) {
  /** @type {Promise<unknown>[]} */
  const waits = [];
  /** @type {HTMLElement[]} */
  const roots = [];
  for (const el of itemEls) {
    if (!(el instanceof HTMLElement)) continue;
    roots.push(el);
    if (isItemiaryBrowseItem(el) && !isPotionLiveItem(el)) {
      attachBrowseStills(el);
      for (const img of el.querySelectorAll(BROWSE_STILL_SRC)) {
        if (img instanceof HTMLImageElement) waits.push(waitSpriteReady(img));
      }
    } else {
      attachSpriteSrc(el);
      mountLiveArt(el);
      for (const img of el.querySelectorAll(FULL_LAYER_SRC)) {
        if (img instanceof HTMLImageElement) waits.push(waitSpriteReady(img));
      }
    }
  }
  return Promise.all(waits).then(() => {
    for (const el of roots) el.classList.remove('bpb-bg__item--sprite-pending');
  });
}

/**
 * Hover / focus — pull glow layers + start WebGL/CSS live art.
 * @param {HTMLElement} itemEl
 */
export function activateItemLiveArt(itemEl) {
  if (!(itemEl instanceof HTMLElement)) return;
  if (!itemEl.querySelector('.bpb-live')) return;
  attachSpriteSrc(itemEl);
  mountLiveArt(itemEl);
}

/**
 * Leave hover — stop RAF for glow/holo; potions stay animated while visible.
 * @param {HTMLElement} itemEl
 */
export function deactivateItemLiveArt(itemEl) {
  if (!(itemEl instanceof HTMLElement)) return;
  if (isPotionLiveItem(itemEl)) return;
  unmountLiveArt(itemEl);
}

/**
 * Entries whose board y-span intersects the scroller viewport (+ pad).
 * Same cull as AppearInLibrary Itemiary wave.
 *
 * Prefer passing `metrics` from paintNow (known cellPx/rows) to avoid
 * getComputedStyle right after paintPooled dirties layout.
 *
 * @param {Element} root — .bpb-bg scroller
 * @param {{ itemEl: HTMLElement, x?: number, y?: number }[]} entries
 * @param {number} [padEm]
 * @param {{ cellPx?: number, rows?: number, scrollTop?: number, clientHeight?: number, scrollLeft?: number, clientWidth?: number }} [metrics]
 * @returns {typeof entries}
 */
export function filterEntriesNearViewport(
  root,
  entries,
  padEm = APPEAR_VIEW_PAD_EM,
  metrics = undefined,
) {
  if (!entries.length) return [];
  const scroller = /** @type {HTMLElement} */ (root);
  let cellPx = metrics?.cellPx;
  let rows = metrics?.rows;
  if (!(cellPx > 0) || !(rows > 0)) {
    const cs = getComputedStyle(scroller);
    if (!(cellPx > 0)) cellPx = parseFloat(cs.getPropertyValue('--bpb-bg-cell')) || 34;
    if (!(rows > 0)) rows = parseFloat(cs.getPropertyValue('--bpb-bg-rows')) || 1;
  }
  const clientHeight =
    metrics?.clientHeight != null ? metrics.clientHeight : scroller.clientHeight;
  const maxScroll = Math.max(0, rows * cellPx - clientHeight);
  const rawScroll =
    metrics?.scrollTop != null ? metrics.scrollTop : scroller.scrollTop;
  const scrollTop = Math.min(rawScroll, maxScroll);
  const viewBottom = scrollTop + clientHeight;
  const padPx = padEm * cellPx;
  /** @type {typeof entries} */
  const near = [];
  for (const entry of entries) {
    const y = Number.isFinite(entry.y) ? /** @type {number} */ (entry.y) : 0;
    const hEm = parseFloat(entry.itemEl.style.height) || 1;
    const topPx = y * cellPx;
    const bottomPx = (y + hEm) * cellPx;
    if (bottomPx < scrollTop - padPx || topPx > viewBottom + padPx) continue;
    const clientWidth = metrics?.clientWidth || 0;
    if (clientWidth > 0) {
      const scrollLeft = Math.max(0, metrics?.scrollLeft || 0);
      const viewRight = scrollLeft + clientWidth;
      const x = Number.isFinite(entry.x) ? /** @type {number} */ (entry.x) : 0;
      const wEm = parseFloat(entry.itemEl.style.width) || 1;
      const leftPx = x * cellPx;
      const rightPx = (x + wEm) * cellPx;
      if (rightPx < scrollLeft - padPx || leftPx > viewRight + padPx) continue;
    }
    near.push(entry);
  }
  return near;
}

/**
 * @param {object} item
 * @param {(item: object) => string} getSpriteUrl
 * @param {number} stackZ
 * @param {number} [face] Game FaceDirection 0–3 (UP/RIGHT/DOWN/LEFT)
 * @param {(string | { url?: string, w?: number, h?: number } | null | undefined)[]} [gems] socketed gems
 * @param {{
 *   libraryBagScale?: boolean,
 *   deferSprite?: boolean,
 *   chrome?: boolean,
 *   shadow?: boolean,
 *   bagSlots?: boolean,
 * }} [opts]
 *   deferSprite: Itemiary pool — data-src only until warm/IO (parked eager would fetch all).
 *   chrome: hover markers / hit pads / empty sockets (default true).
 * @returns {HTMLElement | null}
 */
export function createItemEl(item, getSpriteUrl, stackZ, face = 0, gems = [], opts = {}) {
  const r = ((Number(face) || 0) % 4 + 4) % 4;
  // Layout art/slots in UP orientation, then spin the whole node like Godot Item.rotation
  const shape = shapeForItem(item, 0);
  const bounds = item.__bpbBounds || (item.__bpbBounds = bodyBounds(shape));
  const rotShape = r ? shapeForItem(item, r) : shape;
  const rotBounds = r ? bodyBounds(rotShape) : bounds;
  const rarity = rarityKey(item.rarity);
  const bag = isBagItem(item);
  const z = Number.isFinite(stackZ) ? stackZ : placedStackZ(item, 1);

  const useChrome = opts.chrome !== false;
  const useShadow = opts.shadow !== false;
  const useBagSlots = opts.bagSlots !== false;
  const bagSlots =
    bag && useBagSlots
      ? `<div class="bpb-bg__bag-slots" aria-hidden="true">${bodyCellSpans(
          shape,
          bounds,
          'bpb-bg__cell bpb-bg__cell--bag',
          bagSlotUrl(),
        )}</div>`
      : '';

  const src =
    String(item.id) === '__unrecognized__' ? '' : getSpriteUrl(item);
  const deferSprite = opts.deferSprite === true;
  const sizeStyle = spriteSizeStyle(item, bounds, {
    libraryBagScale: opts.libraryBagScale === true,
  });
  const ax = Number(item?.spriteAnchorX) || 0;
  const ay = Number(item?.spriteAnchorY) || 0;
  const anchorStyle =
    ax || ay
      ? `left:calc(50% + ${ax} * var(--bpb-bg-cell));top:calc(50% + ${ay} * var(--bpb-bg-cell));`
      : '';
  // Deferred: data-src only (no loading=lazy — hidden pending nodes never fetch).
  const liveImg = liveInnerHtml(item, {
    src,
    defer: deferSprite,
    anchorStyle,
    sizeStyle,
  });
  const img = liveImg
    ? liveImg
    : src
      ? deferSprite
        ? `<img class="bpb-bg__sprite" data-src="${escapeAttr(src)}" alt="" draggable="false" decoding="async" style="${anchorStyle}${sizeStyle}" />`
        : `<img class="bpb-bg__sprite" src="${escapeAttr(src)}" alt="" draggable="false" loading="eager" decoding="async" style="${anchorStyle}${sizeStyle}" />`
      : `<span class="bpb-bg__sprite bpb-bg__sprite--empty" aria-hidden="true"></span>`;

  // Game: duplicate sprite, modulate (0,0,0,0.5), global_position + (5,5) — offset in
  // world space, not local, so SE stays SE after rotation (Item.shadowOffset_dropped).
  const shadowImg =
    src && useShadow
      ? deferSprite
        ? `<img class="bpb-bg__sprite bpb-bg__sprite--shadow" data-src="${escapeAttr(src)}" alt="" draggable="false" decoding="async" style="${anchorStyle}${sizeStyle}" aria-hidden="true" />`
        : `<img class="bpb-bg__sprite bpb-bg__sprite--shadow" src="${escapeAttr(src)}" alt="" draggable="false" loading="eager" decoding="async" style="${anchorStyle}${sizeStyle}" aria-hidden="true" />`
      : '';

  const hitPads = useChrome
    ? shape.body
        .map((c) => {
          const left = c.x - bounds.minX;
          const top = c.y - bounds.minY;
          return `<span class="bpb-bg__hit-pad" style="left:${left}em;top:${top}em" aria-hidden="true"></span>`;
        })
        .join('')
    : '';

  // Godot: rotation = face * π/2. Use individual CSS props so translate
  // runs before rotate (shorthand would rotate then translate and skew the pivot).
  const spinStyle = `width:${bounds.w}em;height:${bounds.h}em;translate:-50% -50%;rotate:${r * 90}deg;`;
  // Same spin + world-space SE nudge (5/80 cell) outside local rotate.
  const shadowSpinStyle = `width:${bounds.w}em;height:${bounds.h}em;translate:calc(-50% + 0.0625em) calc(-50% + 0.0625em);rotate:${r * 90}deg;`;

  // z-index on the item root — spin's transform creates a stacking context, so
  // hit z-index alone can no longer lift items above bags painted later in DOM.
  const itemClass = String(item.class || 'Neutral');
  const itemType = String(item.type || '');
  const extraTypes = Array.isArray(item.extraTypes) ? item.extraTypes.map(String).join(',') : '';
  const tags = Array.isArray(item.tags) ? item.tags.map(String).join(',') : '';
  const html = `
    <div
      class="bpb-bg__item${bag ? ' bpb-bg__item--bag' : ''}${
        String(item.id) === '__unrecognized__' ? ' bpb-bg__item--unrecognized' : ''
      } bpb-bg__item--parked"
      data-item-id="${escapeAttr(item.id)}"
      data-item-type="${escapeAttr(itemType)}"
      data-item-class="${escapeAttr(itemClass)}"
      data-extra-types="${escapeAttr(extraTypes)}"
      data-tags="${escapeAttr(tags)}"
      data-cooldown="${escapeAttr(item.cooldown ?? '')}"
      data-damage-min="${escapeAttr(item.damageMin ?? '')}"
      data-block="${escapeAttr(item.block ?? '')}"
      data-chance="${escapeAttr(item.chance ?? '')}"
      data-stamina-cost="${escapeAttr(item.staminaCost ?? '')}"
      data-effect="${escapeAttr(item.effect ?? '')}"
      data-face="${r}"
      data-rarity="${escapeAttr(rarity)}"
      style="left:${PARK_X_EM}em;top:0;width:${rotBounds.w}em;height:${rotBounds.h}em;z-index:${z}"
      ${String(item.id) === '__unrecognized__' ? 'title="Unrecognized item"' : ''}
    >
      ${
        String(item.id) === '__unrecognized__'
          ? `<span class="bpb-bg__unrecognized-label" aria-hidden="true">?</span>`
          : ''
      }
      ${
        shadowImg
          ? `<div class="bpb-bg__spin bpb-bg__spin--shadow" style="${shadowSpinStyle}" aria-hidden="true">${shadowImg}</div>`
          : ''
      }
      <div class="bpb-bg__spin" style="${spinStyle}">
        <button type="button" class="bpb-bg__hit" aria-label="${escapeAttr(item.name)}">
          ${img}
          ${hitPads}
        </button>
        ${bagSlots}
        ${useChrome ? socketLayerHtml(item, shape, bounds, gems) : ''}
        ${gemLayerHtml(item, shape, bounds, gems, r)}
        ${useChrome ? hoverMarkersHtml(item, shape, bounds) : ''}
      </div>
    </div>`;
  const el = elementFromHtml(html);
  // Deferred Itemiary: bind shaders on warm/IO, not while the node is parked.
  if (el instanceof HTMLElement && !deferSprite) mountLiveArt(el);
  return el;
}

/**
 * Under wrapper with relative rarity cells (moved with the item).
 * @param {object} item
 * @param {number} [face]
 * @returns {HTMLElement | null}
 */
export function createUnderEl(item, face = 0) {
  if (isBagItem(item)) return null;
  const r = ((Number(face) || 0) % 4 + 4) % 4;
  const shape = shapeForItem(item, 0);
  const bounds = item.__bpbBounds || (item.__bpbBounds = bodyBounds(shape));
  const rotBounds = r ? bodyBounds(shapeForItem(item, r)) : bounds;
  const rarity = rarityKey(item.rarity);
  const cells = shape.body
    .map((c) => {
      const left = c.x - bounds.minX;
      const top = c.y - bounds.minY;
      const url = `${CDN}/cells/${encodeURIComponent(rarity)}.webp`;
      return `<span class="bpb-bg__cell bpb-bg__cell--rarity" data-item-id="${escapeAttr(item.id)}" style="left:${left}em;top:${top}em;background-image:url('${escapeAttr(url)}')" aria-hidden="true"></span>`;
    })
    .join('');
  const spinStyle = `width:${bounds.w}em;height:${bounds.h}em;translate:-50% -50%;rotate:${r * 90}deg;`;
  const html = `<div class="bpb-bg__under-item bpb-bg__under-item--parked" data-item-id="${escapeAttr(item.id)}" style="left:${PARK_X_EM}em;top:0;width:${rotBounds.w}em;height:${rotBounds.h}em"><div class="bpb-bg__spin" style="${spinStyle}">${cells}</div></div>`;
  return elementFromHtml(html);
}

/**
 * @param {HTMLElement} itemEl
 * @param {number} z
 */
export function setItemZ(itemEl, z) {
  itemEl.style.zIndex = String(z);
  const bagSlots = itemEl.querySelector('.bpb-bg__bag-slots');
  if (bagSlots instanceof HTMLElement) bagSlots.style.zIndex = String(z + 1);
}

const APPEAR_ITEM = ['bpb-bg__item--appear', 'bpb-bg__item--appear-bag'];
const APPEAR_UNDER = ['bpb-bg__under-item--appear', 'bpb-bg__under-item--appear-bag'];

/** Viewport wave: ~2ms per on-screen item, hard cap so the wave stays snappy. */
const APPEAR_STAGGER_MS = 2;
const APPEAR_STAGGER_MAX_MS = 400;

/**
 * Restart AppearInLibrary with **one** reflow.
 * Itemiary: wave only entries in (or near) the scroll viewport.
 * Placed boards (builds): wave the whole board — root is not a scroller.
 *
 * Bags: Itemiary ends at scale 0.9 (AppearInLibrarySmall + resting CSS).
 * Build placed boards use the normal wave ending at 1 — otherwise fill-mode
 * would leave bags stuck at 0.9 after load.
 *
 * Note: Itemiary library layout also has `--placed` (exact coords) but must
 * still use the 0.9 bag wave, or bags snap from 1 → 0.9 when appear clears.
 *
 * @param {Element} root — scroll container (.bpb-bg)
 * @param {{
 *   itemEl: HTMLElement,
 *   underEl: HTMLElement | null,
 *   isBag?: boolean,
 *   x?: number,
 *   y?: number,
 * }[]} entries
 * @param {{
 *   layer?: 'item' | 'under',
 *   inView?: typeof entries,
 *   metrics?: { cellPx?: number, rows?: number, scrollTop?: number, clientHeight?: number },
 * }} [opts]
 *   layer 'under' = loading preview (footprints); 'item' = filter refresh (sprites)
 *   inView = precomputed near-viewport list (Itemiary paintNow cull once)
 */
export function playAppearInLibraryBatch(root, entries, opts = {}) {
  if (!entries.length) return;
  const layer = opts.layer === 'under' ? 'under' : 'item';
  const itemiary = root.classList.contains('bpb-bg--itemiary');
  const placedBoard = root.classList.contains('bpb-bg--placed');
  // Itemiary bags rest at 0.9 even when `--placed` is used for library layout.
  const bagSmall = itemiary || !placedBoard;

  for (const { itemEl, underEl } of entries) {
    clearAppear(itemEl, underEl);
  }

  const scroller = /** @type {HTMLElement} */ (root);

  /** @type {typeof entries} */
  let inView;
  if (Array.isArray(opts.inView)) {
    inView = opts.inView;
  } else if (placedBoard) {
    inView = [...entries];
  } else {
    inView = filterEntriesNearViewport(root, entries, APPEAR_VIEW_PAD_EM, opts.metrics);
  }

  // Nothing on screen to wave (e.g. scroll past new shorter results) — leave at rest
  if (!inView.length) return;

  // Reading order within the viewport
  inView.sort((a, b) => {
    const dy = (a.y ?? 0) - (b.y ?? 0);
    if (dy) return dy;
    return (a.x ?? 0) - (b.x ?? 0);
  });

  // Single intentional flush after clearAppear — restarts CSS animation.
  // No getComputedStyle/clientHeight between clear and class-add.
  void scroller.offsetWidth;

  for (let i = 0; i < inView.length; i += 1) {
    const { itemEl, underEl, isBag } = inView[i];
    const delay = `${Math.min(i * APPEAR_STAGGER_MS, APPEAR_STAGGER_MAX_MS)}ms`;
    const useBagAnim = Boolean(isBag && bagSmall);
    if (layer === 'under' && underEl) {
      underEl.style.setProperty('--bpb-appear-delay', delay);
      underEl.classList.add(
        useBagAnim ? 'bpb-bg__under-item--appear-bag' : 'bpb-bg__under-item--appear',
      );
      bindAppearCleanup(underEl, true);
    } else {
      itemEl.style.setProperty('--bpb-appear-delay', delay);
      itemEl.classList.add(useBagAnim ? 'bpb-bg__item--appear-bag' : 'bpb-bg__item--appear');
      bindAppearCleanup(itemEl, false);
      // Builds + Itemiary: rarity footprints wave with sprites (same delay/scale).
      if (underEl && (placedBoard || itemiary)) {
        underEl.classList.remove('bpb-bg__under-item--appear-pending');
        underEl.style.setProperty('--bpb-appear-delay', delay);
        underEl.classList.add('bpb-bg__under-item--appear');
        bindAppearCleanup(underEl, true);
      }
    }
  }
}

/**
 * After the wave: builds drop appear classes so fill-mode doesn't leave bags @ 0.9.
 *
 * Itemiary: do nothing. Keep --appear + --bpb-appear-delay so fill-mode holds the
 * end scale. Clearing the delay (or class) while the animation property still
 * applies makes Chromium recompute the timeline — a post-wave scale jump.
 * Next filter's clearAppear() strips them before restarting the wave.
 *
 * @param {HTMLElement} el
 * @param {boolean} isUnder
 */
function bindAppearCleanup(el, isUnder) {
  if (el.closest('.bpb-bg')?.classList.contains('bpb-bg--itemiary')) return;
  const onEnd = (ev) => {
    if (ev.target !== el) return;
    if (!String(ev.animationName || '').includes('bpb-bg-appear-library')) return;
    el.removeEventListener('animationend', onEnd);
    if (isUnder) {
      el.classList.remove(...APPEAR_UNDER);
      el.style.removeProperty('--bpb-appear-delay');
    } else {
      el.classList.remove(...APPEAR_ITEM);
      el.style.removeProperty('--bpb-appear-delay');
    }
  };
  el.addEventListener('animationend', onEnd, { once: true });
}

/**
 * @param {HTMLElement} itemEl
 * @param {HTMLElement | null} underEl
 */
export function clearAppear(itemEl, underEl) {
  // Do not clear --sprite-pending here: playAppear runs clearAppear on the full
  // list before the viewport cull; off-screen deferred sprites must stay hidden.
  itemEl.classList.remove(...APPEAR_ITEM, 'bpb-bg__item--leave');
  itemEl.style.removeProperty('--bpb-appear-delay');
  itemEl.style.removeProperty('transform');
  itemEl.style.removeProperty('transform-origin');
  underEl?.classList.remove(
    ...APPEAR_UNDER,
    'bpb-bg__under-item--appear-pending',
    'bpb-bg__under-item--leave',
  );
  underEl?.style.removeProperty('--bpb-appear-delay');
  underEl?.style.removeProperty('transform');
  underEl?.style.removeProperty('transform-origin');
}

/**
 * @param {HTMLElement} itemEl
 * @param {HTMLElement | null} underEl
 * @param {number} x
 * @param {number} y
 */
export function placeEntry(itemEl, underEl, x, y) {
  itemEl.classList.remove('bpb-bg__item--parked');
  itemEl.style.left = `${x}em`;
  itemEl.style.top = `${y}em`;
  if (underEl) {
    underEl.classList.remove('bpb-bg__under-item--parked');
    underEl.style.left = `${x}em`;
    underEl.style.top = `${y}em`;
  }
}

/**
 * Item.rotateTo — snap footprint to new face, ease spin art (and under) 150ms.
 * Reuses existing DOM instead of recreating the pool entry.
 *
 * @param {HTMLElement} itemEl
 * @param {HTMLElement | null | undefined} underEl
 * @param {object} item
 * @param {number} face
 * @param {{ animate?: boolean, fromDeg?: number, durationMs?: number, onDone?: () => void }} [opts]
 */
export function applyItemFace(itemEl, underEl, item, face, opts = {}) {
  const r = ((Number(face) || 0) % 4 + 4) % 4;
  const prev = Number(itemEl.getAttribute('data-face'));
  const hasFrom = Number.isFinite(opts.fromDeg);
  if (prev === r && !hasFrom) return;

  const shape = shapeForItem(item, 0);
  const bounds = item.__bpbBounds || (item.__bpbBounds = bodyBounds(shape));
  const rotBounds = r ? bodyBounds(shapeForItem(item, r)) : bounds;
  const targetDeg = r * 90;
  const animate = opts.animate !== false;
  const bag = isBagItem(item);

  itemEl.setAttribute('data-face', String(r));
  itemEl.style.width = `${rotBounds.w}em`;
  itemEl.style.height = `${rotBounds.h}em`;
  if (underEl) {
    underEl.style.width = `${rotBounds.w}em`;
    underEl.style.height = `${rotBounds.h}em`;
  }
  syncLiveArtFace(itemEl);

  /** @type {HTMLElement[]} */
  const spins = [];
  for (const el of itemEl.querySelectorAll(':scope > .bpb-bg__spin')) {
    if (el instanceof HTMLElement) spins.push(el);
  }
  if (underEl) {
    for (const el of underEl.querySelectorAll(':scope > .bpb-bg__spin')) {
      if (el instanceof HTMLElement) spins.push(el);
    }
  }

  // Game: bagTilemap rides insideRotationNode — show per-bag slots while the
  // sprite eases; shared fabric omits this bag until onDone (see item-pool).
  const spinning = animate && bag && !prefersReducedMotion();
  if (spinning) {
    itemEl.classList.add('is-face-spinning');
  }

  let pending = spins.length;
  const finish = () => {
    if (spinning) itemEl.classList.remove('is-face-spinning');
    syncLiveArtFace(itemEl);
    opts.onDone?.();
  };

  if (!spins.length) {
    finish();
    return;
  }

  for (const spin of spins) {
    spin.style.width = `${bounds.w}em`;
    spin.style.height = `${bounds.h}em`;
    animateSpinRotate(spin, targetDeg, {
      animate,
      fromDeg: hasFrom ? Number(opts.fromDeg) : undefined,
      durationMs: opts.durationMs,
      onDone: () => {
        pending -= 1;
        if (pending <= 0) finish();
      },
    });
  }
}

/**
 * Refresh socketed gem sprites + occupied socket chrome on an existing item
 * (pool reuse). createItemEl only stamps gems at create time — placements can
 * gain/lose gems later.
 *
 * @param {HTMLElement} itemEl
 * @param {object} item host armor/weapon
 * @param {(string | { url?: string, w?: number, h?: number, id?: string, name?: string, rarity?: string } | null | undefined)[]} gems
 */
export function syncItemGems(itemEl, item, gems = []) {
  const spin = itemEl.querySelector(
    ':scope > .bpb-bg__spin:not(.bpb-bg__spin--shadow)',
  );
  if (!(spin instanceof HTMLElement)) return;

  const shape = shapeForItem(item, 0);
  const bounds = item.__bpbBounds || (item.__bpbBounds = bodyBounds(shape));

  // Keep Socket.png chrome in sync (is-occupied hides a filled hole)
  const sockHtml = socketLayerHtml(item, shape, bounds, gems);
  const prevSock = spin.querySelector(':scope > .bpb-bg__sockets');
  if (sockHtml) {
    const nextSock = elementFromHtml(sockHtml);
    if (nextSock instanceof HTMLElement) {
      if (prevSock) prevSock.replaceWith(nextSock);
      else {
        const hit = spin.querySelector(':scope > .bpb-bg__hit');
        if (hit) hit.after(nextSock);
        else spin.prepend(nextSock);
      }
    }
  }

  const hostFace = Number(itemEl.getAttribute('data-face')) || 0;
  const html = gemLayerHtml(item, shape, bounds, gems, hostFace);
  const prev = spin.querySelector(':scope > .bpb-bg__gems');
  if (!html) {
    prev?.remove();
    return;
  }

  const next = elementFromHtml(html);
  if (!(next instanceof HTMLElement)) return;
  if (prev) prev.replaceWith(next);
  else {
    const sock = spin.querySelector(':scope > .bpb-bg__sockets');
    const markers = spin.querySelector(':scope > .bpb-bg__markers');
    if (sock) sock.after(next);
    else if (markers) markers.before(next);
    else spin.appendChild(next);
  }
  writeSpinRotate(spin, readRotateDeg(spin));
}

/**
 * Stamp board cell keys for hover affect checks (body occupancy + star targets).
 * Same y-down CW as .bpb-bg__spin / rotateShape: (x,y) → (−y, x) per 90°.
 *
 * @param {HTMLElement} itemEl
 * @param {object} item
 * @param {number} x
 * @param {number} y
 * @param {number} face
 */
export function stampAffectCells(itemEl, item, x, y, face = 0) {
  const r = ((Number(face) || 0) % 4 + 4) % 4;
  const up = shapeForItem(item, 0);
  const upBounds = item.__bpbBounds || (item.__bpbBounds = bodyBounds(up));
  const rotBounds = r ? bodyBounds(shapeForItem(item, r)) : upBounds;
  const px = Number(x) || 0;
  const py = Number(y) || 0;
  const cx = px + rotBounds.w / 2;
  const cy = py + rotBounds.h / 2;
  const bw = upBounds.w;
  const bh = upBounds.h;

  /** @param {number} lx @param {number} ly */
  const toBoard = (lx, ly) => {
    let ox = lx + 0.5 - bw / 2;
    let oy = ly + 0.5 - bh / 2;
    for (let s = 0; s < r; s += 1) {
      const nx = -oy;
      const ny = ox;
      ox = nx;
      oy = ny;
    }
    return `${Math.floor(cx + ox)},${Math.floor(cy + oy)}`;
  };

  const bodyKeys = up.body.map((c) =>
    toBoard(c.x - upBounds.minX, c.y - upBounds.minY),
  );
  itemEl.dataset.bodyCells = bodyKeys.join(' ');

  itemEl
    .querySelectorAll(
      '.bpb-bg__mark--star, .bpb-bg__mark--diamond, .bpb-bg__mark--extension, .bpb-bg__mark--tertiary, .bpb-bg__mark--lightning',
    )
    .forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const lx = Number(el.dataset.ox);
      const ly = Number(el.dataset.oy);
      if (!Number.isFinite(lx) || !Number.isFinite(ly)) {
        delete el.dataset.cell;
        return;
      }
      el.dataset.cell = toBoard(lx, ly);
    });
}

/**
 * @param {HTMLElement} itemEl
 * @param {HTMLElement | null} underEl
 */
export function parkEntry(itemEl, underEl) {
  clearAppear(itemEl, underEl);
  itemEl.classList.remove('bpb-bg__item--sprite-pending');
  itemEl.classList.add('bpb-bg__item--parked');
  itemEl.style.left = `${PARK_X_EM}em`;
  itemEl.style.top = '0';
  // Dropped/hotswapped nodes must not keep a live placement key — otherwise
  // create-board drag can re-bind rotate to the parked sprite (or stampKeys
  // can confuse it with the item that took its cell).
  delete itemEl.dataset.placementKey;
  itemEl.classList.remove('is-drag-source');
  if (underEl) {
    underEl.classList.add('bpb-bg__under-item--parked');
    underEl.style.left = `${PARK_X_EM}em`;
    underEl.style.top = '0';
    underEl.classList.remove('is-drag-source');
  }
}

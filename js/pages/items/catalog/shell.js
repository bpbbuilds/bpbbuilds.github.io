/**
 * Items catalog — loading shell, filter skeleton, layout preview.
 */

import { skelBar, skelBlock, skelRegion } from '../../../shared/skeleton.js';
import { filterDrawerChromeHtml } from '../../../shared/filter-drawer.js';
import { filtersHtml } from '../catalog-filters.js';

/** Parchment shimmer rail matching real filter sections (shared bpb-skel). */
export function filtersSkeletonHtml() {
  const orb = () =>
    skelBlock({ className: 'il-filter-skel__orb', width: '2.4rem', height: '2.4rem', radius: '50%' });
  const type = () =>
    skelBlock({ className: 'il-filter-skel__type', width: '2.1rem', height: '2.1rem', radius: '0.3rem' });
  const check = (w = '7.5rem') =>
    `<span class="il-filter-skel__check">${skelBlock({
      className: 'il-filter-skel__box',
      width: '1.35rem',
      height: '1.35rem',
      radius: '0.2rem',
    })}${skelBar({ width: w, height: '0.95rem', radius: '0.2rem' })}</span>`;
  const stack = () =>
    skelBlock({ className: 'il-filter-skel__stack', width: '1.85rem', height: '1.85rem', radius: '0.25rem' });

  return `
    <aside class="items-filters il-filter items-filters--skel" aria-hidden="true">
      <div class="il-filter__head il-filter-skel__head">
        ${skelBar({ className: 'il-filter-skel__count', width: '9.5rem', height: '1.15rem', radius: '0.2rem' })}
        ${skelBlock({ className: 'il-filter-skel__reset', width: '2rem', height: '2rem', radius: '50%' })}
      </div>
      <div class="il-filter__shade il-filter-skel__group">
        ${skelBar({ width: '100%', height: '1.6rem', radius: '0.25rem' })}
      </div>
      <div class="il-filter__shade il-filter-skel__classes">${Array.from({ length: 8 }, orb).join('')}</div>
      <div class="il-filter__shade il-filter-skel__rarities">
        <div class="il-filter__rarity-col">${check('6.2rem')}${check('5.2rem')}${check('5.5rem')}</div>
        <div class="il-filter__rarity-col">${check('7rem')}${check('5.5rem')}${check('6.8rem')}${check('5rem')}</div>
      </div>
      <div class="il-filter__shade il-filter-skel__types">${Array.from({ length: 11 }, type).join('')}</div>
      <div class="il-filter__lower">
        <div class="il-filter__shade il-filter-skel__conditions">${check('7.2rem')}${check('7.8rem')}${check('6.8rem')}</div>
        <div class="il-filter__shade il-filter-skel__buffs">${Array.from({ length: 8 }, stack).join('')}</div>
      </div>
      <div class="il-filter__search-row">
        <div class="il-filter__shade il-filter-skel__search">
          ${skelBar({ width: '100%', height: '1.5rem', radius: '0.25rem' })}
        </div>
        <div class="il-filter__shade il-filter-skel__debuffs">${Array.from({ length: 3 }, stack).join('')}</div>
      </div>
    </aside>`;
}

/** Real bag stage + filter placeholder — layout preview paints into the stage. */
export function loadingShellHtml() {
  return skelRegion(
    `<div class="items-shell">
      <div class="items-layout bpb-filter-drawer">
        <div class="items-bag">
          <div class="items-bag__stage" data-items-grid></div>
        </div>
        ${filtersSkeletonHtml()}
        ${filterDrawerChromeHtml('items-filters')}
      </div>
    </div>`,
    { className: 'items-skel-wrap', label: 'Loading item catalog' },
  );
}

/**
 * Footprint-only stubs from local library-layout + shapes (no sprites / no Supabase).
 * @param {object} layout
 * @param {object | null} shapesData
 */
export function buildLayoutPreview(layout, shapesData) {
  const byId = shapesData?.byId || {};
  const order = Array.isArray(layout?.order) ? layout.order : [];
  const placements = Array.isArray(layout?.placements) ? layout.placements : [];
  /** @type {Map<string, object>} */
  const itemsById = new Map();

  for (const o of order) {
    if (!o?.id || itemsById.has(o.id)) continue;
    itemsById.set(o.id, {
      id: o.id,
      name: o.name || o.id,
      rarity: 'Common',
      type: 'Accessory',
      shape: byId[o.id] || [[1]],
      libraryIndex: o.index ?? 0,
      image: null,
    });
  }
  for (const p of placements) {
    if (!p?.id || itemsById.has(p.id)) continue;
    itemsById.set(p.id, {
      id: p.id,
      name: p.id,
      rarity: 'Common',
      type: 'Accessory',
      shape: byId[p.id] || [[1]],
      libraryIndex: 0,
      image: null,
    });
  }

  const placed = placements.length
    ? placements.filter((p) => itemsById.has(p.id))
    : order
        .filter((o) => o?.id && itemsById.has(o.id))
        .map((o) => ({ id: o.id, x: o.x ?? 0, y: o.y ?? 0 }));

  return {
    itemsById,
    placements: placed,
    rows: layout?.rows || 1,
  };
}

/**
 * @param {Element} host
 * @param {object} layout
 * @param {object | null} shapesData
 * @param {{
 *   isReady: () => boolean,
 *   ensureGrid: (stage: HTMLElement) => { showPlaced: Function },
 * }} ctx
 */
export function paintLayoutPreview(host, layout, shapesData, ctx) {
  if (ctx.isReady()) return;
  const stage = host.querySelector('[data-items-grid]');
  if (!(stage instanceof HTMLElement)) return;
  const preview = buildLayoutPreview(layout, shapesData);
  if (!preview.placements.length) return;
  const grid = ctx.ensureGrid(stage);
  void grid.showPlaced(preview.placements, preview.itemsById, preview.rows, {
    preview: true,
    appear: true,
    appearLayer: 'under',
  });
}

/**
 * Promote loading shell → live shell without wiping the bag stage (CLS).
 * @param {Element} host
 * @param {number} shown
 * @param {string} assetRoot
 * @param {object} filterState
 */
export function promoteLoadingShell(host, shown, assetRoot, filterState) {
  const bag = host.querySelector('.items-bag');
  if (bag instanceof HTMLElement && !bag.querySelector('[data-items-empty]')) {
    const empty = document.createElement('p');
    empty.className = 'items-bag__empty';
    empty.dataset.itemsEmpty = '';
    empty.hidden = true;
    empty.textContent = 'No items match these filters.';
    bag.appendChild(empty);
  }

  const filters = host.querySelector('.items-filters');
  if (filters) {
    const hold = document.createElement('div');
    hold.innerHTML = filtersHtml(assetRoot, filterState, shown).trim();
    const next = hold.firstElementChild;
    if (next) filters.replaceWith(next);
  }

  const skelWrap = host.querySelector(':scope > .bpb-skel-region, :scope > .items-skel-wrap');
  if (skelWrap instanceof HTMLElement) {
    const shell = skelWrap.querySelector(':scope > .items-shell');
    if (shell) skelWrap.replaceWith(shell);
    else {
      skelWrap.removeAttribute('aria-busy');
      skelWrap.removeAttribute('role');
      skelWrap.removeAttribute('aria-label');
      skelWrap.classList.remove('items-skel-wrap', 'bpb-skel-region');
    }
  }
}

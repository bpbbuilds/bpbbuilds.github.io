/**
 * Build preview tooltip for “More builds” thumbs (not item tooltips).
 */

import { mountPlacedGrid } from '../../shared/backpack-grid/index.js';
import { classIconPath } from '../../shared/class-icons.js';

const BOARD_COLS = 9;
const BOARD_ROWS = 7;
/** Large preview board inside the class tooltip frame. */
const PREVIEW_CELL_PX = 48;
const EDGE = 8;
/** Let the tip outgrow Build Info width so the frame reads larger. */
const OVER_INFO_WIDTH_BOOST = 1.45;

const LEAGUE_ICONS = {
  bronze: 'League_Bronze.png',
  silver: 'League_Silver.png',
  gold: 'League_Gold.png',
  platinum: 'League_Platinum.png',
  diamond: 'League_Diamond.png',
  master: 'League_Master.png',
  grandmaster: 'League_Grandmaster.png',
  grandma: 'League_Grandma.png',
};

/** Game class tooltip frames (TooltipBase_*.png) — same keys as tooltip.css */
const CLASS_FRAMES = [
  'Adventurer',
  'Berserker',
  'Mage',
  'Ranger',
  'Reaper',
  'Pyromancer',
  'Engineer',
];

/**
 * @param {object} build
 * @returns {string}
 */
function frameKeyForBuild(build) {
  const hero = String(build.hero_class || '')
    .trim()
    .toLowerCase();
  if (!hero) return 'Adventurer';
  const hit = CLASS_FRAMES.find((c) => c.toLowerCase() === hero);
  return hit || 'Adventurer';
}

/**
 * @param {HTMLElement} listEl
 * @param {{
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   root?: string,
 *   overEl?: HTMLElement | null,
 *   thumbSelector?: string,
 * }} opts
 * @returns {() => void}
 */
export function bindMoreBuildTips(listEl, opts) {
  if (!(listEl instanceof HTMLElement)) return () => {};

  const itemsById = opts.itemsById;
  const getSpriteUrl = opts.getSpriteUrl;
  const thumbSelector = opts.thumbSelector || '.build-author__thumb';
  const root = opts.root?.endsWith('/') ? opts.root : `${opts.root || '../../'}/`;
  /** @type {HTMLElement | null} */
  const overEl =
    opts.overEl instanceof HTMLElement
      ? opts.overEl
      : opts.overEl === null
        ? null
        : document.querySelector('.build-info');

  /** @type {HTMLElement | null} */
  let host = null;
  /** @type {ReturnType<typeof mountPlacedGrid> | null} */
  let grid = null;
  /** @type {HTMLElement | null} */
  let activeThumb = null;
  /** @type {ReturnType<typeof setTimeout> | 0} */
  let hideTimer = 0;

  function ensureHost() {
    if (host) return host;
    host = document.createElement('div');
    host.className = 'build-more-tip bpb-tooltip';
    host.hidden = true;
    host.setAttribute('role', 'tooltip');
    host.dataset.frame = 'Adventurer';
    document.body.appendChild(host);
    return host;
  }

  function clearHide() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = 0;
    }
  }

  function destroyGrid() {
    if (grid) {
      try {
        grid.destroy?.({ keepHost: true });
      } catch {
        /* ignore */
      }
      grid = null;
    }
  }

  function hide() {
    clearHide();
    destroyGrid();
    activeThumb = null;
    if (host) {
      host.hidden = true;
      host.replaceChildren();
      host.style.removeProperty('--build-more-tip-scale');
    }
  }

  /**
   * @param {HTMLElement} thumb
   * @param {object} build
   * @param {object[]} placements
   */
  function show(thumb, build, placements) {
    clearHide();
    const tip = ensureHost();
    destroyGrid();
    activeThumb = thumb;

    const title = tipTitle(build);
    const hero = String(build.hero_class || '').trim();
    const frameKey = frameKeyForBuild(build);
    tip.dataset.frame = frameKey;
    const icon = classIconPath(root, hero);
    const gold = Number(build.gold_count);
    const rankKey = String(build.rank || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
    const rankFile = LEAGUE_ICONS[rankKey];
    const result = String(build.result || '').toLowerCase();

    tip.innerHTML = `
      <div class="bpb-tooltip__inner build-more-tip__inner">
        <header class="build-more-tip__head">
          ${
            icon
              ? `<img class="build-more-tip__class" src="${escapeAttr(icon)}" alt="" width="36" height="36" />`
              : ''
          }
          <div class="build-more-tip__titles">
            <p class="build-more-tip__title">${escapeHtml(title)}</p>
            ${
              hero
                ? `<p class="build-more-tip__class-name">${escapeHtml(hero)}</p>`
                : ''
            }
          </div>
        </header>
        <div class="build-more-tip__board" data-preview-board></div>
        <footer class="build-more-tip__meta">
          ${
            Number.isFinite(gold)
              ? `<span class="build-more-tip__stat" title="Gold">
                  <span class="build-more-tip__stat-num">${escapeHtml(String(Math.round(gold)))}</span>
                  <img src="${escapeAttr(root)}assets/tooltips/icons/Gold.png" alt="" width="28" height="28" />
                </span>`
              : ''
          }
          ${
            rankFile
              ? `<span class="build-more-tip__stat" title="${escapeAttr(rankKey)}">
                  <img class="build-more-tip__rank" src="${escapeAttr(root)}assets/icons/leagues/${escapeAttr(rankFile)}" alt="${escapeAttr(rankKey)}" width="40" height="40" />
                </span>`
              : ''
          }
          ${
            result === 'win' || result === 'loss'
              ? `<span class="build-more-tip__result build-more-tip__result--${result}">${
                  result === 'win' ? 'Win' : 'Loss'
                }</span>`
              : ''
          }
        </footer>
      </div>
    `;

    tip.hidden = false;
    const boardHost = tip.querySelector('[data-preview-board]');
    if (boardHost instanceof HTMLElement) {
      grid = mountPlacedGrid(boardHost, {
        placements,
        itemsById,
        cols: BOARD_COLS,
        rows: BOARD_ROWS,
        getSpriteUrl,
        fillWidth: false,
        exactBoard: true,
        reserveScrollGap: false,
        cellPx: PREVIEW_CELL_PX,
      });
    }

    placeTip(tip, thumb);
  }

  /**
   * Anchor over Build Info when available; otherwise near the thumb.
   * Scales the game frame to fit the rail width (keeps nine-patch proportions).
   * @param {HTMLElement} tip
   * @param {HTMLElement} thumb
   */
  function placeTip(tip, thumb) {
    tip.style.left = '0px';
    tip.style.top = '0px';
    tip.style.setProperty('--build-more-tip-scale', '1');

    const layoutW = tip.offsetWidth || 609;
    const anchor = overEl instanceof HTMLElement && !overEl.hidden ? overEl : null;

    if (anchor) {
      const r = anchor.getBoundingClientRect();
      const targetW = Math.min(
        layoutW,
        Math.max(r.width * OVER_INFO_WIDTH_BOOST, r.width),
        window.innerWidth - EDGE * 2,
      );
      const scale = Math.min(1, Math.max(0.45, targetW / layoutW));
      tip.style.setProperty('--build-more-tip-scale', String(scale));
      const scaledW = layoutW * scale;
      // Center over Build Info; clamp into the viewport.
      let left = r.left + (r.width - scaledW) / 2;
      if (left < EDGE) left = EDGE;
      if (left + scaledW > window.innerWidth - EDGE) {
        left = window.innerWidth - EDGE - scaledW;
      }
      tip.style.left = `${Math.round(left)}px`;
      let top = r.top;
      const tipR = tip.getBoundingClientRect();
      if (top + tipR.height > window.innerHeight - EDGE) {
        top = window.innerHeight - EDGE - tipR.height;
      }
      if (top < EDGE) top = EDGE;
      tip.style.top = `${Math.round(top)}px`;
      return;
    }

    const maxW = Math.max(200, window.innerWidth - EDGE * 2);
    const scale = Math.min(1, maxW / layoutW);
    tip.style.setProperty('--build-more-tip-scale', String(scale));

    const tr = thumb.getBoundingClientRect();
    const tipR = tip.getBoundingClientRect();
    let left = tr.right + 12;
    let top = tr.top;
    if (left + tipR.width > window.innerWidth - EDGE) {
      left = tr.left - tipR.width - 12;
    }
    if (left < EDGE) left = EDGE;
    if (top + tipR.height > window.innerHeight - EDGE) {
      top = window.innerHeight - EDGE - tipR.height;
    }
    if (top < EDGE) top = EDGE;
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(top)}px`;
  }

  /** @param {Event} e */
  function onOver(e) {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const thumb = t.closest(thumbSelector);
    if (!(thumb instanceof HTMLElement) || !listEl.contains(thumb)) return;
    const data = tipStore.get(thumb);
    if (!data) return;
    if (activeThumb === thumb && host && !host.hidden) return;
    show(thumb, data.build, data.placements);
  }

  /** @param {Event} e */
  function onOut(e) {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const thumb = t.closest(thumbSelector);
    if (!(thumb instanceof HTMLElement) || thumb !== activeThumb) return;
    const related = e.relatedTarget instanceof Element ? e.relatedTarget : null;
    if (related && thumb.contains(related)) return;
    if (related && host?.contains(related)) return;
    clearHide();
    hideTimer = setTimeout(hide, 80);
  }

  /** Keep tip while moving onto it (optional — tip is not interactive). */
  function onTipOver() {
    clearHide();
  }
  function onTipOut() {
    clearHide();
    hideTimer = setTimeout(hide, 80);
  }

  listEl.addEventListener('pointerover', onOver);
  listEl.addEventListener('pointerout', onOut);

  return () => {
    listEl.removeEventListener('pointerover', onOver);
    listEl.removeEventListener('pointerout', onOut);
    if (host) {
      host.removeEventListener('pointerover', onTipOver);
      host.removeEventListener('pointerout', onTipOut);
    }
    hide();
    host?.remove();
    host = null;
  };
}

/** @type {WeakMap<HTMLElement, { build: object, placements: object[] }>} */
export const tipStore = new WeakMap();

/**
 * @param {HTMLElement} thumb
 * @param {object} build
 * @param {object[]} placements
 */
export function registerMoreBuildTip(thumb, build, placements) {
  tipStore.set(thumb, { build, placements });
}

/**
 * @param {object} build
 */
function tipTitle(build) {
  const raw = String(build.title || build.slug || '').trim();
  const cls = String(build.hero_class || '').trim();
  const runFallback =
    build.runId != null && Number.isFinite(Number(build.runId))
      ? `Run ${build.runId}`
      : 'Build';
  if (!raw) return runFallback;
  if (cls) {
    const prefix = `${cls} · `;
    if (raw.startsWith(prefix)) return raw.slice(prefix.length).trim() || runFallback;
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

/**
 * Seekable Battery / engineer charge spark on the board (Band S).
 */

import { CHARGE_FADE_DUR, sampleWaypoint } from '../engine/charge-path.js';
import { queryLivePlacement } from './sim-item-chrome.js';

/**
 * @typedef {import('../../engine/charge-path.js').ChargePath} ChargePath
 */

/**
 * @param {{
 *   boardEl: HTMLElement,
 *   assetRoot?: string,
 *   onPulse?: (placementKey: string) => void,
 * }} opts
 */
export function createChargeFx(opts) {
  const root = opts.assetRoot?.endsWith('/')
    ? opts.assetRoot
    : `${opts.assetRoot || '../'}`;
  const reduced =
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** @type {Map<string, HTMLElement>} */
  const layers = new Map();
  /** @type {Map<string, { path: ChargePath, el: HTMLElement, tile: HTMLElement, pulsed: Set<string>, layer: HTMLElement }>} */
  const paths = new Map();
  let lastT = 0;

  /**
   * @param {HTMLElement} boardHost
   */
  function ensureLayerOnBoard(boardHost) {
    if (!(boardHost instanceof HTMLElement)) return null;
    const existing = layers.get(boardHost);
    if (existing?.isConnected) return existing;
    const cs = getComputedStyle(boardHost);
    if (cs.position === 'static') boardHost.style.position = 'relative';
    let layer = boardHost.querySelector(':scope > .sim-charge-layer');
    if (!(layer instanceof HTMLElement)) {
      layer = document.createElement('div');
      layer.className = 'sim-charge-layer';
      layer.setAttribute('aria-hidden', 'true');
      boardHost.appendChild(layer);
    }
    layers.set(boardHost, layer);
    return layer;
  }

  /** @param {string | null | undefined} placementKey */
  function boardHostForKey(placementKey) {
    const root = opts.boardEl;
    if (!(root instanceof HTMLElement)) return null;
    if (placementKey) {
      const el = queryLivePlacement(root, placementKey);
      const board = el?.closest('.bpb-bg__board');
      if (board instanceof HTMLElement) return board;
    }
    const fallback =
      root.querySelector('.sim-field__bag .bpb-bg__board') ||
      root.querySelector('.bpb-bg__board');
    return fallback instanceof HTMLElement ? fallback : null;
  }

  function ensureLayer() {
    return ensureLayerOnBoard(boardHostForKey(null));
  }

  /**
   * @param {ChargePath} path
   * @param {string | null | undefined} [placementKey]
   */
  function ensurePath(path, placementKey) {
    const boardHost = boardHostForKey(placementKey);
    const host = ensureLayerOnBoard(boardHost);
    if (!host) return null;
    let entry = paths.get(path.pathId);
    if (entry) {
      entry.path = path;
      return entry;
    }

    const el = document.createElement('div');
    el.className = 'sim-charge-spark';
    el.innerHTML = `
      <img class="sim-charge-spark__trail" src="${root}assets/fx/charge/GlowingDot.png" alt="" draggable="false" />
      <img class="sim-charge-spark__ball" src="${root}assets/fx/charge/CircleLight.png" alt="" draggable="false" />
    `;
    el.hidden = true;

    const tile = document.createElement('div');
    tile.className = 'sim-charge-tile';
    tile.innerHTML = `<img src="${root}assets/fx/charge/ChargedTile.png" alt="" draggable="false" />`;
    tile.hidden = true;

    host.appendChild(tile);
    host.appendChild(el);
    entry = { path, el, tile, pulsed: new Set(), layer: host };
    paths.set(path.pathId, entry);
    return entry;
  }

  /** @type {HTMLAudioElement | null} */
  let sfx = null;
  let muted = false;

  function setMuted(on) {
    muted = on === true;
    if (muted && sfx) {
      sfx.pause();
      sfx.currentTime = 0;
    }
  }

  function playSfxOnce() {
    if (reduced || muted) return;
    try {
      if (!sfx) {
        sfx = new Audio(`${root}assets/fx/charge/Electricity1.ogg`);
        sfx.volume = 0.35;
      }
      sfx.currentTime = 0;
      void sfx.play().catch(() => {});
    } catch {
      /* ignore */
    }
  }

  /**
   * @param {import('../../sim-events.js').SimEvent} ev
   */
  function registerFromEvent(ev) {
    const meta = ev.meta || {};
    const path = /** @type {ChargePath | undefined} */ (meta.chargePath);
    if (!path?.pathId || !path.waypoints?.length) return;
    ensurePath(path, ev.placementKey);
  }

  /**
   * @param {number} t fight time
   * @param {{ pulse?: boolean }} [opt]
   */
  function setTime(t, opt = {}) {
    const allowPulse = opt.pulse !== false;
    const goingForward = t >= lastT - 1e-9;
    lastT = t;

    for (const entry of paths.values()) {
      const { path, el, tile, pulsed } = entry;
      const local = t - path.startT;
      const active = local >= -1e-6 && local <= path.duration + CHARGE_FADE_DUR;

      if (!active) {
        el.hidden = true;
        tile.hidden = true;
        if (local < 0) pulsed.clear();
        continue;
      }

      const sampleT = Math.max(0, Math.min(path.duration, local));
      const pos = sampleWaypoint(path.waypoints, sampleT);
      const cellPx = path.cellPx || 80;
      // Board uses font-size = --bpb-bg-cell; em tracks fillWidth scaling.
      const xEm = pos.x / cellPx;
      const yEm = pos.y / cellPx;
      const u = path.duration > 0 ? sampleT / path.duration : 1;
      const scale =
        path.startSize + (path.endSize - path.startSize) * Math.min(1, Math.max(0, u));
      const fading = local > path.duration - CHARGE_FADE_DUR;
      const fadeU = fading
        ? 1 - (local - (path.duration - CHARGE_FADE_DUR)) / CHARGE_FADE_DUR
        : 1;

      el.hidden = false;
      el.style.left = `${xEm}em`;
      el.style.top = `${yEm}em`;
      el.style.transform = `translate(-50%, -50%) scale(${scale})`;
      el.style.opacity = String(
        reduced ? Math.max(0.35, Math.min(1, fadeU)) : Math.max(0, Math.min(1, fadeU)),
      );

      let curCell = path.cells[0];
      for (const c of path.cells) {
        if (local + 1e-6 >= c.enterT) curCell = c;
      }
      if (curCell) {
        tile.hidden = false;
        tile.style.left = `${curCell.boardX}em`;
        tile.style.top = `${curCell.boardY}em`;
        tile.style.width = '1em';
        tile.style.height = '1em';
        tile.style.transform = '';
        tile.style.opacity = String(Math.max(0.2, Math.min(1, fadeU)));
      }

      if (allowPulse && goingForward) {
        for (const c of path.cells) {
          if (c.cellIndex < 1 || !c.targetKey) continue;
          const absEnter = path.startT + c.enterT;
          const key = `${path.pathId}:${c.cellIndex}`;
          if (t + 1e-6 >= absEnter && !pulsed.has(key)) {
            pulsed.add(key);
            opts.onPulse?.(c.targetKey);
          }
        }
      }
      if (!goingForward) {
        for (const c of path.cells) {
          const absEnter = path.startT + c.enterT;
          const key = `${path.pathId}:${c.cellIndex}`;
          if (t + 1e-6 < absEnter) pulsed.delete(key);
        }
      }
    }
  }

  /**
   * @param {import('../../sim-events.js').SimEvent} ev
   */
  function flashEvent(ev) {
    if (ev.type === 'activate' && ev.meta?.chargePath) {
      registerFromEvent({
        ...ev,
        type: 'charge',
        meta: { ...ev.meta, phase: 'start' },
      });
      playSfxOnce();
      setTime(ev.t);
      return;
    }
    if (ev.type !== 'charge') return;
    registerFromEvent(ev);
    if (ev.meta?.phase === 'start') playSfxOnce();
    setTime(ev.t);
  }

  /**
   * @param {import('../../sim-events.js').SimRun} run
   */
  function loadRun(run) {
    paths.clear();
    for (const layer of layers.values()) layer.replaceChildren();
    layers.clear();
    lastT = 0;
    for (const ev of run.events || []) {
      if (ev.type === 'charge' && ev.meta?.phase === 'start' && ev.meta.chargePath) {
        registerFromEvent(ev);
      } else if (ev.type === 'activate' && ev.meta?.chargePath) {
        registerFromEvent({
          ...ev,
          type: 'charge',
          meta: { ...ev.meta, phase: 'start' },
        });
      }
    }
    setTime(0, { pulse: false });
  }

  return {
    loadRun,
    setTime,
    flashEvent,
    setMuted,
    destroy() {
      paths.clear();
      for (const layer of layers.values()) layer.remove();
      layers.clear();
      if (sfx) {
        sfx.pause();
        sfx = null;
      }
    },
  };
}

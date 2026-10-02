/**
 * Damage Dealt + Combat Log — Open Log book (game CombatLog chrome).
 */

import { mountDamageMeter } from './sim-damage-meter.js';
import { mountCombatLog } from './sim-combat-log.js';
import { mountLogbookShell } from './sim-logbook.js';
import {
  bindClogResize,
  clearResizedHeight,
  resizeHandleHtml,
} from './sim-clog-resize.js';

const LOG_H_KEY = 'bpb-sim-clog-h';
const TAB_KEY = 'bpb-sim-clog-tabs';
const LOG_H_DEFAULT = 488;
const LOG_H_MIN = 300;

/** @returns {number} */
function readLogHeight() {
  try {
    const n = Number(sessionStorage.getItem(LOG_H_KEY));
    if (Number.isFinite(n) && n >= LOG_H_MIN) return n;
  } catch {
    /* ignore */
  }
  return LOG_H_DEFAULT;
}

/** @param {number} px */
function saveLogHeight(px) {
  try {
    sessionStorage.setItem(LOG_H_KEY, String(px));
  } catch {
    /* ignore */
  }
}

/** @returns {{ you: boolean, opp: boolean, filter: boolean }} */
function readTabs() {
  const out = { you: false, opp: false, filter: false };
  try {
    const parsed = JSON.parse(sessionStorage.getItem(TAB_KEY) || '');
    if (parsed && typeof parsed === 'object') {
      out.you = parsed.you === true;
      out.opp = parsed.opp === true;
      out.filter = parsed.filter === true;
    }
  } catch {
    /* ignore */
  }
  return out;
}

/** @param {{ you: boolean, opp: boolean, filter: boolean }} tabs */
function saveTabs(tabs) {
  try {
    sessionStorage.setItem(TAB_KEY, JSON.stringify(tabs));
  } catch {
    /* ignore */
  }
}

/**
 * @param {HTMLElement} ui
 * @param {string} root
 */
function bindClogTabs(ui, root) {
  const tabs = readTabs();
  const chev = `${root}assets/icons/sim/log/OpenButton_right.png`;
  const chevHover = `${root}assets/icons/sim/log/OpenButton_right_hovered.png`;

  function apply(id, open) {
    const tab = ui.querySelector(`[data-clog-tab="${id}"]`);
    if (!(tab instanceof HTMLElement)) return;
    tab.classList.toggle('is-open', open);
    if (id !== 'filter') clearResizedHeight(tab);
    const btn = tab.querySelector('[data-tab-toggle]');
    btn?.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  for (const id of /** @type {const} */ (['you', 'opp', 'filter'])) {
    apply(id, tabs[id]);
  }

  ui.addEventListener('click', (e) => {
    const btn =
      e.target instanceof Element ? e.target.closest('[data-tab-toggle]') : null;
    if (!(btn instanceof HTMLElement) || !ui.contains(btn)) return;
    const id = btn.getAttribute('data-tab-toggle');
    if (id !== 'you' && id !== 'opp' && id !== 'filter') return;
    tabs[id] = !tabs[id];
    apply(id, tabs[id]);
    saveTabs(tabs);
  });

  for (const btn of ui.querySelectorAll('[data-tab-toggle] img')) {
    if (!(btn instanceof HTMLImageElement)) continue;
    const wrap = btn.closest('button');
    wrap?.addEventListener('pointerenter', () => {
      btn.src = chevHover;
    });
    wrap?.addEventListener('pointerleave', () => {
      btn.src = chev;
    });
  }
}

/**
 * Vertical resize on all three sections (game ResizableControl).
 * Only the center log keeps its height for the session — the game resets meter
 * heights on every open().
 * @param {HTMLElement} ui
 * @param {HTMLElement} panel
 */
function bindResize(ui, panel) {
  panel.style.height = `${readLogHeight()}px`;
  return bindClogResize(ui, {
    onResize(id, px) {
      if (id === 'log') saveLogHeight(px);
    },
  });
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   run: import('../../sim-events.js').SimRun,
 *   itemsById?: Map<string, object> | null,
 *   assetRoot?: string,
 *   onSeek?: (t: number) => void,
 *   onHighlight?: (placementKey: string | null, itemId: string | null) => void,
 *   onPlay?: () => void,
 *   onPause?: () => void,
 *   getPlaying?: () => boolean,
 * }} opts
 */
export function mountSimCombatResults(host, opts) {
  host.innerHTML = `
    <div class="sim-results sim-results--dock">
      <div class="sim-results__open" data-results-open></div>
    </div>
  `;
  const openHost = host.querySelector('[data-results-open]');
  if (!(openHost instanceof HTMLElement)) {
    return { setTime() {}, setPlaying() {}, destroy() {} };
  }

  /** @type {{ setTime: Function, setFocus: Function, destroy: Function } | null} */
  let meter = null;
  /** @type {{ setTime: Function, setFocus: Function, destroy: Function } | null} */
  let themMeter = null;
  /** @type {{ setTime: Function, setPlaying?: Function, destroy: Function } | null} */
  let log = null;

  /**
   * @param {string | null} placementKey
   * @param {string | null} [itemId]
   */
  function highlight(placementKey, itemId) {
    opts.onHighlight?.(placementKey, itemId ?? null);
    const key = placementKey || itemId || null;
    meter?.setFocus(key);
    themMeter?.setFocus(key);
  }

  const logbook = mountLogbookShell(openHost, {
    assetRoot: opts.assetRoot,
    mountContents(body) {
      const root = opts.assetRoot || '../';
      const chev = `${root}assets/icons/sim/log/OpenButton_right.png`;
      const meterIcon = `${root}assets/icons/sim/log/DamageMeterIcon.png`;
      body.innerHTML = `
        <div class="sim-clog-ui" data-clog-ui>
          <aside class="sim-clog-tab sim-clog-tab--filter sim-clog-patch" data-clog-tab="filter">
            <button type="button" class="sim-clog-tab__chev" data-tab-toggle="filter" aria-expanded="false" title="Search and replay">
              <img src="${chev}" alt="" width="57" height="99" draggable="false" />
            </button>
            <div class="sim-clog-tab__body" data-clog-filter></div>
          </aside>
          <aside class="sim-clog-tab sim-clog-tab--you sim-clog-patch" data-clog-tab="you">
            <button type="button" class="sim-clog-tab__chev" data-tab-toggle="you" aria-expanded="false" title="Your combat metrics">
              <img src="${chev}" alt="" width="57" height="99" draggable="false" />
            </button>
            <img class="sim-clog-tab__icon" src="${meterIcon}" alt="" width="39" height="32" draggable="false" />
            <div class="sim-clog-tab__body" data-results-dmg></div>
            ${resizeHandleHtml('you', 'Resize your damage meter')}
          </aside>
          <section class="sim-clog-panel sim-clog-patch">
            <div class="sim-results__log" data-results-log></div>
            ${resizeHandleHtml('log', 'Resize combat log')}
          </section>
          <aside class="sim-clog-tab sim-clog-tab--opp sim-clog-patch" data-clog-tab="opp">
            <button type="button" class="sim-clog-tab__chev" data-tab-toggle="opp" aria-expanded="false" title="Opponent combat metrics">
              <img src="${chev}" alt="" width="57" height="99" draggable="false" />
            </button>
            <img class="sim-clog-tab__icon" src="${meterIcon}" alt="" width="39" height="32" draggable="false" />
            <div class="sim-clog-tab__body" data-results-dmg-them></div>
            ${resizeHandleHtml('opp', 'Resize opponent damage meter')}
          </aside>
        </div>
      `;
      const ui = body.querySelector('[data-clog-ui]');
      const dmgHost = body.querySelector('[data-results-dmg]');
      const dmgThemHost = body.querySelector('[data-results-dmg-them]');
      const logHost = body.querySelector('[data-results-log]');
      const filterHost = body.querySelector('[data-clog-filter]');
      const panel = body.querySelector('.sim-clog-panel');
      if (
        !(dmgHost instanceof HTMLElement) ||
        !(dmgThemHost instanceof HTMLElement) ||
        !(logHost instanceof HTMLElement) ||
        !(filterHost instanceof HTMLElement) ||
        !(panel instanceof HTMLElement) ||
        !(ui instanceof HTMLElement)
      ) {
        return {
          setTime() {},
          setPlaying() {},
          destroy() {
            body.replaceChildren();
          },
        };
      }

      meter = mountDamageMeter(dmgHost, {
        run: opts.run,
        itemsById: opts.itemsById,
        assetRoot: opts.assetRoot,
        onSeek: opts.onSeek,
        onHighlight: highlight,
        side: 'player',
        panelLabel: 'You',
      });
      themMeter = mountDamageMeter(dmgThemHost, {
        run: opts.run,
        itemsById: opts.itemsById,
        assetRoot: opts.assetRoot,
        onSeek: opts.onSeek,
        onHighlight: highlight,
        side: 'dummy',
        panelLabel: 'Opponent',
      });
      log = mountCombatLog(logHost, {
        run: opts.run,
        itemsById: opts.itemsById,
        assetRoot: opts.assetRoot,
        filterHost,
        onSeek: opts.onSeek,
        onHighlight: highlight,
        onPlay: opts.onPlay,
        onPause: opts.onPause,
        getPlaying: opts.getPlaying,
      });

      bindClogTabs(ui, root);
      const unbindResize = bindResize(ui, panel);

      return {
        setTime(t) {
          return log?.setTime(t);
        },
        setPlaying(playing) {
          log?.setPlaying?.(playing);
        },
        /**
         * @param {number} t
         * @param {{ bars?: boolean }} [barOpts]
         */
        setMeters(t, barOpts) {
          meter?.setTime(t, barOpts);
          themMeter?.setTime(t, barOpts);
        },
        destroy() {
          unbindResize();
          meter?.destroy();
          themMeter?.destroy();
          log?.destroy();
          meter = null;
          themMeter = null;
          log = null;
          body.replaceChildren();
        },
      };
    },
  });

  return {
    setTime(t) {
      const lineChanged = logbook.setTime(t);
      const playing = opts.getPlaying?.() ?? false;
      const barOpts = { bars: !playing || lineChanged };
      logbook.setMeters?.(t, barOpts);
    },
    setPlaying(playing) {
      logbook.setPlaying?.(playing);
    },
    destroy() {
      logbook.destroy();
      host.replaceChildren();
    },
  };
}

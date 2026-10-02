/**
 * Damage Dealt meters + cumulative plot + metric dropdown (Phase 109).
 */

import { escapeHtml } from './sim-log-sentences.js';
import {
  METER_METRICS,
  metricById,
  buildMetricSections,
  sourceValueAt,
} from './sim-meter-metrics.js';
import { sectionPlotHtml } from './sim-meter-plot.js';
import {
  combatDurationSec,
  toCombatLogTime,
  toEngineTime,
} from '../sim-combat-time.js';

export { buildDamageSources, buildCumulativeSeries } from './sim-meter-metrics.js';

/** Game DamageMeter stepify(..., 0.1) — always one decimal (6.7, 15.0). */
function formatMeterQty(n) {
  const x = Math.round((Number(n) || 0) * 10) / 10;
  if (!Number.isFinite(x)) return '0.0';
  return x.toFixed(1);
}

/** Game DamageMeterPlot.gd palette — bar fill = that source's plot line color. */
const PLOT_COLORS = [
  '#fe7878',
  '#f7ae5d',
  '#fce26f',
  '#b4fc9a',
  '#63f5b7',
  '#06c8c6',
  '#82d0fd',
  '#8282ff',
  '#cf82ff',
  '#f48ffa',
  '#ff89bc',
];

/** Game DamageMeterPlot.gd symbols, cycled in the same sort order. */
const PLOT_SYMBOLS = [
  'Symbol_Star.png',
  'Symbol_Triangle.png',
  'Symbol_Circle.png',
  'Symbol_Square.png',
  'Symbol_Moon.png',
  'Symbol_Heart.png',
  'Symbol_Cross.png',
  'Symbol_Tear.png',
  'Symbol_Cloud.png',
  'Symbol_Pacman.png',
];

/** DamageMeterEntry.gd plotButtonInactiveColor */
const PLOT_OFF_COLOR = '#a79b8c';

/**
 * @param {string} assetRoot
 * @param {string | null | undefined} iconFile
 */
function metricIconHtml(assetRoot, iconFile) {
  if (!iconFile) return '';
  const root = assetRoot.endsWith('/') ? assetRoot : `${assetRoot}/`;
  return `<img class="sim-dmg__micon" src="${root}assets/icons/status/buff/${iconFile}" alt="" width="18" height="18" draggable="false" />`;
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   run: import('../../sim-events.js').SimRun,
 *   itemsById?: Map<string, object> | null,
 *   assetRoot?: string,
 *   onSeek?: (t: number) => void,
 *   onHighlight?: (placementKey: string | null, itemId: string | null) => void,
 *   side?: 'player' | 'dummy',
 *   panelLabel?: string,
 * }} opts
 */
export function mountDamageMeter(host, opts) {
  const run = opts.run;
  const side = opts.side === 'dummy' ? 'dummy' : 'player';
  const panelLabel = opts.panelLabel || (side === 'dummy' ? 'Opponent' : 'You');
  const engineDuration = Math.max(0.1, Number(run.durationSec) || 30);
  const useCombatClock = run.mode !== 'demo';
  const duration = useCombatClock
    ? combatDurationSec(engineDuration)
    : engineDuration;
  /** @param {number} engineT */
  const toPlotT = (engineT) =>
    useCombatClock ? toCombatLogTime(engineT) : Number(engineT) || 0;
  const assetRoot = opts.assetRoot || '../';
  const root = assetRoot.endsWith('/') ? assetRoot : `${assetRoot}/`;
  const caretSrc = `${root}assets/icons/sim/log/NextOptionArrow.png`;
  const dropSrc = `${root}assets/icons/sim/log/DropdownArrow.png`;
  /**
   * Plot symbol URL. Absolute because it also feeds a CSS mask, and relative
   * URLs inside custom properties resolve against the stylesheet, not the page.
   * @param {number} i
   */
  const symbolSrc = (i) =>
    new URL(
      `${root}assets/icons/sim/log/plot/${PLOT_SYMBOLS[i % PLOT_SYMBOLS.length]}`,
      document.baseURI,
    ).href;
  let metricId = 'damage';
  let menuOpen = false;
  /** Engine/wall time from the scrubber */
  let engineT = 0;
  /** Display / combat clock */
  let t = 0;
  /** @type {import('./sim-meter-metrics.js').MeterSource[]} */
  let cachedSources = [];
  /** @type {import('./sim-meter-metrics.js').MeterSection[]} */
  let cachedSections = [];
  /** @type {string | null} */
  let focusKey = null;
  /** Sources whose plot line is toggled off (game: gray bar + dim text). */
  const hiddenSeries = new Set();

  host.innerHTML = `
    <section class="sim-dmg" aria-label="${panelLabel} combat metrics">
      <header class="sim-dmg__head">
        <div class="sim-dmg__metric-wrap">
          <button type="button" class="sim-dmg__metric-btn" data-metric-btn aria-haspopup="listbox" aria-expanded="false">
            <span class="sim-dmg__metric-label" data-metric-label>Damage Dealt</span>
            <img class="sim-dmg__metric-caret" src="${dropSrc}" alt="" width="39" height="30" draggable="false" />
          </button>
          <ul class="sim-dmg__menu" data-metric-menu role="listbox" hidden></ul>
        </div>
        <span class="sim-dmg__side">${panelLabel}</span>
      </header>
      <div class="sim-dmg__body" data-dmg-body>
        <ul class="sim-dmg__list" data-dmg-list></ul>
      </div>
    </section>
  `;

  const listEl = host.querySelector('[data-dmg-list]');
  const bodyEl = host.querySelector('[data-dmg-body]');
  const collapseBtn = host.querySelector('[data-dmg-toggle]');
  const metricBtn = host.querySelector('[data-metric-btn]');
  const metricLabel = host.querySelector('[data-metric-label]');
  const menuEl = host.querySelector('[data-metric-menu]');

  if (menuEl instanceof HTMLElement) {
    menuEl.innerHTML = METER_METRICS.map(
      (m) => `<li role="option" class="sim-dmg__menu-item" data-metric="${m.id}" aria-selected="${m.id === metricId ? 'true' : 'false'}">
        ${metricIconHtml(assetRoot, m.icon)}
        <span>${escapeHtml(m.label)}</span>
      </li>`,
    ).join('');
  }

  function setMenuOpen(open) {
    menuOpen = open;
    if (menuEl instanceof HTMLElement) {
      if (open) menuEl.removeAttribute('hidden');
      else menuEl.setAttribute('hidden', '');
    }
    metricBtn?.setAttribute('aria-expanded', open ? 'true' : 'false');
    metricBtn?.classList.toggle('is-open', open);
  }

  function syncMetricChrome() {
    const meta = metricById(metricId);
    if (metricLabel) metricLabel.textContent = meta.label;
    menuEl?.querySelectorAll('.sim-dmg__menu-item').forEach((el) => {
      const on = el.getAttribute('data-metric') === metricId;
      el.setAttribute('aria-selected', on ? 'true' : 'false');
      el.classList.toggle('is-selected', on);
    });
    return meta;
  }

  function paintList() {
    const meta = metricById(metricId);
    const cutoff = engineT;
    const clockT = Math.max(0.5, t || toPlotT(engineT));

    if (!(listEl instanceof HTMLElement)) return;

    /**
     * @param {import('./sim-meter-metrics.js').MeterSource[]} sources
     * @param {boolean} showTotal
     */
    function sectionHtml(sources) {
      const rows = sources
        .map((src) => ({ src, val: sourceValueAt(src, cutoff) }))
        .filter((r) => r.val > 0)
        .sort((a, b) => b.val - a.val);
      if (!rows.length) return { html: '', count: 0 };
      // Game: one plot per sub-metric, raised below that section's entries
      const plot = sectionPlotHtml({
        rows: rows.map((r, i) => ({
          key: r.src.key,
          points: r.src.points,
          color: PLOT_COLORS[i % PLOT_COLORS.length],
          symbol: PLOT_SYMBOLS[i % PLOT_SYMBOLS.length],
          off: hiddenSeries.has(r.src.key),
        })),
        duration,
        t,
        cutoff,
        assetRoot,
        toPlotT,
      });
      const grand = rows.reduce((s, r) => s + r.val, 0) || 1;
      const largest = rows[0]?.val || 1;
      const body = rows
        .map((r, i) => {
          const src = r.src;
          // Game: % label is share of total, bar width is share of the largest
          const pct = Math.round((r.val / grand) * 100);
          const barPct = Math.round((r.val / largest) * 100);
          const rate = (r.val / clockT).toFixed(1);
          const total = formatMeterQty(r.val);
          const key = src.placementKey || src.itemId || src.key;
          const color = PLOT_COLORS[i % PLOT_COLORS.length];
          const off = hiddenSeries.has(src.key);
          const tint = off ? PLOT_OFF_COLOR : color;
          const active =
            focusKey &&
            (src.placementKey === focusKey || src.itemId === focusKey || src.key === focusKey);
          return `<li class="sim-dmg__row${active ? ' is-active' : ''}${off ? ' is-off' : ''}" data-src="${escapeHtml(src.key)}" data-placement="${escapeHtml(src.placementKey || '')}" data-item="${escapeHtml(src.itemId || '')}" data-key="${escapeHtml(key || '')}">
          <span class="sim-dmg__name">${escapeHtml(src.name)}</span>
          <span class="sim-dmg__bar"><span class="sim-dmg__fill" style="width:${barPct}%;background:${tint}"></span><span class="sim-dmg__pct">${pct}%</span></span>
          <button type="button" class="sim-dmg__plotbtn" data-plot-toggle="${escapeHtml(src.key)}" aria-pressed="${off ? 'false' : 'true'}" title="Toggle plot line">
            <span class="sim-dmg__symbol" style="--plot-mask:url('${symbolSrc(i)}');--plot-tint:${tint}"></span>
          </button>
          <span class="sim-dmg__total">${total} <span class="sim-dmg__rate">(${rate}/s)</span></span>
        </li>`;
        })
        .join('');
      // Game addMeter(): Total row only when the section has more than one entry
      let extra = '';
      if (rows.length > 1) {
        const sum = rows.reduce((s, r) => s + r.val, 0);
        extra = `<li class="sim-dmg__row sim-dmg__row--total" aria-label="Total">
        <span class="sim-dmg__name">Total</span>
        <span class="sim-dmg__total">${formatMeterQty(sum)} <span class="sim-dmg__rate">(${(sum / clockT).toFixed(1)}/s)</span></span>
      </li>`;
      }
      return { html: body + extra + plot, count: rows.length };
    }

    const parts = [];
    let any = false;
    // Game: section labels only when the metric has more than one sub-metric
    const labelled = cachedSections.length > 1;
    cachedSections.forEach((sec) => {
      const painted = sectionHtml(sec.sources);
      if (!painted.count) return;
      any = true;
      const heading = sec.label || meta.label;
      if (labelled && heading) {
        parts.push(`<li class="sim-dmg__section">${escapeHtml(heading)}</li>`);
      }
      parts.push(painted.html);
    });

    if (!any) {
      listEl.innerHTML = `<li class="sim-dmg__empty">${escapeHtml(meta.empty)}</li>`;
      return;
    }
    listEl.innerHTML = parts.join('');
  }

  function syncClock() {
    t = Math.max(0, Math.min(duration, toPlotT(engineT)));
  }

  function loadSources() {
    cachedSections = buildMetricSections(
      run.events || [],
      opts.itemsById,
      metricId,
      side,
    );
    cachedSources = cachedSections[0]?.sources || [];
  }

  function renderMetric() {
    syncMetricChrome();
    loadSources();
    syncClock();
    paintList();
  }

  /**
   * @param {number} nextT
   * @param {{ bars?: boolean, focusKey?: string | null }} [paintOpts]
   */
  function setTime(nextT, paintOpts = {}) {
    engineT = Number(nextT) || 0;
    if (paintOpts.focusKey !== undefined) focusKey = paintOpts.focusKey;
    syncClock();
    paintList();
  }

  /** @param {string | null} key */
  function setFocus(key) {
    focusKey = key;
    paintList();
  }

  metricBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    setMenuOpen(!menuOpen);
  });

  menuEl?.addEventListener('click', (e) => {
    const item = e.target instanceof Element ? e.target.closest('[data-metric]') : null;
    if (!(item instanceof HTMLElement)) return;
    metricId = item.dataset.metric || 'damage';
    setMenuOpen(false);
    renderMetric();
  });

  document.addEventListener(
    'click',
    (e) => {
      if (!menuOpen) return;
      if (e.target instanceof Node && host.contains(e.target)) {
        if (metricBtn?.contains(e.target) || menuEl?.contains(e.target)) return;
      }
      setMenuOpen(false);
    },
    true,
  );

  collapseBtn?.addEventListener('click', () => {
    const open = bodyEl?.hasAttribute('hidden') !== true;
    if (open) {
      bodyEl?.setAttribute('hidden', '');
      collapseBtn.setAttribute('aria-expanded', 'false');
      collapseBtn.textContent = '▸';
    } else {
      bodyEl?.removeAttribute('hidden');
      collapseBtn.setAttribute('aria-expanded', 'true');
      collapseBtn.textContent = '▾';
    }
  });

  listEl?.addEventListener('click', (e) => {
    // Game DamageMeterEntry: clicking the symbol toggles that plot line
    const toggle = e.target instanceof Element ? e.target.closest('[data-plot-toggle]') : null;
    if (toggle instanceof HTMLElement) {
      e.stopPropagation();
      const key = toggle.dataset.plotToggle || '';
      if (hiddenSeries.has(key)) hiddenSeries.delete(key);
      else hiddenSeries.add(key);
      paintList();
      return;
    }

    // Inline section plot: point symbols seek to that event, the grid seeks by x
    const plot = e.target instanceof Element ? e.target.closest('.sim-dmg__plot') : null;
    if (plot instanceof SVGElement) {
      const mark = e.target instanceof Element ? e.target.closest('[data-t]') : null;
      if (mark) {
        const tt = Number(mark.getAttribute('data-t'));
        if (Number.isFinite(tt)) opts.onSeek?.(tt);
        return;
      }
      const rect = plot.getBoundingClientRect();
      // Game plot data rect is x 8→387 of a 394-wide control
      const frac = ((e.clientX - rect.left) / rect.width) * 394;
      const displayT = Math.max(0, Math.min(1, (frac - 8) / 379)) * duration;
      opts.onSeek?.(useCombatClock ? toEngineTime(displayT) : displayT);
      return;
    }

    const row = e.target instanceof Element ? e.target.closest('.sim-dmg__row') : null;
    if (!(row instanceof HTMLElement) || row.classList.contains('sim-dmg__row--total')) return;
    listEl.querySelectorAll('.sim-dmg__row').forEach((el) => el.classList.remove('is-active'));
    row.classList.add('is-active');
    opts.onHighlight?.(row.dataset.placement || null, row.dataset.item || null);
  });

  renderMetric();

  return {
    setTime,
    setFocus,
    setMetric(id) {
      metricId = id;
      renderMetric();
    },
    getMetric: () => metricId,
    destroy() {
      host.replaceChildren();
    },
  };
}

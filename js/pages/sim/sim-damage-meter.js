/**
 * Damage Dealt meters + cumulative plot + metric dropdown (Phase 109).
 */

import { escapeHtml } from './sim-log-sentences.js';
import {
  METER_METRICS,
  metricById,
  buildMetricSections,
  buildCumulativeSeries,
  sourceValueAt,
} from './sim-meter-metrics.js';
import {
  combatDurationSec,
  toCombatLogTime,
  toEngineTime,
} from './sim-combat-time.js';

export { buildDamageSources, buildCumulativeSeries } from './sim-meter-metrics.js';

/** Game DamageMeter stepify(..., 0.1) — always one decimal (6.7, 15.0). */
function formatMeterQty(n) {
  const x = Math.round((Number(n) || 0) * 10) / 10;
  if (!Number.isFinite(x)) return '0.0';
  return x.toFixed(1);
}

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
 *   run: import('./sim-events.js').SimRun,
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
  /** @type {{ t: number, cum: number }[]} */
  let cachedSeries = [];
  /** @type {string | null} */
  let focusKey = null;

  host.innerHTML = `
    <section class="sim-dmg" aria-label="${panelLabel} combat metrics">
      <header class="sim-dmg__head">
        <div class="sim-dmg__metric-wrap">
          <button type="button" class="sim-dmg__metric-btn" data-metric-btn aria-haspopup="listbox" aria-expanded="false">
            <span class="sim-dmg__chev" aria-hidden="true">▾</span>
            <span class="sim-dmg__metric-label" data-metric-label>Damage Dealt</span>
            <span class="sim-dmg__metric-caret" aria-hidden="true">›</span>
          </button>
          <ul class="sim-dmg__menu" data-metric-menu role="listbox" hidden></ul>
        </div>
        <span class="sim-dmg__side">${panelLabel}</span>
        <button type="button" class="sim-dmg__collapse" data-dmg-toggle aria-expanded="true" title="Collapse panel">▾</button>
      </header>
      <div class="sim-dmg__body" data-dmg-body>
        <ul class="sim-dmg__list" data-dmg-list></ul>
        <div class="sim-dmg__plot-wrap">
          <svg class="sim-dmg__plot" data-dmg-plot viewBox="0 0 320 140" role="img" aria-label="Cumulative metric over time"></svg>
          <div class="sim-dmg__cursor" data-dmg-cursor aria-hidden="true"></div>
          <div class="sim-dmg__sync" data-dmg-sync aria-hidden="true" title="Synced log line">➤</div>
        </div>
        <div class="sim-dmg__axis">
          <span>0.0s</span>
          <span data-dmg-end>${duration.toFixed(2)}s</span>
        </div>
      </div>
    </section>
  `;

  const listEl = host.querySelector('[data-dmg-list]');
  const plotEl = host.querySelector('[data-dmg-plot]');
  const bodyEl = host.querySelector('[data-dmg-body]');
  const cursorEl = host.querySelector('[data-dmg-cursor]');
  const syncEl = host.querySelector('[data-dmg-sync]');
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

  function seriesUpTo(cutoffEngineT) {
    const cut = Number(cutoffEngineT) || 0;
    /** @type {{ t: number, cum: number }[]} */
    const out = [];
    for (const p of cachedSeries) {
      if (p.t > cut + 1e-9) break;
      out.push(p);
    }
    if (!out.length) return [{ t: 0, cum: 0 }];
    if (out[out.length - 1].t < cut) {
      out.push({ t: cut, cum: out[out.length - 1].cum });
    }
    return out;
  }

  function renderPlot(series) {
    if (!(plotEl instanceof SVGElement)) return;
    const w = 320;
    const h = 140;
    const padL = 28;
    const padR = 8;
    const padT = 10;
    const padB = 18;
    const maxY = Math.max(1, ...series.map((p) => p.cum));
    const xOf = (tt) => padL + (tt / duration) * (w - padL - padR);
    const yOf = (c) => padT + (1 - c / maxY) * (h - padT - padB);
    const pts = series
      .map((p) => `${xOf(toPlotT(p.t)).toFixed(1)},${yOf(p.cum).toFixed(1)}`)
      .join(' ');
    const dots = series
      .filter((p) => toPlotT(p.t) > 0)
      .map(
        (p) =>
          `<circle class="sim-dmg__dot" cx="${xOf(toPlotT(p.t)).toFixed(1)}" cy="${yOf(p.cum).toFixed(1)}" r="3.5" data-t="${p.t}" />`,
      )
      .join('');
    const xCursor = padL + (t / duration) * (w - padL - padR);
    plotEl.innerHTML = `
      <text class="sim-dmg__ylab" x="4" y="${padT + 8}">${escapeHtml(formatMeterQty(maxY))}</text>
      <text class="sim-dmg__ylab" x="4" y="${h - padB}">0</text>
      <polyline class="sim-dmg__line" fill="none" points="${pts}" />
      ${dots}
      <line class="sim-dmg__vbar" data-vbar x1="${xCursor}" y1="${padT}" x2="${xCursor}" y2="${h - padB}" />
    `;
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
    function sectionHtml(sources, showTotal) {
      const rows = sources
        .map((src) => ({ src, val: sourceValueAt(src, cutoff) }))
        .filter((r) => r.val > 0)
        .sort((a, b) => b.val - a.val);
      if (!rows.length) return { html: '', count: 0 };
      const grand = rows.reduce((s, r) => s + r.val, 0) || 1;
      const largest = rows[0]?.val || 1;
      const body = rows
        .map((r) => {
          const src = r.src;
          const pct = Math.round((r.val / grand) * 100);
          const barPct = Math.round((r.val / largest) * 100);
          const rate = (r.val / clockT).toFixed(1);
          const total = formatMeterQty(r.val);
          const key = src.placementKey || src.itemId || src.key;
          const active =
            focusKey &&
            (src.placementKey === focusKey || src.itemId === focusKey || src.key === focusKey);
          return `<li class="sim-dmg__row${active ? ' is-active' : ''}" data-src="${escapeHtml(src.key)}" data-placement="${escapeHtml(src.placementKey || '')}" data-item="${escapeHtml(src.itemId || '')}" data-key="${escapeHtml(key || '')}">
          <span class="sim-dmg__name">${escapeHtml(src.name)}</span>
          <span class="sim-dmg__bar"><span class="sim-dmg__fill" style="width:${barPct}%"></span><span class="sim-dmg__pct">${pct}%</span></span>
          <span class="sim-dmg__total">${total} <span class="sim-dmg__rate">(${rate}/s)</span></span>
        </li>`;
        })
        .join('');
      let extra = '';
      if (showTotal && rows.length > 1) {
        const sum = rows.reduce((s, r) => s + r.val, 0);
        extra = `<li class="sim-dmg__row sim-dmg__row--total" aria-label="Total">
        <span class="sim-dmg__name">Total</span>
        <span class="sim-dmg__bar sim-dmg__bar--total"><span class="sim-dmg__fill" style="width:100%"></span><span class="sim-dmg__pct">100%</span></span>
        <span class="sim-dmg__total">${formatMeterQty(sum)} <span class="sim-dmg__rate">(${(sum / clockT).toFixed(1)}/s)</span></span>
      </li>`;
      }
      return { html: body + extra, count: rows.length };
    }

    const parts = [];
    let any = false;
    for (const sec of cachedSections) {
      const painted = sectionHtml(sec.sources, true);
      if (!painted.count) continue;
      any = true;
      if (sec.label) {
        parts.push(
          `<li class="sim-dmg__section" aria-hidden="true">${escapeHtml(sec.label)}</li>`,
        );
      }
      parts.push(painted.html);
    }

    if (!any) {
      listEl.innerHTML = `<li class="sim-dmg__empty">${escapeHtml(meta.empty)}</li>`;
      return;
    }
    listEl.innerHTML = parts.join('');
  }

  function updateCursor() {
    t = Math.max(0, Math.min(duration, toPlotT(engineT)));
    if (cursorEl instanceof HTMLElement) {
      cursorEl.style.left = `calc(28px + (100% - 36px) * ${t / duration})`;
    }
    if (syncEl instanceof HTMLElement) syncEl.style.top = '42%';
    const vbar = plotEl?.querySelector('[data-vbar]');
    if (vbar) {
      const w = 320;
      const padL = 28;
      const padR = 8;
      const x = padL + (t / duration) * (w - padL - padR);
      vbar.setAttribute('x1', String(x));
      vbar.setAttribute('x2', String(x));
    }
  }

  function loadSources() {
    cachedSections = buildMetricSections(
      run.events || [],
      opts.itemsById,
      metricId,
      side,
    );
    cachedSources = cachedSections[0]?.sources || [];
    cachedSeries = buildCumulativeSeries(cachedSources, engineDuration);
  }

  function renderMetric() {
    syncMetricChrome();
    loadSources();
    paintList();
    renderPlot(seriesUpTo(engineT));
    updateCursor();
  }

  /**
   * @param {number} nextT
   * @param {{ bars?: boolean, focusKey?: string | null }} [paintOpts]
   */
  function setTime(nextT, paintOpts = {}) {
    engineT = Number(nextT) || 0;
    if (paintOpts.focusKey !== undefined) focusKey = paintOpts.focusKey;
    updateCursor();
    paintList();
    renderPlot(seriesUpTo(engineT));
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
    const row = e.target instanceof Element ? e.target.closest('.sim-dmg__row') : null;
    if (!(row instanceof HTMLElement) || row.classList.contains('sim-dmg__row--total')) return;
    listEl.querySelectorAll('.sim-dmg__row').forEach((el) => el.classList.remove('is-active'));
    row.classList.add('is-active');
    opts.onHighlight?.(row.dataset.placement || null, row.dataset.item || null);
  });

  plotEl?.addEventListener('click', (e) => {
    const dot = e.target instanceof Element ? e.target.closest('[data-t]') : null;
    if (dot instanceof SVGCircleElement) {
      const tt = Number(dot.getAttribute('data-t'));
      if (Number.isFinite(tt)) opts.onSeek?.(tt);
      return;
    }
    if (!(plotEl instanceof SVGElement)) return;
    const rect = plotEl.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const displayT = x * duration;
    opts.onSeek?.(useCombatClock ? toEngineTime(displayT) : displayT);
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

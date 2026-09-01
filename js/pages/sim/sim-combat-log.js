/**
 * In-game Combat Log panel — You/Opponent, activations, search, line scrub.
 * Band Q phases 97–101, 104.
 */

import { prepareLogEvents } from './sim-log-sentences.js';

/** @typedef {'hide' | 'minimize' | 'show'} ActivationsState */

const ACT_LABELS = {
  hide: 'Hide activations',
  minimize: 'Minimize activations',
  show: 'Show activations',
};

const ACT_CYCLE = /** @type {ActivationsState[]} */ (['hide', 'minimize', 'show']);

/**
 * @param {HTMLElement} host
 * @param {{
 *   run: import('./sim-events.js').SimRun,
 *   itemsById?: Map<string, object> | null,
 *   assetRoot?: string,
 *   onSeek?: (t: number) => void,
 *   onHighlight?: (placementKey: string | null, itemId: string | null) => void,
 *   onPlay?: () => void,
 *   onPause?: () => void,
 *   onStep?: (dir: -1 | 1) => void,
 *   getPlaying?: () => boolean,
 * }} opts
 */
export function mountCombatLog(host, opts) {
  const run = opts.run;
  const assetRoot = opts.assetRoot || '../';
  const prepared = prepareLogEvents(run.events || [], {
    dummyEndHp: run.dummyEndHp,
    playerEndHp: run.playerEndHp,
    itemsById: opts.itemsById,
    assetRoot,
    useCombatClock: run.mode !== 'demo',
  });

  let showYou = true;
  let showOpponent = true;
  /** @type {ActivationsState} */
  let activations = 'hide';
  let search = '';
  let t = 0;
  /** @type {number | null} */
  let activeIndex = null;

  host.innerHTML = `
    <section class="sim-clog" aria-label="Combat Log">
      <header class="sim-clog__head">
        <h2 class="sim-clog__title">Combat Log</h2>
        <div class="sim-clog__sides" role="group" aria-label="Side filter">
          <button type="button" class="sim-clog__side sim-clog__side--you is-on" data-side="you" aria-pressed="true">You</button>
          <button type="button" class="sim-clog__side sim-clog__side--opp is-on" data-side="opp" aria-pressed="true">Opponent</button>
        </div>
        <button type="button" class="sim-clog__act" data-act-filter>${ACT_LABELS.hide}</button>
      </header>
      <div class="sim-clog__toolbar">
        <label class="sim-clog__search">
          <span class="sim-clog__search-icon" aria-hidden="true">⌕</span>
          <input type="search" placeholder="Search…" data-search autocomplete="off" />
        </label>
        <div class="sim-clog__replay" role="group" aria-label="Log replay">
          <button type="button" class="sim-clog__rbtn" data-replay="back" title="Previous line" aria-label="Previous line">‹</button>
          <button type="button" class="sim-clog__rbtn" data-replay="play" title="Play / Pause" aria-label="Play or pause" data-playpause>▶</button>
          <button type="button" class="sim-clog__rbtn" data-replay="fwd" title="Next line" aria-label="Next line">›</button>
        </div>
      </div>
      <ol class="sim-clog__list" data-clog-list aria-label="Combat events"></ol>
    </section>
  `;

  const listEl = host.querySelector('[data-clog-list]');
  const searchEl = host.querySelector('[data-search]');
  const actBtn = host.querySelector('[data-act-filter]');
  const playPauseBtn = host.querySelector('[data-playpause]');

  /** @type {HTMLElement[]} */
  const rowEls = [];

  if (listEl instanceof HTMLOListElement) {
    for (const line of prepared.lines) {
      const li = document.createElement('li');
      const depth = Math.max(0, Number(line.ev.meta?.depth) || 0);
      const isSub = depth > 0 || /^\s*>/.test(line.plain);
      li.className = `sim-clog__line ${line.player ? 'sim-clog__line--you' : 'sim-clog__line--opp'}`;
      if (isSub) li.classList.add('sim-clog__line--sub');
      if (depth >= 2) li.classList.add('sim-clog__line--sub2');
      if (line.activation) li.classList.add('sim-clog__line--activation');
      li.dataset.index = String(line.index);
      li.dataset.t = String(line.ev.t);
      li.dataset.depth = String(depth);
      li.dataset.player = line.player ? '1' : '0';
      li.dataset.activation = line.activation ? '1' : '0';
      li.dataset.plain = line.plain;
      li.innerHTML = `<span class="sim-clog__msg">${line.html}</span>`;
      listEl.appendChild(li);
      rowEls.push(li);
    }
  }

  function isMinimized(li) {
    if (!(li instanceof HTMLElement)) return true;
    const player = li.dataset.player === '1';
    if (!showYou && player) return true;
    if (!showOpponent && !player) return true;
    if (li.dataset.activation === '1' && activations === 'minimize') return true;
    if (search) {
      const plain = (li.dataset.plain || '').toLowerCase();
      if (!plain.includes(search.toLowerCase())) return true;
    }
    return false;
  }

  function isVisible(li) {
    if (!(li instanceof HTMLElement)) return false;
    if (li.dataset.activation === '1' && activations === 'hide') return false;
    return true;
  }

  function applyFilters() {
    for (const li of rowEls) {
      const vis = isVisible(li);
      li.hidden = !vis;
      const mini = vis && isMinimized(li);
      li.classList.toggle('is-minimized', mini);
      li.setAttribute('aria-hidden', mini || !vis ? 'true' : 'false');
    }
    highlightAtTime();
  }

  function highlightAtTime() {
    let active = null;
    for (const li of rowEls) {
      if (li.hidden || li.classList.contains('is-minimized')) {
        li.classList.remove('is-past', 'is-active');
        continue;
      }
      const lt = Number(li.dataset.t);
      const on = Number.isFinite(lt) && lt <= t + 1e-6;
      li.classList.toggle('is-past', on);
      li.classList.toggle('is-active', false);
      if (on) active = li;
    }
    if (active instanceof HTMLElement) {
      active.classList.add('is-active');
      activeIndex = Number(active.dataset.index);
    }
  }

  /** Game `moveArrowTo(..., ensureVisibility)` — only if the line is off-screen. */
  function ensureLineVisible(li) {
    if (!listEl || !(li instanceof HTMLElement)) return;
    const top = li.offsetTop;
    const bottom = top + li.offsetHeight;
    const viewTop = listEl.scrollTop;
    const viewBottom = viewTop + listEl.clientHeight;
    if (top < viewTop) listEl.scrollTop = top;
    else if (bottom > viewBottom) listEl.scrollTop = bottom - listEl.clientHeight;
  }

  function setTime(nextT) {
    t = nextT;
    const prev = activeIndex;
    highlightAtTime();
    return activeIndex !== prev;
  }

  /** @param {HTMLElement} li @param {{ seek?: boolean }} [opts] */
  function inspectLine(li, lineOpts = {}) {
    if (li.hidden || li.classList.contains('is-minimized')) return;
    listEl?.querySelectorAll('.is-hover').forEach((el) => el.classList.remove('is-hover'));
    li.classList.add('is-hover');
    const ev = prepared.lines.find((l) => String(l.index) === li.dataset.index)?.ev;
    if (ev) opts.onHighlight?.(ev.placementKey || null, ev.itemId || null);
    if (lineOpts.seek === false) return;
    // Hover must not seek — mouseover while the list updates was jumping HUD 14↔0.
    if (opts.getPlaying?.()) return;
    const tt = Number(li.dataset.t);
    if (Number.isFinite(tt)) opts.onSeek?.(tt);
  }

  function cycleActivations() {
    const i = ACT_CYCLE.indexOf(activations);
    activations = ACT_CYCLE[(i + 1) % ACT_CYCLE.length];
    if (actBtn) actBtn.textContent = ACT_LABELS[activations];
    applyFilters();
  }

  function stepLine(dir) {
    const visible = rowEls.filter(
      (li) => !li.hidden && !li.classList.contains('is-minimized'),
    );
    if (!visible.length) return;
    let idx = visible.findIndex((li) => li.classList.contains('is-active'));
    if (idx < 0) idx = dir > 0 ? -1 : 0;
    const next = visible[Math.max(0, Math.min(visible.length - 1, idx + dir))];
    if (!(next instanceof HTMLElement)) return;
    inspectLine(next, { seek: true });
    ensureLineVisible(next);
  }

  host.querySelector('[data-side="you"]')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    if (!(btn instanceof HTMLElement)) return;
    showYou = !showYou;
    btn.classList.toggle('is-on', showYou);
    btn.setAttribute('aria-pressed', showYou ? 'true' : 'false');
    applyFilters();
  });
  host.querySelector('[data-side="opp"]')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    if (!(btn instanceof HTMLElement)) return;
    showOpponent = !showOpponent;
    btn.classList.toggle('is-on', showOpponent);
    btn.setAttribute('aria-pressed', showOpponent ? 'true' : 'false');
    applyFilters();
  });

  actBtn?.addEventListener('click', () => cycleActivations());

  searchEl?.addEventListener('input', () => {
    search = searchEl instanceof HTMLInputElement ? searchEl.value.trim() : '';
    applyFilters();
  });

  host.querySelector('[data-replay="back"]')?.addEventListener('click', () => {
    opts.onPause?.();
    stepLine(-1);
  });
  host.querySelector('[data-replay="fwd"]')?.addEventListener('click', () => {
    opts.onPause?.();
    stepLine(1);
  });
  playPauseBtn?.addEventListener('click', () => {
    if (opts.getPlaying?.()) {
      opts.onPause?.();
      playPauseBtn.textContent = '▶';
    } else {
      opts.onPlay?.();
      playPauseBtn.textContent = '⏸';
    }
  });

  listEl?.addEventListener('click', (e) => {
    const li = e.target instanceof Element ? e.target.closest('.sim-clog__line') : null;
    if (!(li instanceof HTMLElement)) return;
    inspectLine(li, { seek: true });
  });

  listEl?.addEventListener('mouseover', (e) => {
    const li = e.target instanceof Element ? e.target.closest('.sim-clog__line') : null;
    if (!(li instanceof HTMLElement)) return;
    const from =
      e.relatedTarget instanceof Element
        ? e.relatedTarget.closest('.sim-clog__line')
        : null;
    if (from === li) return;
    inspectLine(li, { seek: false });
  });
  listEl?.addEventListener('mouseleave', () => {
    listEl.querySelectorAll('.is-hover').forEach((el) => el.classList.remove('is-hover'));
    opts.onHighlight?.(null, null);
  });

  applyFilters();
  setTime(0);

  return {
    setTime,
    getActiveIndex: () => activeIndex,
    setPlaying(playing) {
      if (playPauseBtn) playPauseBtn.textContent = playing ? '⏸' : '▶';
    },
    lineCount: prepared.lines.length,
    destroy() {
      host.replaceChildren();
    },
  };
}

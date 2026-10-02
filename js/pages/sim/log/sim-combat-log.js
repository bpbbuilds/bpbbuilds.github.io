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
 *   run: import('../../sim-events.js').SimRun,
 *   itemsById?: Map<string, object> | null,
 *   assetRoot?: string,
 *   filterHost?: HTMLElement | null,
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
      <header class="sim-clog__head sim-logbook__drag" data-logbook-drag title="Drag to move">
        <h2 class="sim-clog__title">Combat Log</h2>
        <div class="sim-clog__sides" role="group" aria-label="Side filter">
          <button type="button" class="sim-clog__side sim-clog__side--you is-on" data-side="you" aria-pressed="true">You</button>
          <button type="button" class="sim-clog__side sim-clog__side--opp is-on" data-side="opp" aria-pressed="true">Opponent</button>
        </div>
        <button type="button" class="sim-clog__close" data-logbook-close aria-label="Close combat log">
          <img src="${assetRoot}assets/icons/sim/log/CloseButton.png" alt="" width="50" height="50" draggable="false" data-close-normal="${assetRoot}assets/icons/sim/log/CloseButton.png" data-close-hover="${assetRoot}assets/icons/sim/log/CloseButton_hovered.png" />
        </button>
      </header>
      <ol class="sim-clog__list" data-clog-list aria-label="Combat events"></ol>
    </section>
  `;

  const filterHost = opts.filterHost;
  const play = `${assetRoot}assets/icons/sim/log/Play_normal.png`;
  const playHover = `${assetRoot}assets/icons/sim/log/Play_hover.png`;
  const playOn = `${assetRoot}assets/icons/sim/log/Play_playing.png`;
  const fromStart = `${assetRoot}assets/icons/sim/log/PlayFromStart_normal.png`;
  const fromStartHover = `${assetRoot}assets/icons/sim/log/PlayFromStart_hover.png`;
  const fromStartOn = `${assetRoot}assets/icons/sim/log/PlayFromStart_playing.png`;
  const arrow = `${assetRoot}assets/icons/sim/log/NextOptionArrow.png`;
  const filterHtml = `
    <div class="sim-clog-filter">
      <button type="button" class="sim-clog__act" data-act-filter>
        <span data-act-label>${ACT_LABELS.hide}</span>
        <img src="${arrow}" alt="" width="35" height="52" draggable="false" />
      </button>
      <div class="sim-clog__toolbar">
        <label class="sim-clog__search">
          <input type="search" placeholder="Search..." data-search autocomplete="off" />
        </label>
        <div class="sim-clog__replay" role="group" aria-label="Log replay">
          <button type="button" class="sim-clog__rbtn is-flip" data-replay="back" title="Previous line" aria-label="Previous line">
            <img src="${play}" alt="" data-art="${play}" data-art-hover="${playHover}" data-art-on="${playOn}" />
          </button>
          <button type="button" class="sim-clog__rbtn sim-clog__rbtn--fs is-flip" data-replay="end" title="Play from end" aria-label="Play from end">
            <img src="${fromStart}" alt="" data-art="${fromStart}" data-art-hover="${fromStartHover}" data-art-on="${fromStartOn}" />
          </button>
          <button type="button" class="sim-clog__rbtn sim-clog__rbtn--fs" data-replay="start" title="Play from start" aria-label="Play from start">
            <img src="${fromStart}" alt="" data-art="${fromStart}" data-art-hover="${fromStartHover}" data-art-on="${fromStartOn}" />
          </button>
          <button type="button" class="sim-clog__rbtn" data-replay="play" title="Play / Pause" aria-label="Play or pause" data-playpause>
            <img src="${play}" alt="" data-art="${play}" data-art-hover="${playHover}" data-art-on="${playOn}" />
          </button>
        </div>
      </div>
    </div>
  `;
  if (filterHost instanceof HTMLElement) {
    filterHost.innerHTML = filterHtml;
  }

  const listEl = host.querySelector('[data-clog-list]');
  const searchRoot = filterHost instanceof HTMLElement ? filterHost : host;
  const searchEl = searchRoot.querySelector('[data-search]');
  const actBtn = searchRoot.querySelector('[data-act-filter]');
  const actLabel = searchRoot.querySelector('[data-act-label]');
  const playPauseBtn = searchRoot.querySelector('[data-playpause]');
  const closeImg = host.querySelector('[data-close-normal]');

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
    if (actLabel) actLabel.textContent = ACT_LABELS[activations];
    else if (actBtn) actBtn.textContent = ACT_LABELS[activations];
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

  function setReplayArt(playing) {
    const img = playPauseBtn?.querySelector('img');
    if (!(img instanceof HTMLImageElement)) return;
    img.src = playing ? img.dataset.artOn || playOn : img.dataset.art || play;
  }

  for (const btn of searchRoot.querySelectorAll('.sim-clog__rbtn')) {
    if (!(btn instanceof HTMLElement)) continue;
    const img = btn.querySelector('img');
    if (!(img instanceof HTMLImageElement)) continue;
    btn.addEventListener('pointerenter', () => {
      if (btn.getAttribute('aria-pressed') === 'true') return;
      img.src = img.dataset.artHover || img.src;
    });
    btn.addEventListener('pointerleave', () => {
      img.src =
        btn.getAttribute('aria-pressed') === 'true'
          ? img.dataset.artOn || img.src
          : img.dataset.art || img.src;
    });
  }

  if (closeImg instanceof HTMLImageElement) {
    const closeBtn = closeImg.closest('button');
    closeBtn?.addEventListener('pointerenter', () => {
      closeImg.src = closeImg.dataset.closeHover || closeImg.src;
    });
    closeBtn?.addEventListener('pointerleave', () => {
      closeImg.src = closeImg.dataset.closeNormal || closeImg.src;
    });
  }

  searchRoot.querySelector('[data-replay="back"]')?.addEventListener('click', () => {
    opts.onPause?.();
    stepLine(-1);
  });
  searchRoot.querySelector('[data-replay="start"]')?.addEventListener('click', () => {
    opts.onSeek?.(0);
    opts.onPlay?.();
  });
  searchRoot.querySelector('[data-replay="end"]')?.addEventListener('click', () => {
    opts.onPause?.();
    const last = rowEls.filter((li) => !li.hidden && !li.classList.contains('is-minimized')).pop();
    const tt = last ? Number(last.dataset.t) : 0;
    if (Number.isFinite(tt)) opts.onSeek?.(tt);
  });
  playPauseBtn?.addEventListener('click', () => {
    if (opts.getPlaying?.()) {
      opts.onPause?.();
      playPauseBtn.setAttribute('aria-pressed', 'false');
      setReplayArt(false);
    } else {
      opts.onPlay?.();
      playPauseBtn.setAttribute('aria-pressed', 'true');
      setReplayArt(true);
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
      playPauseBtn?.setAttribute('aria-pressed', playing ? 'true' : 'false');
      setReplayArt(playing);
    },
    lineCount: prepared.lines.length,
    destroy() {
      host.replaceChildren();
      if (filterHost instanceof HTMLElement) filterHost.replaceChildren();
    },
  };
}

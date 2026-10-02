/**
 * Static Combat Log kitchen sink — one of each chrome / line / meter piece.
 * Open /sim/log-ui/ to restyle without a live fight.
 */

import { initNav } from '../../../shared/nav.js';
import { initFooter } from '../../../shared/footer.js';
import { logSpecimens } from './specimens.js';
import {
  bindClogResize,
  clearResizedHeight,
  resizeHandleHtml,
} from '../log/sim-clog-resize.js';

initNav();
initFooter({ variant: 'slim' });

const root = document.body?.dataset?.root || '../../';
const R = root.endsWith('/') ? root : `${root}/`;

const chev = `${R}assets/icons/sim/log/OpenButton_right.png`;
const meterIcon = `${R}assets/icons/sim/log/DamageMeterIcon.png`;
const close = `${R}assets/icons/sim/log/CloseButton.png`;
const closeH = `${R}assets/icons/sim/log/CloseButton_hovered.png`;
const arrow = `${R}assets/icons/sim/log/NextOptionArrow.png`;
const drop = `${R}assets/icons/sim/log/DropdownArrow.png`;
const play = `${R}assets/icons/sim/log/Play_normal.png`;
const playH = `${R}assets/icons/sim/log/Play_hover.png`;
const playOn = `${R}assets/icons/sim/log/Play_playing.png`;
const fromStart = `${R}assets/icons/sim/log/PlayFromStart_normal.png`;
const fromStartH = `${R}assets/icons/sim/log/PlayFromStart_hover.png`;
const fromStartOn = `${R}assets/icons/sim/log/PlayFromStart_playing.png`;

function rbtn(src, extra = '', title = '', replay = '') {
  return `<button type="button" class="sim-clog__rbtn ${extra}" title="${title}" data-replay="${replay}">
    <img src="${src}" alt="" width="28" height="28" draggable="false" />
  </button>`;
}

/** Game DamageMeterPlot palette / symbols, cycled by sort order. */
const PLOT_COLORS = ['#fe7878', '#f7ae5d', '#fce26f', '#b4fc9a', '#63f5b7'];
const PLOT_SYMBOLS = [
  'Symbol_Star.png',
  'Symbol_Triangle.png',
  'Symbol_Circle.png',
  'Symbol_Square.png',
  'Symbol_Moon.png',
];

function meterRow(name, pct, total, rate, i = 0, extra = '') {
  const tint = extra.includes('is-off') ? '#a79b8c' : PLOT_COLORS[i % PLOT_COLORS.length];
  // Absolute: CSS mask URLs in custom properties resolve against the stylesheet
  const sym = new URL(
    `${R}assets/icons/sim/log/plot/${PLOT_SYMBOLS[i % PLOT_SYMBOLS.length]}`,
    document.baseURI,
  ).href;
  return `<li class="sim-dmg__row ${extra}">
    <span class="sim-dmg__name">${name}</span>
    <span class="sim-dmg__bar"><span class="sim-dmg__fill" style="width:${pct}%;background:${tint}"></span><span class="sim-dmg__pct">${pct}%</span></span>
    <button type="button" class="sim-dmg__plotbtn" title="Toggle plot line">
      <span class="sim-dmg__symbol" style="--plot-mask:url('${sym}');--plot-tint:${tint}"></span>
    </button>
    <span class="sim-dmg__total">${total} <span class="sim-dmg__rate">(${rate}/s)</span></span>
  </li>`;
}

/** Inline section plot (game raises one plot per sub-metric into the list). */
function meterPlot(lines) {
  const grid = `${R}assets/icons/sim/log/plot/CoordinateSystem.png`;
  const paths = lines
    .map(
      (l, i) =>
        `<polyline class="sim-dmg__pline" points="${l}" stroke="${PLOT_COLORS[i % PLOT_COLORS.length]}" />`,
    )
    .join('');
  return `<li class="sim-dmg__plotrow">
    <svg class="sim-dmg__plot" viewBox="0 0 394 240" role="img" aria-label="Sample plot">
      <image href="${grid}" x="0" y="12.5" width="390" height="197" />
      ${paths}
      <line class="sim-dmg__vbar" x1="240" y1="18" x2="240" y2="203" />
      <text class="sim-dmg__plab" x="17" y="27">256.0</text>
      <text class="sim-dmg__plab" x="2" y="224">0.0s</text>
      <text class="sim-dmg__plab sim-dmg__plab--end" x="387" y="225">10.0s</text>
    </svg>
  </li>`;
}

function meterPanel(side, title) {
  return `
    <section class="sim-dmg" aria-label="${title}">
      <header class="sim-dmg__head">
        <div class="sim-dmg__metric-wrap">
          <button type="button" class="sim-dmg__metric-btn" aria-haspopup="listbox" aria-expanded="false">
            <span class="sim-dmg__metric-label">Damage Dealt</span>
            <img class="sim-dmg__metric-caret" src="${drop}" alt="" width="39" height="30" draggable="false" />
          </button>
        </div>
      </header>
      <div class="sim-dmg__body">
        <ul class="sim-dmg__list">
          <li class="sim-dmg__section">Damage Dealt</li>
          ${meterRow('Hungry Blade', 100, '180.0', '18.0', 0)}
          ${meterRow('Torch', 42, '76.0', '7.6', 1, 'is-off')}
          <li class="sim-dmg__row sim-dmg__row--total" aria-label="Total">
            <span class="sim-dmg__name">Total</span>
            <span class="sim-dmg__total">256.0 <span class="sim-dmg__rate">(25.6/s)</span></span>
          </li>
          ${meterPlot(['8,203 80,150 160,110 240,70 387,30'])}
          <li class="sim-dmg__section">Missed attacks</li>
          ${meterRow('Broom', 100, '3.0', '0.3', 0)}
          ${meterPlot(['8,203 120,190 240,170 387,150'])}
          <li class="sim-dmg__section">Damage blocked</li>
          ${meterRow('Training Dummy', 100, '45.0', '4.5', 0)}
          ${side === 'dummy' ? '<li class="sim-dmg__empty">No healing</li>' : ''}
        </ul>
      </div>
    </section>
  `;
}

const main = document.getElementById('main');
if (!main) throw new Error('missing #main');

main.innerHTML = `
  <div class="sim-log-ui__intro">
    <h1>Combat Log UI kitchen sink</h1>
    <p>
      Static specimens — same classes as <code>/sim/</code>. Tabs start open.
      Click flap chevrons to toggle. Reload after CSS edits.
    </p>
  </div>
  <div class="sim-clog-ui" data-clog-ui>
    <aside class="sim-clog-tab sim-clog-tab--filter sim-clog-patch is-open" data-clog-tab="filter">
      <button type="button" class="sim-clog-tab__chev" data-tab-toggle="filter" aria-expanded="true" title="Search and replay">
        <img src="${chev}" alt="" width="44" height="55" draggable="false" />
      </button>
      <div class="sim-clog-tab__body">
        <div class="sim-clog-filter">
          <button type="button" class="sim-clog__act">
            <span>Hide activations</span>
            <img src="${arrow}" alt="" width="35" height="52" draggable="false" />
          </button>
          <div class="sim-clog__toolbar">
            <label class="sim-clog__search">
              <input type="search" placeholder="Search..." value="Hungry" autocomplete="off" />
            </label>
            <div class="sim-clog__replay" role="group" aria-label="Log replay">
              ${rbtn(play, 'is-flip', 'Previous line', 'back')}
              ${rbtn(fromStart, 'sim-clog__rbtn--fs is-flip', 'Play from end', 'end')}
              ${rbtn(fromStartOn, 'sim-clog__rbtn--fs', 'Play from start (playing)', 'start')}
              ${rbtn(playOn, '', 'Play (playing)', 'play')}
            </div>
          </div>
        </div>
      </div>
    </aside>
    <aside class="sim-clog-tab sim-clog-tab--you sim-clog-patch is-open" data-clog-tab="you">
      <button type="button" class="sim-clog-tab__chev" data-tab-toggle="you" aria-expanded="true" title="Your combat metrics">
        <img src="${chev}" alt="" width="44" height="103" draggable="false" />
      </button>
      <img class="sim-clog-tab__icon" src="${meterIcon}" alt="" width="39" height="32" draggable="false" />
      <div class="sim-clog-tab__body">${meterPanel('player', 'You combat metrics')}</div>
      ${resizeHandleHtml('you', 'Resize your damage meter')}
    </aside>
    <section class="sim-clog-panel sim-clog-patch">
      <div class="sim-results__log">
        <section class="sim-clog" aria-label="Combat Log">
          <header class="sim-clog__head">
            <h2 class="sim-clog__title">Combat Log</h2>
            <div class="sim-clog__sides" role="group" aria-label="Side filter">
              <button type="button" class="sim-clog__side sim-clog__side--you is-on" aria-pressed="true">You</button>
              <button type="button" class="sim-clog__side sim-clog__side--opp is-on" aria-pressed="true">Opponent</button>
              <button type="button" class="sim-clog__side sim-clog__side--you" aria-pressed="false">You off</button>
              <button type="button" class="sim-clog__side sim-clog__side--opp" aria-pressed="false">Opp off</button>
            </div>
            <button type="button" class="sim-clog__close" aria-label="Close combat log">
              <img src="${close}" alt="" width="50" height="50" draggable="false" />
            </button>
          </header>
          <ol class="sim-clog__list" aria-label="Combat event specimens">
            ${logSpecimens({ root: R })}
          </ol>
        </section>
      </div>
      ${resizeHandleHtml('log', 'Resize combat log')}
    </section>
    <aside class="sim-clog-tab sim-clog-tab--opp sim-clog-patch is-open" data-clog-tab="opp">
      <button type="button" class="sim-clog-tab__chev" data-tab-toggle="opp" aria-expanded="true" title="Opponent combat metrics">
        <img src="${chev}" alt="" width="44" height="103" draggable="false" />
      </button>
      <img class="sim-clog-tab__icon" src="${meterIcon}" alt="" width="39" height="32" draggable="false" />
      <div class="sim-clog-tab__body">${meterPanel('dummy', 'Opponent combat metrics')}</div>
      ${resizeHandleHtml('opp', 'Resize opponent damage meter')}
    </aside>
  </div>
`;

const closeImg = main.querySelector('.sim-clog__close img');
const closeBtn = main.querySelector('.sim-clog__close');
closeBtn?.addEventListener('pointerenter', () => {
  if (closeImg instanceof HTMLImageElement) closeImg.src = closeH;
});
closeBtn?.addEventListener('pointerleave', () => {
  if (closeImg instanceof HTMLImageElement) closeImg.src = close;
});

main.addEventListener('click', (e) => {
  const btn = e.target instanceof Element ? e.target.closest('[data-tab-toggle]') : null;
  if (!(btn instanceof HTMLElement)) return;
  const id = btn.getAttribute('data-tab-toggle');
  const tab = main.querySelector(`[data-clog-tab="${id}"]`);
  if (!(tab instanceof HTMLElement)) return;
  const open = !tab.classList.contains('is-open');
  tab.classList.toggle('is-open', open);
  if (id !== 'filter') clearResizedHeight(tab);
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
});

const clogUi = main.querySelector('[data-clog-ui]');
if (clogUi instanceof HTMLElement) bindClogResize(clogUi);

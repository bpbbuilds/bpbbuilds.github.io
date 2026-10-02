/**
 * Opponent column chrome for /sim/ — foe rail + dummy bag-slot settings live here
 * (not the bottom lab rail), so Mirror/board never blocks clicks.
 */

import { simBagStageHtml } from '../controls/sim-round-picker.js';
import { foeSideRailHtml } from './sim-side-rails.js';

/**
 * @param {string} s
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Always-on right column shell (Dummy / Build / Mirror).
 * @param {{
 *   title: string,
 *   classIconHtml?: string,
 *   bodyHtml: string,
 *   root?: string,
 * }} opts
 */
export function simOppColumnHtml(opts) {
  return `
    <section
      class="sim-region sim-region--stage sim-field__bag sim-field__bag--opp"
      data-sim-opp-column
      aria-labelledby="sim-region-opp-board"
    >
      <h2 id="sim-region-opp-board" class="sim-region__label">Opponent</h2>
      <div class="sim-opp-chrome">
        <div class="sim-bag-head">
          <h3 class="sim-bag-title" data-sim-opp-title>${escapeHtml(opts.title)}</h3>
          <span data-sim-opp-class-icon>${opts.classIconHtml || ''}</span>
        </div>
        <div class="sim-bag-wrap sim-bag-wrap--opp" data-sim-opp-body>
          ${opts.bodyHtml}
        </div>
        <div data-sim-foe-avatar-host></div>
      </div>
      ${foeSideRailHtml(opts.root || '../')}
    </section>
  `;
}

/**
 * @param {'dummy' | 'build' | 'mirror'} foeMode
 * @param {object | null} oppBoard
 * @param {string} root
 */
export function simOppBodyHtml(foeMode, oppBoard, root) {
  if (foeMode === 'dummy') {
    return `
      <div
        class="sim-opp-dummy"
        data-sim-dummy-settings
        role="region"
        aria-label="Dummy settings"
      ></div>
    `;
  }
  if (!oppBoard?.placements?.length) {
    return `
      <div class="sim-opp-dummy" role="status">
        <p class="sim-opp-dummy__empty">No backpack</p>
      </div>
    `;
  }
  return simBagStageHtml(oppBoard);
}

/**
 * @param {'dummy' | 'build' | 'mirror'} foeMode
 * @param {object | null} oppBoard
 */
export function simOppTitle(foeMode, oppBoard) {
  if (foeMode === 'dummy' || !oppBoard) return 'Training dummy';
  if (foeMode === 'mirror') return 'Mirror';
  return oppBoard.title || oppBoard.slug || 'Opponent';
}

/**
 * @param {'dummy' | 'build' | 'mirror'} foeMode
 * @param {object | null} oppBoard
 */
export function simOppBannerName(foeMode, oppBoard) {
  if (foeMode === 'dummy' || !oppBoard) return '00100';
  return String(oppBoard.authorName || '').trim() || simOppTitle(foeMode, oppBoard);
}

/**
 * Update title / class icon without remounting foe rail.
 * Dummy settings live in the empty bag body when foe = Dummy.
 * @param {HTMLElement} column
 * @param {{
 *   title: string,
 *   classIconHtml: string,
 * }} opts
 */
export function syncOppColumnHead(column, opts) {
  const titleEl = column.querySelector('[data-sim-opp-title]');
  if (titleEl) titleEl.textContent = opts.title;
  const iconHost = column.querySelector('[data-sim-opp-class-icon]');
  if (iconHost) iconHost.innerHTML = opts.classIconHtml || '';
}

/**
 * Replace bag / dummy body markup.
 * @param {HTMLElement} column
 * @param {string} bodyHtml
 */
export function setOppColumnBody(column, bodyHtml) {
  const body = column.querySelector('[data-sim-opp-body]');
  if (!(body instanceof HTMLElement)) return null;
  body.innerHTML = bodyHtml;
  return body;
}

export { escapeHtml as escapeOppHtml };

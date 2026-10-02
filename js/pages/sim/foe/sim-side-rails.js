/**
 * Sim avatar side rails — you person popover + shared rail HTML (foe chrome).
 * Foe opponent mount lives in `sim-foe-rail.js`.
 */

import { blobAvatarPath } from '../hud/sim-avatars.js';

/**
 * @typedef {'class' | 'profile' | 'blob'} AvatarPickMode
 */

/**
 * @param {string} s
 */
function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/**
 * @param {string} side
 * @param {string} kind
 * @param {string} label
 * @param {string} inner
 * @param {{ interactive?: boolean }} [opts]
 */
function railSlotHtml(side, kind, label, inner, opts = {}) {
  const interactive = opts.interactive === true;
  const dataAttr =
    side === 'you' ? 'data-sim-you-rail' : 'data-sim-foe-rail';
  const inertAttrs = interactive
    ? `aria-haspopup="dialog" aria-expanded="false" ${dataAttr}="${kind}"`
    : `aria-disabled="true" tabindex="-1" ${dataAttr}="${kind}"`;
  return `
    <button
      type="button"
      class="sim-side-rail__slot sim-side-rail__slot--${kind}${interactive ? '' : ' is-inert'}"
      ${inertAttrs}
      title="${escapeAttr(label)}"
      aria-label="${escapeAttr(label)}"
    >${inner}</button>
  `;
}

/**
 * You-side rail: person (interactive) + two empty slots.
 * Mount under `.sim-field__bag--you` (absolute left, sword x).
 * @param {string} [root]
 */
export function youSideRailHtml(root = '../') {
  const base = root.endsWith('/') ? root : `${root}/`;
  const personArt = `<img class="sim-side-rail__art" src="${escapeAttr(base)}assets/icons/history/PersonToggle.png" alt="" width="40" height="40" draggable="false" />`;
  return `
    <div
      class="sim-side-rail sim-side-rail--you"
      data-sim-side-rail="you"
      aria-label="Avatar tools"
    >
      ${railSlotHtml('you', 'person', 'Choose avatar', personArt, {
        interactive: true,
      })}
      <div
        class="sim-side-rail__pop sim-side-rail__pop--you"
        data-sim-you-avatar-pop
        hidden
        role="dialog"
        aria-label="Your avatar"
      ></div>
      ${railSlotHtml('you', 'empty', 'Reserved', '', { interactive: false })}
      ${railSlotHtml('you', 'empty', 'Reserved', '', { interactive: false })}
    </div>
  `;
}

/**
 * Foe-side rail: opponent target icon + popover host.
 * Mount under `.sim-field__bag--opp` (absolute right).
 * @param {string} [root]
 */
export function foeSideRailHtml(root = '../') {
  const base = root.endsWith('/') ? root : `${root}/`;
  const targetArt = `<img class="sim-side-rail__art" src="${escapeAttr(base)}assets/icons/history/OpponentToggle.png" alt="" width="40" height="40" draggable="false" />`;
  return `
    <div
      class="sim-side-rail sim-side-rail--foe"
      data-sim-side-rail="foe"
      data-sim-asset-root="${escapeAttr(base)}"
      aria-label="Opponent tools"
    >
      ${railSlotHtml('foe', 'opponent', 'Choose opponent', targetArt, {
        interactive: true,
      })}
      <div
        class="sim-side-rail__pop sim-side-rail__pop--foe"
        data-sim-foe-mode-pop
        hidden
        role="dialog"
        aria-label="Opponent mode"
      ></div>
    </div>
  `;
}

/**
 * @param {AvatarPickMode} mode
 * @param {string} classSrc class emblem icon (e.g. PyromancerIcon.png)
 * @param {string} profileUrl Discord pfp
 * @param {string} blobSrc blob (+ cosmetics) preview
 */
function personPopInnerHtml(mode, classSrc, profileUrl, blobSrc) {
  const profileOk = Boolean(String(profileUrl || '').trim());
  const blobOk = Boolean(String(blobSrc || '').trim());
  const active =
    mode === 'blob' && blobOk
      ? 'blob'
      : mode === 'profile' && profileOk
        ? 'profile'
        : 'class';
  const profileBtn = profileOk
    ? `<button
        type="button"
        class="sim-side-rail__choice sim-side-rail__choice--you${active === 'profile' ? ' is-active' : ''}"
        data-you-avatar="profile"
        role="radio"
        aria-checked="${active === 'profile' ? 'true' : 'false'}"
        title="Profile"
        aria-label="Profile"
      >
        <img class="sim-side-rail__choice-img sim-side-rail__choice-img--profile" src="${escapeAttr(profileUrl)}" alt="" width="48" height="48" draggable="false" />
      </button>`
    : `<button
        type="button"
        class="sim-side-rail__choice sim-side-rail__choice--you"
        data-you-avatar="profile"
        role="radio"
        aria-checked="false"
        disabled
        title="No profile avatar"
        aria-label="Profile unavailable"
      >
        <span class="sim-side-rail__choice-img sim-side-rail__choice-img--empty" aria-hidden="true"></span>
      </button>`;

  return `
    <div class="sim-side-rail__choices sim-side-rail__choices--you" role="radiogroup" aria-label="Avatar look">
      <button
        type="button"
        class="sim-side-rail__choice sim-side-rail__choice--you${active === 'class' ? ' is-active' : ''}"
        data-you-avatar="class"
        role="radio"
        aria-checked="${active === 'class' ? 'true' : 'false'}"
        title="Class"
        aria-label="Class"
      >
        <img class="sim-side-rail__choice-img sim-side-rail__choice-img--class" src="${escapeAttr(classSrc)}" alt="" width="48" height="48" draggable="false" />
      </button>
      ${profileBtn}
      <button
        type="button"
        class="sim-side-rail__choice sim-side-rail__choice--you sim-side-rail__choice--blob${active === 'blob' ? ' is-active' : ''}"
        data-you-avatar="blob"
        role="radio"
        aria-checked="${active === 'blob' ? 'true' : 'false'}"
        title="Blob"
        aria-label="Blob"
      >
        <img class="sim-side-rail__choice-img sim-side-rail__choice-img--blob" src="${escapeAttr(blobSrc || '')}" alt="" width="48" height="48" draggable="false" />
      </button>
    </div>
  `;
}

/**
 * @param {HTMLElement} bagColumn `.sim-field__bag--you` (or rail host)
 * @param {{
 *   mode: AvatarPickMode,
 *   classSrc: string,
 *   profileUrl?: string | null,
 *   blobUrl?: string | null,
 *   root?: string,
 *   onChange: (mode: AvatarPickMode) => void,
 * }} opts
 */
export function mountYouPersonRail(bagColumn, opts) {
  const rail = bagColumn.matches?.('[data-sim-side-rail="you"]')
    ? bagColumn
    : bagColumn.querySelector('[data-sim-side-rail="you"]');
  if (!(rail instanceof HTMLElement)) {
    return { update() {}, destroy() {} };
  }

  const personBtn = rail.querySelector('[data-sim-you-rail="person"]');
  const pop = rail.querySelector('[data-sim-you-avatar-pop]');
  if (
    !(personBtn instanceof HTMLButtonElement) ||
    !(pop instanceof HTMLElement)
  ) {
    return { update() {}, destroy() {} };
  }

  let mode =
    opts.mode === 'profile'
      ? 'profile'
      : opts.mode === 'blob'
        ? 'blob'
        : 'class';
  let classSrc = String(opts.classSrc || '');
  let profileUrl = String(opts.profileUrl || '').trim();
  let blobUrl = String(opts.blobUrl || '').trim() || blobAvatarPath(String(opts.root || '../'));
  let root = String(opts.root || '../');
  let open = false;

  const paintPop = () => {
    pop.innerHTML = personPopInnerHtml(
      mode,
      classSrc,
      profileUrl,
      blobUrl || blobAvatarPath(root),
    );
  };

  const setOpen = (next) => {
    open = next;
    pop.hidden = !open;
    personBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    rail.classList.toggle('is-pop-open', open);
    if (open) paintPop();
  };

  const paintActive = () => {
    if (!open) return;
    paintPop();
  };

  const onPersonClick = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    setOpen(!open);
  };

  const onPopClick = (ev) => {
    const btn =
      ev.target instanceof Element
        ? ev.target.closest('[data-you-avatar]')
        : null;
    if (!(btn instanceof HTMLButtonElement) || btn.disabled) return;
    const next = btn.getAttribute('data-you-avatar');
    if (next !== 'class' && next !== 'profile' && next !== 'blob') return;
    if (next === 'profile' && !profileUrl) return;
    mode = /** @type {AvatarPickMode} */ (next);
    opts.onChange(mode);
    paintActive();
    setOpen(false);
  };

  const onDocPointer = (ev) => {
    if (!open) return;
    const t = ev.target;
    if (!(t instanceof Node)) return;
    if (rail.contains(t)) return;
    setOpen(false);
  };

  const onKey = (ev) => {
    if (!open) return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      setOpen(false);
      personBtn.focus();
    }
  };

  personBtn.addEventListener('click', onPersonClick);
  pop.addEventListener('click', onPopClick);
  document.addEventListener('pointerdown', onDocPointer, true);
  document.addEventListener('keydown', onKey);

  return {
    /**
     * @param {{
     *   mode?: AvatarPickMode,
     *   classSrc?: string,
     *   profileUrl?: string | null,
     *   blobUrl?: string | null,
     *   root?: string,
     * }} next
     */
    update(next) {
      if (next.mode === 'class' || next.mode === 'profile' || next.mode === 'blob') {
        mode = next.mode;
      }
      if (typeof next.classSrc === 'string') classSrc = next.classSrc;
      if ('profileUrl' in next) {
        profileUrl = String(next.profileUrl || '').trim();
      }
      if ('blobUrl' in next) {
        blobUrl = String(next.blobUrl || '').trim() || blobAvatarPath(root);
      }
      if (typeof next.root === 'string') root = next.root;
      if (mode === 'profile' && !profileUrl) mode = 'class';
      paintActive();
    },
    destroy() {
      setOpen(false);
      personBtn.removeEventListener('click', onPersonClick);
      pop.removeEventListener('click', onPopClick);
      document.removeEventListener('pointerdown', onDocPointer, true);
      document.removeEventListener('keydown', onKey);
    },
  };
}

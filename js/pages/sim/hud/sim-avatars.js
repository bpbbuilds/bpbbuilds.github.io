/**
 * Stage avatar slots for /sim/ — large bag-column figures (game-like combat).
 * You: class vs Discord profile vs blob. Foe: dummy fixed; build author / mirror your profile.
 */

import { classCharacterPath } from '../../../shared/class-icons.js';

export const YOU_AVATAR_KEY = 'bpb-sim-you-avatar';
export const FOE_AVATAR_KEY = 'bpb-sim-foe-avatar';

/**
 * @typedef {'class' | 'profile' | 'blob'} AvatarPickMode
 */

/**
 * @param {string} root
 */
export function dummyAvatarPath(root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  return `${base}assets/sim/dummy/dummy.png`;
}

/**
 * Light blob base (profile wardrobe body) for sim stage sprite.
 * @param {string} root
 */
export function blobAvatarPath(root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  return `${base}assets/blob/blob-base.png`;
}

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
 * @param {string} key
 * @returns {AvatarPickMode}
 */
function readPickMode(key) {
  try {
    const raw = String(localStorage.getItem(key) || '')
      .trim()
      .toLowerCase();
    if (raw === 'profile') return 'profile';
    if (raw === 'blob') return 'blob';
  } catch {
    /* ignore */
  }
  return 'class';
}

/**
 * @param {string} key
 * @param {AvatarPickMode} mode
 */
function savePickMode(key, mode) {
  try {
    const v =
      mode === 'profile' ? 'profile' : mode === 'blob' ? 'blob' : 'class';
    localStorage.setItem(key, v);
  } catch {
    /* ignore */
  }
}

/** @returns {AvatarPickMode} */
export function readYouAvatarMode() {
  return readPickMode(YOU_AVATAR_KEY);
}

/** @param {AvatarPickMode} mode */
export function saveYouAvatarMode(mode) {
  savePickMode(YOU_AVATAR_KEY, mode);
}

/** @returns {AvatarPickMode} */
export function readFoeAvatarMode() {
  return readPickMode(FOE_AVATAR_KEY);
}

/** @param {AvatarPickMode} mode */
export function saveFoeAvatarMode(mode) {
  savePickMode(FOE_AVATAR_KEY, mode);
}

/**
 * @param {string} root
 * @param {string | null | undefined} heroClass
 */
function classStandIn(root, heroClass) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const src = classCharacterPath(base, heroClass);
  const label = String(heroClass || '').trim() || 'Adventurer';
  return { src, label, kind: /** @type {'class'} */ ('class') };
}

/**
 * @param {string} root
 * @param {{ heroClass?: string | null } | null | undefined} youBoard
 * @param {{
 *   mode?: AvatarPickMode,
 *   profileAvatarUrl?: string | null,
 *   blobAvatarUrl?: string | null,
 * }} [opts]
 */
export function resolveYouAvatar(root, youBoard, opts = {}) {
  const mode =
    opts.mode === 'profile'
      ? 'profile'
      : opts.mode === 'blob'
        ? 'blob'
        : 'class';
  const profileUrl = String(opts.profileAvatarUrl || '').trim();
  const blobUrl = String(opts.blobAvatarUrl || '').trim();
  if (mode === 'blob') {
    return {
      src: blobUrl || blobAvatarPath(root),
      label: 'Blob',
      kind: /** @type {'blob'} */ ('blob'),
    };
  }
  if (mode === 'profile' && profileUrl) {
    return {
      src: profileUrl,
      label: 'Profile',
      kind: /** @type {'profile'} */ ('profile'),
    };
  }
  return classStandIn(root, youBoard?.heroClass);
}

/**
 * @param {string} root
 * @param {'dummy' | 'build' | 'mirror'} foeMode
 * @param {{
 *   heroClass?: string | null,
 *   authorAvatarUrl?: string | null,
 *   authorAvatarKind?: 'blob' | 'profile' | null,
 * } | null | undefined} oppBoard
 * @param {{ heroClass?: string | null } | null | undefined} youBoard
 * @param {{
 *   profileAvatarUrl?: string | null,
 *   profileIsBlob?: boolean,
 * } } [opts]
 */
export function resolveFoeAvatar(root, foeMode, oppBoard, youBoard, opts = {}) {
  if (foeMode === 'dummy') {
    return {
      src: dummyAvatarPath(root),
      label: 'Training dummy',
      kind: /** @type {'dummy'} */ ('dummy'),
    };
  }

  if (foeMode === 'mirror') {
    const youUrl = String(opts.profileAvatarUrl || '').trim();
    if (youUrl) {
      return {
        src: youUrl,
        label: 'Profile',
        kind: opts.profileIsBlob
          ? /** @type {'blob'} */ ('blob')
          : /** @type {'profile'} */ ('profile'),
      };
    }
    return classStandIn(root, youBoard?.heroClass || oppBoard?.heroClass);
  }

  // Public build — author equipped look (blob → Discord URL on board).
  const authorUrl = String(oppBoard?.authorAvatarUrl || '').trim();
  if (authorUrl) {
    return {
      src: authorUrl,
      label: 'Author',
      kind:
        oppBoard?.authorAvatarKind === 'blob'
          ? /** @type {'blob'} */ ('blob')
          : /** @type {'profile'} */ ('profile'),
    };
  }
  return classStandIn(root, oppBoard?.heroClass || youBoard?.heroClass);
}

/**
 * Whether foe Profile pick is available for the current mode.
 * @param {'dummy' | 'build' | 'mirror'} foeMode
 * @param {{ authorAvatarUrl?: string | null } | null | undefined} oppBoard
 * @param {string | null | undefined} profileAvatarUrl
 */
export function foeProfileAvailable(foeMode, oppBoard, profileAvatarUrl) {
  if (foeMode === 'dummy') return false;
  if (foeMode === 'mirror') return Boolean(String(profileAvatarUrl || '').trim());
  return Boolean(String(oppBoard?.authorAvatarUrl || '').trim());
}

/**
 * @param {'you' | 'foe'} side
 * @param {{ src: string, label: string, kind: string }} avatar
 */
export function avatarSlotHtml(side, avatar) {
  const kind =
    avatar.kind === 'dummy'
      ? 'dummy'
      : avatar.kind === 'profile'
        ? 'profile'
        : avatar.kind === 'blob'
          ? 'blob'
          : 'class';
  return `
    <figure
      class="sim-avatar sim-avatar--${side} sim-avatar--${kind}"
      data-sim-avatar="${side}"
    >
      <img
        class="sim-avatar__img"
        data-sim-avatar-img
        src="${escapeAttr(avatar.src)}"
        alt="${escapeAttr(avatar.label)}"
        title="${escapeAttr(avatar.label)}"
        width="256"
        height="320"
        draggable="false"
      />
    </figure>
  `;
}

/**
 * @param {'you' | 'foe'} side
 * @param {string} ariaLabel
 * @param {AvatarPickMode} mode
 * @param {boolean} profileAvailable
 * @param {string} [profileTitle]
 */
function pickHtml(side, ariaLabel, mode, profileAvailable, profileTitle) {
  const active = mode === 'profile' ? 'profile' : 'class';
  const dataAttr = side === 'you' ? 'data-you-avatar' : 'data-foe-avatar';
  const pickAttr =
    side === 'you' ? 'data-sim-you-avatar-pick' : 'data-sim-foe-avatar-pick';
  const disabledTitle =
    profileTitle ||
    (side === 'you'
      ? 'Sign in to use your Discord avatar'
      : 'No author profile avatar');
  return `
    <div
      class="sim-avatar-pick"
      ${pickAttr}
      role="radiogroup"
      aria-label="${escapeAttr(ariaLabel)}"
    >
      <button
        type="button"
        class="sim-avatar-pick__btn${active === 'class' ? ' is-active' : ''}"
        role="radio"
        aria-checked="${active === 'class' ? 'true' : 'false'}"
        ${dataAttr}="class"
      >Class</button>
      <button
        type="button"
        class="sim-avatar-pick__btn${active === 'profile' ? ' is-active' : ''}"
        role="radio"
        aria-checked="${active === 'profile' ? 'true' : 'false'}"
        ${dataAttr}="profile"
        ${profileAvailable ? '' : `disabled title="${escapeAttr(disabledTitle)}"`}
      >Profile</button>
    </div>
  `;
}

/**
 * @param {{ src: string, label: string, kind: string }} avatar
 */
export function youAvatarStackHtml(avatar) {
  return `
    <div class="sim-avatar-stack sim-avatar-stack--you" data-sim-avatar-stack="you">
      ${avatarSlotHtml('you', avatar)}
    </div>
  `;
}

/**
 * @param {{ src: string, label: string, kind: string }} avatar
 */
export function foeAvatarStackHtml(avatar) {
  return `
    <div class="sim-avatar-stack sim-avatar-stack--foe" data-sim-avatar-stack="foe">
      ${avatarSlotHtml('foe', avatar)}
    </div>
  `;
}

/**
 * @param {HTMLElement | null | undefined} slot
 * @param {{ src: string, label: string, kind: string }} avatar
 */
export function setAvatarSrc(slot, avatar) {
  if (!(slot instanceof HTMLElement)) return;
  const kind =
    avatar.kind === 'dummy'
      ? 'dummy'
      : avatar.kind === 'profile'
        ? 'profile'
        : avatar.kind === 'blob'
          ? 'blob'
          : 'class';
  slot.classList.toggle('sim-avatar--dummy', kind === 'dummy');
  slot.classList.toggle('sim-avatar--class', kind === 'class');
  slot.classList.toggle('sim-avatar--profile', kind === 'profile');
  slot.classList.toggle('sim-avatar--blob', kind === 'blob');
  const img = slot.querySelector('[data-sim-avatar-img]');
  if (!(img instanceof HTMLImageElement)) return;
  img.src = avatar.src;
  img.alt = avatar.label;
  img.title = avatar.label;
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   side: 'you' | 'foe',
 *   mode: AvatarPickMode,
 *   profileAvailable: boolean,
 *   onChange: (mode: AvatarPickMode) => void,
 * }} opts
 */
function mountAvatarPick(host, opts) {
  let mode =
    opts.mode === 'profile'
      ? 'profile'
      : opts.mode === 'blob'
        ? 'blob'
        : 'class';
  const pickSel =
    opts.side === 'you'
      ? '[data-sim-you-avatar-pick]'
      : '[data-sim-foe-avatar-pick]';
  const btnAttr = opts.side === 'you' ? 'data-you-avatar' : 'data-foe-avatar';
  const pickEl =
    host instanceof HTMLElement && host.matches(pickSel)
      ? host
      : host.querySelector(pickSel);
  if (!(pickEl instanceof HTMLElement)) {
    return {
      update() {},
      destroy() {},
    };
  }

  const paintActive = () => {
    for (const btn of pickEl.querySelectorAll(`[${btnAttr}]`)) {
      if (!(btn instanceof HTMLButtonElement)) continue;
      const id = btn.getAttribute(btnAttr);
      const on = id === mode;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      if (id === 'profile') {
        btn.disabled = !opts.profileAvailable;
      }
    }
  };

  const onClick = (ev) => {
    const btn =
      ev.target instanceof Element
        ? ev.target.closest(`[${btnAttr}]`)
        : null;
    if (!(btn instanceof HTMLButtonElement) || btn.disabled) return;
    const next = btn.getAttribute(btnAttr);
    if (next !== 'class' && next !== 'profile' && next !== 'blob') return;
    if (next === 'profile' && !opts.profileAvailable) return;
    mode = /** @type {AvatarPickMode} */ (next);
    if (opts.side === 'you') saveYouAvatarMode(mode);
    else saveFoeAvatarMode(mode);
    paintActive();
    opts.onChange(mode);
  };

  pickEl.addEventListener('click', onClick);
  paintActive();

  return {
    /**
     * @param {{ mode?: AvatarPickMode, profileAvailable?: boolean }} next
     */
    update(next) {
      if (next.mode === 'class' || next.mode === 'profile' || next.mode === 'blob') {
        mode = next.mode;
      }
      if (typeof next.profileAvailable === 'boolean') {
        opts.profileAvailable = next.profileAvailable;
      }
      paintActive();
    },
    destroy() {
      pickEl.removeEventListener('click', onClick);
    },
  };
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   mode: AvatarPickMode,
 *   profileAvailable: boolean,
 *   onChange: (mode: AvatarPickMode) => void,
 * }} opts
 */
export function mountYouAvatarPick(host, opts) {
  return mountAvatarPick(host, { ...opts, side: 'you' });
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   mode: AvatarPickMode,
 *   profileAvailable: boolean,
 *   onChange: (mode: AvatarPickMode) => void,
 * }} opts
 */
export function mountFoeAvatarPick(host, opts) {
  return mountAvatarPick(host, { ...opts, side: 'foe' });
}

/**
 * Admin unlock gate — sessionStorage secret (not localStorage).
 * Lock flag dismisses owner JWT until secret unlock (or clearLock).
 */

import { config } from '../../shared/config.js';

const SESSION_KEY = 'bpb-admin-secret';
const LOCK_KEY = 'bpb-admin-locked';

export function getSessionSecret() {
  try {
    return String(sessionStorage.getItem(SESSION_KEY) || '').trim();
  } catch {
    return '';
  }
}

/** @param {string} secret */
export function saveSessionSecret(secret) {
  const s = String(secret || '').trim();
  try {
    if (s) sessionStorage.setItem(SESSION_KEY, s);
    else sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(LOCK_KEY);
  } catch {
    /* private mode */
  }
}

export function clearSessionSecret() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* private mode */
  }
}

export function isAdminLocked() {
  try {
    return sessionStorage.getItem(LOCK_KEY) === '1';
  } catch {
    return false;
  }
}

export function lockAdminSession() {
  try {
    sessionStorage.setItem(LOCK_KEY, '1');
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* private mode */
  }
}

export function clearAdminLock() {
  try {
    sessionStorage.removeItem(LOCK_KEY);
  } catch {
    /* private mode */
  }
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   onUnlock: (secret: string) => void,
 *   onOwnerSession?: () => void,
 *   error?: string,
 *   ownerReady?: boolean,
 * }} opts
 */
export function mountGate(host, opts) {
  const preset = String(config.submitSecret || '').trim();
  const err = opts.error ? `<p class="admin-gate__error" role="alert">${escapeHtml(opts.error)}</p>` : '';
  const ownerBtn = opts.ownerReady && typeof opts.onOwnerSession === 'function'
    ? `<button type="button" class="admin-btn admin-btn--primary" data-admin-owner>Continue as Discord owner</button>`
    : '';

  host.innerHTML = `
    <div class="admin-gate">
      <h1 class="admin-gate__title">Admin</h1>
      <p class="admin-gate__blurb">Prefer Sign in with Discord (owner). Break-glass: submit secret. Not linked from the public nav.</p>
      ${err}
      ${ownerBtn}
      <form class="admin-gate__form" autocomplete="off">
        <label class="admin-gate__label" for="admin-secret">Submit secret</label>
        <input
          id="admin-secret"
          class="admin-gate__input"
          type="password"
          name="secret"
          spellcheck="false"
          autocomplete="off"
          value="${escapeAttr(preset)}"
        />
        <button type="submit" class="admin-btn admin-btn--primary">Unlock with secret</button>
      </form>
    </div>
  `;

  host.querySelector('[data-admin-owner]')?.addEventListener('click', () => {
    opts.onOwnerSession?.();
  });

  const form = host.querySelector('.admin-gate__form');
  const input = host.querySelector('#admin-secret');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const secret = String(input instanceof HTMLInputElement ? input.value : '').trim();
    if (!secret) return;
    opts.onUnlock(secret);
  });
  if (input instanceof HTMLInputElement) input.focus();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

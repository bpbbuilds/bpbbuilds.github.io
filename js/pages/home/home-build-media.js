/**
 * Shared thumb / escape helpers for homepage build cards.
 */

import { youtubeThumb } from '../../shared/youtube.js';

export function rootPrefix() {
  const raw = document.body?.dataset?.root ?? './';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/**
 * @param {string | null | undefined} path
 * @param {string | null | undefined} youtubeUrl
 * @param {string} root
 */
export function resolveThumb(path, youtubeUrl, root) {
  if (path) {
    if (/^https?:\/\//i.test(path)) return path;
    return `${root}${path.replace(/^\//, '')}`;
  }
  return youtubeThumb(youtubeUrl, 'maxresdefault') || `${root}assets/heroes/hero-party-loot.png`;
}

/** @param {string | null | undefined} youtubeUrl */
export function thumbOnErrorAttr(youtubeUrl) {
  const hq = youtubeThumb(youtubeUrl, 'sddefault') || youtubeThumb(youtubeUrl, 'hqdefault');
  if (!hq) return '';
  return ` onerror="this.onerror=null;this.src='${hq.replace(/'/g, '%27')}'"`;
}

/** @param {string} slug */
export function buildViewHref(slug, root) {
  const s = String(slug || '').trim();
  if (!s) return `${root}builds/`;
  return `${root}builds/view/?slug=${encodeURIComponent(s)}`;
}

/** @param {string} slug */
export function simHref(slug, root) {
  const s = String(slug || '').trim();
  if (!s) return `${root}sim/`;
  return `${root}sim/?slug=${encodeURIComponent(s)}`;
}

/** @param {unknown} s */
export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @param {unknown} s */
export function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

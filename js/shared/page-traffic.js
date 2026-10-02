/**
 * Count one visit per browser session for a public page section.
 * Stores a path + daily total only. No account, IP, or query string.
 */

import { getSupabase } from './supabase.js';

/** @type {readonly string[]} */
const SECTIONS = Object.freeze([
  '/',
  '/items/',
  '/builds/',
  '/builds/history/',
  '/builds/view/',
  '/builds/*',
  '/create/',
  '/events/',
  '/challenges/',
  '/quest/',
  '/market/',
  '/sim/',
  '/u/',
  '/legal/about/',
  '/legal/privacy/',
  '/legal/terms/',
  '/overlay/',
]);

/**
 * @param {string} pathname
 * @returns {string | null}
 */
export function trafficPath(pathname) {
  let path = String(pathname || '/');
  path = path.replace(/\/index\.html$/i, '/');
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.length > 1 && !path.endsWith('/')) path = `${path}/`;
  if (path.startsWith('/admin') || path.startsWith('/dev')) return null;
  if (path.startsWith('/builds/')) {
    if (path === '/builds/' || path === '/builds/history/' || path === '/builds/view/') return path;
    return '/builds/*';
  }
  if (path.startsWith('/u/')) return '/u/';
  if (path.startsWith('/overlay/')) return '/overlay/';
  if (path.startsWith('/legal/about')) return '/legal/about/';
  if (path.startsWith('/legal/privacy')) return '/legal/privacy/';
  if (path.startsWith('/legal/terms')) return '/legal/terms/';
  return SECTIONS.includes(path) ? path : null;
}

export function notePageView() {
  try {
    const path = trafficPath(location.pathname);
    if (!path) return;
    const key = `bpb-pv:${path}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    // The query builder does not send until something awaits it.
    void getSupabase()
      .rpc('record_page_view', { p_path: path })
      .then(
        () => {},
        () => {},
      );
  } catch {
    /* Missing config or a blocked storage write should not break the page. */
  }
}

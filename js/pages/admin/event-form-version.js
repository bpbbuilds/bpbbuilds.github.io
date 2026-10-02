/**
 * Newest shipped game version from the item catalog.
 * Unreleased rows (Book of Ice New is 10.0.0) are not the live patch.
 */

import { getSupabase } from '../../shared/supabase.js';
import { versionToInt } from '../items/library-sort.js';

/** @type {Promise<string> | null} */
let pending = null;

/** @returns {Promise<string>} */
export function latestGameVersion() {
  if (!pending) pending = loadLatest();
  return pending;
}

/**
 * Fill an empty min-version field. Leaves a saved value alone.
 * @param {HTMLFormElement} form
 */
export function fillLatestGameVersion(form) {
  const input = form.elements.namedItem('minGameVersion');
  if (!(input instanceof HTMLInputElement)) return;
  if (input.value.trim()) return;
  latestGameVersion()
    .then((ver) => {
      if (!ver || input.value.trim()) return;
      input.value = ver;
    })
    .catch(() => {
      pending = null;
    });
}

/** @returns {Promise<string>} */
async function loadLatest() {
  const { data, error } = await getSupabase()
    .from('items')
    .select('game_version, release_state')
    .not('game_version', 'is', null);
  if (error || !data) return '';
  let best = '';
  let bestN = 0;
  for (const row of data) {
    if (row.release_state === 'unreleased') continue;
    const ver = String(row.game_version || '').trim();
    const n = versionToInt(ver);
    if (!ver || n <= bestN) continue;
    bestN = n;
    best = ver;
  }
  return best;
}

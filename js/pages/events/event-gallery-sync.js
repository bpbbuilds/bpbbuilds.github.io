/**
 * Ask the database to hide or release contest entries.
 * The clock lives in SQL, so a page load cannot publish a board early.
 */

import { getSupabase } from '../../shared/supabase.js';

/** @type {Promise<void> | null} */
let pending = null;

export function syncEventBuildVisibility() {
  if (!pending) {
    pending = getSupabase()
      .rpc('sync_event_build_visibility')
      .then(() => {})
      .catch(() => {});
  }
  return pending;
}

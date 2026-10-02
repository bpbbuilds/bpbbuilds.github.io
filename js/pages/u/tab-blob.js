/**
 * Profile hub — Blob tab (wardrobe: preview + slots + inventory).
 */

import { mountBlobWardrobe } from './blob/wardrobe.js';

/**
 * @param {HTMLElement} stage
 * @param {{
 *   profile: object,
 *   isSelf: boolean,
 *   root: string,
 *   onLoadoutChange?: (payload: string) => void,
 * }} ctx
 */
export async function mountBlobTab(stage, ctx) {
  stage.innerHTML = `<p class="build-status">Loading blob wardrobe…</p>`;
  try {
    await mountBlobWardrobe(stage, ctx);
  } catch (err) {
    console.error(err);
    stage.innerHTML = `<p class="build-status">Could not load blob wardrobe.</p>`;
  }
}

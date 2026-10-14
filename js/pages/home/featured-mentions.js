/**
 * Featured build description helpers. Keep the renderer pure so it can share
 * the Build view's escaping/chip contract without importing browser services.
 */

import { notesToHtml } from '../../shared/item-mentions.js';

/**
 * @param {string} text
 * @param {{ itemsById: Map<string, object>, getSpriteUrl: (item: object) => string }} mentionData
 */
export function featuredBlurbHtml(text, mentionData) {
  return notesToHtml(text, mentionData.itemsById, mentionData.getSpriteUrl);
}

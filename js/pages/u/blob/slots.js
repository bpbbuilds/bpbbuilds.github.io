/**
 * Blob wardrobe equip slots — shoulder-up / peeking bust (Dunkbin-style).
 */

/** @typedef {'hat' | 'face' | 'head' | 'neck' | 'body' | 'hand'} BlobSlotId */
/** @typedef {BlobSlotId} WardrobeSlotId */

/**
 * Two rails beside the preview: left 3 + right 3.
 * Orbit % is the slot’s center on the stage (0–100).
 *
 * @type {readonly { id: BlobSlotId, label: string, orbit: { x: number, y: number } }[]}
 */
export const BLOB_SLOTS = Object.freeze([
  { id: 'hat', label: 'Hat', orbit: { x: 14, y: 13 } },
  { id: 'face', label: 'Face', orbit: { x: 14, y: 50 } },
  { id: 'neck', label: 'Neck', orbit: { x: 14, y: 87 } },
  { id: 'head', label: 'Full head', orbit: { x: 86, y: 13 } },
  { id: 'body', label: 'Body', orbit: { x: 86, y: 50 } },
  { id: 'hand', label: 'Hand', orbit: { x: 86, y: 87 } },
]);

/** Same list — no separate background rail. */
export const BLOB_WARDROBE_SLOTS = BLOB_SLOTS;

/** @type {readonly BlobSlotId[]} */
export const BLOB_SLOT_IDS = Object.freeze(BLOB_SLOTS.map((s) => s.id));

/**
 * @param {string} id
 * @returns {id is BlobSlotId}
 */
export function isBlobSlotId(id) {
  return BLOB_SLOT_IDS.includes(/** @type {BlobSlotId} */ (id));
}

/**
 * @param {string} id
 * @returns {id is WardrobeSlotId}
 */
export function isWardrobeSlotId(id) {
  return isBlobSlotId(id);
}

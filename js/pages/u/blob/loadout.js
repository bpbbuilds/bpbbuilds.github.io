/**
 * Blob loadout ↔ profiles.equipped_avatar (JSON v1 or legacy string).
 */

import { BLOB_SLOT_IDS, isBlobSlotId } from './slots.js';

/** @typedef {import('./slots.js').BlobSlotId} BlobSlotId */
/** @typedef {{
 *   v: 1,
 *   base: string,
 *   slots: Record<BlobSlotId, string | null>,
 * }} BlobLoadout */

/**
 * @returns {BlobLoadout}
 */
export function emptyLoadout() {
  /** @type {Record<BlobSlotId, string | null>} */
  const slots = /** @type {any} */ ({});
  for (const id of BLOB_SLOT_IDS) slots[id] = null;
  return { v: 1, base: 'discord', slots };
}

/**
 * @param {string | null | undefined} raw
 * @returns {BlobLoadout}
 */
export function parseLoadout(raw) {
  const s = String(raw || '').trim();
  if (!s || s === 'discord') return emptyLoadout();

  if (s.startsWith('{')) {
    try {
      const j = JSON.parse(s);
      if (j && j.v === 1 && j.slots && typeof j.slots === 'object') {
        const base = emptyLoadout();
        base.base = String(j.base || 'discord').trim() || 'discord';
        for (const id of BLOB_SLOT_IDS) {
          const v = j.slots[id];
          base.slots[id] = typeof v === 'string' && v.trim() ? v.trim() : null;
        }
        return base;
      }
    } catch {
      /* fall through */
    }
  }

  // Legacy single key / URL — treat as face override only.
  const base = emptyLoadout();
  if (/^https?:\/\//i.test(s) || s.startsWith('blob:')) {
    base.slots.face = s;
  }
  return base;
}

/**
 * @param {BlobLoadout} loadout
 * @returns {string}
 */
export function serializeLoadout(loadout) {
  const out = emptyLoadout();
  out.base = String(loadout?.base || 'discord').trim() || 'discord';
  for (const id of BLOB_SLOT_IDS) {
    const v = loadout?.slots?.[id];
    out.slots[id] = typeof v === 'string' && v.trim() ? v.trim() : null;
  }
  const anySlot = BLOB_SLOT_IDS.some((id) => out.slots[id]);
  if (!anySlot && out.base === 'discord') return 'discord';
  return JSON.stringify(out);
}

/**
 * @param {BlobLoadout | null | undefined} loadout
 * @returns {'discord' | 'blob'}
 */
export function identityMode(loadout) {
  const b = String(loadout?.base || 'discord').trim().toLowerCase();
  return b === 'blob' ? 'blob' : 'discord';
}

/**
 * @param {BlobLoadout} loadout
 * @param {'discord' | 'blob' | string} mode
 * @returns {BlobLoadout}
 */
export function setIdentityMode(loadout, mode) {
  const next = mode === 'blob' ? 'blob' : 'discord';
  if (identityMode(loadout) === next) return loadout;
  return { ...loadout, base: next };
}

/**
 * @param {BlobLoadout} loadout
 * @param {BlobSlotId} slot
 * @param {string | null} cosmeticId
 */
export function setSlot(loadout, slot, cosmeticId) {
  if (!isBlobSlotId(slot)) return loadout;
  return {
    ...loadout,
    slots: {
      ...loadout.slots,
      [slot]: cosmeticId ? String(cosmeticId).trim() || null : null,
    },
  };
}

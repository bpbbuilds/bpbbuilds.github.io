/**
 * Resolve the public “equipped” profile look for sim / UGC / nav.
 * Discord sync stays on `avatar_url`; `equipped_avatar` is the optional override
 * (legacy URL / blob key, or JSON v1 loadout from the profile Blob tab).
 * Loadout `base`: `discord` (default) | `blob` (website Light blob).
 *
 * For blob identity with cosmetics layered on, prefer `faceHtml` / `hydrateFaces`
 * or `bakeBlobFaceUrl` from `blob-face.js` — this helper returns the base PNG only.
 */

/**
 * @param {string | null | undefined} raw
 * @returns {{ base: 'discord' | 'blob', face?: string | null } | null}
 */
function tryParseLoadout(raw) {
  const s = String(raw || '').trim();
  if (!s.startsWith('{')) return null;
  try {
    const j = JSON.parse(s);
    if (j && j.v === 1 && j.slots && typeof j.slots === 'object') {
      const base = String(j.base || 'discord').trim().toLowerCase() === 'blob' ? 'blob' : 'discord';
      return { base, face: j.slots.face || null };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * @param {{
 *   avatar_url?: string | null,
 *   equipped_avatar?: string | null,
 * } | null | undefined} profile
 * @returns {'discord' | 'blob'}
 */
export function resolveIdentityMode(profile) {
  const equipped = String(profile?.equipped_avatar || '').trim();
  if (!equipped || equipped === 'discord') return 'discord';
  const loadout = tryParseLoadout(equipped);
  if (loadout) return loadout.base;
  if (equipped.startsWith('blob:') || equipped === 'blob') return 'blob';
  return 'discord';
}

/**
 * @param {{
 *   avatar_url?: string | null,
 *   equipped_avatar?: string | null,
 * } | null | undefined} profile
 * @param {string} [assetRoot] site root ending in / (for blob keys)
 * @returns {string | null}
 */
export function resolveEquippedAvatarUrl(profile, assetRoot = '../') {
  const equipped = String(profile?.equipped_avatar || '').trim();
  const discord = String(profile?.avatar_url || '').trim();
  const root = assetRoot.endsWith('/') ? assetRoot : `${assetRoot}/`;
  const blobBase = `${root}assets/blob/blob-base.png`;

  const loadout = tryParseLoadout(equipped);
  if (loadout) {
    if (loadout.base === 'blob') return blobBase;
    const face = String(loadout.face || '').trim();
    if (face && /^https?:\/\//i.test(face)) return face;
    if (face && face.startsWith('blob:')) {
      const blobMap = /** @type {Record<string, string>} */ ({
        // 'blob:peeking': `${root}assets/sim/blobs/peeking.png`,
      });
      if (blobMap[face]) return blobMap[face];
    }
    // Discord identity (or placeholder face cosmetics) → Discord avatar.
    return discord || null;
  }

  if (equipped && /^https?:\/\//i.test(equipped)) {
    return equipped;
  }

  if (equipped === 'blob' || (equipped && equipped.startsWith('blob:'))) {
    const blobMap = /** @type {Record<string, string>} */ ({
      blob: blobBase,
      // 'blob:peeking': `${root}assets/sim/blobs/peeking.png`,
    });
    const mapped = blobMap[equipped] || blobBase;
    if (mapped) return mapped;
  }

  return discord || null;
}

/**
 * Blob cosmetics catalog + ownership (starter / plan / event grants).
 */

import { isBlobSlotId } from './slots.js';
import { normalizePlan } from '../../../shared/entitlements.js';

/** @typedef {import('./slots.js').BlobSlotId} BlobSlotId */

/** @typedef {'part'} BlobCosmeticKind */

/** @typedef {'starter' | 'premium' | 'founding' | 'event'} BlobCosmeticGrant */

/** @typedef {{
 *   id: string,
 *   name: string,
 *   slot: BlobSlotId,
 *   kind: BlobCosmeticKind,
 *   starter?: boolean,
 *   grant?: BlobCosmeticGrant | null,
 *   swatch?: string,
 *   image?: string,
 *   icon?: string,
 *   rarity?: string,
 *   cost?: number | null,
 *   description?: string,
 *   owner?: string,
 *   artist?: string,
 *   added?: string,
 * }} BlobCosmetic */

/** @typedef {{
 *   plan?: string | null,
 *   cosmetic_grants?: unknown,
 *   is_owner?: boolean | null,
 * }} BlobOwnershipProfile */

const GRANTS = new Set(['starter', 'premium', 'founding', 'event']);

/** @type {BlobCosmetic[] | null} */
let catalog = null;
/** @type {Promise<BlobCosmetic[]> | null} */
let catalogLoad = null;

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function parseCosmeticGrants(raw) {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x || '').trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return [];
    try {
      return parseCosmeticGrants(JSON.parse(s));
    } catch {
      return s
        .split(/[,;\s]+/)
        .map((x) => x.trim())
        .filter(Boolean);
    }
  }
  return [];
}

/**
 * @param {string | undefined} raw
 * @param {boolean} starter
 * @returns {BlobCosmeticGrant | null}
 */
function resolveGrant(raw, starter) {
  const g = String(raw || '').trim().toLowerCase();
  if (GRANTS.has(g)) return /** @type {BlobCosmeticGrant} */ (g);
  if (starter) return 'starter';
  return null;
}

/**
 * @param {string} root
 */
export function loadBlobCatalog(root) {
  if (catalog) return Promise.resolve(catalog);
  if (catalogLoad) return catalogLoad;
  const base = root.endsWith('/') ? root : `${root}/`;
  catalogLoad = fetch(`${base}assets/data/blob-cosmetics.json`, {
    signal: AbortSignal.timeout(12000),
  })
    .then((r) => (r.ok ? r.json() : { items: [] }))
    .then((j) => {
      const items = Array.isArray(j?.items) ? j.items : [];
      catalog = items
        .map((raw) => {
          const id = String(raw?.id || '').trim();
          if (!id) return null;
          const slotRaw = String(raw?.slot || '').trim();
          if (!isBlobSlotId(slotRaw)) return null;
          const starter = raw?.starter === true;
          const resolveAsset = (rawPath) => {
            const p = String(rawPath || '').trim();
            if (!p) return '';
            if (p.startsWith('http') || p.startsWith('data:')) return p;
            return `${base}${p.replace(/^\//, '')}`;
          };
          const image = resolveAsset(raw?.image);
          const icon = resolveAsset(raw?.icon) || image;
          return {
            id,
            name: String(raw?.name || id).trim() || id,
            slot: /** @type {BlobSlotId} */ (slotRaw),
            kind: /** @type {BlobCosmeticKind} */ ('part'),
            starter,
            grant: resolveGrant(raw?.grant, starter),
            swatch: String(raw?.swatch || '').trim() || '#8a5a2b',
            image,
            icon,
            rarity: String(raw?.rarity || 'Common').trim() || 'Common',
            cost:
              raw?.cost != null && Number.isFinite(Number(raw.cost))
                ? Number(raw.cost)
                : null,
            description: String(raw?.description || '').trim(),
            owner: String(raw?.owner || '').trim(),
            artist: String(raw?.artist || '').trim(),
            added: String(raw?.added || '').trim(),
          };
        })
        .filter(Boolean);
      return catalog;
    })
    .catch(() => {
      catalog = [];
      return catalog;
    });
  return catalogLoad;
}

/**
 * @param {BlobCosmetic} c
 * @param {BlobOwnershipProfile | null | undefined} profile
 */
export function ownsCosmetic(c, profile) {
  if (!c) return false;
  if (profile?.is_owner) return true;

  // Blob wardrobe is free; only exclusive grants stay gated.
  const grant = c.grant || (c.starter ? 'starter' : null);
  if (grant === 'starter' || c.starter) return true;
  if (!grant) return false;

  const plan = normalizePlan(profile?.plan);
  const grants = new Set(parseCosmeticGrants(profile?.cosmetic_grants));

  if (grant === 'premium') return plan === 'premium' || plan === 'founding';
  if (grant === 'founding') return plan === 'founding';
  if (grant === 'event') return grants.has(c.id);
  return false;
}

/**
 * Cosmetics the profile may equip / see in inventory.
 * @param {BlobCosmetic[]} items
 * @param {BlobOwnershipProfile | null | undefined} [profile]
 */
export function ownedCosmetics(items, profile) {
  return items.filter((c) => ownsCosmetic(c, profile));
}

/**
 * @param {BlobCosmetic[]} items
 * @param {BlobCosmeticKind} [kind]
 * @param {BlobOwnershipProfile | null | undefined} [profile]
 */
export function ownedOfKind(items, kind, profile) {
  const owned = ownedCosmetics(items, profile);
  if (!kind) return owned;
  return owned.filter((c) => c.kind === kind);
}

/**
 * @param {BlobCosmetic[]} items
 * @param {string | null | undefined} id
 */
export function cosmeticById(items, id) {
  const key = String(id || '').trim();
  if (!key) return null;
  return items.find((c) => c.id === key) || null;
}

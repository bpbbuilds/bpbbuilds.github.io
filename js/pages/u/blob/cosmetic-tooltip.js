/**
 * Map blob cosmetics → ItemTooltip shape + hover bind for wardrobe tiles/slots.
 */

import { createTooltipHover } from '../../../shared/tooltip-hover.js';
import { cropSrcToContent } from './fit-item-icon.js';
import { BLOB_SLOTS } from './slots.js';

/** @typedef {import('./catalog.js').BlobCosmetic} BlobCosmetic */

const RARITIES = new Set(['Common', 'Rare', 'Epic', 'Legendary', 'Godly', 'Unique']);

/** @type {Map<string, string>} */
const previewCropBySrc = new Map();

/**
 * @param {string | undefined} r
 */
function rarityKey(r) {
  const v = String(r || 'Common').trim();
  return RARITIES.has(v) ? v : 'Common';
}

/**
 * @param {string | undefined} iso
 */
function formatAdded(iso) {
  const raw = String(iso || '').trim();
  if (!raw) return '';
  // Catalog dates are calendar dates, not UTC instants. Parsing YYYY-MM-DD
  // with `new Date(raw)` shifts them back one day in western time zones.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const d = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Prefetch cropped item-only previews (no blob base).
 * @param {BlobCosmetic[]} catalog
 */
function warmPreviewCrops(catalog) {
  for (const c of catalog) {
    const src = String(c.image || c.icon || '').trim();
    if (!src || previewCropBySrc.has(src)) continue;
    void cropSrcToContent(src).then((cropped) => {
      if (cropped) previewCropBySrc.set(src, cropped);
    });
  }
}

/**
 * How a player gets this cosmetic. Market buys skip the line — the gold worth is enough.
 * @param {BlobCosmetic} c
 */
function obtainedBy(c) {
  const grant = String(c.grant || (c.starter ? 'starter' : '')).toLowerCase();
  const cost = Number(c.cost);
  const marketBuy = !grant && Number.isFinite(cost) && cost > 0;
  if (marketBuy) return '';
  if (grant === 'starter') return 'Comes with every blob.';
  if (grant === 'premium') return 'Included with Premium or Founding.';
  if (grant === 'founding') return 'Founding members only.';
  if (grant === 'event') {
    if (c.id === 'grant_event_trophy') return 'Awarded for winning the DPS Stone event.';
    return 'Awarded from an event.';
  }
  return '';
}

/**
 * Build the game tooltip payload for a cosmetic.
 * @param {BlobCosmetic} c
 */
export function cosmeticToTooltipItem(c) {
  const slotLabel = BLOB_SLOTS.find((s) => s.id === c.slot)?.label || String(c.slot);
  const parts = [];
  const desc = String(c.description || '').trim();
  parts.push(desc || 'Cosmetic wardrobe piece.');

  const id = String(c.id || '').trim();
  if (id) parts.push(`Cosmetic ID: ${id}`);

  if (slotLabel) parts.push(`Slot: ${slotLabel}`);

  const artist = String(c.artist || '').trim();
  const owner = String(c.owner || '').trim();
  if (artist && owner && artist !== owner) {
    parts.push(`Artist: ${artist}`, `Owner: ${owner}`);
  } else if (artist || owner) {
    parts.push(`Created by: ${artist || owner}`);
  }

  const added = formatAdded(c.added);
  if (added) parts.push(`Added: ${added}`);

  const src = String(c.image || c.icon || '').trim();
  const previewImage = (src && previewCropBySrc.get(src)) || src || undefined;

  /** Fiscal worth — always show when catalog has a number (0 = not buyable/sellable). */
  const costRaw = c.cost;
  const hasCost = costRaw != null && Number.isFinite(Number(costRaw));

  return {
    name: c.name,
    rarity: rarityKey(c.rarity),
    type: slotLabel,
    class: 'Neutral',
    cost: hasCost ? Number(costRaw) : undefined,
    /** Compact gold row: coin icon + value (no "Item cost" label). */
    costDisplay: hasCost ? 'worth' : undefined,
    obtainedBy: obtainedBy(c) || undefined,
    effect: parts.join('\n\n') || '—',
    previewImage,
  };
}

/**
 * @param {HTMLElement} root
 * @param {{
 *   catalog: BlobCosmetic[],
 *   getEquippedId?: (slotId: string) => string | null | undefined,
 * }} opts
 */
export function bindCosmeticTooltips(root, opts) {
  const { catalog, getEquippedId } = opts;
  warmPreviewCrops(catalog);
  const tip = createTooltipHover({ pinOnAlt: true });

  const unbind = tip.bind(root, {
    selector: '[data-blob-item], [data-blob-slot].is-filled',
    getItem: (el) => {
      if (!(el instanceof HTMLElement)) return null;
      const itemId = el.getAttribute('data-blob-item');
      if (itemId) {
        const c = catalog.find((x) => x.id === itemId);
        return c ? cosmeticToTooltipItem(c) : null;
      }
      const slotId = el.getAttribute('data-blob-slot') || '';
      const equipped = getEquippedId?.(slotId);
      if (!equipped) return null;
      const c = catalog.find((x) => x.id === equipped);
      return c ? cosmeticToTooltipItem(c) : null;
    },
  });

  return {
    tip,
    destroy() {
      unbind?.();
      tip.destroy();
    },
  };
}

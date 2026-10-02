/**
 * Free vs Premium comparison. Mount the HTML anywhere, or open it
 * through the shared offer dialog (`openPremiumCompare` in premium-offer.js).
 */

import { PREMIUM_PRICE_LABEL } from './entitlements.js';
import { loadBlobCatalog } from '../pages/u/blob/catalog.js';
import { bindCosmeticTooltips } from '../pages/u/blob/cosmetic-tooltip.js';

/**
 * @typedef {{
 *   name: string,
 *   free: boolean,
 *   premium: boolean,
 *   icon: string,
 *   crown?: boolean,
 * }} PremiumFeature
 */

/** @type {PremiumFeature[]} */
export const PREMIUM_FEATURES = [
  {
    name: 'Item Library, builds, and the board editor',
    free: true,
    premium: true,
    icon: 'assets/icons/classes/NeutralIcon.png',
  },
  {
    name: 'Combat sandbox, log, and damage meters',
    free: false,
    premium: true,
    icon: 'assets/icons/sim/hud/Sword.png',
  },
  {
    name: 'Screenshot to build',
    free: false,
    premium: true,
    icon: 'assets/icons/create/GalleryOrb.png',
  },
  {
    name: 'Export board image',
    free: false,
    premium: true,
    icon: 'assets/icons/create/ExportBoard.png',
  },
  {
    name: 'Premium Crown',
    free: false,
    premium: true,
    icon: 'assets/item-thumbs/2x/Crown.webp',
    crown: true,
  },
];

/**
 * @param {string} s
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {boolean} on
 */
function markHtml(on) {
  const cls = on ? 'is-yes' : 'is-no';
  const label = on ? 'Included' : 'Not included';
  const glyph = on ? '✓' : '—';
  return `<span class="bpb-premium-compare__mark ${cls}" aria-label="${label}">${glyph}</span>`;
}

function assetRoot() {
  const raw = typeof document !== 'undefined' ? document.body?.dataset?.root ?? './' : './';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/**
 * @param {PremiumFeature} row
 */
function featureHtml(row) {
  const src = `${assetRoot()}${row.icon}`;
  if (row.crown) {
    return `
      <div class="bpb-premium-compare__feat">
        <span class="bpb-premium-compare__icon bpb-premium-compare__icon--crown" data-blob-item="premium_crown">
          <img src="${escapeHtml(src)}" alt="" width="64" height="64" draggable="false" />
        </span>
        <span>${escapeHtml(row.name)}</span>
      </div>`;
  }
  return `
    <div class="bpb-premium-compare__feat">
      <img class="bpb-premium-compare__icon${row.icon.includes('Sword.png') ? ' bpb-premium-compare__icon--sword' : ''}" src="${escapeHtml(src)}" alt="" width="32" height="32" draggable="false" />
      <span>${escapeHtml(row.name)}</span>
    </div>`;
}

/**
 * Comparison of the two plans. Drop the returned HTML into any host.
 * @returns {string}
 */
export function premiumCompareHtml() {
  const crownSrc = `${assetRoot()}assets/item-thumbs/2x/Crown.webp`;
  const rows = PREMIUM_FEATURES.map(
    (row) => `
      ${featureHtml(row)}
      <div class="bpb-premium-compare__cell">${markHtml(row.free)}</div>
      <div class="bpb-premium-compare__cell bpb-premium-compare__cell--premium">${markHtml(row.premium)}</div>`,
  ).join('');

  return `
    <div class="bpb-premium-compare">
      <div class="bpb-premium-compare__chart">
        <div class="bpb-premium-compare__rail" aria-hidden="true"></div>
        <div class="bpb-premium-compare__h bpb-premium-compare__h--features">Features</div>
        <div class="bpb-premium-compare__h">Free</div>
        <div class="bpb-premium-compare__h bpb-premium-compare__h--premium">
          <span class="bpb-premium-compare__icon bpb-premium-compare__icon--crown bpb-premium-compare__icon--head" aria-hidden="true">
            <img src="${escapeHtml(crownSrc)}" alt="" width="64" height="64" draggable="false" />
          </span>
          <span class="bpb-premium-compare__premium-word">Premium</span>
        </div>
        ${rows}
      </div>
      <p class="bpb-premium-compare__note">Premium is ${escapeHtml(PREMIUM_PRICE_LABEL)}. Founding members keep it forever.</p>
    </div>`;
}

/** @type {{ destroy: () => void } | null} */
let compareTips = null;

/** Drop the cosmetic hover tip when the offer dialog closes or repaints. */
export function clearPremiumCompareTips() {
  compareTips?.destroy?.();
  compareTips = null;
}

/**
 * Hover tip for the Premium Crown row. No-op until the cosmetic catalog loads.
 * @param {ParentNode} root
 */
export function bindPremiumCompareTips(root) {
  clearPremiumCompareTips();
  if (!root.querySelector?.('[data-blob-item="premium_crown"]')) return;
  if (typeof window === 'undefined' || !window.ItemTooltip?.render) return;
  void loadBlobCatalog(assetRoot()).then((catalog) => {
    if (!root.querySelector?.('[data-blob-item="premium_crown"]')) return;
    compareTips = bindCosmeticTooltips(/** @type {HTMLElement} */ (root), { catalog });
  });
}

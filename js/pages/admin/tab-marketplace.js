/**
 * Admin Marketplace tab — coming soon stub.
 */

/**
 * @param {HTMLElement} host
 */
export function mountMarketplacePanel(host) {
  host.innerHTML = `
    <section class="admin-panel admin-marketplace" aria-label="Marketplace">
      <p class="admin-panel__blurb">
        Player buy / sell for blob cosmetics and profile goods. Phase 2 — not shipping yet.
      </p>
      <div class="admin-marketplace__soon">
        <p class="admin-marketplace__soon-title">Coming soon</p>
        <p class="admin-marketplace__soon-meta">
          Listings, moderation, and payouts will live here once the cosmetics catalog and wallet path are ready.
        </p>
      </div>
    </section>
  `;
}

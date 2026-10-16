/**
 * Lightweight build-tooltip preview.
 *
 * This deliberately does not run the combat simulator. It mounts the same
 * placed-board renderer and reuses the Sim's activation clips on a small,
 * deterministic clock so catalog hovers stay cheap.
 */

/** @type {Map<string, Promise<void>>} */
const styleLoads = new Map();

/**
 * @param {string} root
 * @returns {Promise<void>}
 */
function ensureSimAnimationStyles(root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const href = `${base}js/pages/sim/fx/sim-item-anims.css?v=build-tip-preview-20261016a`;
  const cached = styleLoads.get(href);
  if (cached) return cached;

  const existing = document.querySelector(`link[data-build-tip-sim-anims][href="${href}"]`);
  if (existing) return Promise.resolve();

  const promise = new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.buildTipSimAnims = 'true';
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => resolve(), { once: true });
    document.head.appendChild(link);
  });
  styleLoads.set(href, promise);
  return promise;
}

/**
 * @param {object} p
 * @param {number} index
 */
function placementKey(p, index) {
  return p.key != null
    ? String(p.key)
    : `${p.id}:${index}:${Number(p.x) || 0},${Number(p.y) || 0}:${Number(p.r) || 0}`;
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   placements: object[],
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   root: string,
 *   cellPx?: number,
 * }} opts
 * @returns {Promise<{ stop: () => void }>}
 */
export async function mountBuildTipAnimation(host, opts) {
  if (!(host instanceof HTMLElement) || !Array.isArray(opts.placements) || !opts.placements.length) {
    throw new Error('Build tooltip preview needs placements');
  }

  await ensureSimAnimationStyles(opts.root);
  const [{ mountPlacedGrid }, { createItemAnims, loadActivationAniMap }] = await Promise.all([
    import('../../shared/backpack-grid/index.js'),
    import('../sim/fx/sim-item-anims.js'),
  ]);
  await loadActivationAniMap(opts.root);

  host.replaceChildren();
  const mounted = mountPlacedGrid(host, {
    placements: opts.placements,
    itemsById: opts.itemsById,
    cols: 9,
    rows: 7,
    getSpriteUrl: opts.getSpriteUrl,
    root: opts.root,
    cellPx: Number(opts.cellPx) > 0 ? Number(opts.cellPx) : 48,
    exactBoard: true,
    fillWidth: false,
    fitHost: false,
    appear: false,
    preserveBagFabric: true,
    promo: false,
    promoInteractive: false,
  });
  mounted.el.classList.add('sim-bag', 'build-more-tip__live-grid');

  const animations = createItemAnims({
    boardEl: mounted.el,
    assetRoot: opts.root,
  });
  const placements = opts.placements.filter((p) => opts.itemsById.has(p.id));
  let cursor = 0;
  let timer = 0;
  let stopped = false;

  const tick = () => {
    if (stopped || !placements.length) return;
    const p = placements[cursor % placements.length];
    const index = opts.placements.indexOf(p);
    cursor += 1;
    animations.play(placementKey(p, index), {
      itemId: p.id,
      t: performance.now() / 1000,
    });
    timer = window.setTimeout(tick, 480);
  };
  tick();

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      if (timer) window.clearTimeout(timer);
      animations.destroy();
      mounted.destroy();
    },
  };
}

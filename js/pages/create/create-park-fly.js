/**
 * Auto-park fly — same motion as homepage catalog→board (home-promo-assemble).
 * Cover ghosts spawn *immediately* at board size (no vanish flash), then ease
 * toward the park chip while scaling down to chip size.
 */

import { prefersReducedMotion } from '../../shared/backpack-grid/face-spin.js';

const FLY_MS = 420;
const FLY_STAGGER_MS = 90;
/** Beat: bag lands → cargo sits on top of it → then fly to park. */
const REST_ON_BAG_MS = 320;

/**
 * @typedef {{
 *   boardRoot: HTMLElement,
 *   parkEl: HTMLElement,
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 * }} ParkFlyCtx
 */

/** @type {ParkFlyCtx | null} */
let ctx = null;

/**
 * @typedef {{
 *   id: string,
 *   key?: string,
 *   src: string,
 *   from: { left: number, top: number, width: number, height: number },
 *   rotate: number,
 *   ghost: HTMLImageElement,
 * }} PendingFly
 */

/** @type {PendingFly[]} */
let pending = [];
let flushScheduled = false;

/**
 * @param {ParkFlyCtx | null} next
 * @returns {() => void} unbind
 */
export function bindCreateParkFly(next) {
  ctx = next;
  return () => {
    if (ctx === next) ctx = null;
    for (const fly of pending) fly.ghost?.remove();
    pending = [];
    flushScheduled = false;
  };
}

/**
 * Snapshot + mount cover ghosts *now* (while board items still paint).
 * Ghosts sit above the newly placed bag for a beat, then fly to park.
 * @param {object[] | null | undefined} placements
 */
export function queueAutoParkFly(placements) {
  if (!ctx || prefersReducedMotion() || !placements?.length) return;
  const { boardRoot, itemsById, getSpriteUrl } = ctx;
  if (!(boardRoot instanceof HTMLElement)) return;

  for (const p of placements) {
    const id = p?.id != null ? String(p.id) : '';
    if (!id) continue;
    const item = itemsById.get(id);
    const src = item ? getSpriteUrl(item) : '';
    if (!src) continue;
    const snap = snapshotBoardSprite(boardRoot, p);
    if (!snap) continue;
    const ghost = mountCoverGhost({
      src,
      from: snap,
      rotate: snap.rotate,
    });
    pending.push({
      id,
      key: p.key != null ? String(p.key) : undefined,
      src,
      from: snap,
      rotate: snap.rotate,
      ghost,
    });
  }
  scheduleFlush();
}

function scheduleFlush() {
  if (flushScheduled) return;
  flushScheduled = true;
  // After appendParked + setPlacements: bag is painted under the cover ghosts.
  // Hold so cargo reads as sitting above the bag, then fly to park.
  queueMicrotask(() => {
    hideArrivingChips(pending.map((f) => f.id));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        flushScheduled = false;
        const batch = pending;
        pending = [];
        if (!batch.length || !ctx) {
          for (const fly of batch) fly.ghost?.remove();
          return;
        }
        for (const fly of batch) {
          fly.ghost?.classList.add('is-resting');
          liftGhostAboveBag(fly);
        }
        void sleep(REST_ON_BAG_MS).then(() => {
          if (!ctx) {
            for (const fly of batch) fly.ghost?.remove();
            return;
          }
          for (const fly of batch) {
            fly.ghost?.classList.remove('is-resting');
            fly.ghost?.classList.add('is-flying');
          }
          void flyBatch(batch);
        });
      });
    });
  });
}

/**
 * Nudge cover ghosts up slightly so they read as sitting on top of the bag.
 * @param {PendingFly} fly
 */
function liftGhostAboveBag(fly) {
  const img = fly.ghost;
  if (!(img instanceof HTMLElement)) return;
  const fw = Math.max(1, fly.from.width);
  const fh = Math.max(1, fly.from.height);
  const fromCx = fly.from.left + fw / 2;
  const fromCy = fly.from.top + fh / 2;
  const lift = Math.min(18, Math.max(8, fh * 0.08));
  // Keep from.center updated so the fly eases from the lifted rest pose.
  fly.from = {
    ...fly.from,
    top: fly.from.top - lift,
  };
  void img.offsetWidth;
  img.style.transform = `translate3d(${fromCx}px, ${fromCy - lift}px, 0) translate(-50%, -50%) scale(1, 1) rotate(${fly.rotate}deg)`;
}

/**
 * @param {string[]} ids
 */
function hideArrivingChips(ids) {
  const parkEl = ctx?.parkEl;
  if (!(parkEl instanceof HTMLElement)) return;
  for (const id of ids) {
    parkChip(parkEl, id)?.classList.add('is-park-arriving');
  }
}

/**
 * @param {PendingFly[]} batch
 */
async function flyBatch(batch) {
  const parkEl = ctx?.parkEl;
  if (!(parkEl instanceof HTMLElement) || !batch.length) return;

  /** @type {Map<string, HTMLElement>} */
  const hiddenChips = new Map();
  for (const fly of batch) {
    const chip = parkChip(parkEl, fly.id);
    if (chip && !hiddenChips.has(fly.id)) {
      chip.classList.add('is-park-arriving');
      hiddenChips.set(fly.id, chip);
    }
  }

  await Promise.all(
    batch.map((fly, i) =>
      sleep(i * FLY_STAGGER_MS).then(() => {
        if (!ctx) {
          fly.ghost?.remove();
          return;
        }
        const to = parkTarget(parkEl, fly.id);
        return animateCoverGhost(fly, to);
      }),
    ),
  );

  for (const chip of hiddenChips.values()) {
    chip.classList.remove('is-park-arriving');
  }
}

/**
 * Unrotated sprite layout size + visual center (spin AABB), matching board art.
 * @param {HTMLElement} boardRoot
 * @param {object} p
 * @returns {{ left: number, top: number, width: number, height: number, rotate: number } | null}
 */
function snapshotBoardSprite(boardRoot, p) {
  const el = findBoardItem(boardRoot, p);
  if (!el) return null;

  const sprite = el.querySelector(
    '.bpb-bg__sprite:not(.bpb-bg__sprite--shadow)',
  );
  const spin = el.querySelector('.bpb-bg__spin:not(.bpb-bg__spin--shadow)');
  const visual =
    spin instanceof HTMLElement
      ? spin.getBoundingClientRect()
      : sprite instanceof HTMLElement
        ? sprite.getBoundingClientRect()
        : el.getBoundingClientRect();
  if (!visual || visual.width < 2 || visual.height < 2) return null;

  // Layout size of the unrotated sprite — getBoundingClientRect on a rotated
  // node is the AABB and would start the ghost already "wrong"/squashed.
  let fw = 0;
  let fh = 0;
  if (sprite instanceof HTMLElement) {
    fw = sprite.offsetWidth || sprite.clientWidth;
    fh = sprite.offsetHeight || sprite.clientHeight;
  }
  if (!(fw > 1 && fh > 1)) {
    // Fall back to AABB; for 0° faces this matches board size.
    fw = visual.width;
    fh = visual.height;
  }

  const cx = visual.left + visual.width / 2;
  const cy = visual.top + visual.height / 2;
  const rotate = ((Number(p.r) || 0) % 4) * 90;
  return {
    left: cx - fw / 2,
    top: cy - fh / 2,
    width: fw,
    height: fh,
    rotate,
  };
}

/**
 * @param {HTMLElement} boardRoot
 * @param {object} p
 */
function findBoardItem(boardRoot, p) {
  const key = p?.key != null ? String(p.key) : '';
  if (key) {
    const el = boardRoot.querySelector(
      `.bpb-bg__item[data-placement-key="${CSS.escape(key)}"]:not(.bpb-bg__item--parked)`,
    );
    if (el instanceof HTMLElement) return el;
  }
  const id = p?.id != null ? String(p.id) : '';
  if (id) {
    const el = boardRoot.querySelector(
      `.bpb-bg__item[data-item-id="${CSS.escape(id)}"]:not(.bpb-bg__item--parked)`,
    );
    if (el instanceof HTMLElement) return el;
  }
  return null;
}

/**
 * Cover the board sprite before it is removed from the DOM.
 * @param {{
 *   src: string,
 *   from: { left: number, top: number, width: number, height: number },
 *   rotate: number,
 * }} opts
 */
function mountCoverGhost(opts) {
  const { src, from, rotate } = opts;
  const img = document.createElement('img');
  img.className = 'create-board__park-fly';
  img.src = src || '';
  img.alt = '';
  img.draggable = false;
  img.setAttribute('aria-hidden', 'true');
  const fw = Math.max(1, from.width);
  const fh = Math.max(1, from.height);
  const fromCx = from.left + fw / 2;
  const fromCy = from.top + fh / 2;
  img.style.width = `${fw}px`;
  img.style.height = `${fh}px`;
  // Start at board face/size — sits above the bag until fly starts.
  img.style.transform = `translate3d(${fromCx}px, ${fromCy}px, 0) translate(-50%, -50%) scale(1, 1) rotate(${rotate}deg)`;
  document.body.appendChild(img);
  return img;
}

/**
 * Move + scale board-size cover down into the park chip.
 * @param {PendingFly} fly
 * @param {{ left: number, top: number, width: number, height: number }} to
 */
function animateCoverGhost(fly, to) {
  const img = fly.ghost;
  if (!(img instanceof HTMLElement)) return Promise.resolve();

  const fw = Math.max(1, fly.from.width);
  const fh = Math.max(1, fly.from.height);
  const toCx = to.left + to.width / 2;
  const toCy = to.top + to.height / 2;
  const sx = Math.max(0.01, to.width / fw);
  const sy = Math.max(0.01, to.height / fh);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      img.remove();
      resolve();
    };

    img.addEventListener('transitionend', (e) => {
      if (e.target === img && e.propertyName === 'transform') finish();
    });
    window.setTimeout(finish, FLY_MS + 120);

    // Force layout so the starting transform is committed before the end state.
    void img.offsetWidth;
    requestAnimationFrame(() => {
      img.style.transform = `translate3d(${toCx}px, ${toCy}px, 0) translate(-50%, -50%) scale(${sx}, ${sy}) rotate(0deg)`;
    });
  });
}

/**
 * @param {HTMLElement} parkEl
 * @param {string} itemId
 */
function parkChip(parkEl, itemId) {
  const chip = parkEl.querySelector(
    `.create-board__park-chip[data-park-id="${CSS.escape(itemId)}"]`,
  );
  return chip instanceof HTMLElement ? chip : null;
}

/**
 * @param {HTMLElement} node
 */
function originFromNode(node) {
  const r = node.getBoundingClientRect();
  if (!r || r.width < 2 || r.height < 2) return null;
  return {
    left: r.left,
    top: r.top,
    width: r.width,
    height: r.height,
  };
}

/**
 * @param {HTMLElement} parkEl
 * @param {string} itemId
 */
function parkTarget(parkEl, itemId) {
  const chip = parkChip(parkEl, itemId);
  if (chip) {
    const img = chip.querySelector('img');
    const box = originFromNode(img instanceof HTMLElement ? img : chip);
    if (box) return box;
  }
  const tray = parkEl.querySelector('[data-park-tray]');
  const host = tray instanceof HTMLElement ? tray : parkEl;
  const r = host.getBoundingClientRect();
  const size = 40;
  return {
    left: r.left + r.width / 2 - size / 2,
    top: r.top + r.height / 2 - size / 2,
    width: size,
    height: size,
  };
}

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

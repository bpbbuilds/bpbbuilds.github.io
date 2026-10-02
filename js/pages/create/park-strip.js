/**
 * Soft park strip — flat items, stacked by id in the tray UI.
 */

import { isBagItem, bagCellsSet, isPlacementFloating } from './collision.js';
import { newPlacementKey } from './draft-io.js';
import { gemCarry } from './socket-place.js';

/** Max distinct item ids in the parked tray (stacks share one slot). */
export const PARK_UNIQUE_MAX = 27;

/**
 * @param {object} placement
 * @returns {import('./draft-io.js').ParkedEntry}
 */
export function parkedFromPlacement(placement) {
  /** @type {import('./draft-io.js').ParkedEntry} */
  const entry = {
    id: placement.id,
    r: ((Number(placement.r) || 0) % 4 + 4) % 4,
    key: placement.key || newPlacementKey(),
    priority: placement.priority ?? null,
  };
  Object.assign(entry, gemCarry(placement));
  return entry;
}

/**
 * Bag + insides → separate parked rows (no nested cargo).
 * @param {object} placement
 * @param {{ key?: string, id: string, r?: number, gems?: string[] }[]} [cargo]
 * @returns {import('./draft-io.js').ParkedEntry[]}
 */
export function flattenParkedEntries(placement, cargo = []) {
  /** @type {import('./draft-io.js').ParkedEntry[]} */
  const out = [parkedFromPlacement(placement)];
  for (const c of cargo) {
    if (!c?.id) continue;
    out.push(
      parkedFromPlacement({
        id: c.id,
        r: c.r,
        key: c.key || newPlacementKey(),
        gems: c.gems,
        priority: null,
      }),
    );
  }
  return out;
}

/**
 * Group parked rows by item id (display order = first-seen).
 * @param {import('./draft-io.js').ParkedEntry[]} parked
 * @returns {{ id: string, count: number, tipKey: string }[]}
 */
export function stackParkedById(parked) {
  /** @type {Map<string, { id: string, count: number, tipKey: string }>} */
  const map = new Map();
  for (const e of parked) {
    if (!e?.id) continue;
    const prev = map.get(e.id);
    if (prev) {
      prev.count += 1;
    } else {
      map.set(e.id, { id: e.id, count: 1, tipKey: e.key });
    }
  }
  return [...map.values()];
}

/**
 * @param {import('./draft-io.js').ParkedEntry[] | null | undefined} parked
 * @returns {number}
 */
export function parkedUniqueCount(parked) {
  return stackParkedById(parked || []).length;
}

/**
 * @param {import('./draft-io.js').ParkedEntry[]} parked
 * @param {import('./draft-io.js').ParkedEntry[]} incoming
 * @returns {boolean}
 */
export function canFitParkEntries(parked, incoming) {
  const ids = new Set();
  for (const e of parked || []) {
    if (e?.id) ids.add(e.id);
  }
  for (const e of incoming || []) {
    if (!e?.id) continue;
    ids.add(e.id);
    if (ids.size > PARK_UNIQUE_MAX) return false;
  }
  return true;
}

/**
 * Keep only entries that fit under the unique cap (existing stacks always ok).
 * @param {import('./draft-io.js').ParkedEntry[]} parked
 * @param {import('./draft-io.js').ParkedEntry[]} incoming
 * @returns {import('./draft-io.js').ParkedEntry[]}
 */
export function filterParkEntriesToFit(parked, incoming) {
  const ids = new Set();
  for (const e of parked || []) {
    if (e?.id) ids.add(e.id);
  }
  /** @type {import('./draft-io.js').ParkedEntry[]} */
  const out = [];
  for (const e of incoming || []) {
    if (!e?.id) continue;
    if (ids.has(e.id) || ids.size < PARK_UNIQUE_MAX) {
      out.push(e);
      ids.add(e.id);
    }
  }
  return out;
}

/**
 * @param {HTMLElement | null | undefined} el
 * @param {number} clientX
 * @param {number} clientY
 */
export function pointOverElement(el, clientX, clientY) {
  if (!(el instanceof HTMLElement) || el.hidden) return false;
  const r = el.getBoundingClientRect();
  return (
    clientX >= r.left &&
    clientX <= r.right &&
    clientY >= r.top &&
    clientY <= r.bottom
  );
}

/**
 * @param {HTMLElement | null | undefined} parkEl
 * @param {number} clientX
 * @param {number} clientY
 */
export function pointerOverPark(parkEl, clientX, clientY) {
  return pointOverElement(parkEl, clientX, clientY);
}

/**
 * Storagebox.isHovered — uses Game.draggedItem.global_position (main held bag),
 * not the mouse. Create: main float over the Park strip only.
 * Catalog is a delete zone (see mainOverCatalog), not storage.
 *
 * @param {HTMLElement | null | undefined} cursorEl
 * @param {HTMLElement | null | undefined} parkEl
 */
export function mainOverStorage(cursorEl, parkEl) {
  if (!(cursorEl instanceof HTMLElement) || cursorEl.hidden) return false;
  const r = cursorEl.getBoundingClientRect();
  if (r.width < 1 && r.height < 1) return false;
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  return pointOverElement(parkEl, x, y);
}

/**
 * Dropping onto the item catalog deletes (same as sell), does not park.
 * @param {HTMLElement | null | undefined} cursorEl
 */
export function mainOverCatalog(cursorEl) {
  if (!(cursorEl instanceof HTMLElement) || cursorEl.hidden) return false;
  const r = cursorEl.getBoundingClientRect();
  if (r.width < 1 && r.height < 1) return false;
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const catalog = document.querySelector('.page-create .create-col--catalog');
  return pointOverElement(catalog, x, y);
}

/**
 * @param {number} clientX
 * @param {number} clientY
 */
export function pointerOverCatalog(clientX, clientY) {
  const catalog = document.querySelector('.page-create .create-col--catalog');
  return pointOverElement(catalog, clientX, clientY);
}

/**
 * Build the parked entries a drag would add (no state mutation).
 * @param {{
 *   cur: any,
 *   state: any,
 *   itemsById: Map<string, object>,
 *   multiMoveKeys: string[] | null,
 * }} args
 * @returns {import('./draft-io.js').ParkedEntry[] | null}
 */
export function planParkEntries(args) {
  const { cur, state, itemsById, multiMoveKeys } = args;
  const item = itemsById.get(cur?.itemId);
  if (!item || !cur) return null;

  /** @type {import('./draft-io.js').ParkedEntry[]} */
  const toPark = [];
  /** @type {Set<string>} */
  const removeKeys = new Set();

  if (cur.mode === 'move' && cur.moveKey) {
    const placements = state.getDraft().placements;
    const group =
      multiMoveKeys && multiMoveKeys.length > 1
        ? multiMoveKeys
        : [cur.moveKey];

    if (group.length > 1) {
      for (const key of group) {
        const p = placements.find((row) => row.key === key);
        if (!p) continue;
        const r = key === cur.moveKey ? cur.r : p.r;
        toPark.push(parkedFromPlacement({ ...p, r }));
        removeKeys.add(key);
      }
      for (const c of Array.isArray(cur.cargo) ? cur.cargo : []) {
        if (!c?.key || removeKeys.has(c.key) || !c.id) continue;
        toPark.push(
          parkedFromPlacement({
            id: c.id,
            r: c.r,
            key: c.key,
            gems: c.gems,
            priority: null,
          }),
        );
        removeKeys.add(c.key);
      }
    } else {
      const p = placements.find((row) => row.key === cur.moveKey);
      if (!p) return null;
      const cargo = Array.isArray(cur.cargo) ? cur.cargo : [];
      if (isBagItem(item) && cargo.length) {
        toPark.push(...flattenParkedEntries({ ...p, r: cur.r }, cargo));
        removeKeys.add(p.key);
        for (const c of cargo) {
          if (c?.key) removeKeys.add(c.key);
        }
      } else {
        toPark.push(
          parkedFromPlacement({
            ...p,
            r: cur.r,
            gems: Array.isArray(cur.gems) ? cur.gems : p.gems,
          }),
        );
        removeKeys.add(p.key);
      }
    }

    // Preview floating after bag removal (same as commit)
    const after = placements.filter((p) => !removeKeys.has(p.key));
    const bagKeys = bagCellsSet(after, itemsById);
    for (const p of after) {
      if (isPlacementFloating(p, bagKeys, itemsById)) {
        toPark.push(parkedFromPlacement(p));
      }
    }
  } else {
    const seed = {
      id: cur.itemId,
      r: cur.r,
      key: cur.placeKey || cur.restoreParked?.key || newPlacementKey(),
      gems: cur.gems,
      priority: cur.restoreParked?.priority ?? null,
    };
    const cargo = Array.isArray(cur.cargo) ? cur.cargo : [];
    if (isBagItem(item) && cargo.length) {
      toPark.push(...flattenParkedEntries(seed, cargo));
    } else {
      toPark.push(parkedFromPlacement(seed));
    }
  }

  return toPark.length ? toPark : null;
}

/**
 * @param {{
 *   cur: any,
 *   state: any,
 *   itemsById: Map<string, object>,
 *   multiMoveKeys: string[] | null,
 * }} args
 */
export function canParkDrag(args) {
  const toPark = planParkEntries(args);
  if (!toPark) return false;
  const parked = args.state.getParked?.() ?? args.state.getDraft().parked ?? [];
  return canFitParkEntries(parked, toPark);
}

/**
 * Drop held catalog / board / park item into the soft park strip.
 * @param {{
 *   cur: any,
 *   state: any,
 *   itemsById: Map<string, object>,
 *   multiMoveKeys: string[] | null,
 *   endDragHard: () => void,
 * }} args
 * @returns {'done' | 'failed'}
 */
export function commitDragToPark(args) {
  const { cur, state, itemsById, multiMoveKeys, endDragHard } = args;
  const item = itemsById.get(cur?.itemId);
  if (!item || !cur) return 'failed';

  const planned = planParkEntries({ cur, state, itemsById, multiMoveKeys });
  if (!planned?.length) return 'failed';

  const parked = state.getParked?.() ?? state.getDraft().parked ?? [];
  if (!canFitParkEntries(parked, planned)) return 'failed';

  /** @type {import('./draft-io.js').ParkedEntry[]} */
  const toPark = [];
  /** @type {Set<string>} */
  const removeKeys = new Set();

  if (cur.mode === 'move' && cur.moveKey) {
    const placements = state.getDraft().placements;
    const group =
      multiMoveKeys && multiMoveKeys.length > 1
        ? multiMoveKeys
        : [cur.moveKey];

    if (group.length > 1) {
      for (const key of group) {
        const p = placements.find((row) => row.key === key);
        if (!p) continue;
        const r = key === cur.moveKey ? cur.r : p.r;
        toPark.push(parkedFromPlacement({ ...p, r }));
        removeKeys.add(key);
      }
      for (const c of Array.isArray(cur.cargo) ? cur.cargo : []) {
        if (!c?.key || removeKeys.has(c.key) || !c.id) continue;
        toPark.push(
          parkedFromPlacement({
            id: c.id,
            r: c.r,
            key: c.key,
            gems: c.gems,
            priority: null,
          }),
        );
        removeKeys.add(c.key);
      }
    } else {
      const p = placements.find((row) => row.key === cur.moveKey);
      if (!p) return 'failed';
      const cargo = Array.isArray(cur.cargo) ? cur.cargo : [];
      if (isBagItem(item) && cargo.length) {
        toPark.push(...flattenParkedEntries({ ...p, r: cur.r }, cargo));
        removeKeys.add(p.key);
        for (const c of cargo) {
          if (c?.key) removeKeys.add(c.key);
        }
      } else {
        toPark.push(
          parkedFromPlacement({
            ...p,
            r: cur.r,
            gems: Array.isArray(cur.gems) ? cur.gems : p.gems,
          }),
        );
        removeKeys.add(p.key);
      }
    }

    state.setPlacements(
      placements.filter((p) => !removeKeys.has(p.key)),
    );
    const after = state.getDraft().placements;
    const bagKeys = bagCellsSet(after, itemsById);
    /** @type {import('./draft-io.js').ParkedEntry[]} */
    const floatPark = [];
    /** @type {string[]} */
    const floatKeys = [];
    for (const p of after) {
      if (isPlacementFloating(p, bagKeys, itemsById)) {
        floatPark.push(parkedFromPlacement(p));
        if (p.key) floatKeys.push(p.key);
      }
    }
    if (floatKeys.length) {
      const skip = new Set(floatKeys);
      state.setPlacements(after.filter((p) => !p.key || !skip.has(p.key)));
      toPark.push(...floatPark);
    }
  } else {
    const seed = {
      id: cur.itemId,
      r: cur.r,
      key: cur.placeKey || cur.restoreParked?.key || newPlacementKey(),
      gems: cur.gems,
      priority: cur.restoreParked?.priority ?? null,
    };
    const cargo = Array.isArray(cur.cargo) ? cur.cargo : [];
    if (isBagItem(item) && cargo.length) {
      toPark.push(...flattenParkedEntries(seed, cargo));
    } else {
      toPark.push(parkedFromPlacement(seed));
    }
    if (cur.mode === 'unsocket') {
      cur.unsocketRestore = null;
    }
  }

  if (!toPark.length) return 'failed';
  state.appendParked?.(toPark);
  endDragHard();
  return 'done';
}

/**
 * @param {HTMLElement} parkRoot
 * @param {{
 *   state: ReturnType<import('./editor-state.js').createEditorState>,
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   beginParkDrag: (
 *     itemId: string,
 *     clientX: number,
 *     clientY: number,
 *     pointerId: number,
 *     sourceEl: HTMLElement | null,
 *   ) => boolean,
 * }} opts
 */
export function mountParkStrip(parkRoot, opts) {
  const { state, itemsById, getSpriteUrl, beginParkDrag } = opts;
  const tray = parkRoot.querySelector('[data-park-tray]');
  const countEl = parkRoot.querySelector('[data-park-count]');
  const clearBtn = parkRoot.querySelector('[data-act="clear-park"]');
  if (!(tray instanceof HTMLElement)) {
    return { destroy() {}, sync() {} };
  }

  function sync() {
    const parked = state.getParked?.() ?? state.getDraft().parked ?? [];
    const stacks = stackParkedById(parked);
    const n = stacks.length;
    parkRoot.hidden = false;
    parkRoot.setAttribute('aria-hidden', 'false');
    parkRoot.classList.toggle('is-empty', n === 0);
    parkRoot.classList.toggle('is-full', n >= PARK_UNIQUE_MAX);
    parkRoot.setAttribute(
      'aria-label',
      `Parked bags and items, ${n} of ${PARK_UNIQUE_MAX} unique`,
    );
    if (countEl instanceof HTMLElement) {
      countEl.textContent = `${n}/${PARK_UNIQUE_MAX}`;
    }
    if (clearBtn instanceof HTMLButtonElement) {
      clearBtn.disabled = n === 0;
    }
    tray.replaceChildren();

    if (!stacks.length) {
      const hint = document.createElement('p');
      hint.className = 'create-board__park-empty';
      hint.textContent = 'Drop items here to stash';
      tray.append(hint);
      return;
    }

    for (const stack of stacks) {
      const item = itemsById.get(stack.id);
      if (!item) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'create-board__park-chip';
      btn.dataset.parkId = stack.id;
      const name = String(item.name || item.id || 'Item');
      btn.title = stack.count > 1 ? name + ' ×' + stack.count : name;
      btn.setAttribute('aria-label', btn.title);

      const img = document.createElement('img');
      img.alt = '';
      img.draggable = false;
      img.src = getSpriteUrl(item);
      btn.append(img);

      if (stack.count > 1) {
        const badge = document.createElement('span');
        badge.className = 'create-board__park-badge';
        badge.textContent = String(stack.count);
        btn.append(badge);
      }
      tray.append(btn);
    }
  }

  /** @param {PointerEvent} e */
  function onPointerDown(e) {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen' && e.button !== 0) return;
    const chip = e.target instanceof Element
      ? e.target.closest('.create-board__park-chip')
      : null;
    if (!(chip instanceof HTMLElement) || !tray.contains(chip)) return;
    const itemId = chip.dataset.parkId;
    if (!itemId) return;
    e.preventDefault();
    e.stopPropagation();
    beginParkDrag(itemId, e.clientX, e.clientY, e.pointerId, chip);
  }

  tray.addEventListener('pointerdown', onPointerDown);
  sync();

  return {
    sync,
    destroy() {
      tray.removeEventListener('pointerdown', onPointerDown);
      tray.replaceChildren();
    },
  };
}

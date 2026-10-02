/**
 * Commit tryAdd outcomes: place, hotswap (1), multi-rehome (2+).
 */

import {
  canAddCells,
  cellsInBounds,
  isBagItem,
  placementBodyCells,
  placementsInsideBag,
  extractFloatingItems,
} from './collision.js';
import { captureBagCargo } from './bag-cargo.js';
import { flattenParkedEntries, parkedFromPlacement } from './park-strip.js';
import { queueAutoParkFly } from './create-park-fly.js';
import { rehomeColliders } from './try-add.js';
import { EDIT_MODE } from './editor-state.js';
import { newPlacementKey } from './draft-io.js';
import { gemCarry, gemFace } from './socket-place.js';

/**
 * @param {object | null | undefined} p
 * @param {Partial<object>} [patch]
 */
function withPlacementFields(p, patch = {}) {
  const row = {
    id: p?.id,
    x: p?.x,
    y: p?.y,
    r: p?.r,
    key: p?.key,
    priority: p?.priority ?? null,
    ...patch,
  };
  const gems = Array.isArray(patch.gems)
    ? patch.gems.slice()
    : Array.isArray(p?.gems)
      ? p.gems.slice()
      : null;
  if (gems) row.gems = gems;
  const faceSrc = patch.gemR !== undefined ? patch.gemR : p?.gemR;
  if (gems && Array.isArray(faceSrc)) {
    row.gemR = gems.map((_, i) => gemFace(faceSrc[i]));
  }
  return row;
}

/**
 * Inventory.pushFloatingItemsToStorage after bag land — park floaters (never void).
 * @param {string} mode
 * @param {object[]} placements
 * @param {Map<string, object>} itemsById
 * @param {any} [state] when set, floating items go to Parked
 * @returns {object[]}
 */
function finalizeBoard(mode, placements, itemsById, state = null) {
  if (mode !== EDIT_MODE.DEFAULT) return placements;
  const { kept, floating } = extractFloatingItems(placements, itemsById);
  if (state && floating.length) parkPlacements(state, floating);
  return kept;
}

/**
 * @param {object[]} placements
 * @param {Map<string, object>} itemsById
 */
function takeFloatingItems(placements, itemsById) {
  return extractFloatingItems(placements, itemsById);
}

/**
 * Game Item.drop for bags: place bag → float cleanup → dropIntoInventory (cargo).
 * @param {object[]} baseBoard already stripped of held bag / cargo / displaced bag+cargo
 * @param {object} heldSeed
 * @param {string} heldKey
 * @param {any} cur
 * @param {{ x: number, y: number }} target
 * @param {string} mode
 * @param {Map<string, object>} itemsById
 * @returns {{ working: object[], leftover: object | null, rejected: object[] }}
 */
function placeBagThenCargo(baseBoard, heldSeed, heldKey, cur, target, mode, itemsById) {
  let next = [
    ...baseBoard,
    withPlacementFields(heldSeed, {
      id: cur.itemId,
      x: target.x,
      y: target.y,
      r: cur.r,
      key: heldKey,
    }),
  ];
  // Bag cells first, then pushFloating → storage (never void)
  const pre =
    mode === EDIT_MODE.DEFAULT
      ? takeFloatingItems(next, itemsById)
      : { kept: next, floating: /** @type {object[]} */ ([]) };
  next = pre.kept;
  if (
    isBagItem(itemsById.get(cur.itemId)) &&
    mode === EDIT_MODE.DEFAULT &&
    cur.cargo?.length
  ) {
    const applied = applyCargoOnto(cur, heldSeed, target, next, itemsById, mode);
    // tryAddItem also float-cleans after each add — catch overhang the canAdd path missed
    const { kept, floating } = takeFloatingItems(applied.working, itemsById);
    const rejected = [
      ...pre.floating,
      ...(applied.rejected || []),
      ...floating,
    ];
    return {
      working: kept,
      leftover: rejected[0] || null,
      rejected,
    };
  }
  return {
    working: next,
    leftover: pre.floating[0] || null,
    rejected: pre.floating,
  };
}

/**
 * @param {{
 *   cur: any,
 *   tryAdd: { origin: { x: number, y: number }, collisions: object[] },
 *   clientX: number,
 *   clientY: number,
 *   state: any,
 *   itemsById: Map<string, object>,
 *   editMode: string,
 *   multiMoveKeys: string[] | null,
 *   endDragHard: () => void,
 *   beginHotswapFromPlacement: (
 *     p: object,
 *     x: number,
 *     y: number,
 *     opts?: { cargo?: object[] },
 *   ) => void,
 * }} args
 * @returns {'done' | 'failed' | 'hotswap'}
 */
export function commitTryAdd(args) {
  const {
    cur,
    tryAdd,
    clientX,
    clientY,
    state,
    itemsById,
    editMode: mode,
    multiMoveKeys,
    endDragHard,
    beginHotswapFromPlacement,
  } = args;

  const item = itemsById.get(cur.itemId);
  if (!item || !tryAdd?.origin) return 'failed';
  const target = tryAdd.origin;
  const collisions = tryAdd.collisions || [];
  // Bags must stay fully on the inventory grid (game isInventoryCell)
  if (isBagItem(item)) {
    const cells = placementBodyCells(item, { ...target, r: cur.r });
    if (!cells.length || !cellsInBounds(cells)) return 'failed';
  }
  const draft = () => state.getDraft().placements;
  const prevHeld =
    cur.mode === 'move' && cur.moveKey
      ? draft().find((p) => p.key === cur.moveKey)
      : null;

  const heldSeed =
    prevHeld || {
      id: cur.itemId,
      priority: null,
      ...gemCarry(cur),
    };

  const heldCargoKeys = new Set(
    (Array.isArray(cur.cargo) ? cur.cargo : [])
      .map((c) => c.key)
      .filter(Boolean),
  );

  /** Snapshot insides of bags about to leave the board (hotswap / delete). */
  function pullBagCargo(bagP, excludeKeys = null) {
    const bagItem = itemsById.get(bagP?.id);
    if (!isBagItem(bagItem) || mode !== EDIT_MODE.DEFAULT) {
      return /** @type {ReturnType<typeof captureBagCargo>} */ ([]);
    }
    const raw = captureBagCargo(bagItem, bagP, draft(), itemsById);
    if (!excludeKeys?.size) return raw;
    // Draft still has held cargo until we rewrite placements — don't re-attach
    // straddling items (e.g. armor on two bags) to the displaced bag.
    return raw.filter((c) => !c.key || !excludeKeys.has(c.key));
  }

  if (collisions.length === 0) {
    if (cur.mode === 'place') {
      const heldKey = cur.placeKey || newPlacementKey();
      cur.placeKey = heldKey;
      const base = draft().filter(
        (p) => !heldCargoKeys.has(p.key) && p.key !== heldKey,
      );
      const { working, leftover, rejected } = placeBagThenCargo(
        base, heldSeed, heldKey, cur, target, mode, itemsById,
      );
      state.setPlacements(working);
      // First failed cargo free-follows; rest → Parked (game storage)
      const rest = (rejected || []).filter(
        (p) => !leftover || p.key !== leftover.key,
      );
      parkPlacements(state, rest);
      if (leftover) {
        endDragHard();
        queueMicrotask(() => {
          beginHotswapFromPlacement(leftover, clientX, clientY);
        });
        return 'hotswap';
      }
    } else if (cur.mode === 'move' && cur.moveKey) {
      const leftover = applyMoveCommit({
        cur, target, mode, state, itemsById, multiMoveKeys,
      });
      if (leftover) {
        endDragHard();
        queueMicrotask(() => {
          beginHotswapFromPlacement(leftover, clientX, clientY);
        });
        return 'hotswap';
      }
    }
    return 'done';
  }

  // Bag-on-bag / item collision: allow 1+ (game hotswap / rehome)
  const multiKeys = multiMoveKeys?.length > 1 ? multiMoveKeys : null;
  const group = multiKeys ? new Set(multiKeys) : null;

  if (collisions.length === 1) {
    const displaced = collisions[0];
    const displacedCargo = pullBagCargo(displaced, heldCargoKeys);
    const displacedCargoKeys = new Set(
      displacedCargo.map((c) => c.key).filter(Boolean),
    );
    const heldKey = cur.moveKey || cur.placeKey || newPlacementKey();
    cur.placeKey = heldKey;
    let base = draft().filter(
      (p) =>
        p.key !== displaced.key &&
        p.key !== cur.moveKey &&
        p.key !== heldKey &&
        !displacedCargoKeys.has(p.key) &&
        !heldCargoKeys.has(p.key) &&
        !(group && group.has(p.key)),
    );

    let leftover = null;
    if (multiKeys && prevHeld) {
      // Multi: place main bag, float-clean, then followers (same bag-first order)
      let next = [
        ...base,
        withPlacementFields(heldSeed, {
          id: cur.itemId,
          x: target.x,
          y: target.y,
          r: cur.r,
          key: heldKey,
        }),
      ];
      next = finalizeBoard(mode, next, itemsById, state);
      const applied = applyFollowersOnto(
        cur, prevHeld, target, next, state, itemsById, multiKeys, mode,
      );
      state.setPlacements(applied.working);
      parkPlacements(state, applied.rejected || []);
      leftover = applied.leftover;
    } else if (isBagItem(item) && mode === EDIT_MODE.DEFAULT) {
      const placed = placeBagThenCargo(
        base, heldSeed, heldKey, cur, target, mode, itemsById,
      );
      state.setPlacements(placed.working);
      // Bag-on-bag already hotswapped the displaced bag — failed cargo → Parked
      // (game dropIntoInventory → pushToStorage when hotswapped).
      parkPlacements(state, placed.rejected || []);
    } else {
      base = [
        ...base,
        withPlacementFields(heldSeed, {
          id: cur.itemId,
          x: target.x,
          y: target.y,
          r: cur.r,
          key: heldKey,
        }),
      ];
      state.setPlacements(finalizeBoard(mode, base, itemsById, state));
    }

    endDragHard();
    // Displaced bag stays the free-follow hold (game 1-collision hotswap).
    void leftover;
    queueMicrotask(() => {
      beginHotswapFromPlacement(displaced, clientX, clientY, {
        cargo: displacedCargo,
      });
    });
    return 'hotswap';
  }

  /** @type {Map<string, ReturnType<typeof captureBagCargo>>} */
  const colliderBagCargo = new Map();
  /** @type {Set<string>} */
  const stripCargoKeys = new Set();
  for (const c of collisions) {
    const cargo = pullBagCargo(c, heldCargoKeys);
    if (!cargo.length) continue;
    colliderBagCargo.set(c.key, cargo);
    for (const e of cargo) {
      if (e?.key) stripCargoKeys.add(e.key);
    }
  }

  // Game 2+ bag overlap → storage. Create: soft park strip (all bags + cargo).
  const bagColliders = collisions.filter((c) => isBagItem(itemsById.get(c.id)));
  if (isBagItem(item) && bagColliders.length >= 2) {
    const heldKey = cur.moveKey || cur.placeKey || newPlacementKey();
    cur.placeKey = heldKey;
    const parkSkip = new Set(bagColliders.map((c) => c.key));
    if (cur.moveKey) parkSkip.add(cur.moveKey);
    if (group) for (const k of group) parkSkip.add(k);

    let base = draft().filter(
      (p) =>
        !parkSkip.has(p.key) &&
        !stripCargoKeys.has(p.key) &&
        !heldCargoKeys.has(p.key) &&
        p.key !== heldKey,
    );

    /** @type {import('./draft-io.js').ParkedEntry[]} */
    const toPark = [];
    for (const c of bagColliders) {
      toPark.push(
        ...flattenParkedEntries(c, colliderBagCargo.get(c.key) || []),
      );
    }

    const { working, leftover, rejected } = placeBagThenCargo(
      base, heldSeed, heldKey, cur, target, mode, itemsById,
    );
    let board = working;
    if (multiKeys && prevHeld) {
      const applied = applyFollowersOnto(
        cur, prevHeld, target, board, state, itemsById, multiKeys, mode,
      );
      board = applied.working;
      if (applied.leftover) {
        toPark.push(parkedFromPlacement(applied.leftover, []));
      }
    }
    for (const p of rejected || []) {
      toPark.push(parkedFromPlacement(p, []));
    }
    // leftover is rejected[0] — already covered above; keep if rejected empty
    if (leftover && !(rejected || []).some((p) => p.key === leftover.key)) {
      toPark.push(parkedFromPlacement(leftover, []));
    }

    queueAutoParkFly(toPark);
    state.setPlacements(board);
    state.appendParked?.(toPark);
    endDragHard();
    return 'done';
  }

  const skipKeys = new Set(collisions.map((c) => c.key));
  if (cur.moveKey) skipKeys.add(cur.moveKey);
  if (group) for (const k of group) skipKeys.add(k);
  const heldKey = cur.moveKey || cur.placeKey || newPlacementKey();
  cur.placeKey = heldKey;
  let base = draft().filter(
    (p) =>
      !skipKeys.has(p.key) &&
      !stripCargoKeys.has(p.key) &&
      !heldCargoKeys.has(p.key) &&
      p.key !== heldKey,
  );
  base = [
    ...base,
    withPlacementFields(heldSeed, {
      id: cur.itemId,
      x: target.x,
      y: target.y,
      r: cur.r,
      key: heldKey,
    }),
  ];
  // Rehome other colliders against board that already has the held bag
  base = finalizeBoard(mode, base, itemsById, state);
  const { leftovers, working } = rehomeColliders(
    collisions, base, itemsById, mode,
  );
  let board = working.filter((p) => !new Set(leftovers.map((l) => l.key)).has(p.key));

  let cargoLeftover = null;
  /** @type {object[]} */
  let cargoRejected = [];
  if (multiKeys && prevHeld) {
    const applied = applyFollowersOnto(
      cur, prevHeld, target, board, state, itemsById, multiKeys, mode,
    );
    board = applied.working;
    cargoLeftover = applied.leftover;
    cargoRejected = applied.rejected || [];
  } else if (
    isBagItem(item) &&
    mode === EDIT_MODE.DEFAULT &&
    cur.cargo?.length
  ) {
    const applied = applyCargoOnto(
      cur, heldSeed, target, board, itemsById, mode,
    );
    board = applied.working;
    cargoRejected = applied.rejected || [];
    cargoLeftover = applied.leftover;
  }

  // Park extras that would have been deleted (keep first as free-follow).
  // Snapshot board rects *before* setPlacements removes them from the DOM.
  const first = cargoLeftover || leftovers[0] || null;
  const rest = leftovers.filter((l) => !first || l.key !== first.key);
  const parkRest = rest.flatMap((l) =>
    flattenParkedEntries(l, colliderBagCargo.get(l.key) || []),
  );
  const rejectPark = cargoRejected.filter((p) => !first || p.key !== first.key);
  queueAutoParkFly([...parkRest, ...rejectPark]);

  state.setPlacements(board);
  endDragHard();

  if (parkRest.length) state.appendParked?.(parkRest);
  if (rejectPark.length) {
    state.appendParked?.(
      rejectPark.map((p) => parkedFromPlacement(p, [])),
    );
  }

  if (first) {
    queueMicrotask(() => {
      beginHotswapFromPlacement(first, clientX, clientY, {
        cargo: colliderBagCargo.get(first.key) || [],
      });
    });
    return 'hotswap';
  }
  return leftovers.length ? 'hotswap' : 'done';
}

/**
 * @param {{
 *   cur: any,
 *   target: { x: number, y: number },
 *   mode: string,
 *   state: any,
 *   itemsById: Map<string, object>,
 *   multiMoveKeys: string[] | null,
 * }} args
 * @returns {object | null}
 */
function applyMoveCommit(args) {
  const { cur, target, mode, state, itemsById, multiMoveKeys } = args;
  const item = itemsById.get(cur.itemId);
  const prev = state.getDraft().placements.find((p) => p.key === cur.moveKey);
  if (!prev || !item) return null;

  if (multiMoveKeys && multiMoveKeys.length > 1) {
    return applyMultiSelectDrop(cur, prev, target, state, itemsById, multiMoveKeys, mode);
  }

  if (isBagItem(item)) {
    if (mode === EDIT_MODE.DEFAULT) {
      return applyBagMoveWithCargo(cur, prev, target, state, itemsById, mode);
    }
    const next = state.getDraft().placements.map((p) => {
      if (p.key === cur.moveKey) {
        return withPlacementFields(p, { x: target.x, y: target.y, r: cur.r });
      }
      return p;
    });
    state.setPlacements(finalizeBoard(mode, next, itemsById, state));
    return null;
  }

  state.updatePlacement(cur.moveKey, { x: target.x, y: target.y, r: cur.r });
  if (mode === EDIT_MODE.DEFAULT) {
    const { kept, floating } = extractFloatingItems(
      state.getDraft().placements,
      itemsById,
    );
    // Park while floaters are still painted on the board.
    parkPlacements(state, floating);
    state.setPlacements(kept);
  }
  return null;
}

/**
 * @param {any} cur
 * @param {object} prevMain
 * @param {{ x: number, y: number }} target
 * @param {object[]} working
 * @param {any} state
 * @param {Map<string, object>} itemsById
 * @param {string[]} multiMoveKeys
 * @param {string} mode
 */
function applyFollowersOnto(
  cur, prevMain, target, working, state, itemsById, multiMoveKeys, mode,
) {
  const draftPlacements = state.getDraft().placements;
  /** @type {{ key: string, id: string, r: number, ox: number, oy: number, gems?: string[], priority?: any }[]} */
  let followers = Array.isArray(cur.cargo)
    ? cur.cargo.filter((c) => c?.key && c.key !== cur.moveKey)
    : [];
  if (!followers.length) {
    followers = multiMoveKeys
      .filter((k) => k && k !== cur.moveKey)
      .map((key) => {
        const p = draftPlacements.find((row) => row.key === key);
        if (!p) return null;
        return {
          key: p.key,
          id: p.id,
          r: p.r,
          ox: Number(p.x) - Number(prevMain.x),
          oy: Number(p.y) - Number(prevMain.y),
          ...gemCarry(p),
          priority: p.priority ?? null,
        };
      })
      .filter(Boolean);
  }

  const followerKeys = new Set(followers.map((f) => f.key));
  let board = working.filter((p) => !followerKeys.has(p.key));
  /** @type {object | null} */
  let leftover = null;
  /** @type {object[]} */
  const rejected = [];
  for (const entry of followers) {
    const followerItem = itemsById.get(entry.id);
    if (!followerItem || !entry.key) continue;
    const prior = draftPlacements.find((p) => p.key === entry.key);
    const nextP = withPlacementFields(prior || entry, {
      key: entry.key,
      id: entry.id,
      r: ((Number(entry.r) || 0) % 4 + 4) % 4,
      x: Math.round(Number(target.x) + (Number(entry.ox) || 0)),
      y: Math.round(Number(target.y) + (Number(entry.oy) || 0)),
      gems: entry.gems ?? prior?.gems,
      gemR: entry.gemR ?? prior?.gemR,
      priority: entry.priority ?? prior?.priority ?? null,
    });
    const cells = placementBodyCells(followerItem, nextP);
    if (canAddCells(followerItem, cells, board, itemsById, null, mode)) {
      board.push(nextP);
    } else if (!leftover) {
      leftover = nextP;
    } else {
      // Game dropIntoInventory: first failed free-follows; rest → storage
      rejected.push(nextP);
    }
  }
  return { working: board, leftover, rejected };
}

/**
 * @param {any} cur
 * @param {object} prevBag
 * @param {{ x: number, y: number }} target
 * @param {object[]} working
 * @param {Map<string, object>} itemsById
 * @param {string} mode
 * @returns {{ working: object[], leftover: object | null, rejected: object[] }}
 */
function applyCargoOnto(cur, prevBag, target, working, itemsById, mode) {
  const cargoList = Array.isArray(cur.cargo) ? cur.cargo : [];
  const cargoKeys = new Set(cargoList.map((c) => c.key).filter(Boolean));
  let board = working.filter((p) => !cargoKeys.has(p.key));
  /** @type {object[]} */
  const rejected = [];
  for (const entry of cargoList) {
    const cargoItem = itemsById.get(entry.id);
    if (!cargoItem || !entry.key) continue;
    const nextP = withPlacementFields(entry, {
      key: entry.key,
      id: entry.id,
      r: ((Number(entry.r) || 0) % 4 + 4) % 4,
      x: Math.round(Number(target.x) + (Number(entry.ox) || 0)),
      y: Math.round(Number(target.y) + (Number(entry.oy) || 0)),
    });
    const cells = placementBodyCells(cargoItem, nextP);
    if (canAddCells(cargoItem, cells, board, itemsById, null, mode)) {
      board.push(nextP);
    } else {
      rejected.push(nextP);
    }
  }
  // Game dropIntoInventory: first failure free-follows if not yet hotswapped;
  // remaining failures → storage (Parked on create).
  return {
    working: board,
    leftover: rejected[0] || null,
    rejected,
  };
}

/** @param {object[]} placements */
function parkPlacements(state, placements) {
  if (!placements?.length) return;
  // Snapshot board rects before appendParked / setPlacements re-paint.
  queueAutoParkFly(placements);
  state.appendParked?.(
    placements.map((p) => parkedFromPlacement(p, [])),
  );
}

/**
 * @param {any} cur
 * @param {object} prevMain
 * @param {{ x: number, y: number }} target
 * @param {any} state
 * @param {Map<string, object>} itemsById
 * @param {string[]} multiMoveKeys
 * @param {string} mode
 * @returns {object | null}
 */
function applyMultiSelectDrop(
  cur, prevMain, target, state, itemsById, multiMoveKeys, mode,
) {
  const group = new Set(multiMoveKeys);
  const draftPlacements = state.getDraft().placements;
  /** @type {{ key: string, id: string, r: number, ox: number, oy: number, gems?: string[] }[]} */
  let followers = Array.isArray(cur.cargo)
    ? cur.cargo.filter((c) => c?.key && c.key !== cur.moveKey)
    : [];
  if (!followers.length) {
    followers = multiMoveKeys
      .filter((k) => k && k !== cur.moveKey)
      .map((key) => {
        const p = draftPlacements.find((row) => row.key === key);
        if (!p) return null;
        return {
          key: p.key,
          id: p.id,
          r: p.r,
          ox: Number(p.x) - Number(prevMain.x),
          oy: Number(p.y) - Number(prevMain.y),
          ...gemCarry(p),
          priority: p.priority ?? null,
        };
      })
      .filter(Boolean);
  }

  const followerKeys = new Set(followers.map((f) => f.key));
  /** @type {object[]} */
  let working = draftPlacements.filter(
    (p) => p.key !== cur.moveKey && !followerKeys.has(p.key) && !group.has(p.key),
  );
  working = [
    ...working,
    withPlacementFields(prevMain, {
      x: target.x,
      y: target.y,
      r: cur.r,
    }),
  ];
  // Main on board (bag cells exist) before followers — same bag-first order
  working = finalizeBoard(mode, working, itemsById, state);

  const applied = applyFollowersOnto(
    cur, prevMain, target, working, state, itemsById, multiMoveKeys, mode,
  );
  state.setPlacements(applied.working);
  parkPlacements(state, applied.rejected || []);
  return applied.leftover;
}

/**
 * @param {any} cur
 * @param {object} prevBag
 * @param {{ x: number, y: number }} target
 * @param {any} state
 * @param {Map<string, object>} itemsById
 * @param {string} mode
 * @returns {object | null}
 */
function applyBagMoveWithCargo(cur, prevBag, target, state, itemsById, mode) {
  const bagItem = itemsById.get(cur.itemId);
  if (!bagItem) return null;

  /** @type {{ key: string, id: string, r: number, ox: number, oy: number, gems?: string[] }[]} */
  let cargoList = Array.isArray(cur.cargo) ? cur.cargo : [];
  if (!cargoList.length) {
    cargoList = placementsInsideBag(
      bagItem, prevBag, state.getDraft().placements, itemsById,
    ).map((p) => ({
      key: p.key,
      id: p.id,
      r: p.r,
      ox: Number(p.x) - Number(prevBag.x),
      oy: Number(p.y) - Number(prevBag.y),
      ...gemCarry(p),
    }));
  }

  // Temporarily put cargo on cur so placeBagThenCargo / applyCargoOnto can read it
  const prevCargo = cur.cargo;
  cur.cargo = cargoList;

  const cargoKeys = new Set(cargoList.map((c) => c.key).filter(Boolean));
  const base = state.getDraft().placements.filter(
    (p) => p.key !== cur.moveKey && !cargoKeys.has(p.key),
  );
  const heldKey = cur.moveKey || newPlacementKey();
  const { working, leftover, rejected } = placeBagThenCargo(
    base, prevBag, heldKey, cur, target, mode, itemsById,
  );
  cur.cargo = prevCargo;
  state.setPlacements(working);
  // First failed → free-follow (caller); remaining → Parked
  parkPlacements(
    state,
    (rejected || []).filter((p) => !leftover || p.key !== leftover.key),
  );
  return leftover;
}

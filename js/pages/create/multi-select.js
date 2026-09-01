/**
 * Multiselect for create board (Inventory.startMultiSelect subset).
 * Shift-click toggles; marquee sets many; dragging main moves the group.
 */

import { isBagItem, placementsInsideBag } from './collision.js';
import { EDIT_MODE } from './editor-state.js';

/**
 * @param {{
 *   getPlacements: () => object[],
 *   canPick: (placement: object) => boolean,
 *   itemsById: Map<string, object>,
 *   getEditMode: () => string,
 *   onChange: (keys: string[]) => void,
 * }} opts
 */
export function createMultiSelect(opts) {
  /** @type {Set<string>} */
  const selected = new Set();

  function keys() {
    return [...selected];
  }

  function clear() {
    if (!selected.size) return;
    selected.clear();
    opts.onChange([]);
  }

  /** @param {string} key @param {boolean} [additive] */
  function select(key, additive = false) {
    if (!additive) selected.clear();
    if (additive && selected.has(key)) selected.delete(key);
    else selected.add(key);
    opts.onChange(keys());
  }

  /** Replace selection (marquee live / release). @param {string[]} next */
  function setKeys(next) {
    const list = Array.isArray(next) ? next.filter(Boolean) : [];
    const same =
      list.length === selected.size && list.every((k) => selected.has(k));
    if (same) {
      opts.onChange(keys());
      return;
    }
    selected.clear();
    for (const k of list) selected.add(k);
    opts.onChange(keys());
  }

  /** @param {string} key */
  function isSelected(key) {
    return selected.has(key);
  }

  /**
   * Group to move with mainKey.
   * Default + bag main → Inventory.getMultiSelectItems (append bag cargo).
   * @param {string} mainKey
   */
  function groupForDrag(mainKey) {
    if (!selected.has(mainKey) || selected.size <= 1) return [mainKey];
    const placements = opts.getPlacements();
    const picked = keys().filter((k) => {
      const p = placements.find((x) => x.key === k);
      return p && opts.canPick(p);
    });
    const main = placements.find((p) => p.key === mainKey);
    const mainItem = main ? opts.itemsById.get(main.id) : null;
    if (
      !main ||
      !isBagItem(mainItem) ||
      opts.getEditMode() !== EDIT_MODE.DEFAULT
    ) {
      return picked;
    }
    /** @type {Set<string>} */
    const out = new Set(picked);
    for (const key of picked) {
      const bagP = placements.find((p) => p.key === key);
      if (!bagP) continue;
      const bagItem = opts.itemsById.get(bagP.id);
      if (!isBagItem(bagItem)) continue;
      for (const cargo of placementsInsideBag(
        bagItem,
        bagP,
        placements,
        opts.itemsById,
      )) {
        if (cargo.key) out.add(cargo.key);
      }
    }
    return [...out];
  }

  /**
   * @param {string} mainKey
   * @param {{ x: number, y: number }} mainOrigin
   * @param {object[]} placements
   * @returns {{ key: string, x: number, y: number, r: number, id: string }[]}
   */
  function relativeGroup(mainKey, mainOrigin, placements) {
    const main = placements.find((p) => p.key === mainKey);
    if (!main) return [];
    const keysToMove = groupForDrag(mainKey);
    const dx = mainOrigin.x - Number(main.x);
    const dy = mainOrigin.y - Number(main.y);
    return keysToMove.map((key) => {
      const p = placements.find((row) => row.key === key);
      return {
        key,
        id: p.id,
        r: p.r,
        x: Number(p.x) + dx,
        y: Number(p.y) + dy,
      };
    });
  }

  function paint(gridEl) {
    if (!(gridEl instanceof HTMLElement)) return;
    gridEl.querySelectorAll('.bpb-bg__item.is-multi-selected').forEach((el) => {
      el.classList.remove('is-multi-selected');
    });
    for (const key of selected) {
      const el = gridEl.querySelector(
        `.bpb-bg__item[data-placement-key="${CSS.escape(key)}"]:not(.bpb-bg__item--parked)`,
      );
      el?.classList.add('is-multi-selected');
    }
  }

  return {
    keys,
    clear,
    select,
    setKeys,
    isSelected,
    groupForDrag,
    relativeGroup,
    paint,
    size: () => selected.size,
  };
}

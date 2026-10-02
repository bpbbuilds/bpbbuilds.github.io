/**
 * Build-tab skill slots + essentials drop targets.
 */

import {
  accessVerdict,
  isHardIllegalAccess,
} from '../../shared/item-access.js';
import { pointOverElement } from './park-strip.js';

/**
 * @param {{
 *   host: HTMLElement,
 *   state: ReturnType<import('./editor-state.js').createEditorState>,
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   notesComposer?: { el: HTMLElement, insertItem: Function, isOver: Function } | null,
 *   getAllowedIds?: () => Set<string> | null,
 * }} opts
 */
export function createMetaDrops(opts) {
  const { host, state, itemsById, getSpriteUrl, notesComposer, getAllowedIds } =
    opts;
  /** @type {'r3' | 'r10' | null} */
  let armedRoute = null;

  /**
   * @param {'r3' | 'r10'} route
   * @param {string | null} itemId
   */
  function paintSkillSlot(route, itemId) {
    const slot = host.querySelector(`[data-route="${route}"]`);
    if (!(slot instanceof HTMLElement)) return;
    const item = itemId ? itemsById.get(itemId) : null;
    if (!item) {
      slot.innerHTML = `<span class="cr-ess__drop-ph">Drop skill</span>`;
      return;
    }
    const src = getSpriteUrl(item);
    slot.innerHTML = `
      ${src ? `<img class="cr-ess__drop-img" src="${escapeAttr(src)}" alt="" draggable="false" />` : ''}
      <span class="cr-ess__drop-name">${escapeHtml(item.name || item.id)}</span>
    `;
  }

  function paintArmed() {
    host.querySelectorAll('[data-route]').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      el.classList.toggle('is-armed', el.dataset.route === armedRoute);
    });
  }

  function paintTierButtons() {
    host.querySelectorAll('.build-info__tier[data-priority]').forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      btn.classList.remove('is-on', 'is-armed');
    });
  }

  function paintLists() {
    /** @type {Array<'needed' | 'nice' | 'optional'>} */
    const keys = ['needed', 'nice', 'optional'];
    /** @type {Record<string, import('./draft-io.js').DraftPlacement[]>} */
    const byTier = { needed: [], nice: [], optional: [] };
    for (const p of state.getDraft().placements) {
      if (!p.priority || !byTier[p.priority]) continue;
      const item = itemsById.get(p.id);
      if (!item || String(item.type || '') === 'Bag') continue;
      byTier[p.priority].push(p);
    }

    for (const key of keys) {
      const list = host.querySelector(`[data-tier-list="${key}"]`);
      const empty = host.querySelector(`[data-tier-empty="${key}"]`);
      if (!(list instanceof HTMLElement)) continue;
      list.replaceChildren();
      const rows = byTier[key];
      if (!rows.length) {
        list.hidden = true;
        if (empty instanceof HTMLElement) empty.hidden = false;
        continue;
      }
      list.hidden = false;
      if (empty instanceof HTMLElement) empty.hidden = true;
      for (const p of rows) {
        const item = itemsById.get(p.id);
        const src = item ? getSpriteUrl(item) : '';
        if (!src) continue;
        const li = document.createElement('li');
        li.className = 'build-info__list-item';
        li.dataset.key = p.key;
        const img = document.createElement('img');
        img.src = src;
        img.alt = item?.name || p.id;
        li.appendChild(img);
        list.appendChild(li);
      }
    }
  }

  function paintRoute() {
    const d = state.getDraft();
    paintSkillSlot('r3', d.route_r3_item_id);
    paintSkillSlot('r10', d.route_r10_item_id);
    paintLists();
    paintTierButtons();
    paintArmed();
  }

  /**
   * @param {string} itemId
   * @returns {boolean}
   */
  function tryAssignSkill(itemId) {
    if (!armedRoute) return false;
    const item = itemsById.get(itemId);
    if (!item || String(item.type || '') !== 'Skill') return false;
    const d = state.getDraft();
    const hero = String(d.hero_class || '').trim();
    if (hero && isHardIllegalAccess(accessVerdict(hero, item))) return false;
    const other =
      armedRoute === 'r3' ? d.route_r10_item_id : d.route_r3_item_id;
    if (other && other === itemId) return false;
    if (armedRoute === 'r3') state.patchMeta({ route_r3_item_id: itemId });
    else state.patchMeta({ route_r10_item_id: itemId });
    armedRoute = null;
    paintArmed();
    return true;
  }

  /**
   * @param {number} clientX
   * @param {number} clientY
   */
  function isOverBuildPanel(clientX, clientY) {
    const panel = host.closest('[data-cr-panel="build"]')
      || host.closest('#cr-panel-build');
    if (!(panel instanceof HTMLElement) || panel.hidden) return false;
    return pointOverElement(panel, clientX, clientY);
  }

  function isBuildPanelOpen() {
    const panel = host.closest('[data-cr-panel="build"]')
      || host.closest('#cr-panel-build');
    return panel instanceof HTMLElement && !panel.hidden;
  }

  /**
   * Needs / Wants / skills are the drop, even when the panel box test misses.
   * @param {number} clientX
   * @param {number} clientY
   */
  function controlAtPoint(clientX, clientY) {
    if (notesComposer?.el && notesComposer.isOver(clientX, clientY)) {
      return { kind: /** @type {const} */ ('mention'), el: notesComposer.el };
    }
    for (const el of host.querySelectorAll('[data-route]')) {
      if (!(el instanceof HTMLElement)) continue;
      if (!pointOverElement(el, clientX, clientY)) continue;
      const route = el.dataset.route;
      if (route !== 'r3' && route !== 'r10') continue;
      return { kind: /** @type {const} */ ('skill'), route, el };
    }
    for (const el of host.querySelectorAll('.build-info__tier[data-priority]')) {
      if (!(el instanceof HTMLElement)) continue;
      if (!pointOverElement(el, clientX, clientY)) continue;
      const priority = el.dataset.priority;
      if (priority !== 'needed' && priority !== 'nice' && priority !== 'optional') {
        continue;
      }
      return { kind: /** @type {const} */ ('tier'), priority, el };
    }
    return null;
  }

  /**
   * Held sprite covering a tier counts, even if the pointer is still on the bag.
   * @param {DOMRect | null | undefined} rect
   */
  function targetFromRect(rect) {
    if (!rect || rect.width < 2 || rect.height < 2 || !isBuildPanelOpen()) return null;
    /** @type {ReturnType<typeof controlAtPoint>} */
    let best = null;
    let bestCover = 0;
    const nodes = [
      ...host.querySelectorAll('[data-route]'),
      ...host.querySelectorAll('.build-info__tier[data-priority]'),
    ];
    for (const el of nodes) {
      if (!(el instanceof HTMLElement)) continue;
      const box = el.getBoundingClientRect();
      const w = Math.min(rect.right, box.right) - Math.max(rect.left, box.left);
      const h = Math.min(rect.bottom, box.bottom) - Math.max(rect.top, box.top);
      if (w <= 0 || h <= 0) continue;
      // Build-tier targets are deliberately much wider than an item sprite on
      // mobile. Measure how much of the held item is over the target, not how
      // much of the whole target is covered by the item.
      const cover = (w * h) / Math.max(1, rect.width * rect.height);
      if (cover < 0.35 || cover <= bestCover) continue;
      const hit = controlAtPoint(box.left + box.width / 2, box.top + box.height / 2);
      if (!hit) continue;
      best = hit;
      bestCover = cover;
    }
    return best;
  }

  /**
   * @param {number} clientX
   * @param {number} clientY
   * @param {DOMRect | null} [heldRect]
   */
  function getDropTarget(clientX, clientY, heldRect = null) {
    const direct = controlAtPoint(clientX, clientY);
    if (direct) return direct;
    if (heldRect) {
      const cx = heldRect.left + heldRect.width / 2;
      const cy = heldRect.top + heldRect.height / 2;
      const atCenter = controlAtPoint(cx, cy);
      if (atCenter) return atCenter;
      const covered = targetFromRect(heldRect);
      if (covered) return covered;
    }
    return null;
  }

  /**
   * Pointer or held item is on the Build tab (tiers, skills, or the panel).
   * @param {number} clientX
   * @param {number} clientY
   * @param {DOMRect | null} [heldRect]
   */
  function engagesMeta(clientX, clientY, heldRect = null) {
    if (getDropTarget(clientX, clientY, heldRect)) return true;
    if (isOverBuildPanel(clientX, clientY)) return true;
    if (!heldRect) return false;
    const cx = heldRect.left + heldRect.width / 2;
    const cy = heldRect.top + heldRect.height / 2;
    return isOverBuildPanel(cx, cy);
  }

  function clearDropHover() {
    host.querySelectorAll('.is-drop-hover, .is-drop-reject, .is-drop-valid').forEach((el) => {
      el.classList.remove('is-drop-hover', 'is-drop-reject', 'is-drop-valid');
    });
  }

  /**
   * @param {any} cur
   * @returns {string | null}
   */
  function resolveTierPlacementKey(cur) {
    if (!cur?.itemId) return null;
    const item = itemsById.get(cur.itemId);
    if (!item || String(item.type || '') === 'Bag') return null;
    const draft = state.getDraft().placements;
    if (cur.mode === 'move' && cur.moveKey && draft.some((p) => p.key === cur.moveKey)) {
      return cur.moveKey;
    }
    const hx = Number(cur.homeX);
    const hy = Number(cur.homeY);
    if (Number.isFinite(hx) && Number.isFinite(hy)) {
      const at = draft.find(
        (p) => p.id === cur.itemId && Number(p.x) === hx && Number(p.y) === hy,
      );
      if (at?.key) return at.key;
    }
    // Catalog drags have no placement key. They are still valid as long as
    // that item is already on this board: assigning a tier only annotates an
    // existing placement, so it does not alter an attached history run.
    const same = draft.filter((p) => p.id === cur.itemId && p.key);
    if (!same.length) return null;

    // If several copies exist, keep the choice predictable: respect an
    // explicitly selected copy, otherwise use an unclassified one first.
    const selected = state.getSelectedKey?.();
    if (selected && same.some((p) => p.key === selected)) return selected;
    return same.find((p) => !p.priority)?.key || same[0].key;
  }

  /**
   * @param {any} cur
   * @param {{ kind: string, route?: string, priority?: string }} target
   */
  function canAcceptDrop(cur, target) {
    const item = itemsById.get(cur?.itemId);
    if (!item || !cur) return false;
    if (target.kind === 'skill') {
      if (String(item.type || '') !== 'Skill') return false;
      const d = state.getDraft();
      const hero = String(d.hero_class || '').trim();
      if (hero && isHardIllegalAccess(accessVerdict(hero, item))) return false;
      const other =
        target.route === 'r3' ? d.route_r10_item_id : d.route_r3_item_id;
      if (other && other === cur.itemId) return false;
      return true;
    }
    if (target.kind === 'tier') {
      if (String(item.type || '') === 'Bag') return false;
      return !!resolveTierPlacementKey(cur);
    }
    if (target.kind === 'mention') {
      const allowed = getAllowedIds?.() ?? null;
      if (allowed && !allowed.has(String(cur.itemId))) return false;
      return Boolean(getSpriteUrl(item));
    }
    return false;
  }

  /**
   * @param {any} cur
   * @param {number} clientX
   * @param {number} clientY
   */
  function updateDropHover(cur, clientX, clientY, heldRect = null) {
    clearDropHover();
    if (!cur || !isBuildPanelOpen()) return;

    if (canAcceptDrop(cur, { kind: 'tier' })) {
      host.querySelectorAll('.build-info__tier[data-priority]').forEach((el) => {
        el.classList.add('is-drop-valid');
      });
    }

    if (notesComposer?.el && canAcceptDrop(cur, { kind: 'mention' })) {
      notesComposer.el.classList.add('is-drop-valid');
    }

    host.querySelectorAll('[data-route]').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const route = el.dataset.route;
      if (route !== 'r3' && route !== 'r10') return;
      if (canAcceptDrop(cur, { kind: 'skill', route })) {
        el.classList.add('is-drop-valid');
      }
    });

    const target = getDropTarget(clientX, clientY, heldRect);
    if (!target) return;
    target.el.classList.remove('is-drop-valid');
    target.el.classList.add(
      canAcceptDrop(cur, target) ? 'is-drop-hover' : 'is-drop-reject',
    );
  }

  /**
   * @param {any} cur
   * @param {number} clientX
   * @param {number} clientY
   * @returns {'done' | 'reject' | 'miss'}
   */
  function tryCommitDrop(cur, clientX, clientY, heldRect = null) {
    if (!engagesMeta(clientX, clientY, heldRect)) return 'miss';

    const target = getDropTarget(clientX, clientY, heldRect);
    if (!target) return 'reject';
    if (!canAcceptDrop(cur, target)) return 'reject';

    if (target.kind === 'skill') {
      if (target.route === 'r3') state.patchMeta({ route_r3_item_id: cur.itemId });
      else state.patchMeta({ route_r10_item_id: cur.itemId });
      armedRoute = null;
      paintArmed();
      clearDropHover();
      return 'done';
    }

    if (target.kind === 'tier') {
      const key = resolveTierPlacementKey(cur);
      if (!key) return 'reject';
      if (!state.setPriority(key, target.priority)) return 'reject';
      state.setSelectedKey(key);
      clearDropHover();
      return 'done';
    }

    if (target.kind === 'mention') {
      const ok = notesComposer?.insertItem(cur.itemId, {
        clientX,
        clientY,
      });
      clearDropHover();
      return ok ? 'done' : 'reject';
    }
    return 'reject';
  }

  /**
   * @param {HTMLElement} routeSlot
   * @returns {boolean}
   */
  function handleRouteClick(routeSlot) {
    const route = routeSlot.dataset.route;
    if (route !== 'r3' && route !== 'r10') return false;
    const field = route === 'r3' ? 'route_r3_item_id' : 'route_r10_item_id';
    const cur = state.getDraft()[field];
    if (armedRoute === route && cur) {
      state.patchMeta({ [field]: null });
      armedRoute = null;
    } else {
      armedRoute = armedRoute === route ? null : route;
    }
    paintArmed();
    return true;
  }

  /**
   * @param {HTMLElement} tierBox
   * @returns {boolean}
   */
  function handleTierClick(tierBox) {
    const key = state.getSelectedKey();
    if (!key) return false;
    const raw = tierBox.dataset.priority;
    const priority =
      raw === 'needed' || raw === 'nice' || raw === 'optional' ? raw : null;
    const cur =
      state.getDraft().placements.find((x) => x.key === key)?.priority || null;
    state.setPriority(key, cur === priority ? null : priority);
    if (typeof tierBox.blur === 'function') tierBox.blur();
    return true;
  }

  return {
    paintRoute,
    tryAssignSkill,
    getDropTarget,
    isOverBuildPanel,
    engagesMeta,
    updateDropHover,
    clearDropHover,
    tryCommitDrop,
    handleRouteClick,
    handleTierClick,
  };
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

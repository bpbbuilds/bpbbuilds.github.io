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
 * }} opts
 */
export function createMetaDrops(opts) {
  const { host, state, itemsById, getSpriteUrl } = opts;
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
   * @param {number} clientX
   * @param {number} clientY
   */
  function getDropTarget(clientX, clientY) {
    if (!isOverBuildPanel(clientX, clientY)) return null;

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
    if (cur.mode === 'move' && cur.moveKey) return cur.moveKey;
    const item = itemsById.get(cur.itemId);
    if (!item || String(item.type || '') === 'Bag') return null;
    const hit = state.getDraft().placements.find((p) => p.id === cur.itemId);
    return hit?.key || null;
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
    return false;
  }

  /**
   * @param {any} cur
   * @param {number} clientX
   * @param {number} clientY
   */
  function updateDropHover(cur, clientX, clientY) {
    clearDropHover();
    if (!cur || !isBuildPanelOpen()) return;

    if (canAcceptDrop(cur, { kind: 'tier' })) {
      host.querySelectorAll('.build-info__tier[data-priority]').forEach((el) => {
        el.classList.add('is-drop-valid');
      });
    }

    host.querySelectorAll('[data-route]').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const route = el.dataset.route;
      if (route !== 'r3' && route !== 'r10') return;
      if (canAcceptDrop(cur, { kind: 'skill', route })) {
        el.classList.add('is-drop-valid');
      }
    });

    const target = getDropTarget(clientX, clientY);
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
  function tryCommitDrop(cur, clientX, clientY) {
    if (!isOverBuildPanel(clientX, clientY)) return 'miss';

    const target = getDropTarget(clientX, clientY);
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
      state.setPriority(key, target.priority);
      state.setSelectedKey(key);
      clearDropHover();
      return 'done';
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

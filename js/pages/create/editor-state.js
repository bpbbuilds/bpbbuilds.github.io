/**
 * Create editor state — single draft + selection + edit mode + subscribers.
 */

import {
  emptyDraft,
  loadDraft,
  saveDraft,
  newPlacementKey,
} from './draft-io.js';
import { filterParkEntriesToFit } from './park-strip.js';

/**
 * @typedef {import('./draft-io.js').Draft} Draft
 * @typedef {import('./draft-io.js').DraftPlacement} DraftPlacement
 * @typedef {import('./draft-io.js').ParkedEntry} ParkedEntry
 * @typedef {import('./draft-io.js').Priority} Priority
 */

/** @typedef {'default' | 'bagLayer' | 'itemLayer'} EditMode */

export const EDIT_MODE = /** @type {const} */ ({
  DEFAULT: 'default',
  BAG_LAYER: 'bagLayer',
  ITEM_LAYER: 'itemLayer',
});

/**
 * @returns {{
 *   getDraft: () => Draft,
 *   getSelectedKey: () => string | null,
 *   getEditMode: () => EditMode,
 *   setEditMode: (mode: EditMode) => void,
 *   subscribe: (fn: () => void) => () => void,
 *   replaceDraft: (draft: Draft) => void,
 *   patchMeta: (partial: Partial<Pick<Draft, 'title' | 'blurb' | 'notes' | 'hero_class' | 'build_tag' | 'is_op' | 'youtube_url' | 'gold_count' | 'rank' | 'route_r3_item_id' | 'route_r10_item_id' | 'starting_bag_id'>>) => void,
 *   setPlacements: (placements: DraftPlacement[]) => void,
 *   addPlacement: (p: Omit<DraftPlacement, 'key'> & { key?: string }) => DraftPlacement | null,
 *   updatePlacement: (key: string, patch: Partial<DraftPlacement>, opts?: { borrow?: boolean }) => boolean,
 *   removePlacement: (key: string) => boolean,
 *   getParked: () => ParkedEntry[],
 *   setParked: (parked: ParkedEntry[]) => void,
 *   appendParked: (entries: ParkedEntry[], opts?: { borrow?: boolean }) => void,
 *   removeParked: (key: string) => ParkedEntry | null,
 *   takeParkedById: (itemId: string, opts?: { borrow?: boolean }) => ParkedEntry | null,
 *   clearBoard: () => void,
 *   setPriority: (key: string, priority: Priority) => void,
 *   setSelectedKey: (key: string | null) => void,
 *   isHistoryLocked: () => boolean,
 *   clearHistory: () => boolean,
 *   requestHistoryUnlock: () => Promise<boolean>,
 *   setHistoryUnlockAsker: (fn: null | (() => Promise<boolean>)) => void,
 * }}
 */
export function createEditorState() {
  /** @type {Draft} */
  let draft = loadDraft();
  /** @type {string | null} */
  let selectedKey = null;
  /** @type {EditMode} */
  let editMode = EDIT_MODE.DEFAULT;
  /** @type {Set<() => void>} */
  const listeners = new Set();
  /** @type {ReturnType<typeof setTimeout> | 0} */
  let saveTimer = 0;
  /** @type {null | (() => Promise<boolean>)} */
  let historyUnlockAsker = null;

  function emit() {
    for (const fn of listeners) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = 0;
      saveDraft(draft);
    }, 250);
  }

  function commit() {
    scheduleSave();
    emit();
  }

  /**
   * Geometry / composition edits need unlock while history is attached.
   * Priority-only patches do not.
   * @param {Partial<DraftPlacement>} patch
   */
  function patchNeedsUnlock(patch) {
    if (!patch) return false;
    return (
      patch.id !== undefined ||
      patch.x !== undefined ||
      patch.y !== undefined ||
      patch.r !== undefined ||
      patch.gems !== undefined
    );
  }

  /** @returns {boolean} true if the edit is blocked (history still attached) */
  function blockIfHistoryLocked() {
    if (!draft.history) return false;
    void requestHistoryUnlock();
    return true;
  }

  async function requestHistoryUnlock() {
    if (!draft.history) return true;
    if (historyUnlockAsker) return historyUnlockAsker();
    const ok = window.confirm(
      'Editing this board will clear your attached run history. Continue?',
    );
    if (ok) {
      draft = { ...draft, history: null };
      commit();
    }
    return ok;
  }

  return {
    getDraft() {
      return draft;
    },
    getSelectedKey() {
      return selectedKey;
    },
    getEditMode() {
      return editMode;
    },
    setEditMode(mode) {
      if (
        mode !== EDIT_MODE.DEFAULT &&
        mode !== EDIT_MODE.BAG_LAYER &&
        mode !== EDIT_MODE.ITEM_LAYER
      ) {
        return;
      }
      if (editMode === mode) return;
      editMode = mode;
      emit();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    replaceDraft(next) {
      const history =
        next && Object.prototype.hasOwnProperty.call(next, 'history')
          ? next.history || null
          : null;
      draft = {
        ...emptyDraft(),
        ...next,
        version: 1,
        placements: Array.isArray(next.placements) ? next.placements.slice() : [],
        parked: Array.isArray(next.parked) ? next.parked.slice() : [],
        history,
      };
      selectedKey = null;
      commit();
    },
    patchMeta(partial) {
      draft = { ...draft, ...partial };
      commit();
    },
    setPlacements(placements) {
      if (blockIfHistoryLocked()) return;
      draft = { ...draft, placements: placements.slice() };
      if (selectedKey && !placements.some((p) => p.key === selectedKey)) {
        selectedKey = null;
      }
      commit();
    },
    addPlacement(p) {
      if (blockIfHistoryLocked()) return null;
      const key = p.key || newPlacementKey();
      /** @type {DraftPlacement} */
      const row = {
        id: p.id,
        x: Number(p.x) || 0,
        y: Number(p.y) || 0,
        r: ((Number(p.r) || 0) % 4 + 4) % 4,
        key,
        priority: p.priority ?? null,
      };
      if (Array.isArray(p.gems)) row.gems = p.gems.slice();
      draft = { ...draft, placements: [...draft.placements, row] };
      selectedKey = key;
      commit();
      return row;
    },
    updatePlacement(key, patch, opts = {}) {
      const i = draft.placements.findIndex((p) => p.key === key);
      if (i < 0) return false;
      // borrow: gem lift / flyback restore while history is still attached
      if (patchNeedsUnlock(patch) && !opts.borrow && blockIfHistoryLocked()) {
        return false;
      }
      const prev = draft.placements[i];
      const next = { ...prev, ...patch, key: prev.key };
      if (patch.r != null) next.r = ((Number(patch.r) || 0) % 4 + 4) % 4;
      const placements = draft.placements.slice();
      placements[i] = next;
      draft = { ...draft, placements };
      commit();
      return true;
    },
    removePlacement(key) {
      if (blockIfHistoryLocked()) return false;
      const placements = draft.placements.filter((p) => p.key !== key);
      if (placements.length === draft.placements.length) return false;
      draft = { ...draft, placements };
      if (selectedKey === key) selectedKey = null;
      commit();
      return true;
    },
    getParked() {
      return Array.isArray(draft.parked) ? draft.parked : [];
    },
    setParked(parked) {
      if (blockIfHistoryLocked()) return;
      draft = { ...draft, parked: parked.slice() };
      commit();
    },
    appendParked(entries, opts = {}) {
      if (!entries?.length) return;
      // borrow: restore a park lift while history is still attached
      if (!opts.borrow && blockIfHistoryLocked()) return;
      const prev = Array.isArray(draft.parked) ? draft.parked : [];
      const accepted = filterParkEntriesToFit(prev, entries);
      if (!accepted.length) return;
      draft = { ...draft, parked: [...prev, ...accepted] };
      commit();
    },
    removeParked(key) {
      if (blockIfHistoryLocked()) return null;
      const prev = Array.isArray(draft.parked) ? draft.parked : [];
      const hit = prev.find((p) => p.key === key) || null;
      if (!hit) return null;
      draft = { ...draft, parked: prev.filter((p) => p.key !== key) };
      commit();
      return hit;
    },
    takeParkedById(itemId, opts = {}) {
      // borrow: lift for drag without clearing history (restore on cancel)
      if (!opts.borrow && blockIfHistoryLocked()) return null;
      const prev = Array.isArray(draft.parked) ? draft.parked : [];
      const idx = prev.findIndex((p) => p.id === itemId);
      if (idx < 0) return null;
      const hit = prev[idx];
      const next = prev.slice();
      next.splice(idx, 1);
      draft = { ...draft, parked: next };
      commit();
      return hit;
    },
    clearBoard() {
      if (blockIfHistoryLocked()) return;
      draft = {
        ...draft,
        placements: [],
        parked: [],
        history: null,
        build_tag: draft.build_tag === 'real' ? 'feasible' : draft.build_tag,
      };
      selectedKey = null;
      commit();
    },
    setPriority(key, priority) {
      return this.updatePlacement(key, { priority });
    },
    setSelectedKey(key) {
      selectedKey = key;
      emit();
    },
    isHistoryLocked() {
      return Boolean(draft.history);
    },
    clearHistory() {
      if (!draft.history) return false;
      draft = {
        ...draft,
        history: null,
        // Real requires history — drop to Feasible on unlock
        build_tag: draft.build_tag === 'real' ? 'feasible' : draft.build_tag,
      };
      commit();
      return true;
    },
    requestHistoryUnlock,
    setHistoryUnlockAsker(fn) {
      historyUnlockAsker = typeof fn === 'function' ? fn : null;
    },
  };
}

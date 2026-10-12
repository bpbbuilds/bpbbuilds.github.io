/**
 * Thin combat signal hub (Band Z 150) — not a full Godot EventBus clone.
 */

/**
 * @typedef {(payload?: object) => void} CombatBusListener
 * @typedef {{ fn: CombatBusListener, priority: number, order: number }} CombatBusEntry
 */

/**
 * @returns {{
 *   on: (signal: string, fn: CombatBusListener, priority?: number) => void,
 *   emit: (signal: string, payload?: object) => void,
 *   reset: () => void,
 * }}
 */
export function createCombatBus() {
  /** @type {Map<string, CombatBusEntry[]>} */
  const listeners = new Map();
  let nextOrder = 0;

  return {
    on(signal, fn, priority = 0) {
      if (!signal || typeof fn !== 'function') return;
      const list = listeners.get(signal) || [];
      list.push({
        fn,
        priority: Number.isFinite(Number(priority)) ? Number(priority) : 0,
        order: nextOrder++,
      });
      list.sort((a, b) => b.priority - a.priority || a.order - b.order);
      listeners.set(signal, list);
    },
    emit(signal, payload = {}) {
      const list = listeners.get(signal);
      if (!list?.length) return;
      for (const { fn } of list) {
        try {
          fn(payload);
        } catch (err) {
          console.error('[sim] combat-bus', signal, err);
        }
      }
    },
    reset() {
      listeners.clear();
    },
  };
}

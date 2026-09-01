/**
 * Thin combat signal hub (Band Z 150) — not a full Godot EventBus clone.
 */

/**
 * @typedef {(payload?: object) => void} CombatBusListener
 */

/**
 * @returns {{
 *   on: (signal: string, fn: CombatBusListener) => void,
 *   emit: (signal: string, payload?: object) => void,
 *   reset: () => void,
 * }}
 */
export function createCombatBus() {
  /** @type {Map<string, CombatBusListener[]>} */
  const listeners = new Map();

  return {
    on(signal, fn) {
      if (!signal || typeof fn !== 'function') return;
      const list = listeners.get(signal) || [];
      list.push(fn);
      listeners.set(signal, list);
    },
    emit(signal, payload = {}) {
      const list = listeners.get(signal);
      if (!list?.length) return;
      for (const fn of list) {
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

/**
 * Shared activity state for a Home promo loop.
 *
 * A loop is active only while its section is in the viewport. A board hover
 * is allowed to finish the current reveal; once that board is complete,
 * waiting callers stay paused until the pointer leaves the board.
 *
 * @param {boolean} [initialViewportActive]
 */
export function createPromoActivity(initialViewportActive = true) {
  let viewportActive = initialViewportActive !== false;
  let hovered = false;
  let boardComplete = false;
  /** @type {Set<() => void>} */
  const waiters = new Set();
  /** @type {Set<(active: boolean) => void>} */
  const listeners = new Set();
  let lastActive = viewportActive && (!hovered || !boardComplete);

  const activity = {
    get active() {
      return viewportActive && (!hovered || !boardComplete);
    },
    wait() {
      if (activity.active) return Promise.resolve();
      return new Promise((resolve) => waiters.add(resolve));
    },
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      listener(activity.active);
      return () => listeners.delete(listener);
    },
    setHovered(next) {
      hovered = next === true;
      update();
    },
    setBoardComplete(next) {
      boardComplete = next === true;
      update();
    },
    setViewportActive(next) {
      viewportActive = next === true;
      update();
    },
  };

  function update() {
    const active = activity.active;
    if (active !== lastActive) {
      lastActive = active;
      for (const listener of listeners) listener(active);
    }
    if (!active) return;
    for (const resume of waiters) resume();
    waiters.clear();
  }

  return activity;
}

/**
 * Create-board SFX — temporarily disabled (was new Audio() per grab/rotate,
 * which lagged the main thread and made spam-clicks feel unresponsive).
 * Re-enable later with a pooled / decoded AudioBuffer approach.
 */

/** Item.pickup grabSound — no-op for now */
export function playGrab() {}

/** rotateRight Grind — no-op for now */
export function playRotate(_clockwise = true) {}

/** Prefetch — no-op for now */
export function warmSfx() {}

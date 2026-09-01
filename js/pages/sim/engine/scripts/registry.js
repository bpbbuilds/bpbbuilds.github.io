/**
 * Resolve script handlers: dedicated (per-item) → reviewed ports → family defaults.
 */

import { HANDLERS, FAMILY_DEFAULT_HANDLER } from './handlers.js';
import { PORT_HANDLERS } from './ports.js';
import { DEDICATED_HANDLERS } from './dedicated/index.js';
import { AUTO_PORTS } from './auto-ports.js';
import { bindChargeHandlerResolve } from '../charge-delivery.js';
import { withStatSource } from '../stat-mods.js';

/** @type {WeakMap<object, object>} */
const wrappedHandlers = new WeakMap();

/**
 * Attribute addBonusDamage / addSpeed / … to the item whose script is running.
 * @param {object | null} h
 */
function wrapHandlerStatSource(h) {
  if (!h) return h;
  const cached = wrappedHandlers.get(h);
  if (cached) return cached;
  /** @type {Record<string, unknown>} */
  const out = { ...h, __statWrapped: true };
  for (const [key, val] of Object.entries(h)) {
    if (typeof val !== 'function') continue;
    out[key] = (piece, ...rest) =>
      withStatSource(piece, () => val(piece, ...rest));
  }
  wrappedHandlers.set(h, out);
  return out;
}

/** @type {Promise<object | null> | null} */
let coveragePromise = null;
/** @type {object | null} */
let coverageCache = null;
/** @type {object | null} */
let inventoryCache = null;

/** Resolve order later in getScriptHandler; merge for listHandlerIds. */
const ALL_HANDLERS = {
  ...HANDLERS,
  ...DEDICATED_HANDLERS,
  ...AUTO_PORTS,
  ...PORT_HANDLERS,
};

bindChargeHandlerResolve((id) => getScriptHandler(id));

/**
 * @param {object | null} coverage
 * @param {object | null} [inventory]
 */
export function hydrateSimCoverage(coverage, inventory = null) {
  coverageCache = coverage;
  if (inventory) inventoryCache = inventory;
}

/**
 * @param {string} root
 */
export function loadSimCoverage(root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  if (!coveragePromise) {
    coveragePromise = Promise.all([
      fetch(`${base}assets/data/sim-item-coverage.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`${base}assets/data/sim-item-inventory.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([coverage, inventory]) => {
      hydrateSimCoverage(coverage, inventory);
      return coverage;
    });
  }
  return coveragePromise;
}

export function getCoverageSync() {
  return coverageCache;
}

/**
 * @param {string} itemId
 * @returns {import('./handlers.js').ScriptHandler | null}
 */
export function getScriptHandler(itemId) {
  if (!itemId) return null;

  let raw = null;
  if (PORT_HANDLERS[itemId]) raw = PORT_HANDLERS[itemId];
  else if (AUTO_PORTS[itemId]) raw = AUTO_PORTS[itemId];
  else if (DEDICATED_HANDLERS[itemId]) raw = DEDICATED_HANDLERS[itemId];
  else {
    const cov = coverageCache?.byId?.[itemId];
    if (cov?.handlerId && ALL_HANDLERS[cov.handlerId]) {
      raw = ALL_HANDLERS[cov.handlerId];
    } else {
      const inv = inventoryCache?.byId?.[itemId];
      if (inv?.family) {
        const hid = FAMILY_DEFAULT_HANDLER[inv.family];
        if (hid && HANDLERS[hid]) raw = HANDLERS[hid];
      }
    }
  }

  return wrapHandlerStatSource(raw);
}

/**
 * @param {string} itemId
 */
export function hasScriptHandler(itemId) {
  return Boolean(getScriptHandler(itemId));
}

/**
 * @returns {string[]}
 */
export function listHandlerIds() {
  return Object.keys(ALL_HANDLERS);
}

/**
 * @returns {string[]}
 */
export function listDedicatedIds() {
  return Object.keys(DEDICATED_HANDLERS);
}

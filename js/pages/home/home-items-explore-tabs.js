/**
 * Items explore — category tabs + appear / depart waves (Itemiary-style).
 */

/** Match Itemiary AppearInLibrary stagger rhythm (snappy wave). */
const APPEAR_STAGGER_MS = 18;
const APPEAR_STAGGER_MAX_MS = 360;
const DEPART_MS = 400;

/** Invalidates in-flight tab transitions when the user clicks again. */
let tabSwitchGen = 0;

/**
 * @param {HTMLElement} face
 */
function clearFaceWave(face) {
  face.classList.remove(
    'home-items__sprite-face--appear',
    'home-items__sprite-face--depart',
  );
  face.style.removeProperty('--home-items-appear-delay');
}

/**
 * @param {HTMLElement} orbit
 * @returns {HTMLElement[]}
 */
function orbitFaces(orbit) {
  return [...orbit.querySelectorAll('.home-items__sprite-face')].filter(
    (el) => el instanceof HTMLElement,
  );
}

/**
 * Catalog-style scale pop (0 → 1.1 → 1) around the active orbit.
 * @param {HTMLElement | null} orbit
 */
export function playOrbitAppear(orbit) {
  if (!(orbit instanceof HTMLElement) || !orbit.classList.contains('is-active')) {
    return;
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const faces = orbitFaces(orbit);
  if (!faces.length) return;

  for (const face of faces) clearFaceWave(face);
  // Flush on a face only — avoid touching ring layout (keeps orbit time continuous)
  void faces[0].offsetWidth;

  faces.forEach((face, i) => {
    const delay = Math.min(i * APPEAR_STAGGER_MS, APPEAR_STAGGER_MAX_MS);
    face.style.setProperty('--home-items-appear-delay', `${delay}ms`);
    face.classList.add('home-items__sprite-face--appear');
  });
}

/**
 * Reverse wave (1 → 1.08 → 0) before swapping / reshuffling.
 * @param {HTMLElement | null} orbit
 * @returns {Promise<void>}
 */
function playOrbitDepart(orbit) {
  return new Promise((resolve) => {
    if (!(orbit instanceof HTMLElement)) {
      resolve();
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      resolve();
      return;
    }

    const faces = orbitFaces(orbit);
    if (!faces.length) {
      resolve();
      return;
    }

    for (const face of faces) clearFaceWave(face);
    void faces[0].offsetWidth;

    faces.forEach((face, i) => {
      const delay = Math.min(i * APPEAR_STAGGER_MS, APPEAR_STAGGER_MAX_MS);
      face.style.setProperty('--home-items-appear-delay', `${delay}ms`);
      face.classList.add('home-items__sprite-face--depart');
    });

    const total =
      Math.min((faces.length - 1) * APPEAR_STAGGER_MS, APPEAR_STAGGER_MAX_MS) +
      DEPART_MS +
      16;
    window.setTimeout(resolve, total);
  });
}

/**
 * Swap which orbit is visible without unmounting (spin keeps running).
 * @param {HTMLElement} host
 * @param {string} tabId
 * @returns {HTMLElement | null}
 */
function activateOrbit(host, tabId) {
  /** @type {HTMLElement | null} */
  let active = null;
  host.querySelectorAll('[data-items-orbit]').forEach((orbit) => {
    if (!(orbit instanceof HTMLElement)) return;
    const on = orbit.dataset.itemsOrbit === tabId;
    orbit.classList.toggle('is-active', on);
    orbit.setAttribute('aria-hidden', on ? 'false' : 'true');
    if (on) active = orbit;
    else {
      for (const face of orbitFaces(orbit)) clearFaceWave(face);
    }
  });
  return active;
}

/**
 * @param {HTMLElement} host
 * @param {string} tabId
 * @param {{
 *   appear?: boolean,
 *   refillOrbit?: (orbit: HTMLElement, categoryId: string) => void,
 * }} [opts]
 */
export async function showExploreTab(host, tabId, opts = {}) {
  const gen = ++tabSwitchGen;
  const wantMotion = opts.appear !== false;
  const refill = opts.refillOrbit;

  host.querySelectorAll('[data-items-tab]').forEach((btn) => {
    if (!(btn instanceof HTMLElement)) return;
    const on = btn.dataset.itemsTab === tabId;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  host.querySelectorAll('[data-items-panel]').forEach((panel) => {
    if (!(panel instanceof HTMLElement)) return;
    panel.hidden = panel.dataset.itemsPanel !== tabId;
  });

  const prev = host.querySelector('[data-items-orbit].is-active');

  // Always depart first (including same-tab re-press) so the leave wave plays
  if (wantMotion && prev instanceof HTMLElement) {
    await playOrbitDepart(prev);
    if (gen !== tabSwitchGen) return;
  }

  const activeOrbit = activateOrbit(host, tabId);
  if (typeof refill === 'function' && activeOrbit) {
    refill(activeOrbit, tabId);
  }
  if (wantMotion) playOrbitAppear(activeOrbit);
}

/**
 * @param {HTMLElement} host
 * @param {{
 *   refillOrbit?: (orbit: HTMLElement, categoryId: string) => void,
 * }} [opts]
 */
export function bindExploreTabs(host, opts = {}) {
  host.addEventListener('click', (ev) => {
    const btn =
      ev.target instanceof Element ? ev.target.closest('[data-items-tab]') : null;
    if (!(btn instanceof HTMLElement) || !host.contains(btn)) return;
    const id = btn.dataset.itemsTab || '';
    if (!id) return;
    void showExploreTab(host, id, {
      appear: true,
      refillOrbit: opts.refillOrbit,
    });
  });
}

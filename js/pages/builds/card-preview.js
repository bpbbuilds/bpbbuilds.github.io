/**
 * Alt + Play preview for Builds card view.
 *
 * Card view keeps its cached board still in place and mounts the lightweight
 * animation into a pointer-transparent overlay. Compact and grid views do not
 * register here, so their existing thumbnail/tooltip behavior is unchanged.
 */

import { mountBuildTipAnimation } from '../build/build-tip-animation.js';

/** @type {WeakMap<HTMLElement, { card: HTMLElement, button: HTMLButtonElement, liveHost: HTMLElement, preview: object, controller: { stop: () => void } | null, generation: number, busy: boolean }>} */
const entries = new WeakMap();

/**
 * @param {HTMLElement} card
 * @param {HTMLButtonElement} button
 * @param {HTMLElement} liveHost
 * @param {{ placements: object[], itemsById: Map<string, object>, getSpriteUrl: (item: object) => string, root: string, cellPx?: number }} preview
 */
export function registerCardBuildPreview(card, button, liveHost, preview) {
  if (!(card instanceof HTMLElement) || !(button instanceof HTMLButtonElement) || !(liveHost instanceof HTMLElement)) return;
  if (!Array.isArray(preview?.placements) || !preview.placements.length) return;

  button.hidden = false;
  entries.set(card, {
    card,
    button,
    liveHost,
    preview,
    controller: null,
    generation: 0,
    busy: false,
  });
}

/**
 * Bind card hover/focus tracking and the page-level Alt shortcut.
 * @param {HTMLElement} listEl
 * @returns {() => void}
 */
export function bindCardBuildPreviews(listEl) {
  if (!(listEl instanceof HTMLElement)) return () => {};

  /** @type {ReturnType<typeof setTimeout> | 0} */
  let stopTimer = 0;
  /** @type {{ card: HTMLElement, button: HTMLButtonElement, liveHost: HTMLElement, preview: object, controller: { stop: () => void } | null, generation: number, busy: boolean } | null} */
  let active = null;

  const cardForTarget = (target) => {
    if (!(target instanceof Element)) return null;
    const card = target.closest('.builds-post:not(.builds-post--compact):not(.builds-post--grid)');
    return card instanceof HTMLElement && listEl.contains(card) ? card : null;
  };

  const stop = (entry) => {
    entry.generation += 1;
    entry.controller?.stop();
    entry.controller = null;
    entry.busy = false;
    entry.liveHost.replaceChildren();
    entry.liveHost.hidden = true;
    entry.liveHost.setAttribute('aria-hidden', 'true');
    entry.button.disabled = false;
    entry.button.removeAttribute('aria-busy');
    entry.button.setAttribute('aria-pressed', 'false');
    entry.button.title = 'Play board animation';
    entry.button.setAttribute('aria-label', 'Play board animation');
  };

  const setActive = (next) => {
    if (active === next) return;
    if (active) stop(active);
    active = next;
  };

  const start = async (entry) => {
    if (entry.controller || entry.busy) return;
    entry.busy = true;
    const generation = ++entry.generation;
    entry.button.disabled = true;
    entry.button.setAttribute('aria-busy', 'true');
    entry.liveHost.hidden = false;
    entry.liveHost.setAttribute('aria-hidden', 'false');
    try {
      const controller = await mountBuildTipAnimation(entry.liveHost, entry.preview);
      if (generation !== entry.generation || active !== entry) {
        controller.stop();
        return;
      }
      entry.controller = controller;
      entry.button.setAttribute('aria-pressed', 'true');
      entry.button.title = 'Pause board animation';
      entry.button.setAttribute('aria-label', 'Pause board animation');
    } catch (err) {
      if (generation === entry.generation) {
        entry.liveHost.replaceChildren();
        entry.liveHost.hidden = true;
        entry.liveHost.setAttribute('aria-hidden', 'true');
        entry.button.title = 'Preview unavailable';
        entry.button.setAttribute('aria-label', 'Preview unavailable');
      }
      console.warn('[builds-card-preview] preview unavailable', err);
    } finally {
      if (generation === entry.generation) {
        entry.busy = false;
        entry.button.disabled = false;
        entry.button.removeAttribute('aria-busy');
      }
    }
  };

  const toggle = (entry) => {
    if (entry.controller) {
      stop(entry);
      return;
    }
    void start(entry);
  };

  const onPointerOver = (event) => {
    const card = cardForTarget(event.target);
    if (!card) return;
    const entry = entries.get(card);
    if (!entry) return;
    if (stopTimer) {
      clearTimeout(stopTimer);
      stopTimer = 0;
    }
    setActive(entry);
  };

  const onPointerOut = (event) => {
    const card = cardForTarget(event.target);
    if (!card || !(event.relatedTarget instanceof Node) || card.contains(event.relatedTarget)) return;
    if (active?.card !== card) return;
    stopTimer = window.setTimeout(() => {
      stopTimer = 0;
      if (active?.card === card) {
        stop(active);
        active = null;
      }
    }, 80);
  };

  const onFocusIn = (event) => {
    const card = cardForTarget(event.target);
    if (!card) return;
    const entry = entries.get(card);
    if (entry) setActive(entry);
  };

  const onClick = (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-feed-card-preview]');
    if (!(button instanceof HTMLButtonElement) || !listEl.contains(button)) return;
    const card = cardForTarget(button);
    const entry = card ? entries.get(card) : null;
    if (!entry) return;
    event.preventDefault();
    event.stopPropagation();
    setActive(entry);
    toggle(entry);
  };

  const onKeyDown = (event) => {
    if (event.key !== 'Alt' || event.repeat || !active) return;
    event.preventDefault();
    toggle(active);
  };

  listEl.addEventListener('pointerover', onPointerOver);
  listEl.addEventListener('pointerout', onPointerOut);
  listEl.addEventListener('focusin', onFocusIn);
  listEl.addEventListener('click', onClick);
  window.addEventListener('keydown', onKeyDown);

  return () => {
    if (stopTimer) clearTimeout(stopTimer);
    listEl.removeEventListener('pointerover', onPointerOver);
    listEl.removeEventListener('pointerout', onPointerOut);
    listEl.removeEventListener('focusin', onFocusIn);
    listEl.removeEventListener('click', onClick);
    window.removeEventListener('keydown', onKeyDown);
    if (active) stop(active);
    active = null;
  };
}

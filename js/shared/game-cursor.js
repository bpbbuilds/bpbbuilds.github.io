import './youtube-cursor.js';

/**
 * Pressed cursor. The game swaps the hand while the mouse button is down.
 * Hover images stay in css/cursor.css.
 */

const KIND_CLASS = {
  pointer: 'bpb-cursor-kind-pointer',
  grab: 'bpb-cursor-kind-grab',
  ns: 'bpb-cursor-kind-ns',
  ew: 'bpb-cursor-kind-ew',
};

function classify(cursor) {
  const c = String(cursor || '');
  if (
    c === 'text' ||
    c === 'not-allowed' ||
    c === 'help' ||
    c === 'crosshair' ||
    c === 'wait' ||
    c === 'progress' ||
    c.startsWith('zoom-')
  ) {
    return 'native';
  }
  if (c.includes('interactable') || c === 'pointer') return 'pointer';
  if (c.includes('grabbable') || c.includes('grabbed') || c === 'grab' || c === 'grabbing') return 'grab';
  if (c.includes('resize-ns') || c === 'ns-resize' || c === 'row-resize' || c === 'n-resize' || c === 's-resize') {
    return 'ns';
  }
  if (c.includes('resize-ew') || c === 'ew-resize' || c === 'col-resize' || c === 'e-resize' || c === 'w-resize') {
    return 'ew';
  }
  return 'default';
}

function kindFrom(start) {
  let node = start instanceof Element ? start : null;
  while (node) {
    const cursor = getComputedStyle(node).cursor;
    if (cursor && cursor !== 'auto') return classify(cursor);
    node = node.parentElement;
  }
  return 'default';
}

function clearPress() {
  const root = document.documentElement;
  root.classList.remove('bpb-cursor-down', ...Object.values(KIND_CLASS));
}

/**
 * Intrinsic pixels. Chrome paints cursor bitmaps in device pixels, so the
 * on-screen CSS size is these numbers divided by devicePixelRatio.
 * @type {Record<string, { src: string, x: number, y: number, w: number, h: number }>}
 */
const CURSORS = {
  default: { src: '/assets/cursors/default.png', x: 27, y: 27, w: 88, h: 128 },
  clicked: { src: '/assets/cursors/default-clicked.png', x: 27, y: 27, w: 88, h: 128 },
  pointer: { src: '/assets/cursors/interactable.png', x: 29, y: 16, w: 88, h: 128 },
  pointerDown: { src: '/assets/cursors/interactable-clicked.png', x: 29, y: 16, w: 88, h: 128 },
  grab: { src: '/assets/cursors/grabbable.png', x: 27, y: 27, w: 88, h: 128 },
  grabbing: { src: '/assets/cursors/grabbed.png', x: 27, y: 27, w: 88, h: 128 },
  ns: { src: '/assets/cursors/resize-ns.png', x: 36, y: 36, w: 75, h: 128 },
  nsDown: { src: '/assets/cursors/resize-ns-active.png', x: 36, y: 36, w: 75, h: 128 },
  ew: { src: '/assets/cursors/resize-ew.png', x: 42, y: 42, w: 122, h: 122 },
  ewDown: { src: '/assets/cursors/resize-ew-active.png', x: 42, y: 42, w: 122, h: 122 },
};

/** @param {string} kind @param {boolean} down */
function specFor(kind, down) {
  if (kind === 'pointer') return down ? CURSORS.pointerDown : CURSORS.pointer;
  if (kind === 'grab') return down ? CURSORS.grabbing : CURSORS.grab;
  if (kind === 'ns') return down ? CURSORS.nsDown : CURSORS.ns;
  if (kind === 'ew') return down ? CURSORS.ewDown : CURSORS.ew;
  return down ? CURSORS.clicked : CURSORS.default;
}

/**
 * Chrome will not draw a CSS cursor whose bitmap leaves the viewport, so the
 * footer used to swap in a much smaller hand. This element is the same art
 * at the same size and is allowed to clip at the screen edge.
 * @type {HTMLImageElement | null}
 */
let follower = null;
let followerSrc = '';
let followerW = '';
let followerH = '';
let pressed = false;
let pressedKind = 'default';
let following = false;
/** @type {Element | null} */
let hiddenCursorTarget = null;
let hiddenCursorValue = '';
let hiddenCursorPriority = '';
/** @type {EventTarget | null} */
let lastTarget = null;
let lastKind = 'default';
/** @type {WeakMap<Element, string>} */
let kindCache = new WeakMap();
/** @type {{ x: number, y: number, target: EventTarget | null } | null} */
let lastPointer = null;
/** @type {{ x: number, y: number, target: EventTarget | null, pointerType: string } | null} */
let pendingPointer = null;
let frameHandle = 0;

function resetKindCache() {
  kindCache = new WeakMap();
  lastTarget = null;
  lastKind = 'default';
}

function ensureFollower() {
  if (follower) return follower;
  const img = document.createElement('img');
  img.className = 'bpb-cursor-follower';
  img.alt = '';
  img.draggable = false;
  img.setAttribute('aria-hidden', 'true');
  document.body.appendChild(img);
  follower = img;
  return img;
}

function hideFollower() {
  restoreNativeCursor();
  if (!following) return;
  following = false;
  document.documentElement.classList.remove('bpb-live-cursor');
}

function restoreNativeCursor() {
  if (!hiddenCursorTarget) return;
  hiddenCursorTarget.style.setProperty('cursor', hiddenCursorValue, hiddenCursorPriority);
  hiddenCursorTarget = null;
  hiddenCursorValue = '';
  hiddenCursorPriority = '';
}

/** @param {EventTarget | null} target */
function hideNativeCursor(target) {
  const next = target instanceof Element ? target : null;
  if (next === hiddenCursorTarget) return;
  restoreNativeCursor();
  if (!next) return;
  hiddenCursorTarget = next;
  hiddenCursorValue = next.style.getPropertyValue('cursor');
  hiddenCursorPriority = next.style.getPropertyPriority('cursor');
  next.style.setProperty('cursor', 'none', 'important');
}

function usesNativeCursor() {
  if (window.innerWidth <= 640) return true;
  return Boolean(window.matchMedia && !window.matchMedia('(hover: hover) and (pointer: fine)').matches);
}

/** Keep the 1440px desktop art as the reference; compact desktop viewports get a smaller hand. */
function desktopCursorScale() {
  return Math.max(0.72, Math.min(1, (window.innerWidth || 1440) / 1440));
}

/**
 * @param {EventTarget | null} target
 */
function cursorKindAt(target) {
  return kindFrom(target instanceof Element ? target : null);
}

/**
 * Kind is read once per element. Reading it turns the live-cursor class off
 * and back on, and that class restyles every cursor on the page.
 * @param {EventTarget | null} target
 */
function kindFor(target) {
  if (pressed) return pressedKind;
  if (target instanceof Element) {
    const cached = kindCache.get(target);
    if (cached) return cached;
  }
  if (target === lastTarget) return lastKind;
  restoreNativeCursor();
  lastTarget = target;
  lastKind = cursorKindAt(target);
  if (target instanceof Element) kindCache.set(target, lastKind);
  return lastKind;
}

/**
 * @param {{ x: number, y: number, target: EventTarget | null, pointerType: string }} event
 */
function syncFollowerNow(event) {
  if (event.pointerType === 'touch' || usesNativeCursor()) {
    hideFollower();
    return;
  }
  const kind = kindFor(event.target);
  if (kind === 'native') {
    hideFollower();
    return;
  }
  hideNativeCursor(event.target);
  const spec = specFor(kind, pressed);
  const dpr = window.devicePixelRatio || 1;
  const scale = desktopCursorScale();
  const hotX = (spec.x / dpr) * scale;
  const hotY = (spec.y / dpr) * scale;
  const img = ensureFollower();
  if (followerSrc !== spec.src) {
    followerSrc = spec.src;
    img.src = spec.src;
  }
  const w = `${(spec.w / dpr) * scale}px`;
  const h = `${(spec.h / dpr) * scale}px`;
  if (followerW !== w) {
    followerW = w;
    img.style.width = w;
  }
  if (followerH !== h) {
    followerH = h;
    img.style.height = h;
  }
  img.style.transform = `translate3d(${event.x - hotX}px, ${event.y - hotY}px, 0)`;
  if (!following) {
    following = true;
    document.documentElement.classList.add('bpb-live-cursor');
  }
}

/** @param {{ x: number, y: number, target: EventTarget | null, pointerType?: string }} event */
function queueFollowerSync(event) {
  if (!event) return;
  const next = {
    x: event.x,
    y: event.y,
    target: event.target,
    pointerType: event.pointerType || 'mouse',
  };
  lastPointer = { x: next.x, y: next.y, target: next.target };
  pendingPointer = next;
  if (frameHandle) return;
  frameHandle = window.requestAnimationFrame(() => {
    frameHandle = 0;
    const current = pendingPointer;
    pendingPointer = null;
    if (current) syncFollowerNow(current);
  });
}

/** @param {PointerEvent} event */
function onPointerMove(event) {
  queueFollowerSync({
    x: event.clientX,
    y: event.clientY,
    target: event.target,
    pointerType: event.pointerType,
  });
}

/**
 * Native scrolling can move the element under a stationary mouse without
 * producing a pointermove. Re-sample the cursor at the last pointer position
 * so the clipped hand follows nested scrollers such as Create's Filter|Build
 * rail just like it follows the catalog scroller.
 */
function syncFollowerAfterScroll() {
  if (!lastPointer || usesNativeCursor()) return;
  const target = document.elementFromPoint(lastPointer.x, lastPointer.y) || lastPointer.target;
  resetKindCache();
  queueFollowerSync({
    x: lastPointer.x,
    y: lastPointer.y,
    target,
    pointerType: 'mouse',
  });
}

export function bindGameCursor() {
  if (document.documentElement.dataset.bpbCursor === '1') return;
  document.documentElement.dataset.bpbCursor = '1';

  document.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('scroll', syncFollowerAfterScroll, { passive: true, capture: true });
  window.addEventListener('resize', syncFollowerAfterScroll, { passive: true });
  document.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') return;
    if (event.button !== 0) return;
    resetKindCache();
    const kind = kindFor(event.target);
    pressedKind = kind;
    pressed = true;
    if (kind === 'native') {
      pressed = false;
      clearPress();
      hideFollower();
      return;
    }
    const root = document.documentElement;
    root.classList.add('bpb-cursor-down');
    const extra = KIND_CLASS[kind];
    if (extra) root.classList.add(extra);
    queueFollowerSync({
      x: event.clientX,
      y: event.clientY,
      target: event.target,
      pointerType: event.pointerType,
    });
  });

  const release = () => {
    pressed = false;
    pressedKind = 'default';
    clearPress();
    resetKindCache();
    if (lastPointer) queueFollowerSync({ ...lastPointer, pointerType: 'mouse' });
  };
  document.addEventListener('pointerup', release);
  document.addEventListener('pointercancel', release);
  window.addEventListener('blur', () => {
    release();
    hideFollower();
  });
  document.documentElement.addEventListener('pointerleave', () => {
    pendingPointer = null;
    hideFollower();
  });
}

bindGameCursor();

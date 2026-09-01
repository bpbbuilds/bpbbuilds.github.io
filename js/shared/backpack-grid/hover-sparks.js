/**
 * Item Library hover sparks — short rarity-tinted burst (game ItemHoverSparks).
 */

/** Game.gd rarityColors (Common→Unique), lightened ≈0.2 like respondToHover */
const RARITY_SPARK = {
  Common: 'rgb(204, 224, 227)',
  Rare: 'rgb(110, 178, 255)',
  Epic: 'rgb(216, 78, 242)',
  Legendary: 'rgb(255, 185, 78)',
  Godly: 'rgb(255, 250, 180)',
  Unique: 'rgb(170, 245, 195)',
};

function assetPrefix() {
  const raw = document.body?.dataset?.root ?? './';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function sparkUrl() {
  return `${assetPrefix()}assets/icons/grid/GlowingDot.png`;
}

function rarityColor(rarity) {
  const key = String(rarity || 'Common');
  return RARITY_SPARK[key] || RARITY_SPARK.Common;
}

/**
 * One-shot spark burst centered on an item (or socketed gem) element.
 * @param {HTMLElement} el
 */
export function burstHoverSparks(el) {
  if (!el) return;
  const host =
    el.classList.contains('bpb-bg__mark--gem')
      ? el.closest('.bpb-bg__item') || el
      : el;
  const color = rarityColor(el.getAttribute('data-rarity') || host.getAttribute('data-rarity'));
  const layer = document.createElement('div');
  layer.className = 'bpb-bg__sparks';
  layer.setAttribute('aria-hidden', 'true');
  if (el.classList.contains('bpb-bg__mark--gem') && el !== host) {
    // Anchor burst on the gem within the host item
    const hr = host.getBoundingClientRect();
    const gr = el.getBoundingClientRect();
    if (hr.width > 0 && hr.height > 0) {
      const x = ((gr.left + gr.width / 2 - hr.left) / hr.width) * 100;
      const y = ((gr.top + gr.height / 2 - hr.top) / hr.height) * 100;
      layer.style.left = `${x}%`;
      layer.style.top = `${y}%`;
      layer.style.right = 'auto';
      layer.style.bottom = 'auto';
      layer.style.width = '0';
      layer.style.height = '0';
    }
  }
  const url = sparkUrl();
  const n = 3;
  for (let i = 0; i < n; i += 1) {
    const dot = document.createElement('span');
    dot.className = 'bpb-bg__spark';
    const ang = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.6;
    const dist = 0.35 + Math.random() * 0.45;
    dot.style.setProperty('--bpb-spark-x', `${Math.cos(ang) * dist}em`);
    dot.style.setProperty('--bpb-spark-y', `${Math.sin(ang) * dist}em`);
    dot.style.setProperty('--bpb-spark-delay', `${i * 30}ms`);
    dot.style.backgroundImage = `url("${url}")`;
    dot.style.backgroundColor = color;
    layer.appendChild(dot);
  }
  host.appendChild(layer);
  window.setTimeout(() => layer.remove(), 500);
}

/**
 * Bind spark bursts on item pointer/focus (delegated).
 * @param {HTMLElement} root — backpack-grid root
 * @returns {() => void} unbind
 */
export function bindHoverSparks(root) {
  const items = root.querySelector('.bpb-bg__items');
  if (!items) return () => {};

  /** @type {string | null} */
  let lastId = null;

  function onEnter(itemEl) {
    const id = itemEl.getAttribute('data-item-id');
    if (!id || id === lastId) return;
    lastId = id;
    burstHoverSparks(itemEl);
  }

  function onPointerOver(e) {
    if (document.body.classList.contains('is-bpb-dragging')) return;
    if (document.body.classList.contains('is-bpb-selecting')) return;
    const t = e.target instanceof Element ? e.target : null;
    if (!t || !items.contains(t)) return;
    // Gem is its own hover target — don't spark the host shield/weapon
    const gem = t.closest('.bpb-bg__mark--gem');
    if (gem instanceof HTMLElement) {
      const gid = `gem:${gem.getAttribute('data-item-id') || gem.dataset.gemSlot || ''}`;
      if (gid === lastId) return;
      lastId = gid;
      burstHoverSparks(gem);
      return;
    }
    const itemEl = t.closest('.bpb-bg__item');
    if (!itemEl || !items.contains(itemEl)) return;
    // Game: inventory bags skip ItemHoverSparks
    if (itemEl.classList.contains('bpb-bg__item--bag')) return;
    onEnter(itemEl);
  }

  function onPointerOut(e) {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const related = e.relatedTarget instanceof Element ? e.relatedTarget : null;
    const gem = t.closest('.bpb-bg__mark--gem');
    if (gem) {
      if (related?.closest?.('.bpb-bg__mark--gem') === gem) return;
      const gid = `gem:${gem.getAttribute('data-item-id') || gem.dataset.gemSlot || ''}`;
      if (gid === lastId) lastId = null;
      return;
    }
    const itemEl = t.closest('.bpb-bg__item');
    if (!itemEl) return;
    if (related && itemEl.contains(related)) return;
    if (itemEl.getAttribute('data-item-id') === lastId) lastId = null;
  }

  function onFocusIn(e) {
    if (document.body.classList.contains('is-bpb-dragging')) return;
    if (document.body.classList.contains('is-bpb-selecting')) return;
    const t = e.target instanceof Element ? e.target : null;
    if (!t || !items.contains(t)) return;
    const gem = t.closest('.bpb-bg__mark--gem');
    if (gem instanceof HTMLElement) {
      const gid = `gem:${gem.getAttribute('data-item-id') || gem.dataset.gemSlot || ''}`;
      if (gid === lastId) return;
      lastId = gid;
      burstHoverSparks(gem);
      return;
    }
    const itemEl = t.closest('.bpb-bg__item');
    if (!itemEl || !items.contains(itemEl)) return;
    if (itemEl.classList.contains('bpb-bg__item--bag')) return;
    onEnter(itemEl);
  }

  function onFocusOut(e) {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const related = e.relatedTarget instanceof Element ? e.relatedTarget : null;
    const gem = t.closest('.bpb-bg__mark--gem');
    if (gem) {
      if (related?.closest?.('.bpb-bg__mark--gem') === gem) return;
      const gid = `gem:${gem.getAttribute('data-item-id') || gem.dataset.gemSlot || ''}`;
      if (gid === lastId) lastId = null;
      return;
    }
    const itemEl = t.closest('.bpb-bg__item');
    if (!itemEl) return;
    if (related && itemEl.contains(related)) return;
    if (itemEl.getAttribute('data-item-id') === lastId) lastId = null;
  }

  items.addEventListener('pointerover', onPointerOver);
  items.addEventListener('pointerout', onPointerOut);
  items.addEventListener('focusin', onFocusIn);
  items.addEventListener('focusout', onFocusOut);

  return () => {
    items.removeEventListener('pointerover', onPointerOver);
    items.removeEventListener('pointerout', onPointerOut);
    items.removeEventListener('focusin', onFocusIn);
    items.removeEventListener('focusout', onFocusOut);
  };
}

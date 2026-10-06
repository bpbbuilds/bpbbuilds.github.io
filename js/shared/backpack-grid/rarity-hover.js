/**
 * On item hover/focus:
 * - Outline rarity footprint cells under the item
 * - Yellow/blue affect marks via game Inventory.getAffectedCells rules
 *   (canAffect overrides extracted to assets/data/can-affect-rules.json)
 * - Brighten OTHER items that affect the focus on **build boards only**
 *   (Girl Power when hovering Nest) — not on Itemiary /items/
 *
 * Primary → stars, secondary → diamonds, tertiary → tertiary tiles,
 * lightning → lightning tiles. Each color uses its own itemsChecked set
 * (matching Inventory.getAffectedCells per CanAffect color).
 */
import {
  loadCanAffectData,
  canAffectColor,
  isAffectingDistinct,
} from './can-affect.js';
/** @typedef {'primary'|'secondary'|'tertiary'|'lightning'} AffectColor */
/**
 * @param {HTMLElement} root
 */
export function bindRarityHover(root) {
  const under = root.querySelector('.bpb-bg__under');
  const items = root.querySelector('.bpb-bg__items');
  if (!under || !items) return;
  /** @type {HTMLElement | null} */
  let activeItem = null;
  /** @type {Map<HTMLElement, Set<string>>} */
  let affectedBright = new Map();
  /** @type {Record<string, object> | null} */
  let rulesById = null;
  /** @type {Record<string, number> | null} */
  let classMasks = null;
  /** @type {Record<string, number>} */
  let classBits = {};
  /** @type {Set<string>} */
  let hasAttackEffectIds = new Set();
  /** @type {Set<string>} */
  let reactsToChargesIds = new Set();
  /** @type {Set<string>} */
  let gainsBuffsIds = new Set();
  /** @type {Set<string>} */
  let usesBuffsIds = new Set();
  /** @type {Record<string, string[]>} */
  let gainedStacksById = {};
  /** @type {Set<string>} */
  let craftedIds = new Set();
  /** @type {Record<string, string[]>} */
  let scriptFamilies = {};
  /** @type {Record<string, string>} */
  let parentById = {};
  /** @type {Record<string, number>} */
  let rarityRank = {};
  /** @type {Set<string>} */
  let startOfBattleIds = new Set();
  function assetRoot() {
    const raw = document.body?.dataset?.root ?? './';
    return raw.endsWith('/') ? raw : `${raw}/`;
  }
  const STAR_OFF = `${assetRoot()}assets/icons/grid/AffectedTile_noEffect.png`;
  const STAR_ON = `${assetRoot()}assets/icons/grid/AffectedTile.png`;
  const EXT_ICON = `${assetRoot()}assets/icons/grid/Extension.png`;

  /** @type {{ sel: string, color: AffectColor, off: string, on: string }[]} */
  const LAYERS = [
    {
      sel: '.bpb-bg__mark--star',
      color: 'primary',
      off: STAR_OFF,
      on: STAR_ON,
    },
    {
      sel: '.bpb-bg__mark--diamond',
      color: 'secondary',
      off: `${assetRoot()}assets/icons/grid/AffectedTile_secondary_noEffect.png`,
      on: `${assetRoot()}assets/icons/grid/AffectedTile_secondary.png`,
    },
    {
      sel: '.bpb-bg__mark--tertiary',
      color: 'tertiary',
      off: `${assetRoot()}assets/icons/grid/AffectedTile_tertiary_noEffect.png`,
      on: `${assetRoot()}assets/icons/grid/AffectedTile_tertiary.png`,
    },
    {
      sel: '.bpb-bg__mark--lightning',
      color: 'lightning',
      off: `${assetRoot()}assets/icons/grid/AffectedTile_lightning_noEffect.png`,
      on: `${assetRoot()}assets/icons/grid/AffectedTile_lightning.png`,
    },
  ];

  /**
   * Acorn Ace → Ranger collars activate AffectedExtension tiles as primary stars
   * (Item.activateExtendedAffectedCells).
   */
  function boardHasAcornAce() {
    return Boolean(
      items.querySelector(
        '.bpb-bg__item[data-item-id="acorn_ace"]:not(.bpb-bg__item--parked)',
      ),
    );
  }

  /** Promote / demote collar extension marks to look + behave like stars. */
  function syncExtensionPromotion() {
    const on = boardHasAcornAce();
    items.querySelectorAll('.bpb-bg__mark--extension').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      el.classList.toggle('is-promoted', on);
      if (!el.classList.contains('is-active')) {
        el.style.backgroundImage = `url('${on ? STAR_OFF : EXT_ICON}')`;
      }
    });
    return on;
  }
  loadCanAffectData(assetRoot()).then((data) => {
    rulesById = data.rulesById;
    classMasks = data.classMasks;
    classBits = data.classBits || {};
    hasAttackEffectIds = data.hasAttackEffectIds || new Set();
    reactsToChargesIds = data.reactsToChargesIds || new Set();
    gainsBuffsIds = data.gainsBuffsIds || new Set();
    usesBuffsIds = data.usesBuffsIds || new Set();
    gainedStacksById = data.gainedStacksById || {};
    craftedIds = data.craftedIds || new Set();
    scriptFamilies = data.scriptFamilies || {};
    parentById = data.parentById || {};
    rarityRank = data.rarityRank || {};
    startOfBattleIds = data.startOfBattleIds || new Set();
    if (activeItem) syncAffectHits(activeItem);
  });
  function setLit(id, on) {
    if (!id) return;
    under.querySelectorAll(`.bpb-bg__cell--rarity[data-item-id="${CSS.escape(id)}"]`).forEach((el) => {
      el.classList.toggle('is-lit', on);
    });
  }
  function clearAffectMarks(itemEl) {
    if (!itemEl) return;
    for (const layer of LAYERS) {
      itemEl.querySelectorAll(`${layer.sel}.is-active`).forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        el.classList.remove('is-active');
        el.style.backgroundImage = `url('${layer.off}')`;
      });
    }
    // Acorn Ace–promoted collar extensions (primary stars while promoted)
    itemEl.querySelectorAll('.bpb-bg__mark--extension.is-active').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      el.classList.remove('is-active');
      const promoted = el.classList.contains('is-promoted');
      el.style.backgroundImage = `url('${promoted ? STAR_OFF : EXT_ICON}')`;
    });
  }
  function clearAffectedBright() {
    for (const el of affectedBright.keys()) {
      el.classList.remove(
        'bpb-bg__item--affected',
        'bpb-bg__item--affected-primary',
        'bpb-bg__item--affected-secondary',
        'bpb-bg__item--affected-tertiary',
        'bpb-bg__item--affected-lightning',
        'bpb-bg__item--affected-multi',
      );
    }
    affectedBright.clear();
  }
  /**
   * Minimal item view from stamped data-* (for canAffect predicates).
   * @param {HTMLElement} el
   */
  function itemFromEl(el) {
    const split = (s) =>
      String(s || '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    const num = (s) => {
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    };
    return {
      id: el.dataset.itemId || '',
      name: el.querySelector('.bpb-bg__hit')?.getAttribute('aria-label') || '',
      type: el.dataset.itemType || '',
      class: el.dataset.itemClass || 'Neutral',
      rarity: el.dataset.rarity || 'Common',
      extraTypes: split(el.dataset.extraTypes),
      tags: split(el.dataset.tags),
      cooldown: num(el.dataset.cooldown),
      damageMin: num(el.dataset.damageMin),
      block: num(el.dataset.block),
      chance: num(el.dataset.chance),
      staminaCost: num(el.dataset.staminaCost),
      hasInventoryDuration: el.dataset.hasInventoryDuration === '1',
      effect: el.dataset.effect || '',
    };
  }
  function affectCtx() {
    return {
      classMasks,
      classBits,
      hasAttackEffectIds,
      reactsToChargesIds,
      gainsBuffsIds,
      usesBuffsIds,
      gainedStacksById,
      craftedIds,
      scriptFamilies,
      parentById,
      rarityRank,
      startOfBattleIds,
    };
  }
  /**
   * Board occupancy shared across color layers (bags + filled cells).
   * @param {HTMLElement} itemEl
   */
  function boardMaps(itemEl) {
    /** @type {Set<string>} */
    const bagCells = new Set();
    /** @type {Map<string, HTMLElement>} */
    const filled = new Map();
    for (const other of items.querySelectorAll(
      '.bpb-bg__item:not(.bpb-bg__item--parked)',
    )) {
      if (!(other instanceof HTMLElement)) continue;
      const raw = other.dataset.bodyCells || '';
      if (!raw) continue;
      const isBag = other.classList.contains('bpb-bg__item--bag');
      for (const key of raw.split(/\s+/)) {
        if (!key) continue;
        if (isBag) bagCells.add(key);
        else if (other !== itemEl && !filled.has(key)) filled.set(key, other);
      }
    }
    return { bagCells, filled };
  }
  /**
   * Sync one affect color (stars / diamonds / …) like Inventory.getAffectedCells.
   * Lights the hovered item's outbound tiles only (what it can affect).
   * @param {HTMLElement} itemEl
   * @param {object} source
   * @param {{ bagCells: Set<string>, filled: Map<string, HTMLElement> }} maps
   * @param {{ sel: string, color: AffectColor, off: string, on: string }} layer
   */
  function syncLayer(itemEl, source, maps, layer) {
    for (const { mark, hit } of resolveAffectMarks(itemEl, source, maps, layer)) {
      mark.classList.toggle('is-active', hit);
      mark.style.backgroundImage = `url('${hit ? layer.on : layer.off}')`;
    }
  }

  /**
   * Inventory.getAffectedCells for one color — CellSorter + itemsChecked + distinct.
   * @param {HTMLElement} itemEl
   * @param {object} source
   * @param {{ bagCells: Set<string>, filled: Map<string, HTMLElement> }} maps
   * @param {{ sel: string, color: AffectColor }} layer
   * @returns {{ mark: HTMLElement, cell: string, hit: boolean }[]}
   */
  function resolveAffectMarks(itemEl, source, maps, layer) {
    const marks = [...itemEl.querySelectorAll(layer.sel)].filter(
      (el) => el instanceof HTMLElement,
    );
    /** @type {{ mark: HTMLElement, cell: string, hit: boolean }[]} */
    const out = [];
    if (!marks.length) return out;

    // CellSorter: y asc, then x asc
    marks.sort((a, b) => {
      const [ax, ay] = (a.dataset.cell || '0,0').split(',').map(Number);
      const [bx, by] = (b.dataset.cell || '0,0').split(',').map(Number);
      return ay - by || ax - bx;
    });

    /** @type {Set<HTMLElement>} */
    const itemsChecked = new Set();
    /** @type {Set<string>} */
    const distinctIds = new Set();
    const distinctMode = isAffectingDistinct(rulesById, source, layer.color);
    const ctx = affectCtx();
    const skipRecheck = layer.color !== 'lightning';

    for (const mark of marks) {
      const cell = mark.dataset.cell || '';
      let hit = false;
      if (cell && maps.bagCells.has(cell)) {
        const targetEl = maps.filled.get(cell) || null;
        if (targetEl) {
          if (skipRecheck && itemsChecked.has(targetEl)) {
            hit = false;
          } else {
            const target = itemFromEl(targetEl);
            hit = canAffectColor(rulesById, source, target, layer.color, ctx);
            if (hit && distinctMode) {
              const desc = target.id;
              if (distinctIds.has(desc)) hit = false;
              else distinctIds.add(desc);
            }
            itemsChecked.add(targetEl);
          }
        } else {
          hit = canAffectColor(rulesById, source, null, layer.color, ctx);
        }
      } else if (cell) {
        // On board but outside a bag → CannotAffect
        hit = false;
      }
      out.push({ mark, cell, hit });
    }
    return out;
  }

  /**
   * Game Item._process canAffectDraggedItem — tint items that AFFECT the focus
   * using the same distinct-filtered CanAffect cells as outbound stars
   * (Girl Power lights for the chosen class item only, not every star overlap).
   * @param {HTMLElement} focusEl
   * @returns {Map<HTMLElement, Set<string>>}
   */
  function findItemsAffectingFocus(focusEl) {
    /** @type {Map<HTMLElement, Set<string>>} */
    const hitByColor = new Map();
    const focusCells = new Set(
      String(focusEl.dataset.bodyCells || '')
        .split(/\s+/)
        .filter(Boolean),
    );
    if (!focusCells.size || !rulesById) return hitByColor;

    const extPromoted = boardHasAcornAce();
    /** @type {{ sel: string, color: AffectColor }[]} */
    const layers = LAYERS.map((l) => ({ sel: l.sel, color: l.color }));
    if (extPromoted) {
      layers.push({
        sel: '.bpb-bg__mark--extension.is-promoted',
        color: 'primary',
      });
    }

    for (const other of items.querySelectorAll(
      '.bpb-bg__item:not(.bpb-bg__item--parked)',
    )) {
      if (!(other instanceof HTMLElement) || other === focusEl) continue;
      if (other.classList.contains('bpb-bg__item--bag')) continue;
      const source = itemFromEl(other);
      // Exclude the *source* from filled (not the focus) so stars can still hit the hovered item.
      const maps = boardMaps(other);
      for (const layer of layers) {
        const resolved = resolveAffectMarks(other, source, maps, layer);
        if (!resolved.length) continue;
        const overlapsActive = resolved.some(
          (r) => r.hit && r.cell && focusCells.has(r.cell),
        );
        if (!overlapsActive) continue;
        let colors = hitByColor.get(other);
        if (!colors) {
          colors = new Set();
          hitByColor.set(other, colors);
        }
        colors.add(layer.color);
      }
    }
    return hitByColor;
  }
  /**
   * Tint affectors (Game Color modulate on sprites that canAffect the focus).
   * @param {Map<HTMLElement, Set<string>>} hitByColor
   */
  function applyAffectedBright(hitByColor) {
    clearAffectedBright();
    for (const [el, colors] of hitByColor) {
      el.classList.add('bpb-bg__item--affected');
      if (colors.size > 1) {
        el.classList.add('bpb-bg__item--affected-multi');
      } else if (colors.has('primary')) {
        el.classList.add('bpb-bg__item--affected-primary');
      } else if (colors.has('secondary')) {
        el.classList.add('bpb-bg__item--affected-secondary');
      } else if (colors.has('tertiary')) {
        el.classList.add('bpb-bg__item--affected-tertiary');
      } else if (colors.has('lightning')) {
        el.classList.add('bpb-bg__item--affected-lightning');
      }
      affectedBright.set(el, colors);
    }
  }
  /**
   * @param {HTMLElement} itemEl
   */
  function syncAffectHits(itemEl) {
    const source = itemFromEl(itemEl);
    const maps = boardMaps(itemEl);
    const extPromoted = syncExtensionPromotion();
    // Outbound: hovered item's star/diamond tiles (what it can affect) — all boards
    for (const layer of LAYERS) syncLayer(itemEl, source, maps, layer);
    if (extPromoted) {
      syncLayer(itemEl, source, maps, {
        sel: '.bpb-bg__mark--extension.is-promoted',
        color: 'primary',
        off: STAR_OFF,
        on: STAR_ON,
      });
    }
    // Inbound sprite tint (Girl Power when hovering Nest) — build boards only
    if (root.classList.contains('bpb-bg--itemiary')) {
      clearAffectedBright();
      return;
    }
    applyAffectedBright(findItemsAffectingFocus(itemEl));
  }
  function clear() {
    if (!activeItem) {
      clearAffectedBright();
      return;
    }
    setLit(activeItem.getAttribute('data-item-id'), false);
    clearAffectMarks(activeItem);
    clearAffectedBright();
    activeItem = null;
  }
  /**
   * Socketed gem sprite, or a free Gem item on the board (Wisp, crystal, …).
   * @param {Element} t
   * @returns {'socketed' | 'item' | null}
   */
  function gemHoverKind(t) {
    if (t.closest('.bpb-bg__mark--gem') && items.contains(t)) return 'socketed';
    const itemEl = t.closest('.bpb-bg__item');
    if (
      itemEl instanceof HTMLElement &&
      items.contains(itemEl) &&
      !itemEl.classList.contains('bpb-bg__item--parked') &&
      itemEl.getAttribute('data-item-type') === 'Gem'
    ) {
      return 'item';
    }
    return null;
  }
  /**
   * @param {HTMLElement} itemEl
   */
  function activate(itemEl) {
    if (activeItem === itemEl) {
      syncAffectHits(itemEl);
      return;
    }
    clear();
    activeItem = itemEl;
    setLit(itemEl.getAttribute('data-item-id'), true);
    syncAffectHits(itemEl);
  }
  items.addEventListener('pointerover', (e) => {
    if (document.body.classList.contains('is-bpb-dragging')) return;
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    // Gems (Wisp, Corrupted Crystal, …): game Gem.gainFocus → Game.showSockets
    const gemKind = gemHoverKind(t);
    if (gemKind === 'socketed') {
      clear();
      root.classList.add('bpb-bg--show-sockets');
      return;
    }
    if (gemKind === 'item') {
      root.classList.add('bpb-bg--show-sockets');
      const itemEl = t.closest('.bpb-bg__item');
      if (itemEl instanceof HTMLElement) activate(itemEl);
      return;
    }
    const itemEl = t.closest('.bpb-bg__item');
    if (!(itemEl instanceof HTMLElement) || !items.contains(itemEl)) return;
    if (itemEl.classList.contains('bpb-bg__item--parked')) return;
    root.classList.remove('bpb-bg--show-sockets');
    activate(itemEl);
  });
  items.addEventListener('pointerout', (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const related = e.relatedTarget instanceof Element ? e.relatedTarget : null;
    const gem = t.closest('.bpb-bg__mark--gem');
    if (gem && items.contains(gem)) {
      if (related && gemHoverKind(related)) return;
      root.classList.remove('bpb-bg--show-sockets');
      return;
    }
    const itemEl = t.closest('.bpb-bg__item');
    if (!itemEl) return;
    if (related && itemEl.contains(related)) return;
    if (itemEl.getAttribute('data-item-type') === 'Gem') {
      if (related && gemHoverKind(related)) return;
      root.classList.remove('bpb-bg--show-sockets');
    }
    if (itemEl === activeItem) clear();
  });
  items.addEventListener('focusin', (e) => {
    if (document.body.classList.contains('is-bpb-dragging')) return;
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const gemKind = gemHoverKind(t);
    if (gemKind === 'socketed') {
      clear();
      root.classList.add('bpb-bg--show-sockets');
      return;
    }
    if (gemKind === 'item') {
      root.classList.add('bpb-bg--show-sockets');
      const itemEl = t.closest('.bpb-bg__item');
      if (itemEl instanceof HTMLElement) activate(itemEl);
      return;
    }
    const itemEl = t.closest('.bpb-bg__item');
    if (!(itemEl instanceof HTMLElement)) return;
    if (itemEl.classList.contains('bpb-bg__item--parked')) return;
    root.classList.remove('bpb-bg--show-sockets');
    activate(itemEl);
  });
  items.addEventListener('focusout', (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const related = e.relatedTarget instanceof Element ? e.relatedTarget : null;
    const gem = t.closest('.bpb-bg__mark--gem');
    if (gem && items.contains(gem)) {
      if (related && gemHoverKind(related)) return;
      root.classList.remove('bpb-bg--show-sockets');
      return;
    }
    const itemEl = t.closest('.bpb-bg__item');
    if (!itemEl) return;
    if (related && itemEl.contains(related)) return;
    if (itemEl.getAttribute('data-item-type') === 'Gem') {
      if (related && gemHoverKind(related)) return;
      root.classList.remove('bpb-bg--show-sockets');
    }
    if (itemEl === activeItem) clear();
  });

  root.addEventListener('bpb-bg:painted', () => {
    syncExtensionPromotion();
    if (activeItem) syncAffectHits(activeItem);
  });

  // Create-board drag: only the held item's affect preview should show
  document.addEventListener('bpb-create-drag', clear);
}

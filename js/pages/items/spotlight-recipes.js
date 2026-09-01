/**
 * Items spotlight recipes — mirrors game BuildIntoRecipesTooltip:
 *   result | Equals | getAllIngredients() (duplicates kept)
 *   Item.scaleToFit(maxSize, 0.7) — small textures stay small.
 */

/**
 * @typedef {{
 *   id: number | string,
 *   resultId: string,
 *   ingredientIds: string[],
 * }} RecipeRow
 */

/**
 * @typedef {{
 *   byResult: Map<string, RecipeRow[]>,
 *   byIngredient: Map<string, RecipeRow[]>,
 * }} RecipeIndex
 */

/**
 * @typedef {{
 *   stage?: Element | null,
 *   piece?: Element | null,
 *   tipHost?: HTMLElement | null,
 * }} RecipeLayoutCtx
 */

const EDGE = 8;
/** Match Itemiary default when live --bpb-bg-cell isn’t available. */
const FALLBACK_CELL_PX = 34;
/** Minimum panel width; grows only when a recipe row is wider. */
const PANEL_MIN_WIDTH_PX = 200;
const PANEL_PAD_X = 36; /* scroll gutter + horizontal padding */

/**
 * Expand DB rows into display ingredient ids (quantity → repeated icons).
 * @param {Array<{ item_id?: string, quantity?: number, sort_order?: number }>} ings
 * @returns {string[]}
 */
export function expandIngredientIds(ings) {
  const sorted = Array.isArray(ings) ? ings.slice() : [];
  sorted.sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
  /** @type {string[]} */
  const out = [];
  for (const row of sorted) {
    const id = String(row?.item_id || '').trim();
    if (!id) continue;
    const qty = Math.max(1, Math.round(Number(row.quantity) || 1));
    for (let i = 0; i < qty; i += 1) out.push(id);
  }
  return out;
}

/**
 * Build lookup maps from Supabase combinations + ingredients rows.
 * @param {Array<{
 *   id?: number | string,
 *   result_item_id?: string,
 *   ingredients?: Array<{ item_id?: string, quantity?: number, sort_order?: number }>
 * }>} rows
 * @returns {RecipeIndex}
 */
export function buildRecipeIndex(rows) {
  /** @type {Map<string, RecipeRow[]>} */
  const byResult = new Map();
  /** @type {Map<string, RecipeRow[]>} */
  const byIngredient = new Map();

  for (const row of rows || []) {
    const resultId = String(row?.result_item_id || '').trim();
    if (!resultId) continue;
    const ingredientIds = expandIngredientIds(row.ingredients || []);
    if (!ingredientIds.length) continue;

    /** @type {RecipeRow} */
    const recipe = {
      id: row.id ?? `${resultId}:${ingredientIds.join('+')}`,
      resultId,
      ingredientIds,
    };

    const asResult = byResult.get(resultId) || [];
    asResult.push(recipe);
    byResult.set(resultId, asResult);

    const seenIng = new Set();
    for (const ingId of ingredientIds) {
      if (seenIng.has(ingId)) continue;
      seenIng.add(ingId);
      const list = byIngredient.get(ingId) || [];
      list.push(recipe);
      byIngredient.set(ingId, list);
    }
  }

  return { byResult, byIngredient };
}

/**
 * Recipes where item is result or ingredient (game: recipes + recipesAsIngredient).
 * @param {RecipeIndex} index
 * @param {string} itemId
 * @returns {RecipeRow[]}
 */
export function recipesForItem(index, itemId) {
  const id = String(itemId || '').trim();
  if (!id || !index) return [];
  /** @type {Map<string | number, RecipeRow>} */
  const seen = new Map();
  for (const r of index.byResult.get(id) || []) seen.set(r.id, r);
  for (const r of index.byIngredient.get(id) || []) seen.set(r.id, r);
  return [...seen.values()];
}

/**
 * Same on-screen size as the Itemiary catalog board (sprite cells × cell px).
 * @param {object | null | undefined} item
 * @param {number} cellPx
 * @returns {{ w: number, h: number }}
 */
export function recipeIconSize(item, cellPx = FALLBACK_CELL_PX) {
  const cell = Number.isFinite(cellPx) && cellPx > 0 ? cellPx : FALLBACK_CELL_PX;
  const cw = Number(item?.spriteW);
  const ch = Number(item?.spriteH);
  const wCells = Number.isFinite(cw) && cw > 0 ? cw : 1;
  const hCells = Number.isFinite(ch) && ch > 0 ? ch : 1;
  return {
    w: Math.max(12, Math.round(wCells * cell)),
    h: Math.max(12, Math.round(hCells * cell)),
  };
}

/**
 * Live Itemiary cell size (fillWidth may scale past 34px).
 * @param {Element | null} [fromEl]
 */
function readCatalogCellPx(fromEl = null) {
  const probe =
    (fromEl instanceof Element && fromEl.closest?.('.bpb-bg')) ||
    document.querySelector('.items-bag__stage .bpb-bg') ||
    document.querySelector('.bpb-bg--itemiary') ||
    document.querySelector('.bpb-bg');
  if (!(probe instanceof Element)) return FALLBACK_CELL_PX;
  const raw = getComputedStyle(probe).getPropertyValue('--bpb-bg-cell').trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : FALLBACK_CELL_PX;
}

/**
 * @param {string} s
 */
function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/**
 * @param {string} root
 */
function assetUrl(root, rel) {
  const base = String(root || '').replace(/\/?$/, '/');
  return `${base}${rel.replace(/^\//, '')}`;
}

/**
 * @param {{
 *   getItemById: (id: string) => object | undefined,
 *   getSpriteUrl: (item: object) => string,
 *   onPickItem: (id: string) => void,
 *   assetRoot?: string,
 * }} opts
 */
export function createSpotlightRecipes(opts) {
  const root = document.createElement('aside');
  root.className = 'il-spotlight-recipes';
  root.setAttribute('aria-label', 'Item recipes');
  root.hidden = true;
  document.body.appendChild(root);

  const pageRoot =
    opts.assetRoot ??
    document.body?.dataset?.root ??
    '../';

  /** @type {RecipeIndex} */
  let index = { byResult: new Map(), byIngredient: new Map() };
  /** @type {RecipeLayoutCtx} */
  let layoutCtx = {};
  let layoutRaf = 0;
  let cellPx = FALLBACK_CELL_PX;
  /** Locked after open / resize — scroll must not remeasure (was ratcheting wider). */
  let lockedWidthPx = 0;

  /**
   * @param {RecipeIndex | null | undefined} next
   */
  function setIndex(next) {
    index = next || { byResult: new Map(), byIngredient: new Map() };
  }

  /**
   * True content width of a recipe row (sum of children — not scrollWidth,
   * which tracks the panel and ratchets on every remeasure).
   * @param {HTMLElement} row
   */
  function measureRowWidth(row) {
    const style = getComputedStyle(row);
    const gap = parseFloat(style.columnGap || style.gap) || 0;
    const kids = [...row.children].filter((c) => c instanceof HTMLElement);
    let w = 0;
    kids.forEach((el, i) => {
      w += el.getBoundingClientRect().width;
      if (i > 0) w += gap;
    });
    return w;
  }

  /**
   * Widest recipe row + chrome. Do not include the heading (block scrollWidth
   * equals the current panel width and causes expand-on-scroll).
   * @returns {number}
   */
  function measureContentWidth() {
    let widest = 0;
    root.querySelectorAll('.il-spotlight-recipes__row').forEach((row) => {
      if (!(row instanceof HTMLElement)) return;
      widest = Math.max(widest, measureRowWidth(row));
    });
    return Math.ceil(widest) + PANEL_PAD_X;
  }

  /**
   * @param {{ remeasureWidth?: boolean }} [opts]
   */
  function layout(optsLayout = {}) {
    if (root.hidden) return;
    const remeasureWidth = optsLayout.remeasureWidth !== false;
    const stage = layoutCtx.stage;
    const tip = layoutCtx.tipHost;

    cellPx = readCatalogCellPx(layoutCtx.piece || null);
    root.style.setProperty(
      '--recipe-equals-w',
      `${Math.max(16, Math.round(cellPx * 0.55))}px`,
    );
    applyIconSizes();

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let gap = 24;
    let stageRight = vw * 0.5;
    if (stage instanceof Element) {
      const sr = stage.getBoundingClientRect();
      stageRight = sr.right;
    }
    if (tip instanceof HTMLElement) {
      const tr = tip.getBoundingClientRect();
      if (tr.width > 1 && stage instanceof Element) {
        const sr = stage.getBoundingClientRect();
        gap = Math.max(12, Math.round(sr.left - tr.right));
      }
    }

    const roomRight = Math.max(PANEL_MIN_WIDTH_PX, vw - stageRight - gap - EDGE);
    let width = lockedWidthPx;
    if (remeasureWidth || !width) {
      // Shrink-wrap to content; only widen when a row actually needs it.
      const needed = Math.max(PANEL_MIN_WIDTH_PX, measureContentWidth());
      width = Math.min(needed, roomRight, vw - EDGE * 2);
      lockedWidthPx = Math.round(width);
    }
    root.style.width = `${lockedWidthPx}px`;

    const maxH = Math.min(Math.round(vh * 0.7), 36 * 16, vh - EDGE * 2);
    root.style.maxHeight = `${Math.max(180, maxH)}px`;

    if (!(stage instanceof Element)) return;

    const sr = stage.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    const rw = rr.width || lockedWidthPx;
    const rh = rr.height || root.offsetHeight || maxH;

    let left = Math.round(sr.right + gap);
    if (left + rw > vw - EDGE) {
      left = Math.max(EDGE, vw - rw - EDGE);
    }

    let top = Math.round(sr.top + sr.height / 2 - rh / 2);
    if (top + rh > vh - EDGE) top = Math.max(EDGE, vh - rh - EDGE);
    if (top < EDGE) top = EDGE;

    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
    root.style.right = 'auto';
    root.style.transform = 'none';
  }

  function applyIconSizes() {
    root.querySelectorAll('[data-recipe-item]').forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      const id = btn.getAttribute('data-recipe-item');
      const item = id ? opts.getItemById(id) : null;
      const { w, h } = recipeIconSize(item, cellPx);
      const sprite = btn.querySelector('.il-spotlight-recipes__sprite');
      if (sprite instanceof HTMLElement) {
        sprite.style.width = `${w}px`;
        sprite.style.height = `${h}px`;
      }
    });
  }

  /**
   * @param {{ remeasureWidth?: boolean }} [opts]
   */
  function scheduleLayout(optsLayout = {}) {
    const remeasure = optsLayout.remeasureWidth !== false;
    if (layoutRaf) cancelAnimationFrame(layoutRaf);
    layoutRaf = requestAnimationFrame(() => {
      layoutRaf = 0;
      // First pass sizes icons; second pass measures width after layout settles.
      layout({ remeasureWidth: remeasure });
      requestAnimationFrame(() =>
        layout({ remeasureWidth: remeasure }),
      );
    });
  }

  /**
   * @param {string} itemId
   */
  function itemBtnHtml(itemId) {
    const item = opts.getItemById(itemId);
    const name = String(item?.name || itemId);
    const src = item ? opts.getSpriteUrl(item) : '';
    const { w, h } = recipeIconSize(item, cellPx);
    const img = src
      ? `<img class="il-spotlight-recipes__sprite" src="${escapeAttr(src)}" alt="" draggable="false" style="width:${w}px;height:${h}px" />`
      : `<span class="il-spotlight-recipes__sprite il-spotlight-recipes__sprite--empty" aria-hidden="true" style="width:${w}px;height:${h}px"></span>`;
    return `<button type="button" class="il-spotlight-recipes__item" data-recipe-item="${escapeAttr(itemId)}" title="${escapeAttr(name)}" aria-label="${escapeAttr(name)}">${img}</button>`;
  }

  /**
   * Game row: fused result | Equals | ingredients (focus item first when present).
   * @param {RecipeRow} recipe
   * @param {string} focusId
   */
  function recipeRowHtml(recipe, focusId) {
    const ings = recipe.ingredientIds.slice();
    const focusAt = ings.indexOf(focusId);
    if (focusAt > 0) {
      ings.splice(focusAt, 1);
      ings.unshift(focusId);
    }
    const equalsSrc = assetUrl(pageRoot, 'assets/tooltips/recipes/Equals.png');
    const ingredients = ings.map((id) => itemBtnHtml(id)).join('');
    return `<div class="il-spotlight-recipes__row">
      ${itemBtnHtml(recipe.resultId)}
      <img class="il-spotlight-recipes__equals" src="${escapeAttr(equalsSrc)}" alt="" draggable="false" aria-hidden="true" />
      <div class="il-spotlight-recipes__ings">${ingredients}</div>
    </div>`;
  }

  /**
   * @param {string} itemId
   * @param {RecipeLayoutCtx} [ctx]
   */
  function showFor(itemId, ctx = {}) {
    const id = String(itemId || '').trim();
    if (!id) {
      hide();
      return;
    }
    layoutCtx = {
      stage: ctx.stage ?? null,
      piece: ctx.piece ?? null,
      tipHost: ctx.tipHost ?? null,
    };

    cellPx = readCatalogCellPx(ctx.piece || null);

    const recipes = recipesForItem(index, id);
    if (!recipes.length) {
      hide();
      return;
    }

    const n = recipes.length;
    const title = n === 1 ? '1 Recipe' : `${n} Recipes`;
    const dividerSrc = assetUrl(pageRoot, 'assets/tooltips/recipes/Divider1.png');

    let rows = '';
    recipes.forEach((r, i) => {
      if (i > 0) {
        rows += `<div class="il-spotlight-recipes__divider" aria-hidden="true"><img src="${escapeAttr(dividerSrc)}" alt="" draggable="false" /></div>`;
      }
      rows += recipeRowHtml(r, id);
    });

    root.innerHTML = `
      <div class="il-spotlight-recipes__panel">
        <h3 class="il-spotlight-recipes__heading">${escapeAttr(title)}</h3>
        <div class="il-spotlight-recipes__scroll">
          <div class="il-spotlight-recipes__list">${rows}</div>
        </div>
      </div>`;
    root.hidden = false;
    lockedWidthPx = 0;
    scheduleLayout({ remeasureWidth: true });
  }

  function hide() {
    root.hidden = true;
    root.innerHTML = '';
    layoutCtx = {};
    lockedWidthPx = 0;
    root.style.removeProperty('left');
    root.style.removeProperty('top');
    root.style.removeProperty('right');
    root.style.removeProperty('transform');
    root.style.removeProperty('max-height');
    root.style.removeProperty('width');
  }

  root.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) return;
    const btn = e.target.closest('[data-recipe-item]');
    if (!(btn instanceof HTMLElement) || !root.contains(btn)) return;
    const nextId = btn.getAttribute('data-recipe-item');
    if (!nextId) return;
    e.preventDefault();
    e.stopPropagation();
    opts.onPickItem(nextId);
  });

  // Keep wheel on the recipe list — don’t scroll the Itemiary under the dim.
  root.addEventListener(
    'wheel',
    (e) => {
      e.stopPropagation();
    },
    { passive: true },
  );

  const onResize = () => {
    if (root.hidden) return;
    lockedWidthPx = 0;
    scheduleLayout({ remeasureWidth: true });
  };
  /** Reposition only — scrolling the recipe list must not remeasure width. */
  const onScroll = (e) => {
    if (root.hidden) return;
    if (e.target instanceof Node && root.contains(e.target)) return;
    scheduleLayout({ remeasureWidth: false });
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', onScroll, true);

  return {
    el: root,
    setIndex,
    showFor,
    hide,
    layout,
    destroy() {
      if (layoutRaf) cancelAnimationFrame(layoutRaf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
      hide();
      root.remove();
    },
  };
}

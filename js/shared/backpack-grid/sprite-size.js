/**
 * Sprite display size — game Icon.scale × texture ÷ cellSize(80).
 *
 * Overflow past the footprint is intentional (see Fanny Pack in-game).
 * Do not clamp non-bags to the cell box.
 *
 * Bags on placed/build boards use full Icon.scale so adjacent AABBs overlap and
 * soft PNG edges fade into each other (game inventory / BuildViewer).
 * Itemiary bags use full Icon.scale too; the whole item gets CSS scale(0.9)
 * (AppearInLibrarySmall) so FilledSlot cells stay proportional to the art.
 *
 * Sizes use calc(N * var(--bpb-bg-cell)), not em — sprites sit inside a
 * <button>, and UA button font-size would skew em units.
 *
 * Fallback: BPB Builds-style type heuristics when sprite-display.json
 * has no entry for the item.
 */

/** @deprecated Prefer Itemiary whole-item scale(0.9); kept for rare opt-in shrink. */
const BAG_VISUAL_SCALE = 0.91;

/**
 * @param {number} cells
 * @returns {string}
 */
function cellLen(cells) {
  const n = Math.round(cells * 1000) / 1000;
  return `calc(${n} * var(--bpb-bg-cell))`;
}

/**
 * Sprite size in cells (same heuristics as the CSS `spriteSizeStyle` fallback).
 * `autoH` / `autoW` keep the PNG aspect when the other axis is the constraint.
 * @param {object} item
 * @param {{ w: number, h: number }} bounds
 * @returns {{ w: number, h: number, autoH?: boolean, autoW?: boolean }}
 */
export function spriteSizeCells(item, bounds) {
  const w = Math.max(1, bounds.w);
  const h = Math.max(1, bounds.h);
  const type = String(item?.type || '');
  const name = String(item?.name || '');
  const spriteW = Number(item?.spriteW);
  const spriteH = Number(item?.spriteH);
  if (
    Number.isFinite(spriteW) &&
    Number.isFinite(spriteH) &&
    spriteW > 0 &&
    spriteH > 0
  ) {
    return { w: spriteW, h: spriteH };
  }

  const isPotion = type.includes('Potion');
  const isWeapon = type.includes('Weapon');
  const isGem = type === 'Gem' || type.includes('Gemstone');
  const isChess = type.includes('Chess Piece');
  const isCard = type === 'Card' || type.includes('Playing Card');
  const isDeck = name === 'Deck of Cards';
  const isBag = type === 'Bag';

  if (isCard) return { w: 0.8, h: 0.8, autoH: true };
  if (isDeck) return { w: 1, h: 1, autoH: true };
  if (isGem) return { w: 0.5, h: 0.5, autoH: true };
  if (isChess) return { w: 0.6, h: 0.6, autoH: true };
  if (isPotion) return { w, h: h * 0.9, autoW: true };
  if (isBag) return { w: w + 0.4, h: h + 0.4 };
  if (w !== 1 || isWeapon) {
    if (h <= w) return { w, h };
    return { w, h, autoW: true };
  }
  return { w: 1, h };
}

/**
 * @param {object} item
 * @param {{ w: number, h: number }} bounds — body AABB in cells
 * @param {{ libraryBagScale?: boolean }} [opts]
 *   libraryBagScale: optional sprite-only shrink (legacy). Prefer Itemiary
 *   whole-item CSS scale(0.9) so FilledSlots stay proportional to bag art.
 * @returns {string} inline style for the sprite <img>
 */
export function spriteSizeStyle(item, bounds, opts = {}) {
  const w = Math.max(1, bounds.w);
  const h = Math.max(1, bounds.h);
  const type = String(item?.type || '');
  const name = String(item?.name || '');
  const isBag = type === 'Bag';
  const size = spriteSizeCells(item, bounds);

  const spriteW = Number(item?.spriteW);
  const spriteH = Number(item?.spriteH);
  if (
    Number.isFinite(spriteW) &&
    Number.isFinite(spriteH) &&
    spriteW > 0 &&
    spriteH > 0
  ) {
    const k = isBag && opts.libraryBagScale === true ? BAG_VISUAL_SCALE : 1;
    return `width:${cellLen(size.w * k)};height:${cellLen(size.h * k)}`;
  }

  const isPotion = type.includes('Potion');
  const isWeapon = type.includes('Weapon');
  const isGem = type === 'Gem' || type.includes('Gemstone');
  const isChess = type.includes('Chess Piece');
  const isCard = type === 'Card' || type.includes('Playing Card');
  const isDeck = name === 'Deck of Cards';

  if (isCard) {
    return `width:${cellLen(0.8)};height:auto`;
  }
  if (isDeck) {
    return `width:${cellLen(1)};height:auto`;
  }
  if (isGem) {
    return `width:${cellLen(0.5)};height:auto`;
  }
  if (isChess) {
    return `width:${cellLen(0.6)};height:auto`;
  }
  if (isPotion) {
    return `width:auto;height:${cellLen(h * 0.9)}`;
  }
  if (isBag) {
    // BPB Builds approximation when Icon.scale meta is missing
    return `width:${cellLen(w + 0.4)};height:${cellLen(h + 0.4)}`;
  }
  if (w !== 1 || isWeapon) {
    if (h <= w) {
      return `width:${cellLen(w)};height:${cellLen(h)}`;
    }
    return `width:auto;min-width:${cellLen(w)};height:${cellLen(h)}`;
  }
  return `width:${cellLen(1)};height:${cellLen(h)}`;
}

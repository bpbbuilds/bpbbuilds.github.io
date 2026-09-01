/**
 * Shared backpack grid (Itemiary pack + build placements).
 *
 *   import { mountPackedGrid, mountPlacedGrid, mountItemiaryGrid } from '../../shared/backpack-grid/index.js';
 */

export {
  parseShape,
  shapeForItem,
  rotateShape,
  normalizeMatrix,
  bodyBounds,
} from './shape.js';
export { packItems, packGeom, colsForWidth } from './pack.js';
export { spriteSizeStyle } from './sprite-size.js';
export { mountPackedGrid, mountPlacedGrid } from './render.js';
export { mountItemiaryGrid } from './item-pool.js';
export {
  createItemEl,
  createUnderEl,
  applyItemFace,
  syncItemGems,
  attachSpriteSrc,
  warmItemSprites,
  filterEntriesNearViewport,
} from './item-pieces.js';
export {
  ROTATE_MS,
  ROTATE_DURATION_S,
  createAngleTween,
  animateSpinRotate,
  prefersReducedMotion,
} from './face-spin.js';

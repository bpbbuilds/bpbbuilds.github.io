/**
 * Map Supabase item rows → tooltip / grid item shape (camelCase).
 * Also apply local CollisionMap shapes + gem socket offsets (same as items catalog).
 */

/**
 * @param {object} row
 */
export function mapItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    gid: row.gid ?? null,
    name: row.name,
    rarity: row.rarity || 'Common',
    type: row.type || '',
    class: row.class || 'Neutral',
    extraTypes: Array.isArray(row.extra_types) ? row.extra_types : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    cost: row.cost,
    effect: row.effect || '',
    image: row.image || null,
    shape: row.shape ?? [[1]],
    sockets: row.sockets ?? null,
    accuracy: row.accuracy ?? null,
    cooldown: row.cooldown ?? null,
    staminaCost: row.stamina_cost ?? null,
    damageMin: row.damage_min ?? null,
    damageMax: row.damage_max ?? null,
    block: row.block ?? null,
    chance: row.chance ?? null,
    chanceTag: row.chance_tag ?? null,
    params: row.params ?? {},
  };
}

/**
 * Prefer extracted CollisionMap matrices (stars / diamonds / specials).
 * @param {object[]} items
 * @param {{ byId?: Record<string, number[][]>, byImage?: Record<string, number[][]> } | null} shapesData
 */
export function applyShapes(items, shapesData) {
  if (!shapesData || !items?.length) return;
  const byImage = shapesData.byImage || {};
  const byId = shapesData.byId || {};
  for (const item of items) {
    const shape =
      byId[item.id] || (item.image && byImage[item.image]) || null;
    if (Array.isArray(shape) && shape.length) {
      item.shape = shape;
      delete item.__bpbShape;
      delete item.__bpbShapeRot;
      delete item.__bpbBounds;
    }
  }
}

/**
 * Attach GemSocket positions (cells from body AABB center).
 * @param {object[]} items
 * @param {{ byId?: Record<string, {x:number,y:number}[]>, byImage?: Record<string, {x:number,y:number}[]> } | null} socketData
 */
export function applySocketOffsets(items, socketData) {
  if (!socketData || !items?.length) return;
  const byImage = socketData.byImage || {};
  const byId = socketData.byId || {};
  for (const item of items) {
    const offs =
      (item.image && byImage[item.image]) || byId[item.id] || null;
    if (Array.isArray(offs) && offs.length) {
      item.socketOffsets = offs;
      item.sockets = offs.length;
    }
  }
}

/**
 * @param {string} root
 * @param {Record<string, { w?: number, h?: number, anchorX?: number, anchorY?: number }> | { byImage?: Record<string, object> } | null} spriteDisplay
 */
export function makeSpriteUrl(root, spriteDisplay) {
  const byImage =
    spriteDisplay && typeof spriteDisplay === 'object' && spriteDisplay.byImage
      ? spriteDisplay.byImage
      : spriteDisplay;
  return (item) => {
    if (!item?.image) return '';
    const meta = byImage?.[item.image];
    if (meta) {
      item.spriteW = meta.w;
      item.spriteH = meta.h;
      const ax = Number(meta.anchorX) || 0;
      const ay = Number(meta.anchorY) || 0;
      if (Math.abs(ax) <= 0.25 && Math.abs(ay) <= 0.25) {
        item.spriteAnchorX = ax;
        item.spriteAnchorY = ay;
      }
    }
    return `${root}assets/item-sprites/${item.image}`;
  };
}

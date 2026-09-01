/**
 * Match item sprite filenames under assets/item-sprites/.
 * Prefer game .tscn Icon textures (game-sprites.json), then wiki zip names.
 */

import fs from 'fs';
import path from 'path';

export function normKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

export function fileStem(name) {
  return String(name || '').replace(/\s+/g, '');
}

/** @returns {Map<string, string>} normKey → filename */
export function buildSpriteIndex(spritesDir) {
  const index = new Map();
  if (!fs.existsSync(spritesDir)) return index;
  for (const file of fs.readdirSync(spritesDir)) {
    if (!/\.png$/i.test(file)) continue;
    const stem = file.replace(/\.png$/i, '');
    const key = normKey(stem);
    if (!index.has(key)) index.set(key, file);
  }
  return index;
}

/**
 * Load extract-game-sprites.mjs output → normKey → image filename.
 * @param {string} jsonPath
 * @returns {Map<string, string>}
 */
export function loadGameSpriteMap(jsonPath) {
  const map = new Map();
  if (!fs.existsSync(jsonPath)) return map;
  const { sprites } = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  for (const s of sprites || []) {
    if (!s?.image) continue;
    const keys = s.normKeys?.length
      ? s.normKeys
      : [s.nodeName, s.fileStem, s.id].filter(Boolean).map(normKey);
    for (const k of keys) {
      if (k && !map.has(k)) map.set(k, s.image);
    }
  }
  return map;
}

/**
 * @param {{ internalName?: string, displayName?: string, name?: string, id?: string }} item
 * @param {Map<string, string>} gameSpriteMap from loadGameSpriteMap
 * @param {Map<string, string>} spriteIndex directory index (wiki / copied)
 * @returns {string|null} filename or null
 */
export function matchSprite(item, gameSpriteMap, spriteIndex) {
  const candidates = [
    item.internalName,
    item.name,
    item.id,
    item.displayName,
    fileStem(item.internalName),
    fileStem(item.name),
    fileStem(item.displayName),
  ].filter(Boolean);

  // 1) Authoritative: .tscn Icon texture path
  if (gameSpriteMap?.size) {
    for (const c of candidates) {
      const hit = gameSpriteMap.get(normKey(c));
      if (hit) return hit;
    }
  }

  // 2) Fallback: file present under assets/item-sprites (wiki zip)
  if (spriteIndex?.size) {
    for (const c of candidates) {
      const hit = spriteIndex.get(normKey(c));
      if (hit) return hit;
    }
  }

  return null;
}

export function resolveSpritesDir(root) {
  return path.join(root, 'assets', 'item-sprites');
}

export function resolveGameSpritesJson(scriptsDir) {
  return path.join(scriptsDir, '_cache', 'game-sprites.json');
}

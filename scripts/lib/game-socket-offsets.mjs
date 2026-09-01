/**
 * GemSocket → cell offsets from body AABB center (Item.gd init math).
 */

import fs from 'fs';
import path from 'path';

/** @typedef {{ x: number, y: number }} Vec2 */

/**
 * @param {{
 *   cell: number,
 *   defaultIconScale: Vec2,
 *   defaultSocketsScale: Vec2,
 *   readFile: (abs: string) => string,
 *   resToAbs: (res: string) => string | null,
 *   rootInstanceParent: (text: string) => { parentRes: string | null } | null,
 *   decodePos: (encoded: number) => Vec2,
 * }} deps
 */
export function createSocketOffsetComputer(deps) {
  const {
    cell: CELL,
    defaultIconScale,
    defaultSocketsScale,
    readFile,
    resToAbs,
    rootInstanceParent,
    decodePos,
  } = deps;

  function nodeBlock(text, name) {
    const re = new RegExp(
      `\\[node name="${name}"[^\\]]*\\]([\\s\\S]*?)(?=\\n\\[node |\\n*$)`,
    );
    const m = text.match(re);
    return m ? m[1] : null;
  }

  function parseVector2(block, key) {
    if (!block) return null;
    const re = new RegExp(
      `${key}\\s*=\\s*Vector2\\(\\s*([^,]+),\\s*([^)]+)\\)`,
    );
    const m = block.match(re);
    if (!m) return null;
    const x = Number(m[1]);
    const y = Number(m[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  }

  function resolveIconScale(absPath, seen = new Set()) {
    if (!absPath || seen.has(absPath)) return { ...defaultIconScale };
    seen.add(absPath);
    const text = readFile(absPath);
    const own = parseVector2(nodeBlock(text, 'Icon') || '', 'scale');
    if (own) return own;
    const root = rootInstanceParent(text);
    if (root?.parentRes) {
      const parentAbs = resToAbs(root.parentRes);
      if (parentAbs) return resolveIconScale(parentAbs, seen);
    }
    return { ...defaultIconScale };
  }

  function resolveSocketsScale(absPath, seen = new Set()) {
    if (!absPath || seen.has(absPath)) return { ...defaultSocketsScale };
    seen.add(absPath);
    const text = readFile(absPath);
    const own = parseVector2(nodeBlock(text, 'Sockets') || '', 'scale');
    if (own) return own;
    const root = rootInstanceParent(text);
    if (root?.parentRes) {
      const parentAbs = resToAbs(root.parentRes);
      if (parentAbs) return resolveSocketsScale(parentAbs, seen);
    }
    return { ...defaultSocketsScale };
  }

  function extractGemLocals(text) {
    /** @type {Vec2[]} */
    const out = [];
    for (const m of text.matchAll(
      /\[node name="GemSocket[^"]*"[^\]]*\]([\s\S]*?)(?=\n\[node |\n*$)/g,
    )) {
      out.push(parseVector2(m[1], 'position') || { x: 0, y: 0 });
    }
    return out;
  }

  function collisionAabbCenter(text) {
    const block = text.match(
      /\[node name="CollisionMap"[^\]]*\]([\s\S]*?)(?=\n\[node |\n*$)/,
    );
    if (!block) return null;
    const body = block[1];
    const mapPos = parseVector2(body, 'position') || { x: 0, y: 0 };
    const dataM = body.match(/tile_data\s*=\s*PoolIntArray\(\s*([^)]*)\)/);
    if (!dataM) return null;
    const nums = dataM[1]
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    /** @type {Vec2[]} */
    const all = [];
    /** @type {Vec2[]} */
    const occupied = [];
    for (let i = 0; i + 2 < nums.length; i += 3) {
      const pos = decodePos(nums[i]);
      all.push(pos);
      if (nums[i + 1] === 3 || nums[i + 1] === 2) occupied.push(pos);
    }
    const use = occupied.length ? occupied : all;
    if (!use.length) return null;
    const centers = use.map((c) => ({
      x: mapPos.x + c.x * CELL + CELL / 2,
      y: mapPos.y + c.y * CELL + CELL / 2,
    }));
    const minX = Math.min(...centers.map((c) => c.x - CELL / 2));
    const maxX = Math.max(...centers.map((c) => c.x + CELL / 2));
    const minY = Math.min(...centers.map((c) => c.y - CELL / 2));
    const maxY = Math.max(...centers.map((c) => c.y + CELL / 2));
    return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  }

  /**
   * @param {string} itemAbs
   * @param {string} shapeSourceRel
   * @param {string} itemsDir
   */
  function computeSocketOffsets(itemAbs, shapeSourceRel, itemsDir) {
    const text = readFile(itemAbs);
    let gems = extractGemLocals(text);
    if (!gems.length) {
      let abs = itemAbs;
      const seen = new Set();
      while (abs && !seen.has(abs) && !gems.length) {
        seen.add(abs);
        const root = rootInstanceParent(readFile(abs));
        if (!root?.parentRes) break;
        abs = resToAbs(root.parentRes);
        if (abs) gems = extractGemLocals(readFile(abs));
      }
    }
    if (!gems.length) return [];

    const shapeAbs = path.join(
      itemsDir,
      shapeSourceRel.replace(/\//g, path.sep),
    );
    const aabb = collisionAabbCenter(
      fs.existsSync(shapeAbs) ? readFile(shapeAbs) : text,
    );
    if (!aabb) return [];

    const iconPos =
      parseVector2(nodeBlock(text, 'Icon') || '', 'position') || {
        x: 0,
        y: 0,
      };
    const iconScale = resolveIconScale(itemAbs);
    const sockScale = resolveSocketsScale(itemAbs);

    return gems.map((g) => {
      const px = iconPos.x + g.x * iconScale.x * sockScale.x;
      const py = iconPos.y + g.y * iconScale.y * sockScale.y;
      return {
        x: Math.round(((px - aabb.cx) / CELL) * 1000) / 1000,
        y: Math.round(((py - aabb.cy) / CELL) * 1000) / 1000,
      };
    });
  }

  return { computeSocketOffsets, extractGemLocals };
}

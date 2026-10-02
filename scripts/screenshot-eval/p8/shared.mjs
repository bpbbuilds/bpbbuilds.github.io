/**
 * P8 shared catalog + fixture paths. Eval-only. Does not touch the importer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const repo = path.resolve(here, '../../..');
export const evalDir = path.join(repo, 'scripts/screenshot-eval');
export const outDir = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p8');

export const FIXTURES = ['real-001', 'real-003', 'real-007', 'real-008', 'real-010', 'real-013', 'leather-quad', 'pine-protector'];
/** P3's bright-fixture bucket (real-001 is only partly bright; also reported alone). */
export const BRIGHT_FIXTURES = new Set(['real-001', 'real-010', 'pine-protector']);
export const CLEAN_BRIGHT = new Set(['real-010', 'pine-protector']);
export const CELL_PX = 48;
export const JITTER = 4;
export const STRIDE = 2;
export const PAIR_A = 'pine-protector';
export const PAIR_B = 'real-001';

export const normName = (s) => String(s).replace(/[^A-Za-z0-9]/g, '').toLowerCase();

export function fixturePng(name) {
  const a = path.join(repo, 'fixtures', `${name}.png`);
  const b = path.join(evalDir, 'fixtures', `${name}.png`);
  if (fs.existsSync(a)) return a;
  return b;
}

export function fixtureTruth(name) {
  const png = fixturePng(name);
  return path.join(path.dirname(png), `${name}.truth.json`);
}

export function loadCatalog() {
  const classes = JSON.parse(fs.readFileSync(path.join(repo, 'scripts/_cache/synth-detector-v5/classes.json'), 'utf8')).classes || [];
  const shapes = JSON.parse(fs.readFileSync(path.join(repo, 'assets/data/item-shapes.json'), 'utf8')).byImage || {};
  const display = JSON.parse(fs.readFileSync(path.join(repo, 'assets/data/sprite-display.json'), 'utf8')).byImage || {};
  const byNorm = new Map(classes.map((c) => [normName(c.name), c]));
  return { classes, shapes, display, byNorm };
}

export function bodyCells(shapes, cls, r) {
  const m = shapes[`${cls.image}.png`] || [[1]];
  let pts = [];
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < (m[y] || []).length; x++) if (Number(m[y][x]) === 1) pts.push({ x, y });
  }
  if (!pts.length) pts = [{ x: 0, y: 0 }];
  for (let i = 0; i < ((Number(r) || 0) + 4) % 4; i++) pts = pts.map((p) => ({ x: -p.y, y: p.x }));
  const minX = Math.min(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  return pts.map((p) => ({ x: p.x - minX, y: p.y - minY }));
}

export function boundsOf(pts) {
  return {
    x0: Math.min(...pts.map((p) => p.x)),
    y0: Math.min(...pts.map((p) => p.y)),
    x1: Math.max(...pts.map((p) => p.x)),
    y1: Math.max(...pts.map((p) => p.y)),
  };
}

export function isOblong(shapes, cls) {
  const b = boundsOf(bodyCells(shapes, cls, 0));
  return b.x1 - b.x0 !== b.y1 - b.y0;
}

export function footprint(shapes, cls, t) {
  const r0 = t.r == null ? 0 : t.r;
  const fb = boundsOf(bodyCells(shapes, cls, r0));
  return { x0: fb.x0 + t.x, y0: fb.y0 + t.y, x1: fb.x1 + t.x, y1: fb.y1 + t.y };
}

export function areaOf(b) {
  return (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1);
}

/** Confusable 1×1 families on this benchmark. Used only to slice scores. */
export function similar1x1(name, area) {
  if (area !== 1) return false;
  return /orb|blueberr|amulet|berry|gem/i.test(name);
}

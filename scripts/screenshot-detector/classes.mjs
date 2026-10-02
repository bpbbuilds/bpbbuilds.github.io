/**
 * Detector class list: placeable catalog items (bags, skills, and loose jewels).
 */
import fs from 'fs';
import path from 'path';
import { ROOT } from '../screenshot-to-build/catalog.mjs';

/**
 * @typedef {{ id: string, name: string, image: string, type: string, index: number }} DetectorClass
 */

/**
 * @param {{ id: string, name: string, image: string, type?: string }[]} catalog
 * @returns {{ classes: DetectorClass[], byId: Map<string, DetectorClass>, names: string[] }}
 */
export function buildClassList(catalog) {
  /** @type {DetectorClass[]} */
  const classes = [];
  for (const item of catalog) {
    const type = String(item.type || '');
    classes.push({
      id: String(item.id),
      name: String(item.name || item.id),
      image: String(item.image || ''),
      type,
      index: classes.length,
    });
  }
  const byId = new Map(classes.map((c) => [c.id, c]));
  return { classes, byId, names: classes.map((c) => c.name) };
}

/**
 * Keep the shipped 426 ids in the same order; append skills and jewels after them.
 * @param {{ id: string, name: string, image: string, type?: string }[]} catalog
 * @param {{ classes?: { id: string, name: string, image: string, type?: string }[] }} live
 */
export function extendLiveClassList(catalog, live) {
  const full = buildClassList(catalog);
  const liveRows = Array.isArray(live?.classes) ? live.classes : [];
  const liveIds = new Set(liveRows.map((c) => String(c.id)));
  const extra = full.classes
    .filter((c) => !liveIds.has(String(c.id)))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  /** @type {DetectorClass[]} */
  const classes = [];
  for (const row of liveRows) {
    const hit = full.byId.get(String(row.id));
    classes.push({
      id: String(row.id),
      name: String(hit?.name || row.name || row.id),
      image: String(hit?.image || row.image || ''),
      type: String(hit?.type || row.type || ''),
      index: classes.length,
    });
  }
  for (const row of extra) {
    classes.push({
      id: row.id,
      name: row.name,
      image: row.image,
      type: row.type,
      index: classes.length,
    });
  }
  return {
    classes,
    byId: new Map(classes.map((c) => [c.id, c])),
    names: classes.map((c) => c.name),
  };
}

/**
 * Bag-only class list for the dedicated bag detector.
 * @param {{ id: string, name: string, image: string, type?: string }[]} catalog
 */
export function buildBagClassList(catalog) {
  /** @type {DetectorClass[]} */
  const classes = [];
  for (const item of catalog) {
    if (String(item.type || '') !== 'Bag') continue;
    classes.push({
      id: String(item.id),
      name: String(item.name || item.id),
      image: String(item.image || ''),
      type: 'Bag',
      index: classes.length,
    });
  }
  const byId = new Map(classes.map((c) => [c.id, c]));
  return { classes, byId, names: classes.map((c) => c.name) };
}

/**
 * @param {{ classes: DetectorClass[] }} list
 * @param {string} outDir
 * @param {{ assetsPath?: string | null }} [opts]
 */
export function writeClassesArtifacts(list, outDir, opts = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const classesJson = {
    version: 1,
    count: list.classes.length,
    classes: list.classes.map((c) => ({
      index: c.index,
      id: c.id,
      name: c.name,
      image: c.image,
      type: c.type,
    })),
  };
  fs.writeFileSync(
    path.join(outDir, 'classes.json'),
    JSON.stringify(classesJson, null, 2),
  );
  const assetsPath =
    opts.assetsPath === null
      ? null
      : opts.assetsPath || path.join(ROOT, 'assets/data/detector-classes.json');
  if (assetsPath) {
    fs.writeFileSync(assetsPath, JSON.stringify(classesJson, null, 2));
  }

  const namesTxt = list.classes.map((c) => c.name).join('\n') + '\n';
  fs.writeFileSync(path.join(outDir, 'classes.txt'), namesTxt);

  return { classesJsonPath: path.join(outDir, 'classes.json'), assetsPath };
}

/**
 * @param {{ classes: DetectorClass[] }} list
 * @param {string} outDir
 */
export function writeBagClassesArtifacts(list, outDir) {
  return writeClassesArtifacts(list, outDir, {
    assetsPath: path.join(ROOT, 'assets/data/detector-bag-classes.json'),
  });
}

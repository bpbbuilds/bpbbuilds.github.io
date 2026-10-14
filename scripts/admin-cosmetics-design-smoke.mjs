#!/usr/bin/env node

/** Focused contract smoke for the shared Admin Cosmetics surface treatment. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'js/pages/admin/admin.css'), 'utf8');
const tab = fs.readFileSync(path.join(root, 'js/pages/admin/tab-cosmetics.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(/admin-panel__head/.test(tab), 'Cosmetics tab must use the shared admin panel heading');
assert(/admin-panel__body/.test(tab), 'Cosmetics tab must use the shared admin panel body spacing');
assert(/admin-cosmetics__card admin-cosmetics__row/.test(tab), 'Catalog entries must use the shared card surface');
assert(/\.admin-surface\s+\.admin-cosmetics__section\s*\{/.test(css), 'Cosmetics sections need shared surface styling');
assert(/\.admin-surface\s+\.admin-cosmetics__card/.test(css), 'Cosmetic cards need shared surface styling');
assert(/\.admin-surface\s+\.admin-cosmetics-filters\.items-filters/.test(css), 'Cosmetics filters need shared surface styling');
assert(/@media\s*\(max-width:\s*1240px\)/.test(css), 'Cosmetics desktop-to-narrow layout breakpoint is missing');
assert(/@media\s*\(max-width:\s*640px\)/.test(css), 'Cosmetics mobile layout breakpoint is missing');
console.log('admin cosmetics design smoke passed');

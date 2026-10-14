#!/usr/bin/env node

/** Focused contract smoke for the shared admin tab surface. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'js/pages/admin/admin.css'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'js/pages/admin/shell.js'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(/class="admin-stage admin-surface"/.test(shell), 'admin stage must opt into shared surface chrome');
assert(/\.admin-surface\s*\{/.test(css), 'shared admin-surface rule is missing');
assert(css.includes("Patch3.png"), 'shared admin surface must use the Patch3 mask');
assert(/\.admin-surface\s*\{[\s\S]*?box-shadow:/.test(css), 'shared admin surface must define a shadow');
assert(/\.admin-surface::before\s*\{/.test(css), 'shared admin surface mask layer is missing');
assert(/\.admin-surface\s*>\s*\*/.test(css), 'shared admin surface content layer is missing');
for (const selector of [
  '.admin-traffic',
  '.admin-members',
  '.admin-reports-panel',
  '.admin-report-filters',
  '.admin-cosmetics',
]) {
  assert(css.includes(selector), `admin surface contract lost ${selector}`);
}
assert(/\.admin-surface\s*>\s*\.admin-traffic/.test(css), 'analytics must use shared outer surface treatment');
assert(/\.admin-surface\s*>\s*\.admin-members/.test(css), 'members must use shared outer surface treatment');
assert(/\.admin-surface\s+\.admin-reports-col\s*>\s*\.admin-kpis/.test(css), 'reports KPIs must use shared surface treatment');
assert(/\.admin-surface\s+\.admin-members__stat/.test(css), 'members inner panels must use shared surface contrast');
assert(/@media\s*\(max-width:\s*1240px\)/.test(css), 'desktop-to-narrow admin layout breakpoint is missing');
assert(/@media\s*\(max-width:\s*640px\)/.test(css), 'mobile admin layout breakpoint is missing');
console.log('admin surface smoke passed');

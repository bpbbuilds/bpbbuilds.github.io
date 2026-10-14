#!/usr/bin/env node

/** Static smoke for the under-construction Patches page. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const page = await readFile(new URL('patch-notes/index.html', root), 'utf8');
const styles = await readFile(new URL('js/pages/market/market.css', root), 'utf8');

assert.match(page, /<body class="page-patch-notes"/, 'Patches page uses its own page class');
assert.match(page, /<main[^>]+aria-label="Patch notes"/, 'Patches page has an accessible main label');
assert.match(page, /Coming soon/, 'Patches page has the shared coming-soon heading');
assert.match(page, /Patch notes are under construction/i, 'Patches page explains its current status');
assert.match(page, /market\.css/, 'Patches page reuses the established under-construction surface');
assert.match(page, /js\/pages\/patch-notes\/index\.js/, 'Patches page boots its own page module');
assert.match(styles, /body\.page-market\s*,\s*body\.page-patch-notes/, 'Shared coming-soon styling covers the Patches page');

console.log('Patches page smoke passed.');

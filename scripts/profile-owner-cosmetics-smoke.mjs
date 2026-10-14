#!/usr/bin/env node

/** Regression for the owner-only profile -> wardrobe entitlement handoff. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const profilePage = await readFile(new URL('../js/pages/u/index.js', import.meta.url), 'utf8');
const catalogSource = await readFile(new URL('../js/pages/u/blob/catalog.js', import.meta.url), 'utf8');

assert.match(
  profilePage,
  /isSelf\s*&&\s*viewerProfile\?\.is_owner[\s\S]*is_owner\s*:\s*true/,
  'the signed-in owner profile is marked owner-aware before mounting the wardrobe',
);
assert.match(catalogSource, /if \(profile\?\.is_owner\) return true/, 'owner bypass remains explicit and server-role-backed');
assert.match(catalogSource, /return items\.filter\(\(c\) => ownsCosmetic\(c, profile\)\)/, 'inventory is derived from the owner-aware catalog entitlement check');

console.log('Owner cosmetic inventory smoke passed.');

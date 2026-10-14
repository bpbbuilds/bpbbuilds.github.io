#!/usr/bin/env node

/** Verify the animation-lab CSP and generated Supabase origin cannot drift. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const config = await readFile(new URL('js/shared/config.js', root), 'utf8');
const supabase = await readFile(new URL('js/shared/supabase.js', root), 'utf8');
const controller = await readFile(new URL('js/pages/admin/build-creator-animation-test.js', root), 'utf8');
const eventSync = await readFile(new URL('js/pages/events/event-gallery-sync.js', root), 'utf8');
const pagePaths = [
  'admin/test/home/sections/buildCreatorAnimation/index.html',
  'admin/test/home/sections/chooseYourHero/index.html',
  'admin/performance/pages/home/sections/build-creator-animation/index.html',
  'admin/performance/pages/shared/footer/index.html',
];

const origin = config.match(/supabaseUrl:\s*"(https:\/\/[^"/]+)"/)?.[1] || '';
assert.ok(origin, 'generated Supabase origin is present');
assert.match(supabase, /\.\/config\.js\?v=supabase-config-20261013a/, 'Supabase client cache-busts generated config');
assert.match(controller, /api\.js\?v=admin-csp-20261013a/, 'Animation lab forces the current admin API graph');
assert.match(eventSync, /supabase\.js\?v=supabase-client-20261013a/, 'Animation lab event sync uses the current client graph');

for (const pagePath of pagePaths) {
  const html = await readFile(new URL(pagePath, root), 'utf8');
  const policy = html.match(/connect-src\s+([^;]+);/)?.[1] || '';
  assert.ok(policy, `${pagePath}: connect-src directive exists`);
  assert.match(policy, new RegExp(`(?:^|\\s)${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`), `${pagePath}: configured Supabase origin is allowed`);
  assert.doesNotMatch(policy, /xklkysmakrmgtiztsquq\.supabase\.co/, `${pagePath}: stale invalid Supabase origin is not allow-listed`);
}

console.log('Admin test CSP smoke passed.');

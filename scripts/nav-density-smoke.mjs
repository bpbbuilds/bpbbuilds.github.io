#!/usr/bin/env node

/** Contract for the shared desktop navigation density tiers. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [navJs, navCss] = await Promise.all([
  readFile(new URL('js/shared/nav.js', root), 'utf8'),
  readFile(new URL('js/shared/nav.css', root), 'utf8'),
]);

assert.match(navJs, /export function navDesktopScale/, 'shared nav exposes its responsive density helper');
assert.match(navJs, /NAV_SHORT_DESKTOP_MAX_BOOST\s*=\s*0\.15/, '1080p tier is a 15% density correction');
assert.match(navJs, /NAV_DESKTOP_TARGET_HEIGHT\s*=\s*1080/, 'density correction targets 1080p');
assert.match(navJs, /window\.innerWidth, window\.innerHeight/, 'runtime scale uses both viewport dimensions');
assert.match(navCss, /transform:\s*scale\(var\(--bpb-nav-desktop-scale,\s*1\)\)/, 'desktop shell consumes the shared scale');
assert.match(navCss, /@media \(max-width: 1100px\)[\s\S]*?\.site-nav__rail/, 'mobile navigation remains a separate <=1100px layout');

console.log('navigation density smoke passed.');

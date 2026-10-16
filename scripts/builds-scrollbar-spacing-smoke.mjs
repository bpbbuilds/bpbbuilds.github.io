#!/usr/bin/env node

/** Contract for the Builds feed content-to-scrollbar separation. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../js/pages/builds/builds.css', import.meta.url), 'utf8');
const hostStart = css.indexOf('.builds-feed__list-host {');
const hostEnd = css.indexOf('}\n\n/* Same gold scrollbar chrome', hostStart);
assert.ok(hostStart >= 0 && hostEnd > hostStart, 'Builds feed scroll host rule exists');
const host = css.slice(hostStart, hostEnd);
assert.match(host, /padding-bottom:\s*0\.35rem/, 'feed keeps its existing bottom breathing room');
assert.match(host, /padding-inline-end:\s*clamp\(0\.35rem,\s*0\.55vw,\s*0\.65rem\)/, 'feed adds responsive inline-end spacing before the scrollbar');
assert.match(host, /overflow-y:\s*auto/, 'feed remains the scroll container');
assert.match(css, /\.builds-feed__list-host::-webkit-scrollbar\s*\{[\s\S]*?width:\s*16px;/, 'existing scrollbar width remains unchanged');
assert.match(css, /@media \(max-width: 1240px\)[\s\S]*?\.builds-feed__list-host\s*\{[\s\S]*?scrollbar-color:/, 'narrow responsive scrollbar treatment remains active');

console.log('Builds scrollbar spacing smoke passed.');

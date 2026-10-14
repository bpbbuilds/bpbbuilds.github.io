#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'js', 'pages', 'builds', 'builds.css'), 'utf8');
const feed = fs.readFileSync(path.join(root, 'js', 'pages', 'builds', 'feed.js'), 'utf8');

assert.match(feed, /class="build-status builds-feed__empty"/, 'the no-match message uses the builds empty-state hook');
const rule = css.match(/\.builds-feed__empty\s*\{([\s\S]*?)\}/)?.[1] || '';
assert.match(rule, /font-family:\s*var\(--bpb-font-display/, 'empty state uses the nav display font');
assert.match(rule, /color:\s*var\(--bpb-label-fill/, 'empty state uses the outlined white label fill');
assert.match(rule, /text-shadow:\s*var\(--bpb-label-stroke/, 'empty state uses the nav label outline');
assert.match(rule, /font-size:\s*clamp\(/, 'empty state scales with the viewport');
assert.match(rule, /1\.7rem|2rem|2\.4rem|2\.5rem/, 'empty state is visibly larger than body copy');

console.log('builds empty-state style smoke passed.');

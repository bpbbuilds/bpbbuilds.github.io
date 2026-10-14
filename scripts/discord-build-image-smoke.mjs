#!/usr/bin/env node

/** Static contract for Discord build posts: one board image, inside the embed. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../bot/announce.js', import.meta.url), 'utf8');

assert.match(source, /buildThumbPng,\s*hostBoardImage,\s*stillUrl/, 'new build posts can host generated board PNGs');
assert.match(source, /credit\?\.boardImage\s*\|\|\s*image/, 'new build embeds use the hosted board image URL');
assert.doesNotMatch(source, /credit\?\.thumb\s*\?\s*['"]attachment:\/\/build\.png['"]/, 'new build embeds do not point at a loose board attachment');
assert.match(source, /const hostedImage\s*=\s*thumb\s*\?\s*await hostBoardImage/, 'generated board PNGs are uploaded before posting');
assert.match(source, /postBody\(config,\s*build,\s*tagIds,\s*credit\)[\s\S]*?null,\s*\n?\s*\);/, 'new build posts do not send a second board attachment');

console.log('Discord build image smoke passed.');

#!/usr/bin/env node

/** Contract for the lightweight play preview inside build tooltips. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [tipJs, tipCss, animationJs, moreBuilds, boardThumbs, simAnims] = await Promise.all([
  readFile(new URL('js/pages/build/more-build-tip.js', root), 'utf8'),
  readFile(new URL('js/pages/build/more-build-tip.css', root), 'utf8'),
  readFile(new URL('js/pages/build/build-tip-animation.js', root), 'utf8'),
  readFile(new URL('js/pages/build/more-builds.js', root), 'utf8'),
  readFile(new URL('js/pages/builds/board-thumbs.js', root), 'utf8'),
  readFile(new URL('js/pages/sim/fx/sim-item-anims.js', root), 'utf8'),
]);

assert.match(tipJs, /data-build-tip-play/, 'build tooltip includes a play-preview control');
assert.match(tipJs, /Play_normal\.png/, 'build tooltip uses the game play icon');
assert.match(tipJs, /data-build-tip-key[^>]*>Alt</, 'build tooltip identifies the Alt shortcut');
assert.match(tipJs, /aria-keyshortcuts="Alt"/, 'build tooltip exposes the Alt shortcut to assistive technology');
assert.match(tipJs, /keydown/, 'build tooltip listens for the keyboard preview shortcut');
assert.match(tipJs, /preview\??:/, 'tooltip registration accepts preview data');
assert.match(animationJs, /mountPlacedGrid/, 'preview reuses the placed-board renderer');
assert.match(animationJs, /createItemAnims/, 'preview reuses Sim activation animation timing');
assert.match(animationJs, /loadActivationAniMap/, 'preview loads the Sim activation map');
assert.match(animationJs, /sim-item-anims\.css/, 'preview lazy-loads the Sim animation stylesheet');
assert.match(animationJs, /setTimeout|setInterval/, 'preview advances activations on a lightweight clock');
assert.match(
  moreBuilds,
  /registerMoreBuildTip[\s\S]*placements,\s*itemsById,\s*getSpriteUrl/,
  'author More Builds passes board preview data',
);
assert.match(
  boardThumbs,
  /registerMoreBuildTip[\s\S]*placements,\s*itemsById,\s*getSpriteUrl/,
  'feed board thumbnails pass board preview data',
);
assert.match(tipCss, /\.build-more-tip__play[\s\S]*pointer-events:\s*auto/, 'play control is clickable inside the pointer-transparent tip');
assert.match(tipCss, /\.build-more-tip__play-key/, 'play control has a visible shortcut key label');
assert.match(tipCss, /transform:\s*translate\(50%,\s*-50%\)/, 'play control is centered over the board corner');
assert.match(tipCss, /\.build-more-tip__preview-art/, 'preview board has a fixed lightweight layout surface');
assert.match(simAnims, /export function createItemAnims/, 'Sim animation controller remains available');

console.log('build tooltip animation smoke passed.');

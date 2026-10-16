#!/usr/bin/env node

/** Static regression for the shared footer's homepage-preset link treatment. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const footer = await readFile(new URL('js/shared/footer.js', root), 'utf8');
const sharedStyles = await readFile(new URL('css/shared.css', root), 'utf8');
const presetStyles = await readFile(new URL('js/shared/button-preset.css', root), 'utf8');
const homeIndex = await readFile(new URL('index.html', root), 'utf8');

assert.match(sharedStyles, /@import\s+url\(["']\.\.\/js\/shared\/button-preset\.css/, 'shared CSS imports the reusable button preset');
assert.match(footer, /class="home-preset-button site-footer__nav-link site-footer__nav-link--legal"/, 'legal footer links use the preset class');
assert.match(footer, /class="home-preset-button home-preset-button--blue site-footer__nav-link site-footer__nav-link--catalog"/, 'catalog footer links use the blue preset variant');
assert.match(footer, /site-footer__nav-link--legal/, 'footer preserves a semantic legal-link category');
assert.match(footer, /site-footer__nav-link--catalog/, 'footer preserves a semantic catalog-link category');
assert.doesNotMatch(sharedStyles, /\.site-footer__nav\s+a\s*\{[^}]*background:\s*#eac914/, 'footer links no longer use the yellow pill background');
assert.match(presetStyles, /\.home-preset-button::before,\s*\.site-footer__nav\s+a::before[\s\S]*?border:\s*1px\s+solid/, 'preset keeps the inner rim at rest');
assert.match(presetStyles, /\.home-preset-button:hover\s*,[\s\S]*?inset\s+0\s+0\s+0\s+2px\s+var\(--home-preset-gold\)/, 'preset restores the outer gold ring on hover');
assert.match(presetStyles, /\.home-preset-button:hover\s*,[\s\S]*?0\.4rem\s+0\.8rem/, 'preset keeps the outer depth shadow for hover');
assert.match(presetStyles, /\.home-preset-button\.home-preset-button--blue\s*\{/, 'blue preset variant exists');
assert.doesNotMatch(homeIndex, /home-button-preset\.css/, 'Home no longer loads the page-only preset entry point');

console.log('Footer button preset smoke passed.');

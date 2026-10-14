#!/usr/bin/env node

/** Static contract for the Home time-of-day windmill background. */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const indexHtml = await fs.readFile(new URL('index.html', root), 'utf8');
const homeIndex = await fs.readFile(new URL('js/pages/home/index.js', root), 'utf8');
const combatCss = await fs.readFile(new URL('js/pages/home/combat-sky.css', root), 'utf8');

assert.match(indexHtml, /js\/pages\/home\/combat-sky\.css(?:\?[^"']*)?/, 'Home loads the combat sky stylesheet');
assert.doesNotMatch(indexHtml, /js\/pages\/home\/falling-items-background\.css/, 'Home no longer loads the falling-item stylesheet');
assert.match(homeIndex, /import\s+\{\s*initCombatSky\s*\}\s+from\s+['"]\.\/combat-sky\.js['"]/, 'Home imports the time-of-day sky');
assert.match(homeIndex, /\binitCombatSky\(\)/, 'Home boots the time-of-day sky');
assert.doesNotMatch(homeIndex, /initHomeFallingItemsBackground/, 'Home no longer boots falling items');
assert.match(combatCss, /\.combat-sky__windmill\s*\{/, 'Combat sky includes the windmill layer');
assert.match(combatCss, /animation:\s*combat-sky-spin\s+16\.67s\s+linear\s+infinite/, 'Windmill blades keep their animated spin');
assert.match(combatCss, /@keyframes\s+combat-sky-spin\s*\{/, 'Windmill spin keyframes are present');

console.log('Home time-of-day windmill background smoke passed.');

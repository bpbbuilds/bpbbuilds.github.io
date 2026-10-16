#!/usr/bin/env node

/** Static contract for the Home time-of-day windmill background. */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const indexHtml = await fs.readFile(new URL('index.html', root), 'utf8');
const homeIndex = await fs.readFile(new URL('js/pages/home/index.js', root), 'utf8');
const combatCss = await fs.readFile(new URL('js/pages/home/combat-sky.css', root), 'utf8');
const combatIndex = await fs.readFile(new URL('js/pages/home/combat-sky/index.js', root), 'utf8');
const adminBackground = await fs.readFile(new URL('js/pages/admin/background-test.js', root), 'utf8');

assert.match(indexHtml, /js\/pages\/home\/combat-sky\.css(?:\?[^"']*)?/, 'Home loads the combat sky stylesheet');
assert.doesNotMatch(indexHtml, /js\/pages\/home\/falling-items-background\.css/, 'Home no longer loads the falling-item stylesheet');
assert.match(homeIndex, /import\s+\{\s*initCombatSky\s*\}\s+from\s+['"]\.\/combat-sky\.js(?:\?[^'"]*)?['"]/, 'Home imports the time-of-day sky');
assert.match(homeIndex, /\binitCombatSky\(\)/, 'Home boots the time-of-day sky');
assert.match(combatIndex, /T_HOME_NIGHT\s*=\s*25\.8/, 'Home uses the established Night preset time');
assert.match(combatIndex, /mode\s*===\s*['"]scroll['"]/, 'scroll-scrub mode is explicit for the admin preview');
assert.match(combatIndex, /applyTime\(layers,\s*T_HOME_NIGHT\)/, 'Home paints one fixed night frame');
assert.match(adminBackground, /initCombatSky\(\{\s*mode:\s*['"]scroll['"]\s*\}\)/, 'admin background preview keeps scroll mode opt-in');
assert.match(combatCss, /\.combat-sky--fixed-night[\s\S]*?will-change:\s*auto/, 'fixed Home scene releases scroll animation layers');
assert.doesNotMatch(combatCss, /\.combat-sky--fixed-night[^}]*\.combat-sky__blades[\s\S]*?animation:\s*none/, 'fixed Home scene leaves windmill animation enabled');
assert.doesNotMatch(homeIndex, /initHomeFallingItemsBackground/, 'Home no longer boots falling items');
assert.match(combatCss, /\.combat-sky__windmill\s*\{/, 'Combat sky includes the windmill layer');
assert.match(combatCss, /animation:\s*combat-sky-spin\s+16\.67s\s+linear\s+infinite/, 'Windmill blades keep their animated spin');
assert.match(combatCss, /@keyframes\s+combat-sky-spin\s*\{/, 'Windmill spin keyframes are present');

console.log('Home time-of-day windmill background smoke passed.');

#!/usr/bin/env node

/** Contract for the Home static Night first paint and windmill-only boot path. */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const indexHtml = await fs.readFile(new URL('index.html', root), 'utf8');
const themeCss = await fs.readFile(new URL('css/theme.css', root), 'utf8');
const combatIndex = await fs.readFile(new URL('js/pages/home/combat-sky/index.js', root), 'utf8');
const combatDom = await fs.readFile(new URL('js/pages/home/combat-sky/dom.js', root), 'utf8');
const combatCss = await fs.readFile(new URL('js/pages/home/combat-sky.css', root), 'utf8');
const staticFrame = new URL('assets/theme/backgrounds/combat/CombatNightStatic.png', root);

assert.equal(await fs.stat(staticFrame).then(() => true), true, 'static Night frame exists');
assert.match(indexHtml, /rel=["']preload["'][^>]+href=["'][^"']*CombatNightStatic\.png["'][^>]+as=["']image["']/, 'Home preloads the static Night frame');
assert.match(indexHtml, /rel=["']preload["'][^>]+href=["'][^"']*Windmill\.png["'][^>]+as=["']image["']/, 'Home preloads the windmill tower');
assert.match(indexHtml, /rel=["']preload["'][^>]+href=["'][^"']*WindmillBlades\.png["'][^>]+as=["']image["']/, 'Home preloads the windmill blades');
assert.match(themeCss, /--bpb-bg-home-night:[^\n]*CombatNightStatic\.png/, 'Home fallback points at the static Night frame');
assert.match(themeCss, /body\.page-home[\s\S]*?background-image:\s*var\(--bpb-bg-home-night\)/, 'Home body paints the static Night fallback');
assert.match(indexHtml, /combat-sky--preload[\s\S]*data-combat-sky-preload/, 'Home includes a static windmill placeholder in the first-paint HTML');
assert.match(combatIndex, /data-combat-sky-preload/, 'fixed Home boot adopts the first-paint windmill placeholder');
assert.match(combatIndex, /waitForWindmillAssets/, 'fixed Home boot waits for windmill assets before starting motion');
assert.match(combatDom, /windmillOnly\s*=\s*false/, 'scene builder exposes a windmill-only mode');
assert.match(combatDom, /if\s*\(windmillOnly\)/, 'scene builder branches before adding full layered assets');
assert.match(combatCss, /\.combat-sky--fixed-night\s*\{[\s\S]*?background:\s*var\(--bpb-bg-home-night\)/, 'fixed Home host paints the static Night frame');
assert.match(combatCss, /\.combat-sky--preload\s+\.combat-sky__blades[\s\S]*?animation:\s*none/, 'first-paint windmill is visible but paused');
assert.match(combatCss, /animation:\s*combat-sky-spin\s+16\.67s\s+linear\s+infinite/, 'windmill blades remain animated');

console.log('Home background first-paint smoke passed.');

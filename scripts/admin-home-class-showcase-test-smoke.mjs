#!/usr/bin/env node

/** Static smoke for the isolated Choose your hero admin test page. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const page = await readFile(new URL('admin/test/home/sections/chooseYourHero/index.html', root), 'utf8');
const controller = await readFile(new URL('js/pages/admin/home-class-showcase-test.js', root), 'utf8');
const styles = await readFile(new URL('js/pages/admin/home-class-showcase-test.css', root), 'utf8');
const source = await readFile(new URL('js/pages/home/home-class-showcase.js', root), 'utf8');

assert.match(page, /page-admin-home-class-showcase-test/, 'test page has a scoped body class');
assert.match(page, /home-class-showcase\.css/, 'test page loads the live Choose your hero styles');
assert.match(page, /home-class-showcase-test\.css/, 'test page loads isolated preview styles');
assert.match(page, /home-class-showcase-test\.js/, 'test page loads its owner controller');
assert.match(page, /noindex, nofollow/, 'test page is excluded from indexing');
assert.match(page, /connect-src[^;]*xklkysmakrmgtiztsqug\.supabase\.co/, 'test CSP allows the configured data origin');
assert.match(controller, /resolveAdminAuth/, 'test page uses the owner gate');
assert.match(controller, /mountGate/, 'test page renders the shared admin gate');
assert.match(controller, /initHomeClassShowcase/, 'test page mounts the live section implementation');
assert.match(controller, /data-style="home"/, 'test page starts on the Home skin');
assert.match(controller, /id: 'compact'/, 'test page includes a compact preview preset');
assert.match(controller, /id: 'wireframe'/, 'test page includes a wireframe preview preset');
assert.match(controller, /id: 'ranger-idle'/, 'test page includes the Ranger game-idle preset');
assert.match(controller, /setRangerAnimation/, 'test preset can toggle Ranger animation without remounting the rail');
assert.match(styles, /@media \(max-width: 700px\)/, 'test page has a narrow responsive breakpoint');
assert.match(styles, /@media \(max-width: 640px\)/, 'test page has a compact mobile breakpoint');
assert.match(styles, /overflow-x: hidden/, 'test page prevents decorative hero overhang from creating page overflow');
assert.match(source, /Choose your hero/, 'live section source still contains the section heading');
assert.match(source, /data-home-mobs-rail/, 'live section source still contains its card rail');
assert.match(source, /char-ranger-idle\.webp/, 'Ranger game idle asset is wired as an opt-in source');
assert.match(source, /prefers-reduced-motion/, 'Ranger game idle respects reduced-motion users');

console.log('Admin Choose your hero test smoke passed.');

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const pageUrl = new URL('admin/performance/pages/home/sections/build-creator-animation/index.html', root);
const html = await readFile(pageUrl, 'utf8');
const controller = await readFile(new URL('js/pages/admin/build-creator-animation-test.js', root), 'utf8');
const styles = await readFile(new URL('js/pages/admin/build-creator-animation-test.css', root), 'utf8');

assert.match(html, /<main id="main"/i, 'performance lab page has a single main surface');
assert.doesNotMatch(html, /site-(?:nav|footer)|nav\.js|footer\.js/i, 'performance lab page does not mount site navigation or footer');
assert.match(html, /build-creator-animation-test\.js/, 'performance lab page loads the isolated controller');
assert.match(html, /build-creator-animation-test\.css/, 'performance lab page loads the isolated surface styles');
assert.match(html, /data-root="\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/"/, 'performance lab page resolves the repository root');

for (const launcher of ['catalog', 'chest', 'creator']) {
  assert.match(controller, new RegExp(`data-launcher="${launcher}"`), `launcher control exists: ${launcher}`);
}
for (const style of ['home', 'performance', 'wireframe']) {
  assert.match(controller, new RegExp(`data-style="${style}"`), `style control exists: ${style}`);
  assert.match(styles, new RegExp(`data-style=['"]${style}['"]`), `style surface exists: ${style}`);
}
assert.match(controller, /aria-pressed/, 'style controls expose pressed state');
assert.match(controller, /setAttribute\(['"]aria-pressed['"]/, 'style control state updates on selection');
assert.match(styles, /build-creator-animation-test__toolbar/, 'controls use the centered toolbar surface');
assert.match(styles, /justify-content:\s*center/, 'toolbar centers controls');
assert.match(styles, /@media\s*\(max-width:\s*700px\)/, 'narrow viewport layout is explicitly covered');
assert.match(styles, /@media\s*\(max-width:\s*420px\)/, 'mobile viewport layout is explicitly covered');

console.log('Home build-creator performance lab smoke passed.');

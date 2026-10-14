import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const footer = await readFile(new URL('js/shared/footer.js', root), 'utf8');
const homeIndex = await readFile(new URL('js/pages/home/index.js', root), 'utf8');
const homeStyles = await readFile(new URL('js/pages/home/home-builds-vault.css', root), 'utf8');
const pageUrl = new URL('admin/performance/pages/shared/footer/index.html', root);
const page = await readFile(pageUrl, 'utf8');
const controller = await readFile(new URL('js/pages/admin/footer-presets-test.js', root), 'utf8');
const styles = await readFile(new URL('js/pages/admin/footer-presets-test.css', root), 'utf8');

assert.match(footer, /FOOTER_PRESETS/, 'footer exposes a canonical preset registry');
assert.match(footer, /regular:/, 'regular footer preset exists');
assert.match(footer, /slim:/, 'slim footer preset exists');
assert.match(footer, /preset\s*===\s*FOOTER_PRESETS\.slim\.id/, 'footer renderer selects the slim preset');
assert.match(footer, /opts\.preset/, 'footer accepts the canonical preset option');
assert.match(footer, /opts\.variant/, 'legacy variant calls remain supported');

assert.match(homeIndex, /initFooter\(\{\s*preset:\s*['"]regular['"]\s*\}\)/, 'Home explicitly selects the regular footer preset');
assert.match(homeStyles, /body\.page-home #site-footer > \.site-footer[\s\S]*?background:/, 'Home footer has an explicit opaque background boundary');
assert.match(homeStyles, /body\.page-home #site-footer > \.site-footer[\s\S]*?isolation:\s*isolate/, 'Home footer isolates its background from the fixed sky');

assert.match(page, /<main id="main"/i, 'footer preset lab has a single main surface');
assert.doesNotMatch(page, /site-(?:nav|footer)|nav\.js|footer\.js/i, 'footer preset lab does not hard-code site navigation or footer markup');
for (const preset of ['regular', 'slim']) {
  assert.match(controller, new RegExp(`['"]${preset}['"]`), `preset control exists: ${preset}`);
}
assert.match(controller, /initFooter\(\{\s*selector:\s*preview,\s*preset/, 'preview mounts through the shared footer preset API');
assert.match(controller, /aria-pressed/, 'preset controls expose pressed state');
assert.match(styles, /justify-content:\s*center/, 'preset controls are centered');
assert.match(styles, /@media\s*\(max-width:\s*700px\)/, 'footer preset controls cover narrow screens');
assert.match(styles, /@media\s*\(max-width:\s*420px\)/, 'footer preset controls cover mobile screens');

console.log('Admin footer preset smoke passed.');

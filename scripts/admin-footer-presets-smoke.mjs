import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const footer = await readFile(new URL('js/shared/footer.js', root), 'utf8');
const sharedStyles = await readFile(new URL('css/shared.css', root), 'utf8');
const presetStyles = await readFile(new URL('js/shared/button-preset.css', root), 'utf8');
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
assert.match(homeStyles, /body\.page-home #site-footer > \.site-footer[\s\S]*?background-image:\s*url\([^)]*bg-dark-textured\.webp/, 'Home footer has an opaque textured underlay behind the curved edge');
assert.match(homeStyles, /body\.page-home #site-footer > \.site-footer[\s\S]*?isolation:\s*isolate/, 'Home footer isolates its background from the fixed sky');
assert.match(homeStyles, /--home-footer-inverted-top-body-mask:/, 'Home footer defines the inverted top edge curve');
assert.match(homeStyles, /--home-footer-step-height:\s*24px/, 'Home footer uses a fixed desktop edge step');
assert.match(homeStyles, /--home-footer-step-corner:\s*320px/, 'Home footer uses the desktop corner transition');
assert.match(homeStyles, /--home-footer-inverted-top-body-mask:/, 'Home footer keeps the textured layer opaque below the edge step');
assert.match(homeStyles, /--home-footer-inverted-top-center-mask:/, 'Home footer defines the centered edge mask');
assert.match(homeStyles, /body\.page-home #site-footer > \.site-footer::before[\s\S]*?-webkit-mask-image:/, 'Home footer applies the curved mask to its background layer');
assert.match(homeStyles, /body\.page-home #site-footer > \.site-footer::before[\s\S]*?inset:\s*0/, 'Home footer background layer covers the complete footer bounds');
assert.match(homeStyles, /@media\s*\(max-width:\s*768px\)[\s\S]*?--home-footer-step-height:\s*25px/, 'Home footer defines a tablet edge step');
assert.match(homeStyles, /@media\s*\(max-width:\s*400px\)[\s\S]*?mask-image:\s*none/, 'Home footer uses a plain surface on tiny mobile screens');

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
assert.match(sharedStyles, /@import\s+url\(["']\.\.\/js\/shared\/button-preset\.css/, 'shared CSS imports the reusable button preset');
assert.match(footer, /home-preset-button site-footer__nav-link site-footer__nav-link--legal/, 'legal footer links use the preset');
assert.match(footer, /home-preset-button home-preset-button--blue site-footer__nav-link site-footer__nav-link--catalog/, 'catalog footer links use the blue preset');
assert.match(presetStyles, /\.home-preset-button::before,\s*\.site-footer__nav\s+a::before[\s\S]*?border:\s*1px\s+solid/, 'preset keeps the inner rim at rest');
assert.match(presetStyles, /\.home-preset-button:hover\s*,[\s\S]*?inset\s+0\s+0\s+0\s+2px\s+var\(--home-preset-gold\)/, 'preset restores the outer gold ring on hover');
assert.match(presetStyles, /\.home-preset-button\s*,[\s\S]*?border-radius:\s*999px/, 'preset uses pill buttons');

console.log('Admin footer preset smoke passed.');

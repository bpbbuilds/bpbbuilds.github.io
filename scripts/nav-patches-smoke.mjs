import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const markup = await readFile(new URL('js/shared/nav/markup.js', root), 'utf8');
const styles = await readFile(new URL('js/shared/nav.css', root), 'utf8');
const banner = await readFile(new URL('assets/theme/ui/ui-patches-banner.png', root));

assert.match(markup, /site-nav__patches/, 'desktop nav includes the Patches pennant');
assert.match(markup, /site-nav__patches-banner/, 'Patches pennant references its dedicated banner asset');
assert.match(markup, /width="1100"\s+height="1430"/, 'Patches pennant preserves the supplied image dimensions');
assert.match(markup, />Patches<\/span>/, 'Patches pennant has the requested label');
assert.match(markup, /href=\"\$\{root\}patch-notes\//, 'Patches pennant links to the patch notes route');
assert.match(markup, /link\('patch-notes\//, 'mobile drawer includes Patches');
assert.match(styles, /\.site-nav__patches[\s\S]*?width:\s*clamp\(/, 'Patches pennant has responsive sizing');
assert.match(styles, /\.site-nav__patches-banner/, 'Patches banner has shared image styling');
assert.equal(banner.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Patches banner asset is a valid PNG');
assert.ok(banner.length > 100_000, 'Patches banner asset is not an empty placeholder');
assert.doesNotMatch(markup, /ui-patches-banner\.svg/, 'temporary SVG banner is no longer referenced');
assert.doesNotMatch(styles, /ui-patches-banner\.svg/, 'temporary SVG banner is not referenced by styles');

console.log('Navbar Patches banner smoke passed.');

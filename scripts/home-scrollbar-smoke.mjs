import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../css/theme.css', import.meta.url), 'utf8');
const base = css.slice(css.indexOf('html::-webkit-scrollbar {'), css.indexOf('@supports not selector', css.indexOf('html::-webkit-scrollbar {')));
assert.match(base, /html::\-webkit\-scrollbar\s*\{[\s\S]*?width:\s*16px;[\s\S]*?height:\s*16px;/);
assert.match(base, /html::\-webkit\-scrollbar-track\s*\{[\s\S]*?border:\s*3px solid #472a24;[\s\S]*?background:\s*#816230;/);
assert.match(base, /html::\-webkit\-scrollbar-thumb\s*\{[\s\S]*?border:\s*2px solid #472a24;[\s\S]*?background:\s*#eac914;/);

const mobileMarker = '@media (max-width: 1240px)';
const mobileStart = css.indexOf(mobileMarker, css.indexOf('/* Homepage: signature gold scrollbar'));
assert.ok(mobileStart >= 0, 'Home image scrollbar is scoped to the Builds mobile breakpoint');
const homeMobile = css.slice(mobileStart, css.indexOf('/* Items catalog:', mobileStart));
assert.match(homeMobile, /html:has\(body\.page-home\)::\-webkit\-scrollbar\s*\{[\s\S]*?width:\s*16px;[\s\S]*?height:\s*16px;/);
assert.match(homeMobile, /html:has\(body\.page-home\)::\-webkit\-scrollbar-track\s*\{[\s\S]*?track\.png/);
assert.match(homeMobile, /html:has\(body\.page-home\)::\-webkit\-scrollbar-thumb\s*\{[\s\S]*?thumb\.png/);
assert.match(homeMobile, /scrollbar-color:\s*#eac914\s+#472a24/);

console.log('Home scrollbar smoke passed.');

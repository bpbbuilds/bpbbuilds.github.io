import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const assemble = await readFile(new URL('js/pages/home/home-promo-assemble.js', root), 'utf8');
const caption = await readFile(new URL('js/pages/home/home-promo-caption.js', root), 'utf8');
const face = await readFile(new URL('js/shared/blob-face.js', root), 'utf8');
const pool = await readFile(new URL('js/shared/backpack-grid/item-pool.js', root), 'utf8');
const render = await readFile(new URL('js/shared/backpack-grid/render.js', root), 'utf8');

assert.match(assemble, /const assetExtrasCache = new Map\(\)/, 'asset extras are cached at module scope');
assert.match(assemble, /const normalizedBuildCache = new Map\(\)/, 'normalized builds have a memo cache');
assert.match(assemble, /const spriteUrls = new Set\(/, 'sprite URLs are derived from normalized data');
assert.match(assemble, /scheduleCreatorCount/, 'creator counts are deferred through one scheduler');
assert.match(assemble, /token !== activeBuildToken/, 'creator count results are active-build guarded');
assert.match(assemble, /grid\.setResizePaused\?\.\(true\)/, 'Player Info pauses resize paints during its wave');
assert.match(assemble, /grid\.setResizePaused\?\.\(false\)/, 'Player Info releases the resize gate after its wave');
assert.match(caption, /opts\.hideAuthor !== true/, 'hidden caption authors skip face hydration');
assert.match(pool, /function bagFabricInputSignature/, 'bag fabric has a cheap input signature');
assert.match(pool, /data-bpb-fabric-input/, 'bag fabric stores its signature on the mounted node');
assert.match(pool, /before[\s\S]*?bagBodyCells/, 'bag signature check occurs before cell expansion');
assert.match(render, /setResizePaused\(paused\)/, 'placed grids expose a resize pause gate');
assert.match(render, /resizePending/, 'resize notifications are coalesced while paused');
assert.match(render, /pruneParked\(opts = \{\}\)/, 'placed grids expose a scoped parked-node prune');
assert.match(assemble, /grid\.pruneParked\?\./, 'Player Info prunes parked nodes after departure');
assert.match(assemble, /promoCreatorCountCache/, 'creator counts are cached across promo mounts');
assert.match(caption, /hydrateFaces/, 'visible Player Info still hydrates the same face layers');
assert.match(face, /export async function warmFaceAssets/, 'Player Info can prewarm cosmetic image decode');
assert.match(face, /warmedFaceAssets/, 'cosmetic warm-up is URL-cache keyed');
const packedGridSection = render.slice(render.indexOf('export function mountPackedGrid'));
const placedGridSection = render.slice(render.indexOf('export function mountPlacedGrid'));
assert.doesNotMatch(packedGridSection.slice(0, packedGridSection.indexOf('export function mountPlacedGrid')), /let resizePaused\s*=/, 'resize gate state is not attached to packed grids');
assert.match(placedGridSection, /const pool = new Map\(\);[\s\S]*?let resizePaused = false/, 'resize gate state is scoped to placed grids');

console.log('Home promo P1 performance smoke passed.');

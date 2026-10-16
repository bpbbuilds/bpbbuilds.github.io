import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8837;

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html>
      <link rel="stylesheet" href="/js/shared/backpack-grid/backpack-grid.css">
      <main id="board" class="bpb-bg bpb-bg--placed" style="position:relative;width:min(720px,calc(100vw - 32px));aspect-ratio:9/7;margin:16px auto;--bpb-bg-cell:80px">
        <div class="bpb-bg__board" style="width:100%;height:100%"><div id="lines" class="bpb-bg__lines" aria-hidden="true"></div></div>
      </main>
      <div id="mounted" style="width:min(576px,calc(100vw - 32px));height:448px"></div>
      <script type="module">
        import { renderPotionLinks } from '/js/shared/potion-links.js';
        import { paintBoardCanvas } from '/js/shared/board-still/paint.js';
        import { mountBoardStill } from '/js/shared/board-still/index.js';
        import { mountPlacedGrid } from '/js/shared/backpack-grid/index.js';

        const potion = (id) => ({ id, type: 'Potion', shape: [[1], [1]] });
        const items = new Map([['lower', potion('lower')], ['upper', potion('upper')]]);
        const placements = [
          { id: 'lower', key: 'lower-placement', x: 2, y: 3, r: 0 },
          { id: 'upper', key: 'upper-placement', x: 2, y: 1, r: 0 },
        ];

        window.renderLive = () => {
          const layer = document.querySelector('#lines');
          const pairs = renderPotionLinks(layer, { cols: 9, rows: 7, placements, itemsById: items });
          const link = layer.querySelector('.bpb-bg__potion-link');
          const board = document.querySelector('#board').getBoundingClientRect();
          return {
            pairs: pairs.length,
            links: layer.querySelectorAll('.bpb-bg__potion-link').length,
            path: link?.getAttribute('d') || '',
            element: link?.tagName || '',
            fill: link ? getComputedStyle(link).fill : '',
            closed: Boolean(link?.getAttribute('d')?.trim().endsWith('Z')),
            animation: link ? getComputedStyle(link).animationName : '',
            pointerEvents: getComputedStyle(layer).pointerEvents,
            visible: getComputedStyle(layer).visibility,
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            boardRight: board.right,
          };
        };

        window.renderMounted = () => {
          const host = document.querySelector('#mounted');
          host.replaceChildren();
          mountPlacedGrid(host, {
            cols: 9,
            rows: 7,
            cellPx: 64,
            exactBoard: true,
            placements,
            itemsById: items,
            getSpriteUrl: () => '',
          });
          const layer = host.querySelector('.bpb-bg__lines');
          const link = layer?.querySelector('.bpb-bg__potion-link');
          return {
            links: layer?.querySelectorAll('.bpb-bg__potion-link').length || 0,
            visible: layer ? getComputedStyle(layer).visibility : 'missing',
            closed: Boolean(link?.getAttribute('d')?.trim().endsWith('Z')),
          };
        };

        window.renderStatic = async () => {
          const result = await paintBoardCanvas({
            placements,
            itemsById: items,
            getSpriteUrl: () => '',
            loadImage: async () => null,
            cols: 9,
            rows: 7,
            cellPx: 64,
            crop: false,
            bags: false,
            fabric: false,
            shadows: false,
          });
          const ctx = result.canvas.getContext('2d');
          const pixels = ctx.getImageData(0, 0, result.canvas.width, result.canvas.height).data;
          let painted = 0;
          for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) painted += 1;
          return { painted, width: result.canvas.width, height: result.canvas.height };
        };

        window.clearLive = () => {
          const layer = document.querySelector('#lines');
          renderPotionLinks(layer, { cols: 9, rows: 7, placements: [], itemsById: items });
          return {
            links: layer.querySelectorAll('.bpb-bg__potion-link').length,
            visibility: getComputedStyle(layer).visibility,
          };
        };

        window.renderBakedFallback = async () => {
          const host = document.createElement('div');
          document.body.append(host);
          const mounted = mountBoardStill(host, {
            placements,
            itemsById: items,
            getSpriteUrl: () => '',
            root: '/',
            cellPx: 32,
            appear: false,
            bakedUrl: '/legacy-potion-free-board.png',
          });
          const url = await mounted.stillUrl;
          mounted.destroy();
          return url;
        };
      </script>`);
    return;
  }
  const filePath = path.join(ROOT, decodeURIComponent(url.pathname.replace(/^\//, '')));
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  const ext = path.extname(filePath);
  const type = ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
try {
  await page.goto(`http://127.0.0.1:${PORT}/harness`, { waitUntil: 'networkidle' });
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1080, height: 720 },
    { width: 768, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const state = await page.evaluate(() => window.renderLive());
    assert.equal(state.pairs, 1, `one active potion link at ${viewport.width}px`);
    assert.equal(state.links, 1, `one SVG path at ${viewport.width}px`);
    assert.match(state.path, /^M /, `live link has a grid path at ${viewport.width}px`);
    assert.equal(state.element, 'path', `live connector uses a paintable SVG path at ${viewport.width}px`);
    assert.notEqual(state.fill, 'none', `live connector must be filled at ${viewport.width}px`);
    assert.equal(state.closed, true, `live connector must be a closed triangle path at ${viewport.width}px`);
    assert.equal(state.animation, 'bpb-potion-link-flow', `live link animates at ${viewport.width}px`);
    assert.equal(state.pointerEvents, 'none', `live layer is pointer-transparent at ${viewport.width}px`);
    assert.equal(state.visible, 'visible', `live layer is visible at ${viewport.width}px`);
    assert.ok(state.overflow <= 1, `no horizontal overflow at ${viewport.width}px`);
    assert.ok(state.boardRight <= viewport.width + 1, `board fits at ${viewport.width}px`);
  }

  const mounted = await page.evaluate(() => window.renderMounted());
  assert.deepEqual(
    mounted,
    { links: 1, visible: 'visible', closed: true },
    'the shared placed-board integration must paint a visible closed potion connector',
  );

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await page.evaluate(() => window.renderLive());
  assert.equal(reduced.animation, 'none', 'reduced-motion disables connector animation');
  const cleared = await page.evaluate(() => window.clearLive());
  assert.deepEqual(cleared, { links: 0, visibility: 'hidden' }, 'repainting an empty board clears stale links');

  const staticState = await page.evaluate(() => window.renderStatic());
  assert.ok(staticState.painted > 0, 'static board painter draws potion connector pixels');
  const bakedState = await page.evaluate(() => window.renderBakedFallback());
  assert.match(bakedState, /^blob:/, 'active potion boards bypass legacy baked stills');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log('potion interaction lines browser smoke passed');

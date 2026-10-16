#!/usr/bin/env node

/** Verify Round 1 -> previous keeps the label, picker, and board frame synchronized. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8815;
const MIME = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><body>
      <div id="without-video"></div>
      <div id="with-video"></div>
      <script type="module">
        import { mountRoundScrubber } from '/js/pages/build/round-scrubber.js';

        const frames = Array.from({ length: 18 }, (_, i) => ({
          round: i + 1,
          result: i % 2 ? 'loss' : 'win',
          placements: [{ id: 'round-' + (i + 1), x: i, y: 0 }],
        }));

        function mount(id, hasVideo) {
          const events = [];
          const scrubber = mountRoundScrubber(document.querySelector('#' + id), {
            frames,
            root: '/',
            showHistory: true,
            previewMode: true,
            initialIndex: 0,
            hasVideo,
            onChange: (frame, index, meta) => events.push({
              frameRound: frame?.round ?? null,
              placementId: frame?.placements?.[0]?.id ?? null,
              index,
              isVideo: Boolean(meta?.isVideo),
            }),
          });
          return { scrubber, events };
        }

        window.cases = {
          withoutVideo: mount('without-video', false),
          withVideo: mount('with-video', true),
        };
      </script>
    </body></html>`);
    return;
  }
  const filePath = path.join(root, decodeURIComponent(url.pathname.replace(/^\//, '')));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/harness`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.cases?.withoutVideo?.scrubber?.index === 0);

  for (const id of ['withoutVideo', 'withVideo']) {
    const host = id === 'withoutVideo' ? '#without-video' : '#with-video';
    await page.locator(`${host} .build-round__btn--prev`).click();
    const state = await page.evaluate((caseId) => {
      const entry = window.cases[caseId];
      const host = caseId === 'withoutVideo'
        ? document.querySelector('#without-video')
        : document.querySelector('#with-video');
      const selected = host?.querySelector('.build-round-strip__btn.is-selected');
      return {
        index: entry.scrubber.index,
        frameRound: entry.scrubber.frame?.round ?? null,
        label: host?.querySelector('[data-cur]')?.textContent ?? null,
        max: host?.querySelector('[data-max]')?.textContent ?? null,
        selectedIndex: selected?.getAttribute('data-index') ?? null,
        lastEvent: entry.events.at(-1) ?? null,
      };
    }, id);

    assert.equal(state.index, 17, `${id}: previous from Round 1 did not wrap to index 17`);
    assert.equal(state.frameRound, 18, `${id}: board frame did not become Round 18`);
    assert.equal(state.label, '18', `${id}: round label did not become 18`);
    assert.equal(state.selectedIndex, '17', `${id}: Round 18 picker button is not selected`);
    assert.deepEqual(
      state.lastEvent,
      { frameRound: 18, placementId: 'round-18', index: 17, isVideo: false },
      `${id}: board callback did not publish the Round 18 frame`,
    );
    if (id === 'withoutVideo') assert.equal(state.max, '18', 'history max changed for a normal build');
  }

  console.log('build view round wrap smoke: ok');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

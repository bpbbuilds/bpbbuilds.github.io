import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const shareSource = await fs.readFile(
  new URL('../js/pages/build/share.js', import.meta.url),
  'utf8',
);
const server = createServer((req, res) => {
  if (req.url === '/share.js') {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
    res.end(shareSource);
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><button type="button" id="share"><span data-share-label>Share</span></button>
    <script type="module">
      import { bindShareBuild } from '/share.js';
      window.bindShareBuild = bindShareBuild;
    </script>`);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const port = typeof address === 'object' && address ? address.port : 0;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(`http://127.0.0.1:${port}/fixture.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.bindShareBuild === 'function');
  const result = await page.evaluate(async () => {
    const calls = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        async writeText(value) {
          calls.push(['clipboard', value]);
          throw new DOMException('Clipboard permission denied', 'NotAllowedError');
        },
      },
    });
    document.execCommand = (command) => {
      calls.push(['execCommand', command]);
      return command === 'copy';
    };

    const button = document.querySelector('#share');
    window.bindShareBuild(button, { url: () => 'https://example.test/build/demo' });
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 30));
    return {
      calls,
      label: button.querySelector('[data-share-label]')?.textContent,
      copied: button.classList.contains('is-copied'),
    };
  });

  assert.deepEqual(result.calls, [
    ['clipboard', 'https://example.test/build/demo'],
    ['execCommand', 'copy'],
  ]);
  assert.equal(result.label, 'Copied!');
  assert.equal(result.copied, true);
  console.log('build share smoke: ok');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

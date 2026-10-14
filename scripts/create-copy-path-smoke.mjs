import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8813;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  let rel = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!rel || rel.endsWith('/')) rel = path.join(rel, 'index.html');
  const filePath = path.join(ROOT, rel);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto(`http://127.0.0.1:${PORT}/create/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.removeItem('bpb-create-draft:v1');
    sessionStorage.removeItem('bpb-create-onboard-skip:v3');
  });
  await page.reload({ waitUntil: 'networkidle' });
  const copyButton = page.locator('[data-onboard-copy-path]');
  await copyButton.waitFor({ state: 'visible', timeout: 60000 });

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

    const button = document.querySelector('[data-onboard-copy-path]');
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 30));
    return { calls, label: button.textContent?.trim() };
  });

  assert.deepEqual(result.calls, [
    ['clipboard', '%APPDATA%\\Godot\\app_userdata\\Backpack Battles'],
    ['execCommand', 'copy'],
  ]);
  assert.equal(result.label, 'Copied!');
  console.log('create copy path smoke: ok');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

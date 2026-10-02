/**
 * Scrubbing a paused fight must still pop item / damage labels (the game does),
 * and per-activation cooldown rows must not label every item.
 *
 *   node scripts/_audit-sim-scrub-labels.mjs [slug]
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8795;
const OUT = path.join(ROOT, 'scripts/_fixtures');
const SLUG = process.argv[2] || 'bpbb-cool-poison-build-80sj12';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  // The sandbox is premium-gated; grant it so the run controls mount.
  if (url.pathname === '/js/shared/premium-gate.js') {
    const src = fs
      .readFileSync(path.join(ROOT, 'js/shared/premium-gate.js'), 'utf8')
      .replace(
        'export async function getPremiumEntitlement() {',
        'export async function getPremiumEntitlement() {\n' +
          '  return { signedIn: true, entitled: true, profile: { plan: "founding", display_name: "Audit" } };',
      );
    res.writeHead(200, { 'Content-Type': MIME['.js'] });
    res.end(src);
    return;
  }
  let rel = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!rel || rel.endsWith('/')) rel = path.join(rel, 'index.html');
  const filePath = path.join(ROOT, rel);
  if (
    !filePath.startsWith(ROOT) ||
    !fs.existsSync(filePath) ||
    fs.statSync(filePath).isDirectory()
  ) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
  });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const fails = [];
/** @param {string} name @param {boolean} ok @param {string} [detail] */
function check(name, ok, detail = '') {
  if (!ok) fails.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

await page.goto(`http://127.0.0.1:${PORT}/sim/?slug=${SLUG}`, {
  waitUntil: 'domcontentloaded',
});
await page.waitForSelector('.sim-combat-timer__range', { timeout: 30000 });

// Playback: labels pop, and no cooldown label on every activation.
await page.waitForTimeout(4000);
const play = await page.evaluate(() => ({
  labels: document.querySelectorAll('.sim-dn').length,
  cdLabels: [...document.querySelectorAll('.sim-dn__icon')].filter((i) =>
    /Cooldown/i.test(i.getAttribute('src') || ''),
  ).length,
}));
check('playback pops labels', play.labels > 0, JSON.stringify(play));

// Pause + scrub: sweep the timeline and watch for labels at each stop.
const scrub = await page.evaluate(async () => {
  const range = document.querySelector('.sim-combat-timer__range');
  if (!(range instanceof HTMLInputElement)) return { error: 'no range' };
  const max = Number(range.max) || 30;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const seen = [];
  let peak = 0;
  let stopsWithLabels = 0;
  let cdLabels = 0;
  const set = async (v) => {
    range.value = String(v);
    range.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(140);
    const n = document.querySelectorAll('.sim-dn').length;
    cdLabels += [...document.querySelectorAll('.sim-dn__icon')].filter((i) =>
      /Cooldown/i.test(i.getAttribute('src') || ''),
    ).length;
    peak = Math.max(peak, n);
    if (n > 0) stopsWithLabels += 1;
    seen.push({ t: Number(v.toFixed(2)), labels: n });
  };
  // Forward sweep, then back the other way.
  for (let i = 1; i <= 12; i += 1) await set((max * i) / 14);
  for (let i = 11; i >= 1; i -= 2) await set((max * i) / 14);
  return { max, peak, stopsWithLabels, stops: seen.length, cdLabels, seen };
});

check('scrub keeps working', !scrub.error, scrub.error || '');
check(
  'labels pop while scrubbing',
  scrub.peak > 0,
  JSON.stringify({ peak: scrub.peak, stops: scrub.stops }),
);
check(
  'labels show at several stops (both directions)',
  scrub.stopsWithLabels >= 3,
  JSON.stringify({ withLabels: scrub.stopsWithLabels, of: scrub.stops }),
);
check(
  'label burst stays capped',
  scrub.peak <= 36,
  JSON.stringify({ peak: scrub.peak }),
);

await page.screenshot({
  path: path.join(OUT, 'sim-scrub-labels.png'),
  fullPage: false,
});

check('no console errors', errors.length === 0, errors.join(' | ').slice(0, 300));

console.log(
  fails.length ? `\n${fails.length} FAILING:\n- ${fails.join('\n- ')}` : '\nall checks passed',
);
console.log(`shot ${path.join(OUT, 'sim-scrub-labels.png')}`);

await browser.close();
server.close();
process.exit(fails.length ? 1 : 0);

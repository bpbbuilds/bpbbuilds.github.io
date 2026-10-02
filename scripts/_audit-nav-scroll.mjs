/**
 * Nav compact-on-scroll: stage must not layout-animate width/height,
 * and is-scrolled must still swap the compact mark.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8794;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json',
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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.site-nav__logo-swap', { timeout: 20000 });
await page.waitForTimeout(400);

const before = await page.evaluate(() => {
  const swap = document.querySelector('.site-nav__logo-swap');
  const cs = swap ? getComputedStyle(swap) : null;
  const logo = document.querySelector('.site-nav__logo');
  const logoCs = logo ? getComputedStyle(logo) : null;
  return {
    scrolled: document.getElementById('site-nav')?.classList.contains('is-scrolled') || false,
    trans: cs?.transitionProperty || '',
    logoTrans: logoCs?.transitionProperty || '',
    w: swap ? Math.round(swap.getBoundingClientRect().width) : 0,
  };
});

await page.evaluate(() => window.scrollTo(0, 400));
await page.waitForTimeout(280);

const after = await page.evaluate(() => {
  const host = document.getElementById('site-nav');
  const swap = document.querySelector('.site-nav__logo-swap');
  const full = document.querySelector('.site-nav__logo--full');
  const compact = document.querySelector('.site-nav__logo--compact');
  return {
    scrolled: host?.classList.contains('is-scrolled') || false,
    w: swap ? Math.round(swap.getBoundingClientRect().width) : 0,
    fullOp: full ? Number(getComputedStyle(full).opacity) : -1,
    compactOp: compact ? Number(getComputedStyle(compact).opacity) : -1,
    anim: swap?.classList.contains('site-nav__logo-swap--anim') || false,
  };
});

await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(280);

const back = await page.evaluate(() => ({
  scrolled: document.getElementById('site-nav')?.classList.contains('is-scrolled') || false,
}));

await browser.close();
server.close();

const fail = [];
if (/\bwidth\b/.test(before.trans) || /\bheight\b/.test(before.trans)) {
  fail.push(`logo-swap still layout-animates (${before.trans})`);
}
if (/\bfilter\b/.test(before.logoTrans)) {
  fail.push(`logo still transitions filter (${before.logoTrans})`);
}
if (before.scrolled) fail.push('nav started scrolled at top');
if (!after.scrolled) fail.push('scroll did not compact the nav');
if (after.w >= before.w - 8) fail.push(`compact width ${after.w} not smaller than ${before.w}`);
if (after.compactOp < 0.6) fail.push(`compact logo opacity ${after.compactOp}`);
if (after.fullOp > 0.4) fail.push(`full logo still visible (${after.fullOp})`);
if (back.scrolled) fail.push('nav stayed compact after scroll to top');
if (errors.length) fail.push(`page errors: ${errors.join(' | ')}`);

console.log(JSON.stringify({ before, after, back, fail }, null, 2));
if (fail.length) process.exit(1);

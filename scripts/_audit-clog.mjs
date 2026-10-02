/**
 * Screenshot + geometry for the Combat Log chrome (/sim/log-ui/) vs game px.
 * Game targets: FilterPanel 528×119 patch 25; Activations box (68,8)-(513,54);
 * Searchbar 244×40 @ (77,55); OpenButton 44×55 @ (16, h-64).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8778;
const OUT = path.join(ROOT, 'scripts/_fixtures');

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
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
await page.goto(`http://127.0.0.1:${PORT}/sim/log-ui/`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.sim-clog-tab--filter', { timeout: 20000 });
await page.waitForTimeout(500);

await page.locator('.sim-clog-tab--filter').screenshot({ path: path.join(OUT, 'clog-filter.png') });
const oppBox = await page.locator('.sim-clog-tab--opp').boundingBox();
await page.screenshot({
  path: path.join(OUT, 'clog-meter.png'),
  clip: { x: oppBox.x, y: oppBox.y, width: oppBox.width, height: Math.min(oppBox.height, 620) },
  scale: 'css',
});

// Whole composition: flaps hang outside .sim-clog-ui, so clip a padded region
const uiBox = await page.locator('.sim-clog-ui').boundingBox();
await page.screenshot({
  path: path.join(OUT, 'clog-ui.png'),
  clip: {
    x: Math.max(0, uiBox.x - 480),
    y: Math.max(0, uiBox.y - 140),
    width: Math.min(1800, uiBox.width + 970),
    height: uiBox.height + 190,
  },
});

const geo = await page.evaluate(() => {
  const flap = document.querySelector('.sim-clog-tab--filter');
  const fr = flap.getBoundingClientRect();
  const rel = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: +(r.left - fr.left).toFixed(1),
      y: +(r.top - fr.top).toFixed(1),
      right: +(r.right - fr.left).toFixed(1),
      bottom: +(r.bottom - fr.top).toFixed(1),
      w: +r.width.toFixed(1),
      h: +r.height.toFixed(1),
    };
  };
  const px = (sel, prop) => {
    const el = document.querySelector(sel);
    return el ? getComputedStyle(el)[prop] : null;
  };
  return {
    flap: { w: +fr.width.toFixed(1), h: +fr.height.toFixed(1) },
    act: rel('.sim-clog-filter .sim-clog__act'),
    actFont: px('.sim-clog-filter .sim-clog__act', 'fontSize'),
    actWeight: px('.sim-clog-filter .sim-clog__act', 'fontWeight'),
    actStroke: px('.sim-clog-filter .sim-clog__act', 'webkitTextStrokeWidth'),
    arrow: rel('.sim-clog-filter .sim-clog__act img'),
    chev: rel('.sim-clog-tab--filter .sim-clog-tab__chev'),
    search: rel('.sim-clog-filter .sim-clog__search'),
    searchFont: px('.sim-clog-filter .sim-clog__search input', 'fontSize'),
    replay: rel('.sim-clog-filter .sim-clog__replay'),
    btns: [...document.querySelectorAll('.sim-clog-filter .sim-clog__rbtn')].map((b) => {
      const r = b.getBoundingClientRect();
      return {
        id: b.dataset.replay,
        x: +(r.left - fr.left).toFixed(1),
        w: +r.width.toFixed(1),
        h: +r.height.toFixed(1),
      };
    }),
    title: px('.sim-clog-panel .sim-clog__title', 'fontFamily'),
    titleSize: px('.sim-clog-panel .sim-clog__title', 'fontSize'),
    line: px('.sim-clog-panel .sim-clog__line', 'fontSize'),
    row: (() => {
      const r = document.querySelector('.sim-clog-tab--opp .sim-dmg__row');
      if (!r) return null;
      const rr = r.getBoundingClientRect();
      const at = (sel) => {
        const el = r.querySelector(sel);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return {
          x: +(b.left - rr.left).toFixed(1),
          right: +(b.right - rr.left).toFixed(1),
          y: +(b.top - rr.top).toFixed(1),
          w: +b.width.toFixed(1),
          h: +b.height.toFixed(1),
        };
      };
      return {
        size: { w: +rr.width.toFixed(1), h: +rr.height.toFixed(1) },
        name: at('.sim-dmg__name'),
        bar: at('.sim-dmg__bar'),
        pct: at('.sim-dmg__pct'),
        plotbtn: at('.sim-dmg__plotbtn'),
        symbol: at('.sim-dmg__symbol'),
        total: at('.sim-dmg__total'),
        listW: +document
          .querySelector('.sim-clog-tab--opp .sim-dmg__list')
          .getBoundingClientRect()
          .width.toFixed(1),
        plotW: +(
          document.querySelector('.sim-clog-tab--opp .sim-dmg__plot')?.getBoundingClientRect()
            .width || 0
        ).toFixed(1),
      };
    })(),
    panel: (() => {
      // Sink shows extra off-state specimens; hide them for a true header read
      for (const b of document.querySelectorAll('.sim-clog__side:not(.is-on)')) {
        b.style.display = 'none';
      }
      const p = document.querySelector('.sim-clog-panel');
      const pr = p.getBoundingClientRect();
      const at = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          x: +(r.left - pr.left).toFixed(1),
          y: +(r.top - pr.top).toFixed(1),
          right: +(r.right - pr.left).toFixed(1),
          w: +r.width.toFixed(1),
          h: +r.height.toFixed(1),
        };
      };
      return {
        size: { w: +pr.width.toFixed(1), h: +pr.height.toFixed(1) },
        title: at('.sim-clog-panel .sim-clog__title'),
        you: at('.sim-clog-panel .sim-clog__side--you'),
        opp: at('.sim-clog-panel .sim-clog__side--opp'),
        close: at('.sim-clog-panel .sim-clog__close'),
        list: at('.sim-clog-panel .sim-clog__list'),
      };
    })(),
  };
});

console.log(JSON.stringify(geo, null, 2));
console.log('GAME  flap 528x119 | act x68 y8 r513 h46 | chev x16 w44 h55 bottom110 | search x77 y55 244x40');
console.log('GAME  btns back x326 46x39 | end x372 48x45 | start x426 48x45 | play x473 46x39');

// Godot draws Label / MetricList unclipped (rect_clip_content = false), rows are
// ~23px (stylebox content margins 6/2/0/0), scrollbars come from theme 205.
const health = await page.evaluate(() => {
  /** Worst clip any overflow ancestor applies to the element */
  const clipOf = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return 'missing';
    const r = el.getBoundingClientRect();
    let worst = null;
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if ([cs.overflow, cs.overflowX, cs.overflowY].every((v) => v === 'visible')) continue;
      const pr = p.getBoundingClientRect();
      const cut = Math.max(pr.top - r.top, r.bottom - pr.bottom, pr.left - r.left, r.right - pr.right);
      if (cut > 0.5 && (!worst || cut > worst.cut)) {
        worst = { by: String(p.className || p.tagName).split(' ')[0], cut: +cut.toFixed(1) };
      }
    }
    return worst;
  };
  const list = document.querySelector('.sim-clog-panel .sim-clog__list');
  const dmgList = document.querySelector('.sim-clog-tab--opp .sim-dmg__list');
  const lines = [...document.querySelectorAll('.sim-clog-panel .sim-clog__line')].filter(
    (l) => !l.classList.contains('is-minimized'),
  );
  // Godot RichTextLabel autowraps too, so tall rows are fine — a one-line row
  // must land on the game's ~23px box.
  const heights = lines.map((l) => +l.getBoundingClientRect().height.toFixed(1));
  const lineH = Math.min(...heights);
  return {
    lineHMax: Math.max(...heights),
    wrapped: heights.filter((h) => h > lineH * 1.5).length,
    titleClip: clipOf('.sim-clog-panel .sim-clog__title'),
    metricClip: clipOf('.sim-clog-tab--opp .sim-dmg__metric-btn'),
    metricClipYou: clipOf('.sim-clog-tab--you .sim-dmg__metric-btn'),
    lineCount: lines.length,
    lineH: +lineH.toFixed(1),
    linePad: getComputedStyle(lines[0]).padding,
    logBarW: list ? list.offsetWidth - list.clientWidth : null,
    dmgBarW: dmgList ? dmgList.offsetWidth - dmgList.clientWidth : null,
    logScrolls: list ? list.scrollHeight > list.clientHeight + 1 : null,
    dmgScrolls: dmgList ? dmgList.scrollHeight > dmgList.clientHeight + 1 : null,
  };
});
console.log('HEALTH', JSON.stringify(health));

// Collapsed pass — game close(): filter 83×72 at left 0 / 20px behind the log,
// meters 77×115 at top 3 with 14px behind, OpenButton 63×103, Icon 39×32.
for (const id of ['filter', 'you', 'opp']) {
  await page.click(`[data-tab-toggle="${id}"]`);
}
await page.waitForTimeout(300);

const collapsed = await page.evaluate(() => {
  const panel = document.querySelector('.sim-clog-panel');
  const pr = panel.getBoundingClientRect();
  const read = (tab) => {
    const el = document.querySelector(`.sim-clog-tab--${tab}`);
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const kid = (sel) => {
      const k = el.querySelector(sel);
      if (!k) return null;
      const b = k.getBoundingClientRect();
      return {
        x: +(b.left - r.left).toFixed(1),
        y: +(b.top - r.top).toFixed(1),
        right: +(r.right - b.right).toFixed(1),
        bottom: +(r.bottom - b.bottom).toFixed(1),
        w: +b.width.toFixed(1),
        h: +b.height.toFixed(1),
      };
    };
    return {
      w: +r.width.toFixed(1),
      h: +r.height.toFixed(1),
      leftVsPanel: +(r.left - pr.left).toFixed(1),
      rightVsPanelLeft: +(r.right - pr.left).toFixed(1),
      leftVsPanelRight: +(r.left - pr.right).toFixed(1),
      topVsPanel: +(r.top - pr.top).toFixed(1),
      overlapBelowPanelTop: +(r.bottom - pr.top).toFixed(1),
      border: cs.borderWidth,
      zIndex: cs.zIndex,
      chev: kid('.sim-clog-tab__chev'),
      icon: kid('.sim-clog-tab__icon'),
    };
  };
  return {
    panelZ: getComputedStyle(panel).zIndex,
    filter: read('filter'),
    you: read('you'),
    opp: read('opp'),
  };
});
console.log('COLLAPSED', JSON.stringify(collapsed, null, 2));

const checks = [
  ['title unclipped', collapsed && health.titleClip === null],
  ['opp metric unclipped', health.metricClip === null],
  ['you metric unclipped', health.metricClipYou === null],
  ['one-line log row <= 26px', health.lineH <= 26],
  ['log scrollbar 30px', health.logBarW === 0 || health.logBarW === 30],
  ['meter scrollbar 30px', health.dmgBarW === 0 || health.dmgBarW === 30],
  ['filter flap 83x72', collapsed.filter.w === 83 && collapsed.filter.h === 72],
  ['filter flap flush left', Math.abs(collapsed.filter.leftVsPanel) < 0.6],
  ['filter flap 20px behind log', Math.abs(collapsed.filter.overlapBelowPanelTop - 20) < 0.6],
  ['filter flap behind panel', Number(collapsed.filter.zIndex) < Number(collapsed.panelZ)],
  ['filter patch 25px', collapsed.filter.border === '25px'],
  ['filter chev 44x55 @ x16', collapsed.filter.chev.w === 44 && collapsed.filter.chev.h === 55 && Math.abs(collapsed.filter.chev.x - 16) < 0.6],
  ['filter chev 9px off bottom', Math.abs(collapsed.filter.chev.bottom - 9) < 0.6],
  ['you flap 77x115', collapsed.you.w === 77 && collapsed.you.h === 115],
  ['you flap top 3 / right 14 in log', Math.abs(collapsed.you.topVsPanel - 3) < 0.6 && Math.abs(collapsed.you.rightVsPanelLeft - 14) < 0.6],
  ['you patch 28/30/25/24', collapsed.you.border === '28px 30px 25px 24px'],
  ['you chev 63x103 @ y9 r7', collapsed.you.chev.w === 63 && collapsed.you.chev.h === 103 && Math.abs(collapsed.you.chev.y - 9) < 0.6 && Math.abs(collapsed.you.chev.right - 7) < 0.6],
  ['you icon 39x32 @ y62 r21', collapsed.you.icon.w === 39 && Math.abs(collapsed.you.icon.y - 62) < 0.6 && Math.abs(collapsed.you.icon.right - 21) < 0.6],
  ['opp flap 77x115', collapsed.opp.w === 77 && collapsed.opp.h === 115],
  ['opp flap left 15 in log', Math.abs(collapsed.opp.leftVsPanelRight + 15) < 0.6],
  ['opp chev 63x103 @ x5 y9', collapsed.opp.chev.w === 63 && Math.abs(collapsed.opp.chev.x - 5) < 0.6 && Math.abs(collapsed.opp.chev.y - 9) < 0.6],
  ['opp icon @ x20 y63', Math.abs(collapsed.opp.icon.x - 20) < 0.6 && Math.abs(collapsed.opp.icon.y - 63) < 0.6],
];
let failed = 0;
for (const [label, ok] of checks) {
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
}
console.log(failed ? `${failed} check(s) off game px` : 'all checks match game px');

const cBox = await page.locator('.sim-clog-ui').boundingBox();
await page.screenshot({
  path: path.join(OUT, 'clog-collapsed.png'),
  clip: {
    x: Math.max(0, cBox.x - 140),
    y: Math.max(0, cBox.y - 120),
    width: Math.min(1800, cBox.width + 300),
    height: Math.min(560, cBox.height + 160),
  },
});

// Smoke: /sim/ must mount the same chrome without console errors
const errs = [];
const sim = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
sim.on('pageerror', (e) => errs.push(e.message));
sim.on('console', (m) => {
  if (m.type() === 'error') errs.push(m.text());
});
await sim.goto(`http://127.0.0.1:${PORT}/sim/`, { waitUntil: 'domcontentloaded' });
await sim.waitForTimeout(1200);
console.log('SIM console errors:', errs.length ? errs.slice(0, 5) : 'none');

await browser.close();
server.close();

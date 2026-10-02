/**
 * Damage numbers / buff labels vs the game (Interface/DamageNumbers/*,
 * Core/Character.gd, Core/Game.gd).
 *
 * The harness renders two stand-in fighters whose sprites are exactly 336 px
 * tall — the game's combat body box — so 1 CSS px == 1 game px and every
 * assertion can use the raw .tscn / .gd numbers. Math.random is pinned to 0.5
 * so the jitter, flight angle and playback speed are the midpoints.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8789;
const OUT = path.join(ROOT, 'scripts/_fixtures');
const SLUG = process.argv[2] || 'bpbb-cool-poison-build-80sj12';

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

const harness = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="/css/theme.css" />
  <link rel="stylesheet" href="/js/pages/sim/hud/sim-avatars.css" />
  <link rel="stylesheet" href="/js/pages/sim/fx/sim-dmg-numbers.css" />
  <style>
    html, body { margin: 0; background: #f3f4f7; }
    .sim-field {
      position: relative;
      width: 1280px;
      height: 620px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding: 40px 120px;
      box-sizing: border-box;
    }
    /* Body box == game body box: 240 × 336 game px */
    .sim-avatar { width: 240px; }
    .sim-avatar__img {
      width: 240px !important;
      height: 336px !important;
      max-height: none !important;
    }
    .fake-item {
      position: absolute;
      left: 600px;
      top: 420px;
      width: 88px;
      height: 88px;
      background: #6b4a34;
    }
  </style>
</head>
<body data-root="/">
  <div class="sim-field" id="field" style="--bpb-bg-cell: 44px">
    <figure class="sim-avatar sim-avatar--you sim-avatar--dummy" data-sim-avatar="you">
      <img class="sim-avatar__img" data-sim-avatar-img src="/assets/sim/dummy/dummy.png" alt="" />
    </figure>
    <div class="fake-item" id="item"></div>
    <figure class="sim-avatar sim-avatar--foe sim-avatar--dummy" data-sim-avatar="foe">
      <img class="sim-avatar__img" data-sim-avatar-img src="/assets/sim/dummy/dummy.png" alt="" />
    </figure>
  </div>
  <script type="module">
    import { createDamageNumbers } from '/js/pages/sim/fx/sim-dmg-numbers.js';
    import * as G from '/js/pages/sim/fx/sim-dmg-geo.js';
    Math.random = () => 0.5;
    const field = document.getElementById('field');
    window.__G = G;
    window.__dn = createDamageNumbers({
      fieldEl: () => field,
      boardEl: field,
    });
    window.__body = (side) => {
      const img = field.querySelector('[data-sim-avatar="' + side + '"] [data-sim-avatar-img]');
      const lr = field.getBoundingClientRect();
      const ir = img.getBoundingClientRect();
      return { cx: ir.left + ir.width / 2 - lr.left, cy: ir.top + ir.height / 2 - lr.top, h: ir.height };
    };
    window.__ready = true;
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/dn-harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(harness);
    return;
  }
  // /sim/ is premium-gated; unlock it so the live shot actually runs combat.
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
/** @param {string} name @param {number} got @param {number} want @param {number} tol */
function near(name, got, want, tol) {
  check(name, Math.abs(got - want) <= tol, `${got} vs ${want} ±${tol}`);
}

// ---- pure geometry (no DOM) ----
const geo = await import(
  `file:///${path.join(ROOT, 'js/pages/sim/fx/sim-dmg-geo.js').replace(/\\/g, '/')}`
);
check('size curve: 0 dmg → 60', geo.numberFontSize(0) === 60);
check('size curve: 3 dmg → 60', geo.numberFontSize(3) === 60, String(geo.numberFontSize(3)));
check('size curve: 20 dmg → 70', geo.numberFontSize(20) === 70, String(geo.numberFontSize(20)));
check('size curve: 50 dmg → 130', geo.numberFontSize(50) === 130, String(geo.numberFontSize(50)));
check('size curve: 999 dmg → 200', geo.numberFontSize(999) === 200);
near('outline 60 → 4.9', geo.outlineSize(60), 4.9, 0.001);
near('outline 200 → 10.5', geo.outlineSize(200), 10.5, 0.001);
near('ease(0.5, 1) linear', geo.ease(0.5, 1), 0.5, 1e-9);
near('ease(0.5, -2) in-out', geo.ease(0.5, -2), 0.5, 1e-9);
near('ease(0.25, 2) = 0.0625', geo.ease(0.25, 2), 0.0625, 1e-9);
near('Normal scale peaks at 0.47', geo.sampleTrack(geo.ANIMS.Normal.scale, 0.47)[0], 1, 1e-9);
near('Heal starts overbright 1.8', geo.sampleTrack(geo.ANIMS.Heal.mod, 0)[0], 1.8, 1e-9);
check('crit shake is rate 20 / level 50', geo.ANIMS.Critical.shake.rate === 20 && geo.ANIMS.Critical.shake.level === 50);
check('item damage label lives 0.7s', geo.ANIMS.ItemDamage.len === 0.7);
near('item label k follows body, not cell', geo.itemLabelScales(44, 1).k, 1, 1e-9);
near('item label offsets still use cell k', geo.itemLabelScales(44, 1).cellK, 44 / 80, 1e-9);
near('item label falls back to cell k', geo.itemLabelScales(40, 0).k, 0.5, 1e-9);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1320, height: 700 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.goto(`http://127.0.0.1:${PORT}/dn-harness`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ready === true, { timeout: 20000 });
await page.waitForTimeout(400);

/** Freeze rAF so a spawned label can be measured at t = 0. */
const spawnInfo = await page.evaluate(() => {
  const dn = window.__dn;
  const body = window.__body('you');
  dn.number('you', 'damage', 20);
  const el = document.querySelector('.sim-dn');
  const txt = el.querySelector('.sim-dn__txt');
  const cs = getComputedStyle(txt);
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
  return {
    body,
    text: txt.textContent,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    fontFamily: cs.fontFamily,
    color: cs.color,
    stroke: cs.webkitTextStrokeWidth,
    strokeColor: cs.webkitTextStrokeColor,
    paintOrder: cs.paintOrder,
    boxLeft: txt.style.left,
    boxTop: txt.style.top,
    boxWidth: txt.style.width,
    x: m.e,
    y: m.f,
    scale: Math.hypot(m.a, m.b),
    layers: document.querySelectorAll('.sim-dn-layer').length,
    layerPe: getComputedStyle(document.querySelector('.sim-dn-layer')).pointerEvents,
  };
});

check('one label layer, click-through', spawnInfo.layers === 1 && spawnInfo.layerPe === 'none');
check('DealDamage text is bare amount', spawnInfo.text === '20', spawnInfo.text);
check('20 dmg → 70px Baskerville Bold', spawnInfo.fontSize === '70px' && spawnInfo.fontWeight === '700', `${spawnInfo.fontSize} / ${spawnInfo.fontWeight}`);
check('face is Libre Baskerville', /Baskerville/i.test(spawnInfo.fontFamily), spawnInfo.fontFamily);
check('DealDamage is white', spawnInfo.color === 'rgb(255, 255, 255)', spawnInfo.color);
near('outline 5.3 → 10.6px stroke', Number.parseFloat(spawnInfo.stroke), 10.6, 0.05);
check('outline ink #22120c', spawnInfo.strokeColor === 'rgb(34, 18, 12)', spawnInfo.strokeColor);
check('stroke paints under the fill', spawnInfo.paintOrder.startsWith('stroke'), spawnInfo.paintOrder);
check('label box is the 672px [center] rect', spawnInfo.boxLeft === '-336px' && spawnInfo.boxWidth === '672px' && spawnInfo.boxTop === '-27px', `${spawnInfo.boxLeft} ${spawnInfo.boxWidth} ${spawnInfo.boxTop}`);
// DMG_NUM_CENTER is 20 px inward of the body center, jitter midpoint 0
near('spawn x = body center + 20 (inward)', spawnInfo.x, spawnInfo.body.cx + 20, 0.6);
near('spawn y = body center', spawnInfo.y, spawnInfo.body.cy, 0.6);
near('spawn scale 0.1', spawnInfo.scale, 0.1, 0.02);

/** Physics: (0,−660) rotated 12° outward, gravity_scale 12 → g 1200. */
const flight = await page.evaluate(async () => {
  const dn = window.__dn;
  dn.clear();
  const body = window.__body('you');
  dn.number('you', 'damage', 20);
  const el = document.querySelector('.sim-dn');
  const read = () => {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return { x: m.e - body.cx - 20, y: m.f - body.cy, sx: m.a, sy: m.d, rot: Math.atan2(m.b, m.a) };
  };
  const t0 = performance.now();
  await new Promise((r) => setTimeout(r, 300));
  const mid = read();
  const dt = (performance.now() - t0) / 1000;
  return { mid, dt, alive: Boolean(el.isConnected) };
});
const vx = -660 * Math.sin((12 * Math.PI) / 180);
const vy = -660 * Math.cos((12 * Math.PI) / 180);
near('outward drift x = vx·t', flight.mid.x, vx * flight.dt, 12);
near('rise y = vy·t + ½·1200·t²', flight.mid.y, vy * flight.dt + 0.5 * 1200 * flight.dt ** 2, 14);
near('tilt = vx × 0.001 rad', flight.mid.rot, vx * 0.001, 0.02);

const foeDir = await page.evaluate(async () => {
  window.__dn.clear();
  const body = window.__body('foe');
  window.__dn.number('foe', 'damage', 20);
  const el = document.querySelector('.sim-dn');
  await new Promise((r) => setTimeout(r, 200));
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
  return { dx: m.e - body.cx + 20, rot: Math.atan2(m.b, m.a) };
});
check('opponent numbers mirror outward (+x)', foeDir.dx > 10, String(foeDir.dx.toFixed(1)));
check('opponent tilt mirrors', foeDir.rot > 0, String(foeDir.rot.toFixed(3)));

const types = await page.evaluate(async () => {
  const dn = window.__dn;
  const out = {};
  for (const [type, amount] of [
    ['critical', 42],
    ['heal', 12],
    ['poison', 6],
    ['spikes', 6],
    ['fatigue', 9],
    ['loseHealth', 5],
  ]) {
    dn.clear();
    dn.number('you', type, amount);
    const el = document.querySelector('.sim-dn');
    const txt = el.querySelector('.sim-dn__txt');
    const cs = getComputedStyle(txt);
    out[type] = {
      text: txt.textContent,
      color: cs.color,
      fontSize: cs.fontSize,
      glyphs: txt.querySelectorAll('.sim-dn__g').length,
      rot: Math.atan2(
        new DOMMatrixReadOnly(getComputedStyle(el).transform).b,
        new DOMMatrixReadOnly(getComputedStyle(el).transform).a,
      ),
    };
  }
  dn.clear();
  dn.miss('you');
  const missTxt = document.querySelector('.sim-dn__txt');
  out.miss = {
    text: missTxt.textContent,
    fontSize: getComputedStyle(missTxt).fontSize,
    stroke: getComputedStyle(missTxt).webkitTextStrokeWidth,
  };
  dn.clear();
  dn.statusLabel('you', { text: 'STUNNED 1.5s', tone: 'negative' });
  const stun = document.querySelector('.sim-dn__txt');
  out.stun = { text: stun.textContent, color: getComputedStyle(stun).color };
  dn.clear();
  dn.itemLabel(document.getElementById('item'), {
    anim: 'ItemBuff',
    color: window.__G.BUFF_LABEL.positive,
    text: '+2',
    icon: '/assets/icons/status/buff/Lucky.png',
  });
  const item = document.querySelector('.sim-dn__txt');
  out.item = {
    text: item.textContent,
    color: getComputedStyle(item).color,
    // BuffLabel font 40 in UINode space (harness body is 1:1 game px)
    fontSize: getComputedStyle(item).fontSize,
    icon: item.querySelector('.sim-dn__icon')?.style.height,
  };
  dn.clear();
  dn.itemLabel(document.getElementById('item'), {
    anim: 'ItemDamage',
    color: '#ffffff',
    text: 'MISS',
  });
  const itemMiss = document.querySelector('.sim-dn__txt');
  out.itemMiss = { text: itemMiss.textContent, animLen: window.__G.ANIMS.ItemDamage.len };
  dn.clear();
  dn.itemLabel(document.getElementById('item'), {
    anim: 'StatChange',
    color: window.__G.BUFF_LABEL.positive,
    text: '+8%',
    icon: '/assets/icons/sim/stats/HealEfficiency.png',
    iconSize: window.__G.STAT_ICON,
  });
  const stat = document.querySelector('.sim-dn__txt');
  out.stat = {
    text: stat.textContent,
    icon: stat.querySelector('.sim-dn__icon')?.style.height,
    len: window.__G.ANIMS.StatChange.len,
  };
  dn.clear();
  const layer = document.querySelector('.sim-dn-layer');
  const lcs = getComputedStyle(layer);
  out.layer = { overflow: lcs.overflow, z: lcs.zIndex, contain: lcs.contain };
  return out;
});

check('crit is #ff1a1a', types.critical.color === 'rgb(255, 26, 26)', types.critical.color);
check('crit shakes per glyph', types.critical.glyphs === 2, String(types.critical.glyphs));
check('42 dmg → 110px', types.critical.fontSize === '110px', types.critical.fontSize);
check('heal is +N green', types.heal.text === '+12' && types.heal.color === 'rgb(56, 237, 56)', `${types.heal.text} ${types.heal.color}`);
near('heal numbers do not tilt', types.heal.rot, 0, 1e-6);
check('poison #81ff1a', types.poison.color === 'rgb(129, 255, 26)', types.poison.color);
check('spikes #3bb932', types.spikes.color === 'rgb(59, 185, 50)', types.spikes.color);
check('fatigue #8e64bd', types.fatigue.color === 'rgb(142, 100, 189)', types.fatigue.color);
check('lose health #e27878', types.loseHealth.color === 'rgb(226, 120, 120)', types.loseHealth.color);
check('miss label is MISS at 40px / 8px outline', types.miss.text === 'MISS' && types.miss.fontSize === '40px' && Number.parseFloat(types.miss.stroke) === 8, `${types.miss.text} ${types.miss.fontSize} ${types.miss.stroke}`);
check('stun label uses the negative tone', types.stun.color === 'rgb(255, 144, 144)', types.stun.color);
check('item stack label carries the stack icon', types.item.icon === '40px', String(types.item.icon));
near('item label font matches UINode 40px', Number.parseFloat(types.item.fontSize), 40, 0.6);
check('item miss uses ItemDamage + MISS', types.itemMiss.text === 'MISS' && types.itemMiss.animLen === 0.7, JSON.stringify(types.itemMiss));
check('StatChange lives 1.5s', types.stat.len === 1.5, String(types.stat.len));
near('stat icon is 50 game px', Number.parseFloat(types.stat.icon), 50, 0.6);
check('label layer does not clip item pops', types.layer.overflow === 'visible' && Number(types.layer.z) >= 12, JSON.stringify(types.layer));
check('StatChange / ItemBuff / ItemDamage exist', geo.ANIMS.StatChange && geo.ANIMS.ItemBuff && geo.ANIMS.ItemDamage);

/** HitAnimation: multiply tint + squash on the fighter that was hit. */
const hitFx = await page.evaluate(async () => {
  const dn = window.__dn;
  const img = document.querySelector('[data-sim-avatar="foe"] [data-sim-avatar-img]');
  dn.hit('foe', 'Hit');
  await new Promise((r) => setTimeout(r, 70));
  const mid = {
    tint: img.style.getPropertyValue('--sim-av-tint'),
    matrix: document.querySelector('#sim-dn-tint-foe feColorMatrix')?.getAttribute('values'),
    sx: img.style.getPropertyValue('--sim-av-sx'),
    sy: img.style.getPropertyValue('--sim-av-sy'),
    filter: getComputedStyle(img).filter,
  };
  await new Promise((r) => setTimeout(r, 300));
  return {
    mid,
    after: {
      tint: img.style.getPropertyValue('--sim-av-tint'),
      matrix: document.querySelector('#sim-dn-tint-foe feColorMatrix')?.getAttribute('values'),
      sx: img.style.getPropertyValue('--sim-av-sx'),
    },
  };
});
check('hit tint filter is applied', hitFx.mid.tint.includes('sim-dn-tint-foe'), hitFx.mid.tint);
check('tint keeps the drop shadows', /drop-shadow/.test(hitFx.mid.filter), hitFx.mid.filter.slice(0, 80));
const midMatrix = (hitFx.mid.matrix || '').split(/\s+/).map(Number);
check('tint multiplies green/blue down (Hit = 1, .65, .65)', midMatrix[0] === 1 && midMatrix[6] < 0.9 && midMatrix[6] > 0.6, hitFx.mid.matrix);
check('squash is authored 1.03 × 0.97', Number(hitFx.mid.sx) > 1 && Number(hitFx.mid.sy) < 1, `${hitFx.mid.sx} / ${hitFx.mid.sy}`);
check('hit resets after 0.2s', hitFx.after.tint === '' && hitFx.after.sx === '' && hitFx.after.matrix === '1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0', `${hitFx.after.tint} ${hitFx.after.matrix}`);

/** Poison tint outranks a Hit tint, like Character.takeDamage. */
const poisonGuard = await page.evaluate(async () => {
  const dn = window.__dn;
  dn.hit('you', 'Poison');
  await new Promise((r) => setTimeout(r, 40));
  dn.hit('you', 'Hit');
  await new Promise((r) => setTimeout(r, 20));
  const m = (document.querySelector('#sim-dn-tint-you feColorMatrix')?.getAttribute('values') || '')
    .split(/\s+/)
    .map(Number);
  return { r: m[0], g: m[6] };
});
check('running Poison tint is not replaced by Hit', poisonGuard.r < 0.95 && poisonGuard.g > 0.95, JSON.stringify(poisonGuard));

/** Attack lunge: inward, 100–160 px out at 2600 px/s, back at 1000 px/s. */
const lungeFx = await page.evaluate(async () => {
  const you = document.querySelector('[data-sim-avatar="you"] [data-sim-avatar-img]');
  const foe = document.querySelector('[data-sim-avatar="foe"] [data-sim-avatar-img]');
  window.__dn.lunge('you');
  window.__dn.lunge('foe');
  // Forward leg is only ~50 ms (130 px at 2600 px/s) — sample every frame.
  const peak = { you: 0, foe: 0 };
  for (let i = 0; i < 14; i++) {
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const dy = Number.parseFloat(you.style.getPropertyValue('--sim-av-dx')) || 0;
    const df = Number.parseFloat(foe.style.getPropertyValue('--sim-av-dx')) || 0;
    if (Math.abs(dy) > Math.abs(peak.you)) peak.you = dy;
    if (Math.abs(df) > Math.abs(peak.foe)) peak.foe = df;
  }
  await new Promise((r) => setTimeout(r, 300));
  const rest = {
    you: you.style.getPropertyValue('--sim-av-dx'),
    foe: foe.style.getPropertyValue('--sim-av-dx'),
  };
  window.__dn.hop('you');
  let hop = 0;
  for (let i = 0; i < 16; i++) {
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const dy = Number.parseFloat(you.style.getPropertyValue('--sim-av-dy')) || 0;
    if (Math.abs(dy) > Math.abs(hop)) hop = dy;
  }
  await new Promise((r) => setTimeout(r, 250));
  return { peak, rest, hop, hopRest: you.style.getPropertyValue('--sim-av-dy') };
});
near('you lunge inward ~130px', lungeFx.peak.you, 130, 25);
near('foe lunge mirrors', lungeFx.peak.foe, -130, 25);
check('lunge returns to rest', lungeFx.rest.you === '' && lungeFx.rest.foe === '', `${lungeFx.rest.you}|${lungeFx.rest.foe}`);
near('activate hop is 40px up', lungeFx.hop, -40, 8);
check('hop returns to rest', lungeFx.hopRest === '', lungeFx.hopRest);

/** Contact sheet: one of each label mid-flight. */
await page.evaluate(async () => {
  const dn = window.__dn;
  dn.clear();
  dn.number('you', 'damage', 18);
  dn.number('you', 'critical', 64);
  dn.number('you', 'heal', 9);
  dn.number('foe', 'damage', 120);
  dn.number('foe', 'poison', 7);
  dn.number('foe', 'spikes', 4);
  dn.miss('foe');
  dn.statusLabel('you', { text: 'STUNNED 1.5s', tone: 'negative' });
  dn.itemLabel(document.getElementById('item'), {
    anim: 'ItemDamage',
    color: '#ffffff',
    text: '18',
  });
  dn.hit('foe', 'Hit');
  dn.lunge('you');
  await new Promise((r) => setTimeout(r, 260));
});
await page.screenshot({ path: path.join(OUT, 'dmg-numbers-audit.png') });

check('no console errors', errors.length === 0, errors.join(' | ').slice(0, 300));

/** Live /sim/ — catch labels during real playback. */
const live = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const liveErrors = [];
live.on('pageerror', (e) => liveErrors.push(e.message));
live.on('console', (m) => {
  if (m.type() === 'error') liveErrors.push(m.text());
});
await live.goto(`http://127.0.0.1:${PORT}/sim/?slug=${SLUG}`, { waitUntil: 'domcontentloaded' });
await live.waitForSelector('.sim-hud[data-hud="player"]', { timeout: 30000 });
let seen = 0;
for (let i = 0; i < 40; i++) {
  await live.waitForTimeout(150);
  seen = await live.evaluate(() => document.querySelectorAll('.sim-dn').length);
  if (seen >= 2) break;
}
await live.screenshot({ path: path.join(OUT, 'dmg-numbers-page.png') });
check('labels appear during live playback', seen >= 1, `${seen} on screen`);
const liveItems = await live.evaluate(() => {
  const labels = [...document.querySelectorAll('.sim-dn__txt')].map((el) => ({
    text: (el.textContent || '').trim(),
    hasIcon: Boolean(el.querySelector('.sim-dn__icon')),
  }));
  return {
    count: labels.length,
    withIcon: labels.filter((l) => l.hasIcon).length,
    texts: labels.map((l) => l.text).slice(0, 8),
  };
});
check('live item/character labels have text', liveItems.count >= 1, JSON.stringify(liveItems));
const liveGeo = await live.evaluate(() => {
  const layer = document.querySelector('.sim-dn-layer');
  const field = document.querySelector('.sim-field');
  const you = document.querySelector('[data-sim-avatar="you"] [data-sim-avatar-img]');
  const r = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { w: +b.width.toFixed(1), h: +b.height.toFixed(1) };
  };
  return {
    layer: r(layer),
    field: r(field),
    bodyH: r(you)?.h ?? 0,
    inField: layer?.parentElement === field,
  };
});
check('layer covers the field', liveGeo.inField && liveGeo.layer?.h === liveGeo.field?.h, JSON.stringify(liveGeo));
check('live body scale is sane', liveGeo.bodyH > 120, `${liveGeo.bodyH}px tall`);
check('no console errors on /sim/', liveErrors.length === 0, liveErrors.join(' | ').slice(0, 300));

console.log('\nshots:', path.join(OUT, 'dmg-numbers-audit.png'), '|', path.join(OUT, 'dmg-numbers-page.png'));
console.log(fails.length ? `\n${fails.length} FAILING:\n- ${fails.join('\n- ')}` : '\nall checks passed');

await browser.close();
server.close();
process.exit(fails.length ? 1 : 0);

/**
 * Combat HUD vs game Core/Character.tscn `CombatUI`.
 *
 * Renders the web HUD at --hud-k: 1 (game px) with live values, then asserts
 * every rect against the .tscn margins. Also writes a reference render built
 * straight from the extracted game textures for eyeballing.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8785;
const OUT = path.join(ROOT, 'scripts/_fixtures');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

const SNAP_YOU = {
  hp: 8800,
  maxHp: 20000,
  stamina: 6.53,
  maxStamina: 8,
  block: 40,
  regeneration: 4,
  lucky: 2,
  spikes: 3,
  vampirism: 1,
  mana: 9,
  heat: 6,
  empower: 2,
  protection: 1,
  poison: 3,
  blind: 1,
  cold: 2,
  weak: 1,
  combatStats: {
    heal_efficiency: 25,
    damage_resistance: 10,
    melee_dmg_factor: 15,
    unhealing: 15,
    crit_stacks: 2,
    dodge_stacks: 1,
    stamina_regen: 20,
  },
};

const SNAP_FOE = {
  hp: 200000,
  maxHp: 1200000,
  stamina: 5,
  maxStamina: 5,
  block: 99999,
  regeneration: 0,
  lucky: 0,
  spikes: 40,
  vampirism: 0,
  mana: 0,
  heat: 0,
  empower: 0,
  protection: 0,
  poison: 120,
  blind: 0,
  cold: 0,
  weak: 0,
  combatStats: { damage_resistance: 30, effect_dmg_factor: -20 },
};

const harness = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="/css/theme.css" />
  <link rel="stylesheet" href="/js/pages/sim/sim.css" />
  <link rel="stylesheet" href="/js/pages/sim/hud/sim-avatars.css" />
  <link rel="stylesheet" href="/js/pages/sim/hud/sim-hud.css" />
  <style>
    html, body { margin: 0; background: #f3f4f7; }
    body.page-sim { height: auto; max-height: none; overflow: auto; }
    .hud-harness { padding: 40px; }
    .sim-field__hud { position: relative; transform: none; bottom: auto; }
    /* Audit at game scale so CSS px == game px */
    .sim-hud { --hud-k: 1; }
    .sim-hud-row { display: flex; justify-content: center; width: auto; }
  </style>
</head>
<body class="page-sim" data-root="/">
  <div class="hud-harness">
    <section class="sim-region sim-region--hud sim-field__hud">
      <div class="sim-hud-row" id="hud"></div>
    </section>
  </div>
  <script type="module">
    import { actorHudHtml, bindActorHud } from '/js/pages/sim/hud/sim-hud.js';
    const root = '/';
    const host = document.getElementById('hud');
    host.innerHTML =
      actorHudHtml('player', 'ttv/smojolol', 'player', root, 'pyromancer') +
      actorHudHtml('dummy', 'Garfieldkart', 'opponent', root, 'reaper');
    const you = bindActorHud(host.querySelector('[data-hud="player"]'), root);
    const foe = bindActorHud(host.querySelector('[data-hud="dummy"]'), root);
    you.apply(${JSON.stringify(SNAP_YOU)}, 0);
    foe.apply(${JSON.stringify(SNAP_FOE)}, 0);
    window.__hudReady = true;
  </script>
</body>
</html>`;

/** Reference render: game textures at raw .tscn coordinates. */
const reference = `<!DOCTYPE html>
<html><head><meta charset="UTF-8" /><style>
  html, body { margin: 0; background: #f3f4f7; }
  .ref { position: relative; width: 1180px; height: 592px; }
  .ref img { position: absolute; }
</style></head><body>
<div class="ref" id="ref"></div>
<script type="module">
  // CombatUI-local coords → stage px (x − sheetLeft, y + 298)
  const G = '/tools/game-extract-full/';
  const put = (src, cx, cy, w, h, flip, dx) =>
    \`<img src="\${G}\${src}" style="left:\${(cx - w / 2 + dx).toFixed(2)}px;top:\${(cy - h / 2).toFixed(2)}px;width:\${w}px;height:\${h}px\${flip ? ';transform:scaleX(-1)' : ''}" />\`;
  let html = '';
  // player card at dx 0, opponent card shifted right by 573 − 96
  html += put('Assets/Character/CombatSheet.png', 286.26, 258, 572.51, 506, false, 0);
  html += put('Interface/Combat/NameBanner_Pyromancer.png', 279.26, 73, 498.48, 125, false, 0);
  html += put('Assets/Character/Sword.png', 510.26, 58, 96.73, 116, false, 0);
  html += put('Assets/Character/CombatSheet_Opponent.png', 286.75, 258, 573.49, 507, false, 477);
  html += put('Interface/Combat/NameBanner_Reaper.png', 293.75, 72, 498.48, 125, true, 477);
  html += put('Assets/Character/Sword.png', 55.75, 59, 96.73, 116, true, 477);
  document.getElementById('ref').innerHTML = html;
</script></body></html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/hud-harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(harness);
    return;
  }
  if (url.pathname === '/hud-reference') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(reference);
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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
await page.goto(`http://127.0.0.1:${PORT}/hud-harness`, {
  waitUntil: 'domcontentloaded',
});
await page.waitForFunction(() => window.__hudReady === true, { timeout: 20000 });
await page.waitForTimeout(700);

await page.locator('.sim-hud-row').screenshot({ path: path.join(OUT, 'sim-hud-audit.png') });

const geo = await page.evaluate(() => {
  const stage = document.querySelector('.sim-hud[data-hud="player"] .sim-hud__stage');
  const base = stage.getBoundingClientRect();
  /** rect in stage px */
  const R = (sel, hud = 'player') => {
    const el = document.querySelector(`.sim-hud[data-hud="${hud}"] ${sel}`);
    if (!el) return null;
    const o = document
      .querySelector(`.sim-hud[data-hud="${hud}"] .sim-hud__stage`)
      .getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {
      left: +(r.left - o.left).toFixed(2),
      top: +(r.top - o.top).toFixed(2),
      w: +r.width.toFixed(2),
      h: +r.height.toFixed(2),
    };
  };
  const font = (sel, hud = 'player') => {
    const el = document.querySelector(`.sim-hud[data-hud="${hud}"] ${sel}`);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      px: Math.round(parseFloat(cs.fontSize)),
      weight: cs.fontWeight,
      stroke: cs.webkitTextStrokeWidth,
      family: cs.fontFamily.split(',')[0].replace(/"/g, ''),
    };
  };
  return {
    stageW: +base.width.toFixed(2),
    stageH: +base.height.toFixed(2),
    sheet: R('.sim-hud__sheet'),
    sheetFoe: R('.sim-hud__sheet', 'dummy'),
    banner: R('.sim-hud__banner'),
    bannerFoe: R('.sim-hud__banner', 'dummy'),
    name: R('.sim-hud__name'),
    sword: R('.sim-hud__sword'),
    swordFoe: R('.sim-hud__sword', 'dummy'),
    hpBar: R('.sim-hud__bar--hp'),
    hpBarFoe: R('.sim-hud__bar--hp', 'dummy'),
    hpBorder: R('.sim-hud__bar-border'),
    stamBar: R('.sim-hud__bar--stam'),
    regen: R('[data-hud-counter="regeneration"] .sim-hud__counter-icon'),
    protection: R('[data-hud-counter="protection"] .sim-hud__counter-icon'),
    weak: R('[data-hud-counter="weak"] .sim-hud__counter-icon'),
    blockIcon: R('[data-hud-counter="block"] .sim-hud__counter-icon'),
    blockIconFoe: R('[data-hud-counter="block"] .sim-hud__counter-icon', 'dummy'),
    statIcon: R('.sim-hud__stat-icon'),
    statIconFoe: R('.sim-hud__stat-icon', 'dummy'),
    nameFont: font('.sim-hud__name'),
    labelFont: font('.sim-hud__label'),
    countFont: font('.sim-hud__counter-num'),
    blockLayer: (() => {
      const hud = document.querySelector('.sim-hud[data-hud="dummy"]');
      const over = hud?.querySelector('.sim-hud__over');
      const z = (el) => (el ? parseInt(getComputedStyle(el).zIndex, 10) : NaN);
      return {
        inOverLayer: !!over?.querySelector('[data-hud-counter="block"]'),
        over: z(over),
        banner: z(hud?.querySelector('.sim-hud__banner')),
        sword: z(hud?.querySelector('.sim-hud__sword')),
        body: z(hud?.querySelector('.sim-hud__body')),
      };
    })(),
    hpText: document.querySelector('.sim-hud[data-hud="dummy"] [data-hud-hp]')?.textContent,
    stamText: document.querySelector('.sim-hud[data-hud="player"] [data-hud-stam]')?.textContent,
    blockText: document.querySelector(
      '.sim-hud[data-hud="dummy"] [data-hud-counter="block"] .sim-hud__counter-num',
    )?.textContent,
    activeStats: document.querySelectorAll('.sim-hud[data-hud="player"] .sim-hud__stat').length,
    fills: {
      youHp: document.querySelector('.sim-hud[data-hud="player"] [data-hud-hp-fill]')?.style
        .width,
      foeHp: document.querySelector('.sim-hud[data-hud="dummy"] [data-hud-hp-fill]')?.style
        .width,
      youStam: document.querySelector('.sim-hud[data-hud="player"] [data-hud-stam-fill]')?.style
        .width,
      foeStam: document.querySelector('.sim-hud[data-hud="dummy"] [data-hud-stam-fill]')?.style
        .width,
    },
    hiddenBuffs: [...document.querySelectorAll('.sim-hud[data-hud="dummy"] [data-hud-counter]')]
      .filter((el) => !el.classList.contains('is-on'))
      .map((el) => el.getAttribute('data-hud-counter')),
  };
});

const checks = [];

// Counter art must be the game texture itself — our older crops were the wrong
// icon (Empower_single, tight Block / Poison) and broke the sprite aspect.
const GAME_BUFFS = path.join(ROOT, 'tools/game-extract-full/Assets/Buffs');
if (fs.existsSync(GAME_BUFFS)) {
  const stale = fs
    .readdirSync(path.join(ROOT, 'assets/icons/status/buff'))
    .filter((f) => f.endsWith('.png'))
    .filter((f) => {
      const twin = path.join(GAME_BUFFS, f);
      return (
        fs.existsSync(twin) &&
        !fs.readFileSync(path.join(ROOT, 'assets/icons/status/buff', f)).equals(fs.readFileSync(twin))
      );
    });
  checks.push(
    stale.length
      ? `FAIL buff icons match Assets/Buffs — stale: ${stale.join(', ')}`
      : 'OK   buff icons match Assets/Buffs',
  );
}

const near = (a, b, tol = 1.2) => Number.isFinite(a) && Math.abs(a - b) <= tol;
const ok = (label, pass, got) =>
  checks.push(`${pass ? 'OK  ' : 'FAIL'} ${label}${pass ? '' : ` — got ${got}`}`);
const rectOk = (label, r, exp, tol = 1.2) =>
  ok(
    label,
    r && near(r.left, exp.left, tol) && near(r.top, exp.top, tol) && near(r.w, exp.w, tol) && near(r.h, exp.h, tol),
    JSON.stringify(r),
  );

// Game Character.tscn / Opponent.tscn rects in stage px
rectOk('sheet 572.51x506 @ 0,5', geo.sheet, { left: 0, top: 5, w: 572.51, h: 506 });
rectOk('opp sheet 573.49x507 @ 0,4.5', geo.sheetFoe, { left: 0, top: 4.5, w: 573.49, h: 507 });
rectOk('banner 498.5x125 @ 30,10.5', geo.banner, { left: 30.01, top: 10.5, w: 498.48, h: 125 });
rectOk('opp banner @ 44.5,9.5', geo.bannerFoe, { left: 44.51, top: 9.5, w: 498.48, h: 125 });
rectOk('name 403x51 @ 86.3,58', geo.name, { left: 86.26, top: 58, w: 403, h: 51 });
rectOk('sword 96.7x116 @ 461.9,0', geo.sword, { left: 461.89, top: 0, w: 96.73, h: 116 });
rectOk('opp sword @ 7.4,1', geo.swordFoe, { left: 7.39, top: 1, w: 96.73, h: 116 });
rectOk('health bar 216x33 @ 241.3,134', geo.hpBar, { left: 241.26, top: 134, w: 216, h: 33 });
rectOk('opp health bar shifted -32.5', geo.hpBarFoe, {
  left: 208.76,
  top: 134,
  w: 216,
  h: 33,
});
rectOk('bar border 223x41 @ 238.3,129.6', geo.hpBorder, {
  left: 238.25,
  top: 129.63,
  w: 222.96,
  h: 41,
});
rectOk('stamina bar 214x35 @ 244.3,182', geo.stamBar, {
  left: 244.26,
  top: 182,
  w: 214,
  h: 35,
});

// StackCounter sprites: size × BlockHud.calcScale(value)
const scaled = (w, h, v, thr = 50) => {
  let x = v;
  if (x > thr) x = thr + (x - thr) ** 0.65;
  const k = 0.5 + Math.sqrt(x / 100);
  return { w: +(w * k).toFixed(2), h: +(h * k).toFixed(2), k };
};
const regenExp = scaled(68.8, 59.14, 4);
ok(
  `regeneration 4 stacks scales to ${regenExp.w}x${regenExp.h}`,
  geo.regen && near(geo.regen.w, regenExp.w, 1) && near(geo.regen.h, regenExp.h, 1),
  JSON.stringify(geo.regen),
);
const blockYouExp = scaled(80.27, 85.93, 40, 250);
ok(
  `block 40 scales to ${blockYouExp.w}x${blockYouExp.h}`,
  geo.blockIcon && near(geo.blockIcon.w, blockYouExp.w, 1),
  `${JSON.stringify(geo.blockIcon)} want w ${blockYouExp.w}`,
);
const blockFoeExp = scaled(80.27, 85.93, 99999, 250);
ok(
  'block 99999 uses scaleThreshold 250',
  geo.blockIconFoe && near(geo.blockIconFoe.w, blockFoeExp.w, 2),
  `${JSON.stringify(geo.blockIconFoe)} want w ${blockFoeExp.w}`,
);
ok(
  'block paints over banner / sword / bars (game z_index 3)',
  geo.blockLayer.inOverLayer &&
    geo.blockLayer.over > geo.blockLayer.banner &&
    geo.blockLayer.over > geo.blockLayer.sword &&
    geo.blockLayer.over > geo.blockLayer.body,
  JSON.stringify(geo.blockLayer),
);
ok('protection counter present', !!geo.protection, 'missing');
ok('weak counter present', !!geo.weak, 'missing');

// CharacterStatsDisplay: 55px icons, first slot centered on the display origin
rectOk('player stat icon 55x55 @ 9.8,55.5', geo.statIcon, {
  left: 9.76,
  top: 55.5,
  w: 55,
  h: 55,
});
rectOk('opp stat icon @ 509.3,52.5', geo.statIconFoe, {
  left: 509.25,
  top: 52.5,
  w: 55,
  h: 55,
});

ok('name font Baskerville 40 regular', geo.nameFont?.px === 40 && geo.nameFont?.weight === '400', JSON.stringify(geo.nameFont));
ok('label font Baskerville 25 bold', geo.labelFont?.px === 25 && geo.labelFont?.weight === '700', JSON.stringify(geo.labelFont));
ok('count font Baskerville 26 bold', geo.countFont?.px === 26 && geo.countFont?.weight === '700', JSON.stringify(geo.countFont));
ok('outline 3px (6px centered stroke)', geo.labelFont?.stroke === '6px', geo.labelFont?.stroke);

// Healthbar.gd / Staminabar.gd number formats
ok('hp text round/round', geo.hpText === '200000/1200000', geo.hpText);
ok('stamina text floorStepify/stepify', geo.stamText === '6.5/8', geo.stamText);
ok('block count raw', geo.blockText === '99999', geo.blockText);
// Foe snapshot leaves block / spikes / poison on, the other 10 at zero
ok('zero counters hidden', geo.hiddenBuffs.length === 10, geo.hiddenBuffs.join(','));
ok('stats packed (7 active)', geo.activeStats === 7, String(geo.activeStats));
ok(
  'fills track hp / stamina ratios',
  near(parseFloat(geo.fills.youHp), 44, 0.2) &&
    near(parseFloat(geo.fills.foeHp), 16.67, 0.2) &&
    near(parseFloat(geo.fills.youStam), 81.63, 0.2) &&
    near(parseFloat(geo.fills.foeStam), 100, 0.2),
  JSON.stringify(geo.fills),
);

console.log(JSON.stringify(geo, null, 2));
console.log(checks.join('\n'));
console.log(
  checks.some((c) => c.startsWith('FAIL')) ? '\nSOME CHECKS FAILED' : '\nall rects match game px',
);

const ref = await browser.newPage({ viewport: { width: 1200, height: 640 } });
await ref.goto(`http://127.0.0.1:${PORT}/hud-reference`, { waitUntil: 'domcontentloaded' });
await ref.waitForTimeout(600);
await ref.locator('.ref').screenshot({ path: path.join(OUT, 'sim-hud-game-ref.png') });

await browser.close();
server.close();

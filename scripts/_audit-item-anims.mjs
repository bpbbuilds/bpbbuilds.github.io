/**
 * ActivationAni coverage: ItemData map, CSS clips, play module, live harness.
 *
 *   node scripts/_audit-item-anims.mjs
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8791;
const ANI_JSON = path.join(ROOT, 'assets', 'data', 'sim-activation-ani.json');
const CSS = path.join(ROOT, 'js', 'pages', 'sim', 'fx', 'sim-item-anims.css');
const JS = path.join(ROOT, 'js', 'pages', 'sim', 'fx', 'sim-item-anims.js');
const FX = path.join(ROOT, 'js', 'pages', 'sim', 'fx', 'sim-fx.js');
const HTML = path.join(ROOT, 'sim', 'index.html');
const GAME_ITEMS = path.join(ROOT, 'scripts', '_cache', 'game-items.json');

const ENUMS = [
  'Scale',
  'Jump',
  'SquishyJump',
  'VerySquishyJump',
  'Slash',
  'Stab',
  'Bonk',
  'ReverseBonk',
  'Chop',
  'Squish',
  'Block',
  'Wave',
  'Potion',
  'Sweep',
  'Spin',
  'Throw',
  'Shoot',
  'Struggle',
  'ReverseStab',
  'Hiss',
  'Tackle',
  'DoubleSlash',
  'Flash',
];

const EXPECT_ID = {
  wooden_sword: 'Slash',
  stone: 'Throw',
  health_potion: 'Potion',
  fanny_pack: 'Scale',
  pumpkin: 'Throw',
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

const harness = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="/js/shared/backpack-grid/backpack-grid.css" />
  <link rel="stylesheet" href="/js/pages/sim/fx/sim-item-anims.css" />
  <style>
    html, body { margin: 0; background: #2a1c14; }
    .sim-bag { position: relative; width: 400px; height: 240px; font-size: 64px; }
    .bpb-bg__item { position: absolute; width: 1em; height: 1em; left: 1em; top: 1em; }
    .bpb-bg__spin { position: absolute; left: 50%; top: 50%; translate: -50% -50%; width: 1em; height: 1em; }
    .bpb-bg__spin--shadow { translate: calc(-50% + 0.0625em) calc(-50% + 0.0625em); }
    .bpb-bg__hit { position: absolute; inset: 0; }
    .bpb-bg__sprite { position: absolute; left: 50%; top: 50%; translate: -50% -50%; width: 1em; height: 1em; background: #c94; }
  </style>
</head>
<body>
  <div class="sim-field">
    <div class="sim-field__bag">
      <div class="sim-bag" id="board">
        <div class="bpb-bg__item" data-placement-key="p-sword" data-item-id="wooden_sword" data-item-type="Melee Weapon" data-face="0">
          <div class="bpb-bg__spin bpb-bg__spin--shadow" aria-hidden="true">
            <img class="bpb-bg__sprite bpb-bg__sprite--shadow" alt="" />
          </div>
          <div class="bpb-bg__spin">
            <button type="button" class="bpb-bg__hit">
              <img class="bpb-bg__sprite" alt="" />
              <span class="sim-cd-shade is-on" aria-hidden="true"></span>
            </button>
          </div>
        </div>
        <div class="bpb-bg__item" data-placement-key="p-stone" data-item-id="stone" data-item-type="Ranged Weapon" data-face="0">
          <div class="bpb-bg__spin bpb-bg__spin--shadow" aria-hidden="true">
            <img class="bpb-bg__sprite bpb-bg__sprite--shadow" alt="" />
          </div>
          <div class="bpb-bg__spin">
            <button type="button" class="bpb-bg__hit">
              <img class="bpb-bg__sprite" alt="" />
            </button>
          </div>
        </div>
        <div class="bpb-bg__item" data-placement-key="p-pot" data-item-id="health_potion" data-item-type="Potion" data-face="2">
          <div class="bpb-bg__spin bpb-bg__spin--shadow" aria-hidden="true">
            <img class="bpb-bg__sprite bpb-bg__sprite--shadow" alt="" />
          </div>
          <div class="bpb-bg__spin">
            <button type="button" class="bpb-bg__hit">
              <img class="bpb-bg__sprite" alt="" />
            </button>
          </div>
        </div>
        <div class="bpb-bg__item bpb-bg__item--bag" data-placement-key="p-bag" data-item-id="fanny_pack" data-item-type="Bag" data-face="0">
          <div class="bpb-bg__spin">
            <button type="button" class="bpb-bg__hit">
              <img class="bpb-bg__sprite" alt="" />
            </button>
          </div>
        </div>
        <div class="bpb-bg__item" data-placement-key="p-charge" data-item-id="battery" data-item-type="Accessory" data-face="0">
          <div class="bpb-bg__spin bpb-bg__spin--shadow" aria-hidden="true">
            <img class="bpb-bg__sprite bpb-bg__sprite--shadow" alt="" />
          </div>
          <div class="bpb-bg__spin">
            <button type="button" class="bpb-bg__hit">
              <img class="bpb-bg__sprite" alt="" />
            </button>
          </div>
        </div>
        <div class="bpb-bg__item" data-placement-key="p-food" data-item-id="carrot" data-item-type="Food" data-face="2">
          <div class="bpb-bg__spin bpb-bg__spin--shadow" aria-hidden="true">
            <img class="bpb-bg__sprite bpb-bg__sprite--shadow" alt="" />
          </div>
          <div class="bpb-bg__spin">
            <button type="button" class="bpb-bg__hit">
              <img class="bpb-bg__sprite" alt="" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <script type="module">
    import { createItemAnims, resolveAni } from '/js/pages/sim/fx/sim-item-anims.js';
    import { loadActivationAniMap } from '/js/pages/sim/fx/sim-item-anims.js';
    await loadActivationAniMap('/');
    const board = document.getElementById('board');
    const anims = createItemAnims({ boardEl: board, assetRoot: '/' });
    window.__ani = {
      anims,
      resolve: (id) => {
        const el = board.querySelector(\`[data-item-id="\${id}"]\`);
        return resolveAni(el, id);
      },
      clip(key) {
        const el = board.querySelector(\`[data-placement-key="\${key}"]\`);
        const hit = el?.querySelector('.bpb-bg__hit');
        const shadow = el?.querySelector('.bpb-bg__spin--shadow');
        const onItem = el?.classList.contains('sim-ani');
        const host = onItem ? el : hit;
        return {
          classes: [...(host?.classList || [])],
          onItem: !!onItem,
          lift: el?.classList.contains('sim-ani-lift') || false,
          name: host ? getComputedStyle(host).animationName : '',
          shadeInside: !el?.querySelector('.sim-cd-shade') || !!hit?.querySelector('.sim-cd-shade'),
          shadowFollows: !shadow || [...(shadow.classList || [])].some((c) => c.startsWith('sim-ani')),
        };
      },
    };
  </script>
</body>
</html>`;

function fail(msg) {
  console.error(`FAIL ${msg}`);
  process.exitCode = 1;
}

function ok(msg) {
  console.log(`ok  ${msg}`);
}

function staticAudit() {
  const ani = JSON.parse(fs.readFileSync(ANI_JSON, 'utf8'));
  const items = ani.items || {};
  const css = fs.readFileSync(CSS, 'utf8');
  const js = fs.readFileSync(JS, 'utf8');
  const fx = fs.readFileSync(FX, 'utf8');
  const html = fs.readFileSync(HTML, 'utf8');

  const ids = Object.keys(items);
  if (ids.length < 400) fail(`ani map too small (${ids.length})`);
  else ok(`ani map ${ids.length} items`);

  const unknown = [];
  for (const [id, name] of Object.entries(items)) {
    if (!ENUMS.includes(name)) unknown.push(`${id}:${name}`);
  }
  if (unknown.length) fail(`unknown enums ${unknown.slice(0, 8).join(', ')}`);
  else ok('every id maps to an ActivationAni enum');

  for (const [id, name] of Object.entries(EXPECT_ID)) {
    if (items[id] !== name) fail(`${id} expected ${name} got ${items[id]}`);
    else ok(`${id} → ${name}`);
  }

  for (const name of ENUMS) {
    if (!css.includes(`.sim-ani--${name}`)) fail(`CSS missing .sim-ani--${name}`);
  }
  ok('every enum has a CSS class');

  if (!css.includes('sim-ani-slash')) fail('CSS missing slash keyframes');
  if (!css.includes('sim-ani-throw')) fail('CSS missing throw keyframes');
  if (!css.includes('sim-ani-potion')) fail('CSS missing potion keyframes');
  if (!css.includes('sim-ani-scale')) fail('CSS missing scale keyframes');
  if (!/0\.125em/.test(css) || !/-0\.5em/.test(css)) fail('CSS missing 80px→em conversions');
  else ok('keyframes + em conversion present');

  if (!js.includes('prefers-reduced-motion')) fail('JS missing reduced-motion');
  if (!js.includes('activationsThisFrame') && !js.includes('underCap')) {
    fail('JS missing 3-per-frame cap');
  }
  ok('play module has cap + reduced-motion');

  if (fx.includes('sim-fx-pulse') || fx.includes('sim-fx-ring')) {
    fail('sim-fx.js still pulses / rings');
  }
  if (!fx.includes('itemAnims.play') || !fx.includes('itemAnims.mini')) {
    fail('sim-fx.js not wired to item anims');
  }
  if (fx.includes("ev.type === 'damage'") && /damage[\s\S]{0,80}itemAnims\.play/.test(fx)) {
    fail('damage still plays a board anim');
  }
  ok('sim-fx wired; no pulse/ring; no damage/miss re-anim');

  if (!html.includes('sim-item-anims.css')) fail('sim/index.html missing anims stylesheet');
  else ok('sim/index.html links sim-item-anims.css');

  if (fs.existsSync(GAME_ITEMS)) {
    const cache = JSON.parse(fs.readFileSync(GAME_ITEMS, 'utf8'));
    const sample = (cache.items || []).filter((it) => it.activationAni);
    if (sample.length < 400) fail(`game-items activationAni ${sample.length}`);
    else ok(`game-items activationAni on ${sample.length} items`);
  }
}

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === '/__ani-harness') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(harness);
        return;
      }
      const url = decodeURIComponent((req.url || '/').split('?')[0]);
      let file = path.join(ROOT, url === '/' ? 'index.html' : url.replace(/^\//, ''));
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        file = path.join(file, 'index.html');
      }
      const rel = path.relative(ROOT, file);
      if (rel.startsWith('..') || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end();
        return;
      }
      const ext = path.extname(file);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function liveAudit() {
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/__ani-harness`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ani);

  const resolved = await page.evaluate(() => ({
    sword: window.__ani.resolve('wooden_sword'),
    stone: window.__ani.resolve('stone'),
    pot: window.__ani.resolve('health_potion'),
    bag: window.__ani.resolve('fanny_pack'),
  }));
  if (resolved.sword !== 'Slash') fail(`resolve sword ${resolved.sword}`);
  else ok('resolve wooden_sword → Slash');
  if (resolved.stone !== 'Throw') fail(`resolve stone ${resolved.stone}`);
  else ok('resolve stone → Throw');
  if (resolved.pot !== 'Potion') fail(`resolve pot ${resolved.pot}`);
  else ok('resolve health_potion → Potion');
  if (resolved.bag !== 'Scale') fail(`resolve bag ${resolved.bag}`);
  else ok('resolve fanny_pack → Scale');

  await page.evaluate(() => {
    window.__ani.anims.play('p-sword', { itemId: 'wooden_sword', t: 1 });
    window.__ani.anims.play('p-stone', { itemId: 'stone', t: 1 });
    window.__ani.anims.play('p-pot', { itemId: 'health_potion', consume: true, t: 1 });
    window.__ani.anims.play('p-bag', { itemId: 'fanny_pack', t: 1 });
    window.__ani.anims.mini('p-charge');
    window.__ani.anims.play('p-food', { itemId: 'carrot', ani: 'Jump', t: 1 });
  });

  const clips = await page.evaluate(() => ({
    sword: window.__ani.clip('p-sword'),
    stone: window.__ani.clip('p-stone'),
    pot: window.__ani.clip('p-pot'),
    bag: window.__ani.clip('p-bag'),
    charge: window.__ani.clip('p-charge'),
    food: window.__ani.clip('p-food'),
  }));

  if (!clips.sword.classes.includes('sim-ani--Slash')) fail(`sword clip ${clips.sword.classes}`);
  else ok('sword plays Slash');
  if (!clips.sword.shadeInside) fail('CD shade left outside motion host');
  else ok('CD shade rides with the hit');
  if (!clips.sword.shadowFollows) fail('sword shadow did not follow Slash');
  else ok('sword shadow follows Slash');
  if (!clips.stone.classes.includes('sim-ani--Throw')) fail(`stone clip ${clips.stone.classes}`);
  else ok('stone plays Throw');
  if (!clips.stone.shadowFollows) fail('stone shadow did not follow Throw');
  else ok('stone shadow follows Throw');
  if (!clips.pot.classes.includes('sim-ani--Potion')) fail(`pot clip ${clips.pot.classes}`);
  else ok('potion plays Potion');
  if (!clips.bag.classes.includes('sim-ani--Scale')) fail(`bag clip ${clips.bag.classes}`);
  else ok('bag plays Scale');
  if (clips.bag.lift) fail('bag should not lift z-index');
  else ok('bag does not lift');
  if (!clips.sword.lift) fail('sword should lift');
  else ok('weapon lifts z-index');
  if (!clips.charge.classes.includes('sim-ani--mini')) fail(`charge ${clips.charge.classes}`);
  else ok('charge tile MiniActivate (no hop class)');
  if (!clips.food.onItem || !clips.food.classes.includes('sim-ani--Jump')) {
    fail(`upside-down food Jump should be on item root (${clips.food.classes}, onItem=${clips.food.onItem})`);
  } else ok('upside-down food Jump is screen-up on item root');

  const live = await page.goto(`http://127.0.0.1:${PORT}/sim/`, { waitUntil: 'domcontentloaded' });
  const linked = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel="stylesheet"]')].some((l) =>
      (l.href || '').includes('sim-item-anims.css'),
    ),
  );
  if (!linked || live.status() >= 400) fail('live /sim/ missing anims css');
  else ok('live /sim/ loads sim-item-anims.css');

  const slug = process.argv[2] || 'bpbb-cool-poison-build-80sj12';
  await page.goto(`http://127.0.0.1:${PORT}/sim/?slug=${encodeURIComponent(slug)}`, {
    waitUntil: 'domcontentloaded',
  });
  try {
    await page.waitForSelector('.sim-field__bag--you .bpb-bg__item', { timeout: 25000 });
    await page.waitForTimeout(1200);
    const liveBoard = await page.evaluate(() => {
      const items = [...document.querySelectorAll('.sim-field__bag--you .bpb-bg__item')];
      const playing = items.filter((el) =>
        el.classList.contains('sim-ani') ||
        el.querySelector(
          '.bpb-bg__hit.sim-ani, .bpb-bg__spin--shadow.sim-ani, .bpb-bg__sprite.sim-ani, .bpb-bg__sprite.sim-ani--consumed',
        ),
      );
      return {
        n: items.length,
        pulse: items.filter((el) => el.classList.contains('sim-fx-pulse')).length,
        rings: document.querySelectorAll('.sim-fx-ring').length,
        playing: playing.length,
      };
    });
    if (liveBoard.n < 1) fail('live /sim/ board has no items');
    else ok(`live /sim/ board ${liveBoard.n} items`);
    if (liveBoard.pulse || liveBoard.rings) fail('live /sim/ still using pulse/ring');
    else ok('live /sim/ no pulse/ring leftovers');
  } catch (err) {
    fail(`live /sim/ board: ${err.message || err}`);
  }

  if (errors.length) fail(`page errors ${errors.join(' | ')}`);

  await browser.close();
  await new Promise((r) => server.close(r));
}

staticAudit();
await liveAudit();
if (process.exitCode) {
  console.error('activation-ani audit failed');
  process.exit(1);
}
console.log('activation-ani audit passed');

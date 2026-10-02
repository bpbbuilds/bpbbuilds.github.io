/**
 * Screenshot import eval: serve repo, drive dev/screenshot-import in Chromium, score vs truth.
 *
 *   node scripts/screenshot-eval/run.mjs              # all fixtures/*.truth.json
 *   node scripts/screenshot-eval/run.mjs pine-protector pine-egg-remix
 *
 * Writes scripts/_cache/screenshot-eval/<fixture>/{result.png,result.json}.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const fixturesDir = path.join(here, 'fixtures');
/** Label-tool saves (create ?label=1) land in the repo-root fixtures folder. */
const labeledDir = path.join(repo, 'fixtures');
const outRoot = path.join(repo, 'scripts/_cache/screenshot-eval');
fs.mkdirSync(outRoot, { recursive: true });

const cliArgs = process.argv.slice(2);
const evalModel = cliArgs.find((a) => a.startsWith('--model='))?.slice(8) || '';
const evalTiles = cliArgs.includes('--tiles');
const v5Model = path.join(repo, 'scripts/_cache/synth-detector-v5/screenshot-detector.onnx');
const v5Classes = path.join(repo, 'scripts/_cache/synth-detector-v5/classes.json');

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream',
};

function listFixtures() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  if (args.length) return args;
  const names = new Set();
  for (const dir of [fixturesDir, labeledDir]) {
    if (!fs.existsSync(dir)) continue;
    for (const n of fs.readdirSync(dir)) {
      if (n.endsWith('.truth.json')) names.add(n.replace(/\.truth\.json$/, ''));
    }
  }
  return [...names].sort();
}

/** @param {string} fixture */
function fixtureDir(fixture) {
  return fs.existsSync(path.join(fixturesDir, `${fixture}.png`)) ? fixturesDir : labeledDir;
}

function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://x');
    if (evalModel === 'v5-80' && url.pathname === '/assets/data/detector-classes.json') {
      if (!fs.existsSync(v5Classes)) return res.writeHead(404).end();
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return fs.createReadStream(v5Classes).pipe(res);
    }
    if (evalModel === 'v5-80' && url.pathname === '/assets/ml/screenshot-detector/v1/screenshot-detector.onnx') {
      if (!fs.existsSync(v5Model)) return res.writeHead(404).end();
      res.writeHead(200, { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' });
      return fs.createReadStream(v5Model).pipe(res);
    }
    let file = path.join(repo, decodeURIComponent(url.pathname));
    if (!file.startsWith(repo)) {
      res.writeHead(403).end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/** Truth r=null means rotation-agnostic (symmetric 1x1). */
const rotOk = (p, t) => t.r == null || (p.r || 0) === t.r;

/** Detector often swaps these edge pouches. */
const BAG_NAME_ALIASES = new Map([
  ['protective purse', 'fanny pack'],
  ['fanny pack', 'fanny pack'],
]);

/**
 * @param {string} s
 */
function normBagName(s) {
  const n = String(s || '').toLowerCase().trim();
  return BAG_NAME_ALIASES.get(n) || n;
}

/**
 * Greedy name+cell match. Mutates `left` (remaining predictions).
 * @param {object[]} left
 * @param {object[]} truthRows
 */
function matchRows(left, truthRows) {
  const norm = (s) => String(s).toLowerCase();
  /** @type {{ t: object, p: object | null, cell: boolean, rot: boolean }[]} */
  const rows = [];
  const pending = [];
  for (const t of truthRows || []) {
    const k = left.findIndex((p) => norm(p.name) === norm(t.name) && p.x === t.x && p.y === t.y);
    if (k >= 0) {
      const p = left.splice(k, 1)[0];
      rows.push({ t, p, cell: true, rot: rotOk(p, t) });
    } else pending.push(t);
  }
  for (const t of pending) {
    let best = -1;
    let bd = Infinity;
    left.forEach((p, k) => {
      if (norm(p.name) !== norm(t.name)) return;
      const d = Math.abs(p.x - t.x) + Math.abs(p.y - t.y);
      if (d < bd) {
        bd = d;
        best = k;
      }
    });
    if (best >= 0) {
      const p = left.splice(best, 1)[0];
      rows.push({ t, p, cell: false, rot: rotOk(p, t) });
    } else rows.push({ t, p: null, cell: false, rot: false });
  }
  return rows;
}

function groupScore(rows, truthN) {
  const matched = rows.filter((r) => r.p);
  return {
    cellHits: matched.filter((r) => r.cell).length,
    rotHits: matched.filter((r) => r.cell && r.rot).length,
    truthN,
    misses: rows.filter((r) => !r.p).map((r) => r.t),
    misplaced: rows.filter((r) => r.p && !(r.cell && r.rot)),
  };
}

function score(pred, truth) {
  const items = pred.filter((p) => !p.bag);
  const left = items.map((p, i) => ({ ...p, i }));
  const itemRows = matchRows(left, truth.items || []);
  const skillRows = matchRows(left, truth.skills || []);
  const jewelRows = matchRows(left, truth.jewels || []);
  const matched = itemRows.filter((r) => r.p);
  const tp = matched.length;
  const precision = items.length ? tp / items.length : 0;
  const recall = (truth.items || []).length ? tp / truth.items.length : 0;
  const cellHits = matched.filter((r) => r.cell).length;
  const rotHits = matched.filter((r) => r.cell && r.rot).length;
  const skills = groupScore(skillRows, (truth.skills || []).length);
  const jewels = groupScore(jewelRows, (truth.jewels || []).length);

  const predBag = new Set(pred.filter((p) => p.bag).flatMap((p) => p.cells || []));
  const truthBag = new Set(truth.bagCells || []);
  let inter = 0;
  for (const c of predBag) if (truthBag.has(c)) inter += 1;
  const union = new Set([...predBag, ...truthBag]).size;
  const bagIou = union ? inter / union : 0;

  /** Bag name gate (optional truth.bags). */
  const truthBags = Array.isArray(truth.bags) ? truth.bags : [];
  const predBags = pred.filter((p) => p.bag).map((p, i) => ({ ...p, i }));
  let bagNameHits = 0;
  /** @type {object[]} */
  const bagMisses = [];
  for (const t of truthBags) {
    const k = predBags.findIndex(
      (p) => normBagName(p.name) === normBagName(t.name) && p.x === t.x && p.y === t.y,
    );
    if (k >= 0) {
      predBags.splice(k, 1);
      bagNameHits += 1;
    } else {
      bagMisses.push(t);
    }
  }

  return {
    precision,
    recall,
    cellHits,
    rotHits,
    truthN: (truth.items || []).length,
    predN: items.length,
    bagN: pred.filter((p) => p.bag).length,
    bagIou,
    bagNameHits,
    bagNameTruth: truthBags.length,
    bagMisses,
    bagExtras: predBags,
    perfect: tp === (truth.items || []).length && items.length === tp && rotHits === tp,
    misses: itemRows.filter((r) => !r.p).map((r) => r.t),
    misplaced: itemRows.filter((r) => r.p && !(r.cell && r.rot)),
    extras: left,
    skills,
    jewels,
  };
}

function rawNameAtCell(raw, truth) {
  const seen = new Set();
  for (const d of raw?.items || []) {
    const x = Number.isFinite(Number(d.x)) ? Number(d.x) : Math.round(Number(d.col));
    const y = Number.isFinite(Number(d.y)) ? Number(d.y) : Math.round(Number(d.row));
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    seen.add(`${String(d.name).toLowerCase()}@${x},${y}`);
  }
  const rows = truth.items || [];
  const hits = rows.filter((t) => seen.has(`${String(t.name).toLowerCase()}@${t.x},${t.y}`)).length;
  return { hits, truthN: rows.length };
}

/**
 * @param {import('playwright').Page} page
 * @param {string} fixture
 * @param {number} port
 */
async function runFixture(page, fixture, port) {
  const dir = fixtureDir(fixture);
  const shotPath = path.join(dir, `${fixture}.png`);
  const truthPath = path.join(dir, `${fixture}.truth.json`);
  const outDir = path.join(outRoot, fixture);
  fs.mkdirSync(outDir, { recursive: true });

  if (!fs.existsSync(shotPath)) {
    console.log(`\n=== ${fixture} ===\nSKIP missing png`);
    return null;
  }

  const query = new URLSearchParams();
  if (evalModel) query.set('evalModel', evalModel);
  if (evalTiles) query.set('evalTiles', '1');
  await page.goto(`http://127.0.0.1:${port}/dev/screenshot-import/${query.toString() ? `?${query}` : ''}`);
  await page.waitForFunction(() => window.__stbReady === true, null, { timeout: 60000 });
  await page.evaluate(() => {
    window.__stbResult = undefined;
  });
  await page.setInputFiles('#stb-file', shotPath);
  await page.waitForFunction(() => window.__stbResult !== undefined, null, {
    timeout: evalTiles ? 360000 : 180000,
  });
  const result = await page.evaluate(() => window.__stbResult);
  await page.locator('#stb-board').screenshot({ path: path.join(outDir, 'result.png') }).catch(() => {});
  fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2));

  console.log(`\n=== ${fixture} ===`);
  for (const l of result.logs || []) console.log(l);
  if (result.error) console.log('ERROR', result.error);
  console.log(`ms=${result.ms}`);
  console.log('PREDICTED bags:', (result.placements || []).filter((q) => q.bag).map((q) => `${q.name}@${q.x},${q.y}r${q.r}`).join(' | '));
  if (result.raw?.bags?.length) {
    console.log(
      'RAW bags:',
      result.raw.bags
        .map((b) => `${b.name}@${b.col},${b.row} c${b.conf}`)
        .join(' | '),
    );
  } else if (Array.isArray(result.raw) && process.env.RAW === '1') {
    console.log('RAW items:', result.raw.slice(0, 12).map((b) => `${b.name}@${b.col},${b.row}`).join(' | '));
  }

  if (!fs.existsSync(truthPath)) {
    console.log('(no truth file — scoring skipped)');
    return null;
  }
  const truth = JSON.parse(fs.readFileSync(truthPath, 'utf8'));
  const s = score(result.placements || [], truth);
  const rawScore = rawNameAtCell(result.raw, truth);
  console.log('SCORE');
  console.log(
    `  precision=${s.precision.toFixed(3)} recall=${s.recall.toFixed(3)}`,
    `cell=${s.cellHits}/${s.truthN} cell+rot=${s.rotHits}/${s.truthN}`,
    `pred=${s.predN} bags=${s.bagN} bagIoU=${s.bagIou.toFixed(3)} perfect=${s.perfect}`,
  );
  console.log(`  raw name-at-cell=${rawScore.hits}/${rawScore.truthN}`);
  if (s.bagNameTruth) {
    console.log(
      `  bagNames=${s.bagNameHits}/${s.bagNameTruth}`,
    );
    for (const t of s.bagMisses) console.log(`  BAGMISS ${t.name} @${t.x},${t.y}`);
    for (const p of s.bagExtras) console.log(`  BAGEXTRA ${p.name} @${p.x},${p.y}`);
  }
  if (s.skills?.truthN) {
    console.log(`  skills cell=${s.skills.cellHits}/${s.skills.truthN} cell+rot=${s.skills.rotHits}/${s.skills.truthN}`);
  }
  if (s.jewels?.truthN) {
    console.log(`  jewels cell=${s.jewels.cellHits}/${s.jewels.truthN} cell+rot=${s.jewels.rotHits}/${s.jewels.truthN}`);
  }
  for (const t of s.misses) console.log(`  MISS   ${t.name} @${t.x},${t.y} r${t.r || 0}`);
  for (const r of s.misplaced) {
    console.log(
      `  WRONG  ${r.t.name} truth @${r.t.x},${r.t.y} r${r.t.r || 0} got @${r.p.x},${r.p.y} r${r.p.r}`,
    );
  }
  for (const p of s.extras) console.log(`  EXTRA  ${p.name} @${p.x},${p.y} r${p.r}`);
  return { fixture, ...s, rawNameCell: rawScore };
}

async function main() {
  const fixtures = listFixtures();
  if (!fixtures.length) {
    console.error('No fixtures found in', fixturesDir);
    process.exit(1);
  }
  const server = await serve();
  const port = /** @type {import('node:net').AddressInfo} */ (server.address()).port;
  const browser = await chromium.launch();
  /** @type {object[]} */
  const scores = [];
  try {
    for (const name of fixtures) {
      const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
      page.on('pageerror', (e) => console.error('[page error]', e.message));
      try {
        const s = await runFixture(page, name, port);
        if (s) scores.push(s);
      } catch (err) {
        console.error(`\n=== ${name} ===\nERROR`, err instanceof Error ? err.message : err);
      } finally {
        await page.close().catch(() => {});
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (scores.length > 1) {
    const bagIous = scores.map((s) => s.bagIou);
    const meanBag = bagIous.reduce((a, b) => a + b, 0) / bagIous.length;
    const minBag = Math.min(...bagIous);
    const cellSum = scores.reduce((a, s) => a + s.cellHits, 0);
    const truthSum = scores.reduce((a, s) => a + s.truthN, 0);
    const rotSum = scores.reduce((a, s) => a + s.rotHits, 0);
    const skillCell = scores.reduce((a, s) => a + (s.skills?.cellHits || 0), 0);
    const skillN = scores.reduce((a, s) => a + (s.skills?.truthN || 0), 0);
    const jewelCell = scores.reduce((a, s) => a + (s.jewels?.cellHits || 0), 0);
    const jewelN = scores.reduce((a, s) => a + (s.jewels?.truthN || 0), 0);
    const rawCell = scores.reduce((a, s) => a + (s.rawNameCell?.hits || 0), 0);
    const rawN = scores.reduce((a, s) => a + (s.rawNameCell?.truthN || 0), 0);
    const anyFail = scores.some((s) => !s.perfect);
    console.log('\n===== TOTALS =====');
    console.log(
      `  fixtures=${scores.length}`,
      `cell=${cellSum}/${truthSum}`,
      `cell+rot=${rotSum}/${truthSum}`,
      `skills=${skillCell}/${skillN}`,
      `jewels=${jewelCell}/${jewelN}`,
      `rawNameCell=${rawCell}/${rawN}`,
      `bagIoU mean=${meanBag.toFixed(3)} min=${minBag.toFixed(3)}`,
      `allPerfect=${!anyFail}`,
    );
    for (const s of scores) {
      console.log(
        `  - ${s.fixture}: cell=${s.cellHits}/${s.truthN} bagIoU=${s.bagIou.toFixed(3)} perfect=${s.perfect}`,
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

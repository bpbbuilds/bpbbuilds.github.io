/**
 * Collect Backpack Battles screenshots from r/BackpackBattles (via the pullpush archive)
 * into fixtures/inbox/raw for hand-labeling. Local dev use only — inbox is gitignored.
 *
 *   node scripts/fixture-scout/scrape-reddit.mjs --pages 60 --max 1500
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INBOX = path.join(ROOT, 'fixtures/inbox');
const RAW = path.join(INBOX, 'raw');
const POSTS = path.join(INBOX, 'posts.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const maxPages = Number(arg('--pages', '60')) | 0;
const maxImages = Number(arg('--max', '1500')) | 0;
const subreddit = arg('--sub', 'BackpackBattles');

fs.mkdirSync(RAW, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** @param {any} p */
function imagesOf(p) {
  /** @type {{ url: string, ext: string }[]} */
  const out = [];
  const url = String(p.url || '');
  const direct = /^https:\/\/(i\.redd\.it|i\.imgur\.com)\/[\w-]+\.(png|jpe?g|webp)$/i.exec(url);
  if (direct) out.push({ url, ext: direct[2].toLowerCase().replace('jpeg', 'jpg') });
  if (p.is_gallery && p.media_metadata) {
    for (const [mid, m] of Object.entries(p.media_metadata)) {
      const mime = String(/** @type {any} */ (m)?.m || '');
      const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('jp') ? 'jpg' : '';
      if (ext) out.push({ url: `https://i.redd.it/${mid}.${ext}`, ext });
    }
  }
  return out;
}

async function getJson(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA } });
      if (res.status === 429) {
        await sleep(5000 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === 3) throw err;
      await sleep(2000 * (attempt + 1));
    }
  }
  return null;
}

/** @type {Record<string, any>} */
const known = fs.existsSync(POSTS) ? Object.fromEntries(JSON.parse(fs.readFileSync(POSTS, 'utf8')).map((e) => [e.file, e])) : {};
/** @type {{ file: string, url: string, title: string, permalink: string, author: string, created: number }[]} */
const queue = [];

let before = arg('--before', '');
const floorUtc = Date.UTC(2023, 5, 1) / 1000;
for (let page = 0; page < maxPages && queue.length < maxImages; page++) {
  const url =
    `https://api.pullpush.io/reddit/search/submission/?subreddit=${subreddit}&size=100&sort=desc` +
    (before ? `&before=${before}` : '');
  const j = await getJson(url).catch(() => null);
  const posts = j?.data || [];
  if (!posts.length) {
    // Archive has gaps — hop back a week and keep going until the subreddit existed.
    if (!before || Number(before) < floorUtc) break;
    before = String(Number(before) - 7 * 86400);
    await sleep(1500);
    continue;
  }
  for (const p of posts) {
    if (p.over_18 || p.removed_by_category) continue;
    imagesOf(p).forEach((img, n) => {
      const file = `${p.id}${n ? `_${n}` : ''}.${img.ext}`;
      queue.push({
        file,
        url: img.url,
        title: String(p.title || '').slice(0, 200),
        permalink: `https://www.reddit.com${p.permalink || `/comments/${p.id}`}`,
        author: String(p.author || ''),
        created: Number(p.created_utc) || 0,
      });
    });
  }
  before = String(posts[posts.length - 1].created_utc);
  console.error(`page ${page + 1}: ${posts.length} posts, queue ${queue.length}, back to ${new Date(Number(before) * 1000).toISOString().slice(0, 10)}`);
  await sleep(1200);
}

let downloaded = 0;
let skipped = 0;
let failed = 0;
const todo = queue.slice(0, maxImages);
async function worker() {
  for (;;) {
    const e = todo.shift();
    if (!e) return;
    const dest = path.join(RAW, e.file);
    if (fs.existsSync(dest)) {
      skipped += 1;
      known[e.file] = e;
      continue;
    }
    try {
      const res = await fetch(e.url, { headers: { 'user-agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 20_000) throw new Error('too small');
      fs.writeFileSync(dest, buf);
      known[e.file] = e;
      downloaded += 1;
      if (downloaded % 50 === 0) console.error(`downloaded ${downloaded}`);
    } catch {
      failed += 1;
    }
    await sleep(250);
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);

fs.writeFileSync(POSTS, `${JSON.stringify(Object.values(known), null, 2)}\n`);
console.log(JSON.stringify({ queued: queue.length, downloaded, skipped, failed, total: Object.keys(known).length }));

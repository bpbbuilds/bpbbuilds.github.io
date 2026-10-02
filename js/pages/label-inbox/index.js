/**
 * Dev label inbox: grid of scraped board screenshots → open one in create ?label=1.
 * Done marks come from the label tool (localStorage); skips are local to this page.
 */
import { skelBlock, skelRegion } from '../../shared/skeleton.js';

const DONE_KEY = 'bpb-label-inbox-done';
const SKIP_KEY = 'bpb-label-inbox-skip';

const grid = /** @type {HTMLUListElement} */ (document.getElementById('li-grid'));
const countEl = /** @type {HTMLElement} */ (document.getElementById('li-count'));
const showHidden = /** @type {HTMLInputElement} */ (document.getElementById('li-show-hidden'));

/** @param {string} key */
function readSet(key) {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch {
    return new Set();
  }
}

/** @param {string} key @param {Set<string>} set */
function writeSet(key, set) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

/** @param {string} s */
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);

/** @type {{ file: string, shot: string, w: number, h: number, bags: number, title: string, permalink: string, author: string }[]} */
let items = [];

/** @type {{ shots: Set<string>, permalinks: Set<string> }} */
let doneFile = { shots: new Set(), permalinks: new Set() };

async function loadDoneFile() {
  try {
    const res = await fetch('/fixtures/inbox-done.json', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    doneFile = {
      shots: new Set(data.shots || []),
      permalinks: new Set(data.permalinks || []),
    };
  } catch {
    /* not written yet */
  }
}

/** @param {{ shot: string, permalink: string }} it */
function isDone(it) {
  return readSet(DONE_KEY).has(it.shot) || doneFile.shots.has(it.shot) || doneFile.permalinks.has(it.permalink);
}

function render() {
  const skip = readSet(SKIP_KEY);
  const show = showHidden.checked;
  const open = items.filter((it) => !isDone(it) && !skip.has(it.shot));
  const doneCount = items.filter((it) => isDone(it)).length;
  countEl.textContent = `${open.length} to label · ${doneCount} done · ${skip.size} skipped · ${items.length} found`;
  const list = show ? items : open;
  grid.innerHTML = list
    .map((it) => {
      const state = isDone(it) ? 'done' : skip.has(it.shot) ? 'skip' : '';
      const href = `/create/?label=1&shot=${encodeURIComponent(it.shot)}&src=${encodeURIComponent(it.permalink)}`;
      return `
        <li class="li-card${state ? ` is-${state}` : ''}">
          <a class="li-thumb" href="${href}" title="Open in labeling tool">
            <img src="${esc(it.shot)}" alt="" loading="lazy" width="${it.w}" height="${it.h}" />
          </a>
          <p class="li-meta">
            <span class="li-name">${esc(it.title || it.file)}</span>
            <span class="cr-hint">${it.bags} bags seen · ${it.w}×${it.h}${state ? ` · ${state}` : ''}</span>
          </p>
          <p class="li-actions">
            <a class="cr-btn-quiet" href="${esc(it.permalink)}" target="_blank" rel="noopener">Post</a>
            <button type="button" class="cr-btn-quiet" data-skip="${esc(it.shot)}">${state === 'skip' ? 'Unskip' : 'Skip'}</button>
          </p>
        </li>`;
    })
    .join('');
}

grid.addEventListener('click', (e) => {
  const btn = /** @type {HTMLElement} */ (e.target).closest('[data-skip]');
  if (!btn) return;
  const shot = btn.getAttribute('data-skip') || '';
  const skip = readSet(SKIP_KEY);
  if (skip.has(shot)) skip.delete(shot);
  else skip.add(shot);
  writeSet(SKIP_KEY, skip);
  render();
});
showHidden.addEventListener('change', render);
window.addEventListener('storage', render);
window.addEventListener('pageshow', () => {
  void loadDoneFile().then(render);
});

grid.innerHTML = skelRegion(
  Array.from({ length: 8 }, () => `<li class="li-card">${skelBlock()}</li>`).join(''),
  { label: 'Loading inbox' },
);

try {
  const res = await fetch('/fixtures/inbox/manifest.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  items = (await res.json()).items || [];
  await loadDoneFile();
  render();
} catch {
  grid.innerHTML = '';
  countEl.textContent =
    'No inbox yet. Run: node scripts/fixture-scout/scrape-reddit.mjs, then python scripts/fixture-scout/filter_boards.py';
}

/**
 * Dev labeling tool (create ?label=1): save the pasted screenshot + the hand-corrected
 * board as a screenshot-eval fixture (real-NNN.png + real-NNN.truth.json).
 */

import { isBagItem, isGemItem } from './collision.js';
import { fixStemFromUrl, holdCreateDraft, loadFixFixture, releaseCreateDraft, truthFromPlacements } from './label-fix.js?v=shells1';
import { isUnrecognizedId } from './screenshot-unrecognized.js?v=fa3633b';

const TARGET_TEST = 50;
const TARGET_TRAIN = 100;
const PREFIX = 'real-';
const DB_NAME = 'bpb-label-tool';
const DB_STORE = 'handles';
const HANDLE_KEY = 'fixtures';
const SOURCE_KEY = 'bpb-label-tool-source';
const INBOX_DONE_KEY = 'bpb-label-inbox-done';

const SOURCES = [
  ['in-game', 'In-game screenshot'],
  ['reddit', 'Reddit post'],
  ['build-page', 'Build page (this site)'],
  ['other-site', 'Other site'],
  ['other', 'Other'],
];

/** @param {string} shot */
const INBOX_DONE_FILE = 'inbox-done.json';

export function markInboxDone(shot) {
  try {
    const done = new Set(JSON.parse(localStorage.getItem(INBOX_DONE_KEY) || '[]'));
    done.add(shot);
    localStorage.setItem(INBOX_DONE_KEY, JSON.stringify([...done]));
  } catch {
    /* storage full / blocked — the fixtures file is the one the inbox reads */
  }
}

/**
 * Inbox hides cards from this file (same origin localStorage does not survive
 * localhost vs 127.0.0.1, or a restored inbox tab).
 * @param {FileSystemDirectoryHandle} dir
 * @param {string} shot
 * @param {string} permalink
 */
async function rememberInboxDone(dir, shot, permalink) {
  /** @type {{ shots: string[], permalinks: string[] }} */
  let data = { shots: [], permalinks: [] };
  try {
    const fh = await dir.getFileHandle(INBOX_DONE_FILE);
    const parsed = JSON.parse(await (await fh.getFile()).text());
    data = {
      shots: Array.isArray(parsed.shots) ? parsed.shots : [],
      permalinks: Array.isArray(parsed.permalinks) ? parsed.permalinks : [],
    };
  } catch {
    /* first completed inbox shot */
  }
  if (shot && !data.shots.includes(shot)) data.shots.push(shot);
  if (permalink && !data.permalinks.includes(permalink)) data.permalinks.push(permalink);
  await writeFile(dir, INBOX_DONE_FILE, `${JSON.stringify(data, null, 2)}\n`);
}

export function wantLabelTool() {
  try {
    return new URLSearchParams(window.location.search).get('label') === '1';
  } catch {
    return false;
  }
}

/** @returns {Promise<IDBDatabase>} */
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** @param {string} key */
async function idbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(DB_STORE).objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * @param {string} key
 * @param {unknown} value
 */
async function idbSet(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve(undefined);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * @param {number} test
 * @param {number} train
 * @returns {'test' | 'train'}
 */
function nextSplit(test, train) {
  if (test >= TARGET_TEST) return 'train';
  if (train >= TARGET_TRAIN) return 'test';
  return test * 2 <= train ? 'test' : 'train';
}

/** @param {File | Blob} blob */
async function toPng(blob) {
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bmp, 0, 0);
  const png = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png');
  });
  return { png: /** @type {Blob} */ (png), w: bmp.width, h: bmp.height };
}

/**
 * @param {FileSystemDirectoryHandle} dir
 * @param {string} name
 * @param {Blob | string} data
 */
async function writeFile(dir, name, data) {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(data);
  await w.close();
}

/**
 * @param {Map<string, object>} itemsById
 */
function catalogTotals(itemsById) {
  let items = 0;
  let bags = 0;
  for (const item of itemsById.values()) {
    if (isUnrecognizedId(item.id)) continue;
    if (isBagItem(item)) bags += 1;
    else if (!isGemItem(item) && String(item.type || '') !== 'Skill') items += 1;
  }
  return { items, bags };
}

/**
 * @param {{
 *   state: ReturnType<import('./editor-state.js').createEditorState>,
 *   itemsById: Map<string, object>,
 * }} opts
 */
export function mountLabelTool(opts) {
  const { state, itemsById } = opts;
  const totals = catalogTotals(itemsById);
  const params = new URLSearchParams(window.location.search);
  const inboxShot = params.get('shot') || '';
  const inboxSrc = params.get('src') || '';
  const fixStem = fixStemFromUrl();

  const css = document.createElement('link');
  css.rel = 'stylesheet';
  const cssUrl = new URL('./label-tool.css', import.meta.url);
  cssUrl.searchParams.set('v', 'hide1');
  css.href = cssUrl.href;
  document.head.appendChild(css);

  const panel = document.createElement('aside');
  panel.className = 'lt-panel';
  panel.setAttribute('aria-label', 'Screenshot labeling tool');
  const savedSource = inboxShot ? 'reddit' : localStorage.getItem(SOURCE_KEY) || 'in-game';
  panel.innerHTML = `
    <div class="lt-head">
      <h2 class="lt-title">${fixStem ? `Edit ${fixStem}` : 'Labeling'}</h2>
      <button type="button" class="lt-hide" data-lt-hide>Hide</button>
    </div>
    ${inboxShot ? '<a class="cr-hint lt-line lt-inbox" href="/dev/label-inbox/">← Back to inbox</a>' : ''}
    ${fixStem ? `<a class="cr-hint lt-line lt-inbox" href="/dev/label-review/#${fixStem}">← Back to label check</a>` : ''}
    <p class="lt-count"><strong data-lt-total>0</strong> / ${TARGET_TEST + TARGET_TRAIN} labeled</p>
    <div class="lt-bar" aria-hidden="true"><span data-lt-bar></span></div>
    <p class="cr-hint lt-line" data-lt-split></p>
    <p class="cr-hint lt-line" data-lt-cover></p>
    <button type="button" class="cr-btn-quiet lt-connect" data-lt-connect>Connect fixtures folder</button>
    <label class="cr-label cr-label--sm" for="lt-source">Source</label>
    <select id="lt-source" class="cr-input lt-source">
      ${SOURCES.map(
        ([v, l]) => `<option value="${v}"${v === savedSource ? ' selected' : ''}>${l}</option>`,
      ).join('')}
    </select>
    <p class="cr-hint lt-line" data-lt-status role="status">Paste a screenshot, fix the board, then save.</p>
    <button type="button" class="cr-submit lt-save" data-lt-save disabled>Save test case</button>
  `;
  document.body.appendChild(panel);

  const showBtn = document.createElement('button');
  showBtn.type = 'button';
  showBtn.className = 'lt-show';
  showBtn.hidden = true;
  showBtn.textContent = fixStem ? `Show ${fixStem}` : 'Show labeling';
  document.body.appendChild(showBtn);

  const ref = document.createElement('figure');
  ref.className = 'lt-ref';
  ref.hidden = true;
  ref.title = 'Click to enlarge the screenshot';
  ref.innerHTML = '<img alt="Screenshot for this label" /><figcaption>Click to enlarge</figcaption>';
  panel.insertBefore(ref, panel.querySelector('[data-lt-total]')?.parentElement || null);
  const refImg = /** @type {HTMLImageElement} */ (ref.querySelector('img'));
  ref.addEventListener('click', () => {
    ref.classList.toggle('is-open');
    const cap = ref.querySelector('figcaption');
    if (cap) cap.textContent = ref.classList.contains('is-open') ? 'Click to shrink' : 'Click to enlarge';
  });

  function setPanelHidden(hidden) {
    panel.classList.toggle('is-hidden', hidden);
    showBtn.hidden = !hidden;
    if (hidden && ref.classList.contains('is-open')) {
      ref.classList.remove('is-open');
      const cap = ref.querySelector('figcaption');
      if (cap) cap.textContent = 'Click to enlarge';
    }
  }
  panel.querySelector('[data-lt-hide]')?.addEventListener('click', () => setPanelHidden(true));
  showBtn.addEventListener('click', () => setPanelHidden(false));

  const $ = (sel) => /** @type {HTMLElement} */ (panel.querySelector(sel));
  const totalEl = $('[data-lt-total]');
  const barEl = $('[data-lt-bar]');
  const splitEl = $('[data-lt-split]');
  const coverEl = $('[data-lt-cover]');
  const statusEl = $('[data-lt-status]');
  const connectBtn = /** @type {HTMLButtonElement} */ ($('[data-lt-connect]'));
  const saveBtn = /** @type {HTMLButtonElement} */ ($('[data-lt-save]'));
  const sourceSel = /** @type {HTMLSelectElement} */ ($('#lt-source'));

  /** @type {FileSystemDirectoryHandle | null} */
  let dir = null;
  /** @type {Blob | null} */
  let lastShot = null;
  let busy = false;
  /** @type {'test' | 'train' | ''} */
  let fixSplit = '';
  const counts = { test: 0, train: 0, nextIndex: 1 };

  /** @param {string} msg */
  const setStatus = (msg) => {
    statusEl.textContent = msg;
  };

  function syncSave() {
    const split = nextSplit(counts.test, counts.train);
    saveBtn.textContent = fixStem ? `Update ${fixStem}` : `Save as ${split} case`;
    const ready = Boolean(dir && lastShot && !busy);
    saveBtn.disabled = !ready;
    saveBtn.classList.toggle('is-ready', ready);
  }

  async function refreshCounts() {
    counts.test = 0;
    counts.train = 0;
    counts.nextIndex = 1;
    /** @type {Set<string>} */
    const itemNames = new Set();
    /** @type {Set<string>} */
    const bagNames = new Set();
    if (dir) {
      for await (const [name, handle] of dir.entries()) {
        const m = /^real-(\d+)\.truth\.json$/.exec(name);
        if (!m || handle.kind !== 'file') continue;
        counts.nextIndex = Math.max(counts.nextIndex, Number(m[1]) + 1);
        try {
          const truth = JSON.parse(await (await handle.getFile()).text());
          if (truth.split === 'test') counts.test += 1;
          else counts.train += 1;
          for (const it of truth.items || []) itemNames.add(String(it.name));
          for (const it of truth.skills || []) itemNames.add(String(it.name));
          for (const b of truth.bags || []) bagNames.add(String(b.name));
        } catch {
          counts.train += 1;
        }
      }
    }
    const done = counts.test + counts.train;
    const target = TARGET_TEST + TARGET_TRAIN;
    totalEl.textContent = String(done);
    barEl.style.width = `${Math.min(100, (done / target) * 100).toFixed(1)}%`;
    splitEl.textContent = `Test ${counts.test}/${TARGET_TEST} · Train ${counts.train}/${TARGET_TRAIN}`;
    coverEl.textContent = `Items seen ${itemNames.size}/${totals.items} · Bags seen ${bagNames.size}/${totals.bags}`;
    syncSave();
  }

  /** @param {FileSystemDirectoryHandle} handle */
  async function useDir(handle) {
    dir = handle;
    connectBtn.textContent = `Folder: ${handle.name}`;
    if (handle.name === 'inbox') {
      setStatus('This is the inbox folder. Connect the fixtures folder one level up, or these saves will not be scored.');
    } else if (handle.name !== 'fixtures') {
      setStatus('Heads up: connect the repo fixtures folder so the eval runner sees these.');
    }
    await refreshCounts();
  }

  async function restoreDir() {
    if (!('showDirectoryPicker' in window)) {
      connectBtn.disabled = true;
      setStatus('This browser has no folder access. Use Chrome or Edge.');
      return;
    }
    try {
      const handle = /** @type {FileSystemDirectoryHandle | undefined} */ (await idbGet(HANDLE_KEY));
      if (!handle) return;
      const perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') await useDir(handle);
      else connectBtn.textContent = `Reconnect ${handle.name}`;
    } catch (err) {
      console.warn('[label-tool] restore folder failed', err);
    }
  }

  async function onConnect() {
    try {
      // Must start the picker before any await, or the click gesture expires and nothing opens.
      // Always show it so a saved folder (for example inbox) can be replaced.
      const handle = await window.showDirectoryPicker({ id: 'bpb-fixtures', mode: 'readwrite' });
      await idbSet(HANDLE_KEY, handle);
      await useDir(handle);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error(err);
      setStatus("Couldn't open that folder.");
    }
  }

  async function onSave() {
    if (!dir || !lastShot || busy) return;
    const draft = state.getDraft();
    const truth = truthFromPlacements(draft.placements || [], itemsById);
    if (truth.unrecognized) {
      setStatus(`${truth.unrecognized} unrecognized item(s) left — replace or delete them first.`);
      return;
    }
    if (!truth.items.length && !truth.skills.length && !truth.jewels.length && !truth.bags.length) {
      setStatus('The board is empty — fix it to match the screenshot first.');
      return;
    }
    busy = true;
    syncSave();
    try {
      const split = fixStem && fixSplit ? fixSplit : nextSplit(counts.test, counts.train);
      const stem = fixStem || `${PREFIX}${String(counts.nextIndex).padStart(3, '0')}`;
      const { png, w, h } = await toPng(lastShot);
      const source = sourceSel.value;
      const file = {
        note: 'Hand-labeled with create ?label=1',
        source,
        ...(inboxSrc ? { sourceUrl: inboxSrc } : {}),
        split,
        labeledAt: new Date().toISOString(),
        shot: { w, h },
        items: truth.items,
        skills: truth.skills,
        jewels: truth.jewels,
        bagCells: truth.bagCells,
        bags: truth.bags,
      };
      await writeFile(dir, `${stem}.png`, png);
      await writeFile(dir, `${stem}.truth.json`, `${JSON.stringify(file, null, 2)}\n`);
      if (!fixStem) lastShot = null;
      if (inboxShot) {
        markInboxDone(inboxShot);
        await rememberInboxDone(dir, inboxShot, inboxSrc);
      }
      const socketCount = [...truth.items, ...truth.skills].reduce(
        (n, row) => n + (Array.isArray(row.gems) ? row.gems.filter(Boolean).length : 0),
        0,
      );
      const parts = [
        `${truth.items.length} items`,
        truth.skills.length ? `${truth.skills.length} skills` : '',
        truth.jewels.length ? `${truth.jewels.length} jewels` : '',
        socketCount ? `${socketCount} in slots` : '',
        `${truth.bags.length} bags`,
      ].filter(Boolean).join(', ');
      setStatus(
        fixStem
          ? `Updated ${stem}: ${parts}.`
          : inboxShot
            ? `Saved ${stem} (${split}). Head back to the inbox for the next one.`
            : `Saved ${stem} (${split}): ${parts}. Paste the next one.`,
      );
      await refreshCounts();
    } catch (err) {
      console.error(err);
      setStatus(err instanceof Error ? `Save failed: ${err.message}` : 'Save failed.');
    } finally {
      busy = false;
      syncSave();
    }
  }

  connectBtn.addEventListener('click', () => void onConnect());
  saveBtn.addEventListener('click', () => void onSave());
  sourceSel.addEventListener('change', () => localStorage.setItem(SOURCE_KEY, sourceSel.value));

  void restoreDir().then(() => (dir ? undefined : refreshCounts()));

  return {
    /**
     * Saved fixture from label check (?fix=real-NNN).
     * Does not re-run the detector — the board is the file you already saved.
     */
    async queuedFix() {
      if (!fixStem) return null;
      holdCreateDraft();
      try {
        const fix = await loadFixFixture(fixStem, itemsById);
        lastShot = fix.file;
        fixSplit = fix.split === 'test' || fix.split === 'train' ? fix.split : '';
        if (fix.source && [...sourceSel.options].some((o) => o.value === fix.source)) {
          sourceSel.value = fix.source;
        }
        refImg.src = fix.shotUrl;
        ref.hidden = false;
        const miss = fix.missing.length
          ? ` Not in the catalog: ${fix.missing.join(', ')}.`
          : '';
        setStatus(
          fix.empty
            ? `${fixStem} has no saved board. Place the items and bags to match the screenshot, then update.${miss}`
            : `Editing ${fixStem}. Change the board until it matches the screenshot, then update.${miss}`,
        );
        syncSave();
        return fix;
      } catch (err) {
        releaseCreateDraft();
        console.error('[label-tool] fix', err);
        setStatus(err instanceof Error ? err.message : `Couldn't open ${fixStem}.`);
        return null;
      }
    },
    /** Screenshot from an inbox link (?shot=), or null. */
    async queuedShot() {
      if (!inboxShot) return null;
      try {
        const res = await fetch(inboxShot);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.blob();
      } catch (err) {
        console.error('[label-tool] inbox shot', err);
        setStatus(`Couldn't load ${inboxShot}.`);
        return null;
      }
    },
    /** @param {File | Blob} file */
    setScreenshot(file) {
      lastShot = file;
      setStatus('Screenshot captured. Fix the board to match it, then save.');
      syncSave();
    },
    destroy() {
      panel.remove();
      showBtn.remove();
      css.remove();
    },
  };
}

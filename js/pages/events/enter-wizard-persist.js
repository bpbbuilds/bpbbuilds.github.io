/**
 * Persist enter-wizard UI + history.db across refresh (session).
 */

const META_PREFIX = 'bpb-event-enter-meta:';
const IDB_NAME = 'bpb-event-enter';
const IDB_STORE = 'historyDb';
const IDB_VERSION = 1;

/** @typedef {'account' | 'upload' | 'details'} WizardStep */

/**
 * @typedef {{
 *   open: boolean,
 *   step: WizardStep,
 *   title: string,
 *   notes: string,
 *   claimedDps: string,
 *   youtubeUrl: string,
 *   selectedRunId: number | null,
 *   roundIndex: number,
 *   fileName: string,
 *   savedAt: number,
 * }} EnterWizardMeta
 */

/**
 * @param {string} slug
 */
function metaKey(slug) {
  return `${META_PREFIX}${slug}`;
}

/**
 * @returns {Promise<IDBDatabase>}
 */
function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

/**
 * @param {string} slug
 * @returns {EnterWizardMeta | null}
 */
export function readEnterWizardMeta(slug) {
  try {
    const raw = sessionStorage.getItem(metaKey(slug));
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object' || !o.open) return null;
    return /** @type {EnterWizardMeta} */ (o);
  } catch {
    return null;
  }
}

/**
 * @param {string} slug
 * @param {Partial<EnterWizardMeta> & { open: boolean, step: WizardStep }} patch
 */
export function writeEnterWizardMeta(slug, patch) {
  try {
    const prev = readEnterWizardMeta(slug) || {
      open: false,
      step: /** @type {WizardStep} */ ('account'),
      title: '',
      notes: '',
      claimedDps: '',
      youtubeUrl: '',
      selectedRunId: null,
      roundIndex: 0,
      fileName: '',
      savedAt: 0,
    };
    const next = {
      ...prev,
      ...patch,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(metaKey(slug), JSON.stringify(next));
  } catch {
    /* private mode / quota */
  }
}

/**
 * @param {string} slug
 */
export function clearEnterWizardMeta(slug) {
  try {
    sessionStorage.removeItem(metaKey(slug));
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} slug
 * @param {ArrayBuffer} buffer
 * @param {string} [fileName]
 */
export async function saveEnterWizardDb(slug, buffer, fileName = 'history.db') {
  const db = await openIdb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.oncomplete = () => resolve(undefined);
    tx.onerror = () => reject(tx.error || new Error('IndexedDB write failed'));
    tx.objectStore(IDB_STORE).put(
      { buffer, fileName: String(fileName || 'history.db'), savedAt: Date.now() },
      slug,
    );
  });
  db.close();
}

/**
 * @param {string} slug
 * @returns {Promise<{ buffer: ArrayBuffer, fileName: string } | null>}
 */
export async function loadEnterWizardDb(slug) {
  try {
    const db = await openIdb();
    const row = await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(slug);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('IndexedDB read failed'));
    });
    db.close();
    if (!row?.buffer) return null;
    return {
      buffer: row.buffer,
      fileName: String(row.fileName || 'history.db'),
    };
  } catch {
    return null;
  }
}

/**
 * @param {string} slug
 */
export async function clearEnterWizardDb(slug) {
  try {
    const db = await openIdb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error || new Error('IndexedDB clear failed'));
      tx.objectStore(IDB_STORE).delete(slug);
    });
    db.close();
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} slug
 */
export async function clearEnterWizardSession(slug) {
  clearEnterWizardMeta(slug);
  await clearEnterWizardDb(slug);
}

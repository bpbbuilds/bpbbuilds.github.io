/**
 * Smoke: destination-based history unlock for create drag.
 * Run: node scripts/_test-history-drag-unlock.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** @type {Map<string, string>} */
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => {
    store.set(k, String(v));
  },
  removeItem: (k) => {
    store.delete(k);
  },
};

const { createEditorState } = await import(
  pathToFileURL(path.join(ROOT, 'js/pages/create/editor-state.js')).href
);

const miniHistory = {
  runId: 1,
  rounds: [
    {
      round: 1,
      result: 'win',
      placements: [{ id: 'garlic', x: 0, y: 0, r: 0 }],
    },
  ],
};

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    process.exit(1);
  }
}

// --- editor-state: priority free; park borrow; geometry awaits unlock ---
{
  const state = createEditorState();
  let askCount = 0;
  /** @type {boolean} */
  let unlockOk = false;
  state.setHistoryUnlockAsker(async () => {
    askCount += 1;
    if (!unlockOk) return false;
    state.clearHistory();
    return true;
  });

  state.replaceDraft({
    title: 'locked',
    placements: [
      { id: 'garlic', x: 1, y: 1, r: 0, key: 'p1', priority: null },
    ],
    parked: [{ id: 'banana', r: 0, key: 'park1' }],
    history: miniHistory,
  });

  assert(state.isHistoryLocked(), 'history attached');

  assert(state.setPriority('p1', 'needed') === true, 'priority while locked');
  assert(state.getDraft().history, 'history kept after priority');
  assert(askCount === 0, 'priority must not open unlock dialog');

  state.patchMeta({ route_r3_item_id: 'some_skill' });
  assert(state.getDraft().history, 'history kept after route meta');
  assert(askCount === 0, 'route meta must not open unlock dialog');

  const borrowed = state.takeParkedById('banana', { borrow: true });
  assert(borrowed?.id === 'banana', 'park borrow lift');
  assert(state.getParked().length === 0, 'park empty after borrow');
  assert(state.getDraft().history, 'history kept after park borrow');
  assert(askCount === 0, 'borrow must not ask unlock');

  state.appendParked([borrowed], { borrow: true });
  assert(state.getParked().length === 1, 'park restore borrow');
  assert(askCount === 0, 'restore borrow must not ask');

  const beforePlace = state.getDraft().placements.length;
  state.setPlacements([
    ...state.getDraft().placements,
    { id: 'stone', x: 2, y: 2, r: 0, key: 'p2' },
  ]);
  assert(
    state.getDraft().placements.length === beforePlace,
    'setPlacements blocked while locked',
  );
  assert(askCount === 1, 'geometry sync path still prompts (void)');

  unlockOk = true;
  askCount = 0;
  const unlocked = await state.requestHistoryUnlock();
  assert(unlocked, 'await unlock confirm');
  assert(!state.isHistoryLocked(), 'history cleared');
  assert(askCount === 1, 'unlock asked once');

  state.setPlacements([
    { id: 'garlic', x: 1, y: 1, r: 0, key: 'p1', priority: 'needed' },
    { id: 'stone', x: 2, y: 2, r: 0, key: 'p2' },
  ]);
  assert(state.getDraft().placements.length === 2, 'geometry ok after unlock');
}

// --- gem borrow update while locked ---
{
  const state = createEditorState();
  state.setHistoryUnlockAsker(async () => false);
  state.replaceDraft({
    placements: [
      {
        id: 'goobert',
        x: 0,
        y: 0,
        r: 0,
        key: 'g1',
        gems: ['ruby', ''],
      },
    ],
    history: miniHistory,
  });
  const ok = state.updatePlacement('g1', { gems: ['', ''] }, { borrow: true });
  assert(ok, 'gem borrow update');
  assert(state.getDraft().placements[0].gems?.[0] === '', 'gem lifted');
  assert(state.getDraft().history, 'history kept after gem borrow');
  const blocked = state.updatePlacement('g1', { gems: ['ruby', ''] });
  assert(!blocked, 'gem update without borrow blocked');
  assert(state.getDraft().placements[0].gems?.[0] === '', 'gem still empty');
}

// --- source contracts in drag modules ---
{
  const pointers = fs.readFileSync(
    path.join(ROOT, 'js/pages/create/drag-pointers.js'),
    'utf8',
  );
  const session = fs.readFileSync(
    path.join(ROOT, 'js/pages/create/drag-session.js'),
    'utf8',
  );

  assert(
    !/function beginCatalogDrag[\s\S]{0,200}isHistoryLocked/.test(pointers),
    'beginCatalogDrag must not early-out on history lock',
  );
  assert(
    pointers.includes('ensureHistoryUnlockedForGeometry'),
    'finishDrop awaits geometry unlock',
  );
  assert(
    pointers.includes('isPointerOverMeta') &&
      pointers.indexOf('isPointerOverMeta') <
        pointers.indexOf('ensureHistoryUnlockedForGeometry'),
    'meta path appears before geometry unlock helper use',
  );
  assert(
    /takeParkedById\?\.\(itemId, \{\s*borrow:\s*true\s*\}\)/.test(session) ||
      session.includes("takeParkedById?.(itemId, { borrow: true })"),
    'beginParkDrag uses borrow lift',
  );
  assert(
    pointers.includes('async function finishDropAsync'),
    'finishDropAsync is async',
  );
  assert(
    pointers.includes('await ensureHistoryUnlockedForGeometry()'),
    'geometry branch awaits unlock',
  );
}

console.log('OK history-drag-unlock smoke');

import assert from 'node:assert/strict';
import catalog from '../assets/data/history-decode-catalog.json' with { type: 'json' };
import { normalizeDraft } from '../js/pages/create/draft-io.js';
import { deserializeItems } from '../js/pages/create/history-decode.js';
import { serializeBuildInfo } from '../js/pages/create/history-encode.js';
import { ringEffectsFromPersistent } from '../js/shared/ring-config.js';

const importedEffects = [
  { trigger: 0, stack: 'blind' },
  { trigger: 2, stack: 'blind' },
];
const buildInfo = serializeBuildInfo(
  [{ id: 'magic_ring', x: 2, y: 3, r: 1, instance: { persistent: { magicRing: 552 } } }],
  catalog,
  100,
  20,
);
const decoded = deserializeItems(buildInfo, catalog, '1.1.9');
const draft = normalizeDraft({
  placements: decoded?.items.map((item, index) => ({
    id: item.id,
    x: item.x,
    y: item.y,
    r: item.r,
    key: `history-ring-${index}`,
    instance: item.persistent ? { persistent: item.persistent } : undefined,
  })),
});
const imported = draft?.placements[0];
assert.deepEqual(
  ringEffectsFromPersistent(imported?.instance?.persistent, 'magic_ring'),
  importedEffects,
  'Create draft restoration must keep imported ring effects',
);

const zeroInfo = serializeBuildInfo(
  [{ id: 'magic_ring', x: 0, y: 0, r: 0, instance: { persistent: { magicRing: 0 } } }],
  catalog,
  100,
  20,
);
const zeroDecoded = deserializeItems(zeroInfo, catalog, '1.1.9');
assert.deepEqual(
  zeroDecoded?.items[0]?.persistent?.effects,
  [
    { trigger: 0, stack: 'lucky' },
    { trigger: 0, stack: 'lucky' },
  ],
  'A zero-bit HistoryDB ring is a valid all-default ring configuration',
);

console.log('history ring Create smoke: ok');

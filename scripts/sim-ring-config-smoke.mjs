import assert from 'node:assert/strict';
import {
  RING_STACKS,
  RING_TRIGGERS,
  decodeRingEffects,
  encodeRingEffects,
  ringEffectCount,
  ringEffectsFromPersistent,
} from '../js/shared/ring-config.js';
import catalog from '../assets/data/history-decode-catalog.json' with { type: 'json' };
import { deserializeItems, ringPersistBits } from '../js/pages/create/history-decode.js';
import { serializeBuildInfo } from '../js/pages/create/history-encode.js';

const magic = [
  { trigger: 0, stack: 'blind' },
  { trigger: 2, stack: 'blind' },
];
assert.equal(ringEffectCount('magic_ring'), 2);
assert.equal(ringEffectCount('superior_ring'), 3);
assert.equal(ringPersistBits(catalog, 505), 12);
assert.equal(ringPersistBits(catalog, 506), 18);
assert.equal(RING_TRIGGERS.length, 4);
assert.equal(RING_STACKS.length, 10);
assert.deepEqual(RING_STACKS, [
  'lucky', 'regeneration', 'vampirism', 'spikes', 'mana',
  'empower', 'heat', 'poison', 'blind', 'cold',
]);
assert.deepEqual(decodeRingEffects(552, 2), magic);
assert.equal(encodeRingEffects(magic), 552);
assert.deepEqual(
  ringEffectsFromPersistent({ magicRing: 552 }, 'magic_ring'),
  magic,
);
const edited = [
  { trigger: 3, stack: 'poison' },
  { trigger: 1, stack: 'mana' },
  { trigger: 0, stack: 'lucky' },
];
assert.deepEqual(
  ringEffectsFromPersistent({ effects: edited }, 'superior_ring'),
  edited,
);
assert.equal(encodeRingEffects(edited), 226_560);
const buildInfo = serializeBuildInfo(
  [{ id: 'superior_ring', x: 1, y: 1, r: 0, instance: { persistent: { magicRing: 226_560 } } }],
  catalog,
  100,
  20,
);
const decoded = deserializeItems(buildInfo, catalog, '1.1.9');
assert.deepEqual(decoded?.items?.[0]?.persistent?.effects, edited);
console.log('ring config smoke: ok');

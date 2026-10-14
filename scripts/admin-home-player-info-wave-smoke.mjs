import assert from 'node:assert/strict';
import { orderAppearEntries } from '../js/shared/backpack-grid/appear-order.js';

const entries = [
  { id: 'bottom-right', x: 3, y: 3 },
  { id: 'top-right', x: 3, y: 0 },
  { id: 'middle-left', x: 0, y: 2 },
  { id: 'top-left', x: 0, y: 0 },
  { id: 'diagonal', x: 1, y: 1 },
  { id: 'next-diagonal', x: 2, y: 0 },
];

assert.deepEqual(
  orderAppearEntries(entries, 'diagonal').map((entry) => entry.id),
  ['top-left', 'next-diagonal', 'diagonal', 'middle-left', 'top-right', 'bottom-right'],
  'diagonal reveal starts at the top-left and advances toward the opposite corner',
);

assert.deepEqual(
  orderAppearEntries(entries, 'diagonal-top-right').map((entry) => entry.id),
  ['top-right', 'next-diagonal', 'top-left', 'diagonal', 'bottom-right', 'middle-left'],
  'Player Info reveal starts at the top-right and advances along a diagonal wave',
);

assert.deepEqual(
  orderAppearEntries(entries, 'reading').map((entry) => entry.id),
  ['top-left', 'next-diagonal', 'top-right', 'diagonal', 'middle-left', 'bottom-right'],
  'existing reading order remains available for non-Player Info surfaces',
);

console.log('Home Player info wave smoke passed.');

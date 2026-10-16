import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { potionInteractionPairs } = await import(new URL('../js/shared/potion-links.js', import.meta.url));

const potion = (id, shape = [[1], [1]]) => ({ id, type: 'Potion', shape });
const accessory = (id) => ({ id, type: 'Accessory', shape: [[1]] });
const items = new Map([
  ['lower', potion('lower')],
  ['upper', potion('upper')],
  ['side', potion('side')],
  ['sword', accessory('sword')],
  ['rotLower', potion('rotLower')],
  ['rotUpper', potion('rotUpper')],
]);

const linked = potionInteractionPairs(
  [
    { id: 'lower', key: 'lower-placement', x: 2, y: 2, r: 0 },
    { id: 'upper', key: 'upper-placement', x: 2, y: 0, r: 0 },
  ],
  items,
);
assert.equal(linked.length, 1, 'a potion must link to a potion in its primary cell above');
assert.equal(linked[0].sourceKey, 'lower-placement');
assert.equal(linked[0].targetKey, 'upper-placement');
assert.deepEqual(linked[0].sourceCell, { x: 2, y: 1 });

assert.equal(
  potionInteractionPairs(
    [
      { id: 'lower', key: 'lower-placement', x: 2, y: 2, r: 0 },
      { id: 'side', key: 'side-placement', x: 3, y: 0, r: 0 },
    ],
    items,
  ).length,
  0,
  'side-by-side potions must not create a connector',
);

assert.equal(
  potionInteractionPairs(
    [
      { id: 'lower', key: 'lower-placement', x: 2, y: 3, r: 0 },
      { id: 'upper', key: 'upper-placement', x: 2, y: 0, r: 0 },
    ],
    items,
  ).length,
  0,
  'a potion with a one-cell gap must not create a connector',
);

assert.equal(
  potionInteractionPairs(
    [
      { id: 'lower', key: 'lower-placement', x: 2, y: 2, r: 0 },
      { id: 'sword', key: 'sword-placement', x: 2, y: 0, r: 0 },
    ],
    items,
  ).length,
  0,
  'the affected item must itself be a potion',
);

const rotated = potionInteractionPairs(
  [
    { id: 'rotLower', key: 'rotated-lower', x: 2, y: 2, r: 1 },
    { id: 'rotUpper', key: 'rotated-upper', x: 3, y: 0, r: 0 },
  ],
  items,
);
assert.equal(rotated.length, 1, 'the rotated primary affected cell must be respected');
assert.deepEqual(rotated[0].sourceCell, { x: 3, y: 1 });

const duplicate = potionInteractionPairs(
  [
    { id: 'lower', key: 'lower-a', x: 5, y: 2, r: 0 },
    { id: 'upper', key: 'upper-a', x: 5, y: 0, r: 0 },
    { id: 'lower', key: 'lower-b', x: 7, y: 2, r: 0 },
    { id: 'upper', key: 'upper-b', x: 7, y: 0, r: 0 },
  ],
  items,
);
assert.deepEqual(
  duplicate.map(({ sourceKey, targetKey }) => [sourceKey, targetKey]),
  [
    ['lower-a', 'upper-a'],
    ['lower-b', 'upper-b'],
  ],
  'duplicate item ids must remain tied to their placement keys',
);

const css = await readFile(new URL('../js/shared/backpack-grid/backpack-grid.css', import.meta.url), 'utf8');
const pool = await readFile(new URL('../js/shared/backpack-grid/item-pool.js', import.meta.url), 'utf8');
const painter = await readFile(new URL('../js/shared/board-still/paint.js', import.meta.url), 'utf8');
const cache = await readFile(new URL('../js/shared/board-still/cache.js', import.meta.url), 'utf8');
const boardStill = await readFile(new URL('../js/shared/board-still/index.js', import.meta.url), 'utf8');
const todo = await readFile(new URL('../docs/todo.md', import.meta.url), 'utf8');
assert.match(pool, /renderPotionLinks/);
assert.match(css, /bpb-bg__potion-link/);
assert.match(css, /prefers-reduced-motion: reduce/);
assert.match(painter, /potionInteractionPairs/);
assert.match(cache, /v3\|/);
assert.match(boardStill, /potionInteractionPairs\(opts\.placements, opts\.itemsById\)/);
assert.match(todo, /\[x\] add potion lines animation for the potions/);
for (const page of ['index.html', 'create/index.html', 'sim/index.html', 'builds/index.html']) {
  const html = await readFile(new URL(`../${page}`, import.meta.url), 'utf8');
  assert.match(html, /backpack-grid\.css\?v=potionlinks2/);
}

console.log('potion interaction lines smoke passed');

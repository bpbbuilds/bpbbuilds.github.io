/**
 * Regression check for history.db items that are not in the live catalog.
 * Run after build-history-decode-catalog.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BitStream,
  deserializeItems,
  ensureHistoryCatalogItems,
} from '../js/pages/create/history-decode.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(
  fs.readFileSync(path.join(root, 'assets/data/history-decode-catalog.json'), 'utf8'),
);
const game = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts/_cache/game-items.json'), 'utf8'),
);
const layout = JSON.parse(
  fs.readFileSync(path.join(root, 'assets/data/library-layout.json'), 'utf8'),
);

if (catalog.gidToId?.['331'] !== 'book_of_ice_new') {
  throw new Error('history catalog does not map gid 331 to book_of_ice_new');
}
const fallback = catalog.historyOnly?.book_of_ice_new;
if (!fallback || fallback.image !== 'BookofIceNew.png' || !fallback.shape?.length) {
  throw new Error('history-only Book of Ice metadata is incomplete');
}

const layoutIds = new Set((layout.order || []).map((row) => String(row.id)));
const missingGameIds = (game.items || []).filter(
  (item) => item?.id && !layoutIds.has(String(item.id)),
);
for (const item of missingGameIds) {
  if (catalog.gidToId?.[String(item.gid)] !== String(item.id)) {
    throw new Error(`game gid ${item.gid} is not decodable (${item.id})`);
  }
  if (!catalog.historyOnly?.[String(item.id)]) {
    throw new Error(`game-only item ${item.id} has no render fallback`);
  }
}

const itemsById = new Map();
const added = ensureHistoryCatalogItems(itemsById, catalog);
if (added !== missingGameIds.length || !itemsById.has('book_of_ice_new')) {
  throw new Error('history-only items were not added to the runtime catalog map');
}

const bits = new BitStream();
bits.push(100, 999);
bits.push(100, 999);
bits.push(331, catalog.numItems);
bits.push(1, 10);
bits.push(1, 10);
bits.push(0, 4);
const decoded = deserializeItems(bits.toGodotString(), catalog, '1.1.0');
if (decoded?.items[0]?.id !== 'book_of_ice_new') {
  throw new Error('synthetic history frame did not recover gid 331');
}

console.log(
  `history catalog recovery ok: ${missingGameIds.length} game-only item(s), ` +
    `${added} runtime fallback item(s), gid 331 decoded`,
);

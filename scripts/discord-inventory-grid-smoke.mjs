#!/usr/bin/env node

/** Regression for paginated Discord inventory grid rendering. */

import assert from 'node:assert/strict';
import { loadImage } from '@napi-rs/canvas';
import {
  INVENTORY_PAGE_SIZE,
  handleInv,
  inventoryPage,
  renderInventoryGridPng,
} from '../bot/commands/inv.js';

const items = Array.from({ length: 10 }, (_, index) => ({
  id: `cosmetic_${index + 1}`,
  name: `Cosmetic ${index + 1}`,
  slot: 'hat',
  rarity: 'Common',
  file: '',
}));

assert.equal(INVENTORY_PAGE_SIZE, 9, 'inventory pages use a 3×3 grid');
assert.deepEqual(inventoryPage(items, 0).map((item) => item.id), items.slice(0, 9).map((item) => item.id));
assert.deepEqual(inventoryPage(items, 1).map((item) => item.id), ['cosmetic_10']);

const png = await renderInventoryGridPng(inventoryPage(items, 0));
const image = await loadImage(png);
assert.ok(image.width > 700 && image.height > 700, 'inventory grid renders a multi-cell image');

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => ({
  ok: true,
  async json() {
    return [{ display_name: 'Grid Tester', is_owner: true, plan: 'free', cosmetic_grants: [] }];
  },
});
let payload = null;
await handleInv({
  user: { id: '123456789012345678' },
  options: { getUser: () => null },
  deferReply: async () => {},
  editReply: async (next) => { payload = next; },
});
globalThis.fetch = originalFetch;
const embed = payload?.embeds?.[0]?.toJSON?.() || {};
assert.match(embed.description || '', /1\. \*\*|2\. \*\*/, 'inventory embed lists multiple page items');
assert.equal(embed.image?.url, 'attachment://inv.png', 'inventory embed uses the grid attachment');
assert.equal(payload?.components?.length, 1, 'inventory keeps paginated navigation');

console.log('Discord inventory grid smoke passed.');

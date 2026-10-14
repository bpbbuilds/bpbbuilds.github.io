#!/usr/bin/env node

/** Regression for Discord /item autocomplete timing and filtering. */

import assert from 'node:assert/strict';

const originalFetch = globalThis.fetch;
let fetchCalls = 0;
globalThis.fetch = async () => {
  fetchCalls += 1;
  return {
    ok: true,
    async json() {
      return [
        { id: 'hammer', name: 'Forging Hammer' },
        { id: 'wooden_sword', name: 'Wooden Sword' },
        { id: 'hammerhead', name: 'Hammerhead' },
      ];
    },
  };
};

const { handleItemAutocomplete, warmItemAutocomplete } = await import('../bot/commands/item.js');
await warmItemAutocomplete();
assert.equal(fetchCalls, 1, 'autocomplete catalog warms with one request');

let choices = null;
await handleItemAutocomplete({
  options: { getString: () => 'hammer' },
  respond: async (value) => { choices = value; },
});
assert.deepEqual(
  choices,
  [
    { name: 'Forging Hammer', value: 'hammer' },
    { name: 'Hammerhead', value: 'hammerhead' },
  ],
  'autocomplete filters the warmed catalog locally',
);

globalThis.fetch = async () => {
  await new Promise((resolve) => setTimeout(resolve, 3500));
  throw new Error('network should not be needed after warm-up');
};
let responded = false;
const started = Date.now();
await Promise.race([
  handleItemAutocomplete({
    options: { getString: () => 'wood' },
    respond: async () => { responded = true; },
  }),
  new Promise((resolve) => setTimeout(resolve, 250)),
]);
assert.equal(responded, true, `autocomplete responds from cache before Discord's 3-second deadline (${Date.now() - started}ms)`);

globalThis.fetch = originalFetch;
console.log('Discord item autocomplete smoke passed.');

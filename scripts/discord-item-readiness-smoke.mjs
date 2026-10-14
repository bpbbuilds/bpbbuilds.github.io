#!/usr/bin/env node

/** Regression for cold-start /item autocomplete and command-handler parity. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return {
    ok: true,
    async json() {
      return [{ id: 'hammer', name: 'Forging Hammer' }];
    },
  };
};

const { handleItemAutocomplete } = await import(`../bot/commands/item.js?cold=${Date.now()}`);
let responded = false;
await Promise.race([
  handleItemAutocomplete({
    options: { getString: () => 'hammer' },
    respond: async () => { responded = true; },
  }),
  new Promise((resolve) => setTimeout(resolve, 900)),
]);
assert.equal(responded, true, 'cold autocomplete acknowledges before Discord timeout');

globalThis.fetch = async () => new Promise((resolve) => {
  const timer = setTimeout(() => resolve({ ok: false }), 5000);
  timer.unref?.();
});
let timedOutResponded = false;
const started = Date.now();
await Promise.race([
  handleItemAutocomplete({
    options: { getString: () => 'hammer' },
    respond: async () => { timedOutResponded = true; },
  }),
  new Promise((resolve) => setTimeout(resolve, 2600)),
]);
assert.equal(timedOutResponded, true, `failed autocomplete still acknowledges before Discord timeout (${Date.now() - started}ms)`);

const { commands, getCommandHandler } = await import('../bot/commands/index.js');
const itemDefinition = commands.find((command) => command.name === 'item');
assert.ok(itemDefinition, 'item command remains registered');
assert.equal(typeof getCommandHandler('item'), 'function', 'registered item command has a live handler');
assert.equal(commands.every((command) => typeof getCommandHandler(command.name) === 'function'), true, 'every registered command has a live handler');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const watcher = fs.readFileSync(path.join(root, 'bot', 'watch.js'), 'utf8');
assert.match(watcher, /application\.commands\.set/, 'watcher reconciles the live guild command registry on startup');

globalThis.fetch = originalFetch;
console.log('Discord item readiness smoke passed.');

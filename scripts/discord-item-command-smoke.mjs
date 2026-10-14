#!/usr/bin/env node

/** Static/runtime contract for the Discord /item command. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const itemCommand = fs.readFileSync(path.join(root, 'bot', 'commands', 'item.js'), 'utf8');
const tooltip = fs.readFileSync(path.join(root, 'bot', 'item-tooltip.js'), 'utf8');
const commandIndex = fs.readFileSync(path.join(root, 'bot', 'commands', 'index.js'), 'utf8');
const botIndex = fs.readFileSync(path.join(root, 'bot', 'watch.js'), 'utf8');
const dockerfile = fs.readFileSync(path.join(root, 'bot', 'Dockerfile'), 'utf8');

assert.match(itemCommand, /name:\s*['"]item['"]/, 'item slash command is named item');
assert.match(itemCommand, /autocomplete:\s*true/, 'item command supports autocomplete');
assert.match(itemCommand, /setThumbnail\(['"]attachment:\/\/item\.png['"]\)/, 'item icon is the embed thumbnail');
assert.match(itemCommand, /setImage\(['"]attachment:\/\/item-tooltip\.png['"]\)/, 'tooltip render is the large embed image');
assert.match(itemCommand, /\[\$\{[^}]*buildCount[^}]*\} public builds\]\(/, 'build count is linked in the embed');
assert.match(itemCommand, /set\('q',\s*`\[\[\$\{[^}]*itemId[^}]*\}\]\]`\)/, 'build link uses the serialized item filter');
for (const label of ['Damage', 'Stamina', 'Accuracy', 'Cooldown', 'Cost', 'Rarity', 'Class', 'Category', 'Effects']) {
  assert.match(itemCommand, new RegExp(`name:\\s*['"]${label}['"]`), `${label} is included in the item embed`);
}
assert.match(tooltip, /TooltipBase_\$\{/, 'tooltip image uses the item tooltip frame');
assert.match(tooltip, /damageMin|damage_min/, 'tooltip image includes combat values');
assert.match(tooltip, /effect/, 'tooltip image includes the item effect');
assert.match(commandIndex, /itemCommand|handleItem/, 'command registry imports the item command');
assert.match(botIndex, /handleItemAutocomplete|isAutocomplete/, 'bot routes item autocomplete interactions');
assert.match(itemCommand, /warmItemAutocomplete/, 'item autocomplete exposes a warm catalog path');
assert.match(botIndex, /warmItemAutocomplete\(\)/, 'bot warms the autocomplete catalog when Discord is ready');
for (const asset of [
  'assets/tooltips/frames',
  'assets/tooltips/dividers',
  'assets/fonts/libre-baskerville-tooltip.ttf',
  'assets/fonts/libre-baskerville-tooltip-bold.ttf',
  'assets/fonts/milonga-tooltip.ttf',
]) {
  assert.match(dockerfile, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${asset} is available in the bot image`);
}

const { itemEmbed, mapItem, buildsForItemUrl } = await import('../bot/commands/item.js');
const sample = mapItem({
  id: 'sample_item',
  name: 'Sample Item',
  rarity: 'Rare',
  type: 'Weapon',
  class: 'Ranger',
  extra_types: ['Dark'],
  tags: ['Vampiric'],
  effect: 'Deal 10 damage.',
  damage_min: 10,
  damage_max: 12,
  stamina_cost: 2,
  accuracy: 95,
  cooldown: 1,
  cost: 3,
});
const embed = itemEmbed(sample, 7).toJSON();
assert.equal(embed.thumbnail?.url, 'attachment://item.png', 'item thumbnail attachment is wired');
assert.equal(embed.image?.url, 'attachment://item-tooltip.png', 'tooltip attachment is wired');
assert.match(embed.fields?.find((field) => field.name === 'Builds using this item')?.value || '', /\[7 public builds\]\(/, 'build count is rendered');
assert.equal(buildsForItemUrl(sample.id), 'https://bpbbuilds.com/builds/?q=%5B%5Bsample_item%5D%5D', 'build filter URL is stable');

console.log('discord item command smoke passed.');

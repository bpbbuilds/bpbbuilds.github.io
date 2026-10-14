#!/usr/bin/env node

/**
 * Rebuild the source-backed item catalog embedded in docs/sim/combat-start-sequence.md.
 *
 * The catalog is intentionally derived from the checked-in game extract inventory,
 * not from the simulator's handler registry. That keeps the audit honest when an
 * extracted item is not yet ported or when a family handler is shared.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inventoryPath = path.join(root, 'assets/data/sim-item-inventory.json');
const itemCachePath = path.join(root, 'scripts/_cache/game-items.json');
const priorityPath = path.join(root, 'js/pages/sim/engine/combat-start-priority.js');
const docPath = path.join(root, 'docs/sim/combat-start-sequence.md');

const SUPPORT_IDS = new Set([
  'bow',
  'card',
  'dragonegg',
  'chesspiece',
  'forestfriend',
  'goldcounter',
  'recombobulator',
  'rotationspring',
  'food',
  'amethyst',
  'emerald',
  'ruby',
  'sapphire',
  'topaz',
  'gemsocket',
  'itempushzone',
  'socketsnode',
  'bagborder',
  'weapon',
]);

const START_METHODS = [
  ['onPrepare', 'Preparation / listener registration'],
  ['onPreCombatStart', 'Pre-combat-start pass'],
  ['onCombatStart', 'Combat-start pass'],
  ['onPostCombatStart', 'Post-combat-start pass'],
  ['combatStartInventory', 'Inventory-start gem effects'],
];

const PRIORITY_VALUES = {
  Highest: 10000,
  High: 1000,
  Normal: 0,
  Low: -1000,
  Lowest: -10000,
};

const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8')).byId;
const itemCache = JSON.parse(fs.readFileSync(itemCachePath, 'utf8')).items;
const names = new Map(itemCache.map((item) => [item.id, item.displayName || item.name]));
const extractedRows = Object.values(inventory)
  .filter((item) => !SUPPORT_IDS.has(item.id))
  .sort((a, b) => a.id.localeCompare(b.id));
const extractedIds = new Set(extractedRows.map((item) => item.id));
const catalogOnlyRows = itemCache
  .filter((item) => !extractedIds.has(item.id))
  .map((item) => ({ id: item.id, file: null, overrides: [] }));
const rows = [...extractedRows, ...catalogOnlyRows].sort((a, b) => a.id.localeCompare(b.id));

function titleCase(id) {
  return id
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function cleanText(value) {
  return String(value)
    .replaceAll('â€™', "'")
    .replaceAll('â€œ', '"')
    .replaceAll('â€', '"')
    .replaceAll('â€“', '-')
    .replaceAll('â€”', '-')
    .replaceAll('Â ', ' ');
}

function label(item) {
  const displayName = cleanText(names.get(item.id) || titleCase(item.id));
  return `${displayName} (\`${item.id}\`)`;
}

function sourceLabel(item) {
  return item.file ? ` — ${item.file}` : '';
}

function list(items, includeSource = false) {
  if (!items.length) return '- None.';
  return items
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((item) => `- ${label(item)}${includeSource ? sourceLabel(item) : ''}`)
    .join('\n');
}

function parsePriorities() {
  const source = fs.readFileSync(priorityPath, 'utf8');
  const priorities = new Map();
  const re = /^\s{2}([a-z0-9_]+): PRIORITY\.([A-Za-z]+)(?:\s*\+\s*(\d+))?,?\s*$/gm;
  for (const match of source.matchAll(re)) {
    const base = PRIORITY_VALUES[match[2]];
    if (base === undefined) continue;
    priorities.set(match[1], base + Number(match[3] || 0));
  }
  return priorities;
}

function priorityName(value) {
  if (value === 10000) return 'Highest';
  if (value === 1000) return 'High';
  if (value >= 1000) return `High + ${value - 1000}`;
  if (value > 0) return `Normal + ${value}`;
  if (value === 0) return 'Normal';
  if (value <= -10000) return 'Lowest';
  if (value <= -1000) return `Low${value === -1000 ? '' : ` (${value})`}`;
  return String(value);
}

function buildCatalog() {
  const priorities = parsePriorities();
  const byPriority = new Map();
  for (const [id, value] of priorities) {
    if (!byPriority.has(value)) byPriority.set(value, []);
    byPriority.get(value).push(inventory[id] || { id });
  }

  const lines = [];
  lines.push('<!-- GENERATED_COMBAT_START_CATALOG:BEGIN -->');
  lines.push('## Complete item classification');
  lines.push('');
  lines.push(
    `This appendix is generated from the extracted script inventory plus the game item catalog (${rows.length} catalog items: ${extractedRows.length} scripted rows and ${catalogOnlyRows.length} catalog-only rows). ` +
      'A script can appear in more than one lifecycle list when it overrides more than one hook. ' +
      'The simulator priority map is an explicit override map; every item not listed in the priority table has source priority Normal (0).',
  );
  lines.push('');
  lines.push(
    'Source inputs: `assets/data/sim-item-inventory.json`, `scripts/_cache/game-items.json`, and `js/pages/sim/engine/combat-start-priority.js`.',
  );
  lines.push('');
  lines.push('### Explicit trigger-priority overrides');
  lines.push('');
  lines.push('| Priority class | Value | Complete item list |');
  lines.push('| --- | ---: | --- |');
  for (const value of [...byPriority.keys()].sort((a, b) => b - a)) {
    const items = byPriority.get(value).sort((a, b) => a.id.localeCompare(b.id));
    lines.push(`| ${priorityName(value)} | ${value} | ${items.map(label).join(', ')} |`);
  }
  lines.push('');
  lines.push(
    'The rows above are the complete non-default map in `COMBAT_START_PRIORITY`; they are not representative examples. ' +
      'Equal-priority items are still shuffled within each side, and the player batch still runs before the opponent batch.',
  );
  lines.push('');

  const priorityIds = new Set(priorities.keys());
  const lifecycleIds = new Set(
    rows
      .filter((item) => (item.overrides || []).some((method) => START_METHODS.some(([name]) => name === method)))
      .map((item) => item.id),
  );
  const normalLifecycleCount = [...lifecycleIds].filter((id) => !priorityIds.has(id)).length;
  const normalNoHookCount = rows.filter((item) => !priorityIds.has(item.id) && !lifecycleIds.has(item.id)).length;
  lines.push(
    `Coverage check: ${priorityIds.size} explicit-priority items + ${normalLifecycleCount} default-Normal items with a direct start hook + ${normalNoHookCount} default-Normal items without a direct start hook = ${rows.length} catalog items.`,
  );
  lines.push('');
  lines.push(
    'The priority table is the ordering classification. The lifecycle lists below subdivide the remaining Normal (0) items by what they do during preparation/start; an item can occur in multiple lifecycle lists when the source overrides multiple hooks.',
  );
  lines.push('');

  for (const [method, heading] of START_METHODS) {
    const hooked = rows.filter((item) => (item.overrides || []).includes(method));
    lines.push(`### ${heading} (\`${method}\`) — ${hooked.length} items`);
    lines.push('');
    lines.push(list(hooked));
    lines.push('');
  }

  const noStartHook = rows.filter(
    (item) =>
      !priorityIds.has(item.id) &&
      !(item.overrides || []).some((method) => START_METHODS.some(([name]) => name === method)),
  );
  lines.push(`### Default Normal items with no direct start hook — ${noStartHook.length} items`);
  lines.push('');
  lines.push(
    'These catalog items do not directly override one of the five lifecycle hooks above. ' +
      'Their priority is Normal (0) unless they also appear in the explicit priority table. ' +
      'A no-direct-hook row is not a claim of no combat behavior: it may use an inherited hook, a reactive callback such as `onDamaged`, or ordinary cooldown/trigger behavior later in the fight.',
  );
  lines.push('');
  lines.push(list(noStartHook));
  lines.push('');

  lines.push('### Extracted base/support classes (not catalog items)');
  lines.push('');
  lines.push(
    'The extract also contains these shared classes. They are intentionally excluded from the item counts above and are covered through their derived items: ' +
      [...SUPPORT_IDS].sort().map((id) => `\`${id}\``).join(', ') + '.',
  );
  lines.push('');
  lines.push(
    'If a new item script or source hook is added, rerun `node scripts/build-combat-start-catalog.mjs` and review the resulting diff. ' +
      'This keeps the audit complete without hand-maintaining a second item registry.',
  );
  lines.push('<!-- GENERATED_COMBAT_START_CATALOG:END -->');
  return lines.join('\n');
}

const doc = fs.readFileSync(docPath, 'utf8');
const generated = buildCatalog();
const begin = '<!-- GENERATED_COMBAT_START_CATALOG:BEGIN -->';
const end = '<!-- GENERATED_COMBAT_START_CATALOG:END -->';
const beginIndex = doc.indexOf(begin);
const endIndex = doc.indexOf(end);
let next;
if (beginIndex >= 0 && endIndex > beginIndex) {
  next = `${doc.slice(0, beginIndex)}${generated}${doc.slice(endIndex + end.length)}`;
} else {
  const anchor = '## Phase details';
  const anchorIndex = doc.indexOf(anchor);
  if (anchorIndex < 0) throw new Error(`Could not find ${anchor} in ${docPath}`);
  next = `${doc.slice(0, anchorIndex)}${generated}\n\n${doc.slice(anchorIndex)}`;
}
fs.writeFileSync(docPath, next);
console.log(`Updated ${path.relative(root, docPath)} with ${rows.length} item scripts.`);

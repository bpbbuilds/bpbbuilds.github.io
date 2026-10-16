import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';

import {
  PRISMATIC_ORB_SECTION_KEYS,
  countPrismaticOrbSections,
} from '../js/shared/prismatic-orb.js';

const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/RainbowOrb.gd',
  'utf8',
);
const csv = fs.readFileSync(
  'tools/game-extract-full/Sheets/CSV/ExclusiveItems.csv',
  'utf8',
);
const tooltipSource = fs.readFileSync('js/shared/tooltip.js', 'utf8');
const catalogSource = fs.readFileSync('js/pages/items/catalog/index.js', 'utf8');
const boardStatsSource = fs.readFileSync('js/pages/create/board-live-stats.js', 'utf8');

assert.match(source, /countTypes\(getAffectedItems\(\)\)/);
assert.match(source, /insertCounter\(descr, "n_magic"/);
assert.match(source, /insertCounter\(descr, "n_vampiric"/);
assert.match(source, /insertCounter\(descr, "n_holy"/);
assert.match(source, /insertCounter\(descr, "n_dark"/);
assert.match(csv, /^Rainbow Orb_Counter,.*\$num/m);
assert.match(tooltipSource, /prismaticSectionCounts/);
assert.match(catalogSource, /countPrismaticOrbSections\(items\)/);
assert.match(boardStatsSource, /prismaticOrbTypes\(item\)/);
assert.match(boardStatsSource, /strictPrismaticTypes/);
assert.match(boardStatsSource, /type\.includes\(k\)/);

assert.deepEqual(PRISMATIC_ORB_SECTION_KEYS, ['magic', 'vampiric', 'holy', 'dark']);

const items = [
  { id: 'magic-staff', type: 'Accessory', extraTypes: ['Magic'], tags: ['not-a-type'] },
  { id: 'vampiric-armor', type: 'Armor', extraTypes: ['Vampiric'] },
  { id: 'holy-armor', type: 'Armor', extraTypes: ['Holy'] },
  { id: 'dark-lantern', type: 'Accessory', extraTypes: ['Dark'] },
  { id: 'multi-type', type: 'Accessory', extraTypes: ['Magic', 'Holy'] },
  { id: 'tag-only', type: 'Accessory', extraTypes: [], tags: ['Magic', 'Dark'] },
];

assert.deepEqual(countPrismaticOrbSections(items), {
  magic: 2,
  vampiric: 1,
  holy: 2,
  dark: 1,
});

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent('<body></body>');
  await page.addScriptTag({ path: 'js/shared/tooltip.js' });
  const effectText = await page.evaluate(() => {
    const root = window.ItemTooltip.render({
      id: 'rainbow_orb',
      name: 'Prismatic Orb',
      rarity: 'Godly',
      type: 'Accessory',
      class: 'Neutral',
      cost: 14,
      effect:
        'Start of battle: For each...\\n<Star> <Magic> item<N_magic>: Gain 2 <Mana>.\\n<Star> <Vampiric> item<N_vampiric>: Gain 1 <Vampirism>.\\n<Star> <Holy> item<N_holy>: Increase your healing by 4%.\\n<Star> <Dark> item<N_dark>: Inflict a random debuff.',
      prismaticSectionCounts: { magic: 2, vampiric: 1, holy: 2, dark: 1 },
      params: {},
    });
    document.body.append(root);
    return root.querySelector('.bpb-tooltip__effect')?.textContent || '';
  });
  assert.deepEqual(
    [...effectText.matchAll(/item\s+\((\d+)\)/g)].map((match) => Number(match[1])),
    [2, 1, 2, 1],
  );
} finally {
  await browser.close();
}

console.log('Prismatic Orb tooltip smoke passed.');

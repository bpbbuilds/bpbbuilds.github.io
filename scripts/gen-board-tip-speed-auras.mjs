/**
 * Build assets/data/board-tip-speed-auras.json from game Item/*.gd
 * prepare / combat_start addSpeed|reduceSpeed patterns.
 *
 * Tip parity: inventory tips reflect onPrepare speed. Create board also
 * includes combat_start neighbor auras (Gloves, Falcon, …) so placed
 * builds show green/red CDs before hitting Play.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const itemsRoot = path.join(root, 'tools/game-extract-full/Items');
const inv = JSON.parse(
  fs.readFileSync(path.join(root, 'assets/data/sim-item-inventory.json'), 'utf8'),
);

/** @type {Map<string, string>} */
const stemToId = new Map();
for (const v of Object.values(inv.byId || {})) {
  if (!v || typeof v !== 'object') continue;
  if (v.scriptStem) stemToId.set(v.scriptStem, v.id);
  const stem = path.basename(String(v.file || ''), '.gd');
  if (stem) stemToId.set(stem, v.id);
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function walkGd(dir) {
  /** @type {string[]} */
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkGd(p));
    else if (ent.name.endsWith('.gd')) out.push(p);
  }
  return out;
}

/**
 * @param {string} text
 * @param {string} name
 */
function funcBody(text, name) {
  const re = new RegExp(`func ${name}\\(\\):([\\s\\S]*?)(?=\\nfunc |\\Z)`);
  const m = text.match(re);
  return m ? m[1] : '';
}

/**
 * @param {string} body
 * @param {string} fallback
 */
function guessParam(body, fallback = 'speed') {
  const named = body.match(/getP\(\s*"([a-z0-9_]+)"\s*\)\s*\/\s*100/i);
  if (named) return named[1];
  const p = body.match(/getP([1-5])\(\)\s*\/\s*100/);
  if (p) return `p${p[1]}`;
  const namedAny = body.match(/getP\(\s*"([a-z0-9_]+)"\s*\)/i);
  if (namedAny) return namedAny[1];
  return fallback;
}

/**
 * @param {string} body
 * @param {string} when
 */
function classify(body, when) {
  /** @type {object[]} */
  const modes = [];
  const hasReduce = /\.reduceSpeed\s*\(/.test(body) || /reduceSpeed\s*\(/.test(body);
  const hasAdd = /\.addSpeed\s*\(/.test(body) || /(?<!\.)addSpeed\s*\(/.test(body);

  // Self haste × affected count (Echoing, Flute, books, …)
  if (
    /^\s*addSpeed\([^;\n]*getNum(?:Distinct)?Affected/m.test(body) ||
    /^\s*addSpeed\([^;\n]*num/m.test(body)
  ) {
    modes.push({
      mode: 'self_per_links',
      sign: 1,
      param: guessParam(body, 'speed'),
    });
  }

  // First link only (Con-Trap, Uniquely Unique)
  if (
    /affectedItems\[0\]\.(?:add|reduce)Speed/.test(body) ||
    (/for\s+\w+\s+in\s+getAffectedItems/.test(body) &&
      /\bbreak\b/.test(body) &&
      /\.(?:add|reduce)Speed/.test(body))
  ) {
    const sign = /affectedItems\[0\]\.reduceSpeed|\.reduceSpeed/.test(body) &&
      !/affectedItems\[0\]\.addSpeed/.test(body)
      ? -1
      : /\[0\]\.addSpeed/.test(body)
        ? 1
        : hasReduce && !hasAdd
          ? -1
          : 1;
    modes.push({
      mode: 'first_link',
      sign,
      param: guessParam(body, 'speed'),
    });
  }

  // Per canAffect link
  if (
    /for\s+.+\s+in\s+getAffectedItems/.test(body) &&
    /\.(?:add|reduce)Speed/.test(body) &&
    !modes.some((m) => m.mode === 'first_link')
  ) {
    const linkBlock = body.match(
      /for\s+.+\s+in\s+getAffectedItems[\s\S]{0,400}/,
    )?.[0] || body;
    const sign = /\.reduceSpeed/.test(linkBlock) && !/\.addSpeed/.test(linkBlock) ? -1 : 1;
    modes.push({
      mode: 'links',
      sign,
      param: guessParam(linkBlock, guessParam(body, 'speed')),
    });
  }

  // Bag cargo
  if (
    /getItemsInside|getAffectedItemsInside/.test(body) &&
    /\.(?:add|reduce)Speed/.test(body)
  ) {
    const block =
      body.match(
        /(?:getItemsInside|getAffectedItemsInside)[\s\S]{0,350}/,
      )?.[0] || body;
    const sign = /\.reduceSpeed/.test(block) && !/\.addSpeed/.test(block) ? -1 : 1;
    modes.push({
      mode: 'cargo',
      sign,
      param: guessParam(block, guessParam(body, 'speed')),
      requireCooldown: true,
    });
  }

  // All weapons in inventory (Time Dilator, Gold Armor, Dual Wielding)
  if (
    /(?:isWeapon\(\)|hasType\(Type\.Weapon\)|Type\.Weapon)/.test(body) &&
    /\.(?:add|reduce)Speed/.test(body)
  ) {
    const sign = /\.reduceSpeed/.test(body) && !/\.addSpeed/.test(body) ? -1 : 1;
    modes.push({
      mode: 'all_weapons',
      sign,
      param: guessParam(body, when === 'prepare' ? 'slow' : 'speed'),
    });
  }

  // Knife / inventory-wide non-weapon loops left as custom notes
  if (
    /for\s+\w+\s+in\s+inventory\.getItems/.test(body) &&
    /\.(?:add|reduce)Speed/.test(body) &&
    !modes.some((m) => m.mode === 'all_weapons')
  ) {
    modes.push({
      mode: 'inventory_loop',
      sign: 1,
      param: guessParam(body, 'speed'),
    });
  }

  if (!modes.length && (hasAdd || hasReduce)) {
    modes.push({
      mode: 'unknown',
      sign: hasReduce && !hasAdd ? -1 : 1,
      param: guessParam(body, 'speed'),
    });
  }

  return modes;
}

/** Manual overrides — game-accurate tip auras (param names + modes). */
const MANUAL = {
  echoing_battlecry: {
    when: 'prepare',
    modes: [{ mode: 'self_per_links', sign: 1, param: 'speed', fallback: 65 }],
  },
  sloth: {
    when: 'prepare',
    modes: [{ mode: 'links', sign: -1, param: 'speed', fallback: 30 }],
  },
  con_trap_tron: {
    when: 'prepare',
    modes: [{ mode: 'first_link', sign: -1, param: 'speed', fallback: 10 }],
  },
  flute: {
    when: 'prepare',
    modes: [{ mode: 'self_per_links', sign: 1, param: 'p3', fallback: 10 }],
  },
  fanfare: {
    when: 'prepare',
    modes: [{ mode: 'self_per_links', sign: 1, param: 'p5', fallback: 5 }],
  },
  wolpertinger: {
    when: 'prepare',
    modes: [{ mode: 'self_per_links', sign: 1, param: 'p3', fallback: 5 }],
  },
  twine_badge: {
    when: 'prepare',
    modes: [{ mode: 'links', sign: 1, param: 'speed', fallback: 10 }],
  },
  sewing_case: {
    when: 'prepare',
    modes: [{ mode: 'cargo', sign: 1, param: 'speed', fallback: 10, requireCooldown: true }],
  },
  puzzlebox: {
    when: 'prepare',
    modes: [{ mode: 'cargo', sign: -1, param: 'speed', fallback: 20, requireCooldown: true }],
  },
  puzzle_badge: {
    when: 'prepare',
    modes: [{ mode: 'links', sign: -1, param: 'speed', fallback: 20 }],
  },
  time_dilator: {
    when: 'prepare',
    modes: [{ mode: 'all_weapons', sign: -1, param: 'slow', fallback: 10 }],
  },
  gold_armor: {
    when: 'prepare',
    modes: [{ mode: 'all_weapons', sign: -1, param: 'speed', fallback: 10 }],
  },
  dual_wielding: {
    when: 'prepare',
    modes: [
      {
        mode: 'all_weapons_stamina',
        sign: 1,
        param: 'speed',
        fallback: 15,
        needExactly: 2,
      },
    ],
  },
  markswoman: {
    when: 'prepare',
    modes: [{ mode: 'links', sign: 1, param: 'speed', fallback: 10 }],
  },
  uniquely_unique: {
    when: 'prepare',
    modes: [{ mode: 'first_link', sign: 1, param: 'speed', fallback: 20 }],
  },
  knife_to_meet_you: {
    when: 'prepare',
    modes: [
      { mode: 'inventory_type', sign: 1, param: 'speed', fallback: 10, type: 'dagger' },
      { mode: 'self_per_links', sign: 1, param: 'speed2', fallback: 5 },
    ],
  },
  shielded: {
    when: 'prepare',
    modes: [{ mode: 'links_armor_cd', sign: 1, param: 'speed', fallback: 10 }],
  },
  gloves_of_haste: {
    when: 'combat_start',
    modes: [{ mode: 'links', sign: 1, param: 'p1', fallback: 20 }],
  },
  vampiric_gloves: {
    when: 'combat_start',
    modes: [{ mode: 'links', sign: 1, param: 'speed', fallback: 15 }],
  },
  falcon_blade: {
    when: 'combat_start',
    modes: [{ mode: 'links', sign: 1, param: 'p1', fallback: 15 }],
  },
  stone_gloves: {
    when: 'combat_start',
    modes: [{ mode: 'links', sign: -1, param: 'speedreduction', fallback: 20 }],
  },
  fanny_pack: {
    when: 'combat_start',
    modes: [{ mode: 'cargo', sign: 1, param: 'p1', fallback: 15, requireCooldown: true }],
  },
  toolbox: {
    when: 'combat_start',
    modes: [
      {
        mode: 'cargo',
        sign: -1,
        param: 'speedreduction',
        fallback: 20,
        requireEmpowerable: true,
      },
    ],
  },
  // Amulet of Energy (AmuletofAgility.gd) — combat-start haste on CD links.
  amulet_of_agility: {
    when: 'combat_start',
    modes: [{ mode: 'links', sign: 1, param: 'speed', fallback: 15 }],
  },
  extra_bags: {
    when: 'prepare',
    modes: [{ mode: 'links_empty_secondary', sign: 1, param: 'speed', fallback: 5 }],
  },
  book_of_darkness: {
    when: 'prepare',
    modes: [{ mode: 'self_per_links', sign: 1, param: 'speed', fallback: 10 }],
  },
  book_of_ice: {
    when: 'prepare',
    modes: [{ mode: 'self_per_links', sign: 1, param: 'speed', fallback: 10 }],
  },
  book_of_light: {
    when: 'prepare',
    modes: [{ mode: 'self_per_links', sign: 1, param: 'speed', fallback: 10 }],
  },
  book_of_nature: {
    when: 'prepare',
    modes: [{ mode: 'self_per_links', sign: 1, param: 'speed', fallback: 10 }],
  },
  prismatic_sword: {
    when: 'prepare',
    modes: [{ mode: 'self_per_type', sign: 1, param: 'speed', fallback: 5, type: 'magic' }],
  },
  ultima: {
    when: 'prepare',
    modes: [{ mode: 'self_per_type', sign: 1, param: 'speed', fallback: 5, type: 'spell' }],
  },
};

/** @type {Record<string, object>} */
const byId = { ...MANUAL };

for (const file of walkGd(itemsRoot)) {
  const stem = path.basename(file, '.gd');
  const id = stemToId.get(stem);
  if (!id || byId[id]) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const [hook, when] of [
    ['onPrepare', 'prepare'],
    ['onCombatStart', 'combat_start'],
  ]) {
    const body = funcBody(text, hook);
    if (!body || (!body.includes('addSpeed') && !body.includes('reduceSpeed'))) {
      continue;
    }
    // Skip combat_start unless we already want them in MANUAL — prepare only auto
    if (when === 'combat_start') continue;
    const modes = classify(body, when);
    if (!modes.length) continue;
    // Attach fallbacks
    for (const m of modes) {
      if (m.fallback == null) m.fallback = 10;
    }
    byId[id] = { when, modes, auto: true, stem };
    break;
  }
}

// Food base prepare: +10% per affected — apply to Food-family with CD
byId['__food_base__'] = {
  when: 'prepare',
  modes: [{ mode: 'food_self_per_links', sign: 1, param: null, fallback: 10 }],
  note: 'Food.gd prepare()',
};

const out = {
  generatedAt: new Date().toISOString(),
  source: 'tools/game-extract-full/Items/**/*.gd',
  note:
    'Create-board tip speed auras. prepare = inventory tip parity; combat_start included for common neighbor haste so tips match what players expect on a placed board.',
  auras: byId,
};

const outPath = path.join(root, 'assets/data/board-tip-speed-auras.json');
fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
console.log('wrote', outPath, 'auras', Object.keys(byId).length);

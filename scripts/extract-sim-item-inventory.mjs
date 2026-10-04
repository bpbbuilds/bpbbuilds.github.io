/**
 * Scan Items/*.gd combat overrides → assets/data/sim-item-inventory.json
 * Run: node scripts/extract-sim-item-inventory.mjs
 */
import fs from 'fs';
import path from 'path';

const ITEMS_DIR = 'tools/game-extract-full/Items';
const GAME_ITEMS = 'scripts/_cache/game-items.json';
const OUT = 'assets/data/sim-item-inventory.json';

const METHODS = [
  'doCooldownEffect',
  'doRevealEffect',
  'onCombatStart',
  'combatStartInventory',
  'onPreCombatStart',
  'onPostCombatStart',
  'trigger',
  'dealDamage',
  'onDealtDamage',
  'onPreDealDamage_early',
  'onPreDealDamage_late',
];

const BASE_ITEM_SCRIPTS = new Set(['Item.gd', 'Potion.gd', 'Bag.gd', 'Shield.gd', 'Gem.gd']);
// These scripts provide shared engine dispatch, not item-specific overrides.
// Keep them in inheritedFiles for provenance, but do not make every child
// appear to override their generic lifecycle methods.
const GENERIC_INHERITED_SCRIPTS = new Set([
  'Item.gd',
  'Potion.gd',
  'Bag.gd',
  'Shield.gd',
  'Gem.gd',
  'Card.gd',
  'Skill.gd',
  'Weapon.gd',
  'RangedWeapon.gd',
  'Bow.gd',
]);
const SOURCE_EVIDENCE_METHODS = new Set([
  '_ready',
  'canAffect',
  'canAffect_global',
  'cardSecondaryEffectActive',
  'prepareInventory',
  'prepareWeapon',
  'prepareArmor',
  'combatStartArmor',
  'combatEndArmor',
  'removeDebuffResistance',
  'hasCooldown',
  'onHotSwapHoverWithGemEnd',
]);

function walk(dir, out = [], { includeBase = false } = {}) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'Animations') continue;
      walk(full, out, { includeBase });
    } else if (
      ent.name.endsWith('.gd') &&
      (includeBase || !BASE_ITEM_SCRIPTS.has(ent.name))
    ) {
      out.push(full);
    }
  }
  return out;
}

function slugify(name) {
  return (
    String(name || '')
      .toLowerCase()
      .replace(/['']/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 80) || 'item'
  );
}

function normKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

function loadItemIndex() {
  const raw = JSON.parse(fs.readFileSync(GAME_ITEMS, 'utf8'));
  const arr = Array.isArray(raw) ? raw : raw.items || [];
  /** @type {Map<string, string>} */
  const byStem = new Map();
  /** @type {Map<string, string>} */
  const byNorm = new Map();
  for (const it of arr) {
    if (!it?.id) continue;
    byNorm.set(normKey(it.id), it.id);
    byNorm.set(normKey(it.name), it.id);
    byNorm.set(normKey(it.displayName || ''), it.id);
    if (it.image) {
      const stem = path.basename(String(it.image), path.extname(it.image));
      byStem.set(stem, it.id);
      byStem.set(normKey(stem), it.id);
    }
  }
  /** @type {Set<string>} */
  const weaponIds = new Set();
  /** @type {Set<string>} */
  const petIds = new Set();
  /** @type {Set<string>} */
  const wearIds = new Set();
  /** @type {Set<string>} */
  const skillFamIds = new Set();
  for (const it of arr) {
    if (!it?.id) continue;
    if (/weapon/i.test(String(it.type || ''))) weaponIds.add(it.id);
    if (/pet/i.test(String(it.type || ''))) petIds.add(it.id);
    if (/accessory|armor|glove|shoe|boot/i.test(String(it.type || ''))) wearIds.add(it.id);
    if (/skill|spell|book|shield|card/i.test(String(it.type || ''))) skillFamIds.add(it.id);
  }
  return { byStem, byNorm, arr, weaponIds, petIds, wearIds, skillFamIds };
}

function extractFuncBody(text, name) {
  const re = new RegExp(`^func ${name}\\s*\\([^\\n]*\\):\\r?\\n([\\s\\S]*?)(?=^func |\\Z)`, 'm');
  const m = text.match(re);
  return m ? m[1] : '';
}

/** doCooldownEffect always ends consume/stop via onAfterEffectFinished (not activate() in that func). */
function isCdThenConsume(text) {
  const body = extractFuncBody(text, 'doCooldownEffect');
  if (!body) return false;
  if (!/\bonAfterEffectFinished\s*\(/.test(body)) return false;
  if (/\bactivate\s*\(/.test(body)) return false;
  return true;
}

function expandCdThenConsumeIds(itemId, arr) {
  const ids = new Set([itemId]);
  const gem = String(itemId).match(/^(?:chipped_|flawed_|flawless_|perfect_|regular_)?([a-z]+)$/);
  const fam = gem?.[1];
  if (fam && ['ruby', 'emerald', 'sapphire', 'topaz', 'amethyst'].includes(fam)) {
    for (const it of arr) {
      if (String(it?.type || '') !== 'Gem') continue;
      if (it.id === fam || String(it.id || '').endsWith(`_${fam}`)) ids.add(it.id);
    }
  }
  return [...ids];
}

function resolveItemId(filePath, index) {
  const stem = path.basename(filePath, '.gd');
  if (index.byStem.has(stem)) return index.byStem.get(stem);
  if (index.byStem.has(normKey(stem))) return index.byStem.get(normKey(stem));
  const slug = slugify(stem);
  if (index.byNorm.has(slug)) return index.byNorm.get(slug);
  if (index.byNorm.has(normKey(slug))) return index.byNorm.get(normKey(slug));
  return slug;
}

function parseExtends(text) {
  return parseExtendsInfo(text)?.name || null;
}

function parseExtendsInfo(text) {
  const m = text.match(/^extends\s+(?:"(res:\/\/Items\/[^\"]+\.gd)"|(\w+))/m);
  if (!m) return null;
  const resource = m[1] || null;
  return {
    name: resource ? path.basename(resource, '.gd') : m[2] || null,
    resource,
  };
}

function functionNames(text) {
  return [...text.matchAll(/^func\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/gm)].map((m) => m[1]);
}

function resolveParentFile(file, text, allFiles) {
  const info = parseExtendsInfo(text);
  if (!info || !info.name) return null;
  const relativeResource = info.resource?.replace(/^res:\/\//, '');
  if (relativeResource) {
    const exact = path.resolve(ITEMS_DIR, relativeResource.replace(/^Items[\\/]/, ''));
    if (fs.existsSync(exact)) return exact;
  }
  const candidates = allFiles.filter((candidate) => path.basename(candidate, '.gd') === info.name);
  if (!candidates.length) return null;
  const siblingDir = path.dirname(file);
  return (
    candidates.find((candidate) => path.dirname(candidate) === siblingDir) ||
    candidates.find((candidate) => path.relative(ITEMS_DIR, candidate).split(path.sep)[0] === 'Exclusive') ||
    candidates[0]
  );
}

function sourceDescriptor(file, allFiles, cache = new Map(), stack = new Set()) {
  if (cache.has(file)) return cache.get(file);
  const text = fs.readFileSync(file, 'utf8');
  if (stack.has(file)) {
    return {
      text,
      directOverrides: [],
      effectiveOverrides: [],
      inheritedOverrides: [],
      inheritedFiles: [],
      sourceSetup: [],
      sourceMethods: [],
      genericBase: GENERIC_INHERITED_SCRIPTS.has(path.basename(file)),
    };
  }
  const nextStack = new Set(stack).add(file);
  const directMethods = functionNames(text);
  const directOverrides = METHODS.filter((method) => directMethods.includes(method));
  const parent = resolveParentFile(file, text, allFiles);
  const parentDescriptor = parent ? sourceDescriptor(parent, allFiles, cache, nextStack) : null;
  const parentIsGeneric = parentDescriptor ? GENERIC_INHERITED_SCRIPTS.has(path.basename(parent)) : false;
  const inheritedOverrides = parentDescriptor && !parentIsGeneric
    ? parentDescriptor.effectiveOverrides.filter((method) => !directOverrides.includes(method))
    : [];
  const inheritedFiles = parent
    ? [path.relative(ITEMS_DIR, parent).replace(/\\/g, '/'), ...(parentDescriptor?.inheritedFiles || [])]
    : [];
  const sourceSetup = [...new Set([...text.matchAll(/DamageSource\.Flags\.([A-Za-z0-9_]+)/g)].map((m) => m[1]))];
  const sourceMethods = directMethods.filter(
    (method) => !METHODS.includes(method) && SOURCE_EVIDENCE_METHODS.has(method),
  );
  const descriptor = {
    text: parentDescriptor ? `${text}\n${parentDescriptor.text}` : text,
    directOverrides,
    effectiveOverrides: [
      ...new Set([
        ...directOverrides,
        ...(parentDescriptor && !parentIsGeneric ? parentDescriptor.effectiveOverrides : []),
      ]),
    ],
    inheritedOverrides,
    inheritedFiles,
    sourceSetup,
    sourceMethods: [
      ...new Set([
        ...sourceMethods,
        ...(parentDescriptor && !parentIsGeneric ? parentDescriptor.sourceMethods || [] : []),
      ]),
    ],
    genericBase: GENERIC_INHERITED_SCRIPTS.has(path.basename(file)),
  };
  cache.set(file, descriptor);
  return descriptor;
}

function classifyFamily(itemId, overrides, extendsName, text) {
  if (overrides.includes('onCombatStart') && /getAffectedItems|addBonusDamage|empower/i.test(text)) {
    return 'synergy_aura';
  }
  if (overrides.includes('onCombatStart') && /heal|Regeneration|Food|Potion/i.test(text + itemId)) {
    return 'start_buff';
  }
  if (overrides.length === 1 && overrides[0] === 'doCooldownEffect') {
    if (/useStamina\(\)|dealDamage\(\)/.test(text)) return 'basic_weapon';
    return 'custom_cd';
  }
  if (overrides.includes('onPreDealDamage_early') || overrides.includes('onDealtDamage')) {
    return 'on_hit';
  }
  if (extendsName === 'Weapon' || extendsName === 'RangedWeapon') return 'weapon_base';
  if (/goobert|dragon|whelp/i.test(itemId)) return 'pet_like';
  if (/potion|herb|berry|food|banana|apple/i.test(itemId)) return 'food';
  if (overrides.includes('onTriggerPotion') || overrides.includes('consumePotion')) return 'food';
  if (extendsName === 'Bag' || /bag|sack|basket|belt|coffin|loadout/i.test(itemId)) return 'unique';
  return 'unique';
}

const index = loadItemIndex();
const files = walk(ITEMS_DIR);
const allFiles = walk(ITEMS_DIR, [], { includeBase: true });
const sourceCache = new Map();
const INHERITANCE_RESOLUTION_IDS = new Set([
  'ace_of_spades',
  'armored_courage_puppy',
  'badger_rune',
  'bagtacular',
]);

// Some catalog rows are scene aliases: the .tscn selects the catalog-specific
// sprite but intentionally reuses another item's script. Keep those rows in
// the source inventory instead of treating them as unresolved just because
// there is no same-named .gd file.
const SCENE_SOURCE_ALIASES = {
  book_of_ice_new: 'Exclusive/BookofIceNew.tscn',
  chipped_amethyst: 'Gems/ChippedAmethyst.tscn',
  chipped_emerald: 'Gems/ChippedEmerald.tscn',
  chipped_ruby: 'Gems/ChippedRuby.tscn',
  chipped_sapphire: 'Gems/ChippedSapphire.tscn',
  chipped_topaz: 'Gems/ChippedTopaz.tscn',
  flawed_amethyst: 'Gems/FlawedAmethyst.tscn',
  flawed_emerald: 'Gems/FlawedEmerald.tscn',
  flawed_ruby: 'Gems/FlawedRuby.tscn',
  flawed_sapphire: 'Gems/FlawedSapphire.tscn',
  flawless_amethyst: 'Gems/FlawlessAmethyst.tscn',
  flawless_emerald: 'Gems/FlawlessEmerald.tscn',
  flawless_ruby: 'Gems/FlawlessRuby.tscn',
  flawless_sapphire: 'Gems/FlawlessSapphire.tscn',
  flawless_topaz: 'Gems/FlawlessTopaz.tscn',
  perfect_amethyst: 'Gems/PerfectAmethyst.tscn',
  perfect_emerald: 'Gems/PerfectEmerald.tscn',
  perfect_ruby: 'Gems/PerfectRuby.tscn',
  perfect_sapphire: 'Gems/PerfectSapphire.tscn',
  perfect_topaz: 'Gems/PerfectTopaz.tscn',
  regular_amethyst: 'Gems/RegularAmethyst.tscn',
  goobling: 'Exclusive/Goobling.tscn',
  darkest_lotus: 'DarkestLotus.tscn',
  elephant_rune: 'Exclusive/ElephantRune.tscn',
};

function sceneScriptPath(sceneFile) {
  const abs = path.join(ITEMS_DIR, sceneFile);
  if (!fs.existsSync(abs)) return null;
  const text = fs.readFileSync(abs, 'utf8');
  const match = text.match(
    /path="res:\/\/Items\/([^"]+\.gd)"\s+type="Script"/,
  );
  return match?.[1]?.replace(/\\/g, '/') || null;
}

/** @type {Record<string, object>} */
const byId = {};
const byMethod = Object.fromEntries(METHODS.map((m) => [m, 0]));
/** @type {Record<string, string[]>} */
const families = {};
/** @type {Set<string>} */
const cdThenConsumeIds = new Set();

for (const file of files) {
  const descriptor = sourceDescriptor(file, allFiles, sourceCache);
  const directText = fs.readFileSync(file, 'utf8');
  // Keep the established direct-script classification stable for the rest of
  // the inventory; only the two source-unresolved rows in this wave opt into
  // inherited lifecycle resolution below.
  const text = directText;
  const stem = path.basename(file, '.gd');
  const itemId = resolveItemId(file, index);
  const directOverrides = [...descriptor.directOverrides];
  if (
    itemId === 'ace_of_spades' &&
    /^func doRevealEffect\s*\(/m.test(directText) &&
    !directOverrides.includes('doRevealEffect')
  ) {
    directOverrides.push('doRevealEffect');
    byMethod.doRevealEffect = (byMethod.doRevealEffect || 0) + 1;
  }
  /** @type {string[]} */
  const overrides = [
    ...(INHERITANCE_RESOLUTION_IDS.has(itemId)
      ? descriptor.effectiveOverrides
      : directOverrides),
  ];
  if (itemId === 'ace_of_spades' && !overrides.includes('doRevealEffect')) {
    overrides.push('doRevealEffect');
  }
  for (const m of METHODS) {
    if (new RegExp(`^func ${m}\\s*\\(`, 'm').test(directText)) {
      byMethod[m] += 1;
    }
  }
  const extendsName = parseExtends(text);
  const potionFns = ['onTriggerPotion', 'consumePotion'];
  const hasPotionFn = potionFns.some((m) => new RegExp(`^func ${m}\\s*\\(`, 'm').test(text));
  const isPotion =
    hasPotionFn ||
    extendsName === 'Potion' ||
    /extends Potion\b/.test(text) ||
    /Potion\.gd"/.test(text);
  if (isPotion) {
    for (const m of ['onTriggerPotion', 'consumePotion', 'onDamaged']) {
      if (new RegExp(`^func ${m}\\s*\\(`, 'm').test(directText) && !overrides.includes(m)) {
        overrides.push(m);
        byMethod[m] = (byMethod[m] || 0) + 1;
      }
    }
  }
  const isBag =
    extendsName === 'Bag' ||
    /extends Bag\b/.test(text) ||
    /class_name Bag/.test(text);
  const bagCombat =
    isBag &&
    (/^func onPrepare\s*\(/m.test(text) ||
      (/^func addToInventory\s*\(/m.test(text) &&
        /stamina|Stamina|changeBaseMaxStamina/i.test(text)));
  if (bagCombat && !overrides.includes('onPrepare') && /^func onPrepare\s*\(/m.test(text)) {
    overrides.push('onPrepare');
    byMethod.onPrepare = (byMethod.onPrepare || 0) + 1;
  }
  if (bagCombat && !overrides.includes('addToInventory') && /^func addToInventory\s*\(/m.test(text)) {
    overrides.push('addToInventory');
    byMethod.addToInventory = (byMethod.addToInventory || 0) + 1;
  }
  const isWeaponFam =
    ['Weapon', 'Bow', 'RangedWeapon', 'Dagger', 'Greatsword', 'Lightsaber', 'Phoenix'].includes(
      extendsName,
    ) ||
    /(?:Weapon|Bow|Dagger|Greatsword|Lightsaber|RangedWeapon|Phoenix)\.gd"/.test(text) ||
    index.weaponIds.has(itemId);
  if (isWeaponFam) {
    if (/^func onPrepare\s*\(/m.test(text) && !overrides.includes('onPrepare')) {
      overrides.push('onPrepare');
      byMethod.onPrepare = (byMethod.onPrepare || 0) + 1;
    }
    if (/^func prepare\s*\(/m.test(text) && !overrides.includes('onPrepare')) {
      overrides.push('onPrepare');
      byMethod.onPrepare = (byMethod.onPrepare || 0) + 1;
    }
  }
  const isPetFam =
    ['Goobert', 'Pet', 'Toad', 'Shelly', 'DragonEgg', 'SpiritCompanion'].includes(extendsName) ||
    /(?:Goobert|Pet|Toad|Shelly|DragonEgg)\.gd"/.test(text) ||
    index.petIds.has(itemId);
  if (isPetFam) {
    if (/^func onPrepare\s*\(/m.test(text) && !overrides.includes('onPrepare')) {
      overrides.push('onPrepare');
      byMethod.onPrepare = (byMethod.onPrepare || 0) + 1;
    }
    if (/^func prepare\s*\(/m.test(text) && !overrides.includes('onPrepare')) {
      overrides.push('onPrepare');
      byMethod.onPrepare = (byMethod.onPrepare || 0) + 1;
    }
  }
  const isWearFam =
    index.wearIds.has(itemId) ||
    /(?:Armor|Gloves|Shoes|Amulet|Collar|Badge)\.gd"/.test(text);
  if (isWearFam && !/skill|spell|shield|card/i.test(String(index.arr.find((x) => x.id === itemId)?.type || ''))) {
    if (/^func onPrepare\s*\(/m.test(text) && !overrides.includes('onPrepare')) {
      overrides.push('onPrepare');
      byMethod.onPrepare = (byMethod.onPrepare || 0) + 1;
    }
    if (/^func prepare\s*\(/m.test(text) && !overrides.includes('onPrepare')) {
      overrides.push('onPrepare');
      byMethod.onPrepare = (byMethod.onPrepare || 0) + 1;
    }
  }
  const isSkillFam =
    index.skillFamIds.has(itemId) ||
    ['Skill', 'Shield', 'Card', 'Spell', 'Book'].includes(extendsName) ||
    /(?:Skill|Shield|Card|Spell|Book)\.gd"/.test(text);
  if (isSkillFam) {
    if (/^func onPrepare\s*\(/m.test(text) && !overrides.includes('onPrepare')) {
      overrides.push('onPrepare');
      byMethod.onPrepare = (byMethod.onPrepare || 0) + 1;
    }
    if (/^func prepare\s*\(/m.test(text) && !overrides.includes('onPrepare')) {
      overrides.push('onPrepare');
      byMethod.onPrepare = (byMethod.onPrepare || 0) + 1;
    }
    if (/^func doCooldownEffect\s*\(/m.test(text) && !overrides.includes('doCooldownEffect')) {
      overrides.push('doCooldownEffect');
      byMethod.doCooldownEffect = (byMethod.doCooldownEffect || 0) + 1;
    }
    if (/^func afterBlock\s*\(/m.test(text) && !overrides.includes('afterBlock')) {
      overrides.push('afterBlock');
      byMethod.afterBlock = (byMethod.afterBlock || 0) + 1;
    }
  }
  if (!overrides.length && !descriptor.sourceMethods.length) continue;
  const family = classifyFamily(itemId, overrides, extendsName, text);
  const cdThenConsume = isCdThenConsume(directText);
  const inheritance =
    INHERITANCE_RESOLUTION_IDS.has(itemId) && descriptor.inheritedFiles.length
      ? {
          directOverrides,
          inheritedOverrides: descriptor.inheritedOverrides,
          inheritedFiles: descriptor.inheritedFiles,
        }
      : {};
  const sourceEvidence = INHERITANCE_RESOLUTION_IDS.has(itemId)
    ? {
        ...(descriptor.sourceSetup.length ? { sourceSetup: descriptor.sourceSetup } : {}),
        ...(descriptor.sourceMethods.length ? { sourceMethods: descriptor.sourceMethods } : {}),
      }
    : {};
  byId[itemId] = {
    id: itemId,
    scriptStem: stem,
    file: path.relative(ITEMS_DIR, file).replace(/\\/g, '/'),
    extends: extendsName,
    overrides,
    family,
    ...inheritance,
    ...sourceEvidence,
    ...(cdThenConsume ? { cdThenConsume: true } : {}),
  };
  if (cdThenConsume) {
    for (const id of expandCdThenConsumeIds(itemId, index.arr)) cdThenConsumeIds.add(id);
  }
  if (!families[family]) families[family] = [];
  families[family].push(itemId);
}

for (const [itemId, sceneFile] of Object.entries(SCENE_SOURCE_ALIASES)) {
  const scriptFile = sceneScriptPath(sceneFile);
  if (!scriptFile) continue;
  const file = path.join(ITEMS_DIR, scriptFile);
  if (!fs.existsSync(file)) continue;
  const descriptor = sourceDescriptor(file, allFiles, sourceCache);
  const directText = fs.readFileSync(file, 'utf8');
  const directOverrides = [...descriptor.directOverrides];
  const overrides = [...descriptor.effectiveOverrides];
  // Scene aliases reuse a script that may define Item.prepare() rather than
  // one of the direct combat method names above. Preserve that lifecycle hook
  // in the alias record just as the catalog-family pass does for normal rows.
  if (/^func onPrepare\s*\(/m.test(directText) && !overrides.includes('onPrepare')) {
    overrides.push('onPrepare');
  }
  const extendsName = parseExtends(directText);
  const family = classifyFamily(itemId, overrides, extendsName, descriptor.text);
  const cdThenConsume = isCdThenConsume(directText);
  byId[itemId] = {
    id: itemId,
    scriptStem: path.basename(file, '.gd'),
    file: scriptFile,
    sceneFile,
    extends: extendsName,
    overrides,
    family,
    directOverrides,
    inheritedOverrides: descriptor.inheritedOverrides,
    inheritedFiles: descriptor.inheritedFiles,
    ...(descriptor.sourceSetup.length ? { sourceSetup: descriptor.sourceSetup } : {}),
    ...(descriptor.sourceMethods.length ? { sourceMethods: descriptor.sourceMethods } : {}),
    ...(cdThenConsume ? { cdThenConsume: true } : {}),
  };
  if (cdThenConsume) {
    for (const id of expandCdThenConsumeIds(itemId, index.arr)) cdThenConsumeIds.add(id);
  }
  if (!families[family]) families[family] = [];
  if (!families[family].includes(itemId)) families[family].push(itemId);
}

for (const k of Object.keys(families)) families[k].sort();

const payload = {
  extractedAt: new Date().toISOString(),
  source: ITEMS_DIR,
  scriptFileCount: files.length,
  withCombatOverrides: Object.keys(byId).length,
  byMethod,
  families,
  byId,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));

const consumeList = [...cdThenConsumeIds].sort();
const consumeJson = path.join('assets/data', 'sim-cd-then-consume.json');
fs.writeFileSync(
  consumeJson,
  `${JSON.stringify({ extractedAt: payload.extractedAt, count: consumeList.length, ids: consumeList }, null, 2)}\n`,
);
const consumeJs = path.join('js/pages/sim/engine', 'cd-then-consume-ids.js');
fs.writeFileSync(
  consumeJs,
  `/** GENERATED by scripts/extract-sim-item-inventory.mjs — do not hand-edit. */\n` +
    `export const CD_THEN_CONSUME_IDS = new Set(${JSON.stringify(consumeList)});\n`,
);

console.log(
  `Wrote ${OUT}: ${payload.withCombatOverrides} items, families=${Object.keys(families).join(', ')}`,
);
console.log(`Wrote ${consumeJson} + ${consumeJs}: ${consumeList.length} cd-then-consume ids`);

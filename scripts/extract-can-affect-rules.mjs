/**
 * Parse Items .gd canAffect / affectsEmpty / isAffectingDistinct overrides
 * into assets/data/can-affect-rules.json
 *
 * Also extracts:
 * - hasAttackEffectIds (onPreDealDamage_* / onDealtDamage, incl. parents)
 * - scriptFamilies (DragonEgg, Dagger, … → item ids)
 * - parentById (for .canAffect(item) parent calls)
 *
 * Run: node scripts/extract-can-affect-rules.mjs
 */
import fs from 'fs';
import path from 'path';

const ITEMS_DIR = 'tools/game-extract-full/Items';
const ITEM_BOOK = 'tools/game-extract-full/Sheets/ItemBook.gd';
const GAME_ITEMS = 'scripts/_cache/game-items.json';
const ITEM_DATA = 'scripts/_cache/ItemData.csv';
const OUT = 'assets/data/can-affect-rules.json';

/** Item.Stack.Buff bits (Lucky|Regen|Vamp|Spikes|Mana|Empower|Heat) + Buff/BuffNoLuck labels. */
const BUFF_GAIN_FLAGS = new Set([
  'Buff',
  'BuffNoLuck',
  'Lucky',
  'Regeneration',
  'Vampirism',
  'Spikes',
  'Mana',
  'Empower',
  'Heat',
]);

const FN_RE =
  /^func (canAffect(?:_secondary|_tertiary|_lightning)?|affectsEmpty|isAffectingDistinct)\s*\(([^)]*)\)(?:\s*->\s*[^\n:]+)?\s*:\n((?:\t.*\n|\t.*$)*)/gm;

const EXTENDS_RE =
  /^extends\s+(?:\"res:\/\/Items\/(?:Exclusive\/)?([^\"]+)\.gd\"|(\w+))/m;
const CLASSNAME_RE = /^class_name\s+(\w+)/m;

const RULE_KEYS = [
  'primary',
  'secondary',
  'tertiary',
  'lightning',
  'affectsEmpty',
  'distinct',
];

const RARITY_RANK = {
  Common: 0,
  Rare: 1,
  Epic: 2,
  Legendary: 3,
  Godly: 4,
  Unique: 5,
};

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (ent.name.endsWith('.gd') && ent.name !== 'Item.gd') out.push(full);
  }
  return out;
}

function walkTscn(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkTscn(full, out);
    else if (ent.name.endsWith('.tscn')) out.push(full);
  }
  return out;
}

/**
 * Root item script for a .tscn (e.g. Goobling.tscn → Goobert.gd).
 * @param {string} filePath
 * @returns {{ sceneStem: string, scriptStem: string } | null}
 */
function parseTscnRootScript(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  /** @type {Map<string, string>} */
  const scriptById = new Map();
  // Godot 3: attributes may appear in any order on one line.
  const resRe = /\[ext_resource([^\]]*)\]/g;
  let rm;
  while ((rm = resRe.exec(text))) {
    const attrs = rm[1] || '';
    if (!/\btype\s*=\s*"Script"/.test(attrs)) continue;
    const pathM = /\bpath\s*=\s*"([^"]+\.gd)"/.exec(attrs);
    const idM = /\bid\s*=\s*(\d+)/.exec(attrs);
    if (!pathM || !idM) continue;
    scriptById.set(idM[1], path.basename(pathM[1], '.gd'));
  }

  const nodeRe =
    /^\[node name="([^"]+)"[^\]]*\]\r?\n([\s\S]*?)(?=^\[node |\Z)/m;
  const nm = nodeRe.exec(text);
  if (!nm) return null;
  const body = nm[2] || '';
  const sm = /^script = ExtResource\(\s*(\d+)\s*\)/m.exec(body);
  if (!sm) return null;
  const scriptStem = scriptById.get(sm[1]);
  if (!scriptStem) return null;
  return { sceneStem: path.basename(filePath, '.tscn'), scriptStem };
}

function resolveStemToItemId(stem, index) {
  if (index.byStem.has(stem)) return index.byStem.get(stem);
  if (index.byStem.has(normKey(stem))) return index.byStem.get(normKey(stem));
  const slug = slugify(stem);
  if (index.byNorm.has(slug)) return index.byNorm.get(slug);
  if (index.byNorm.has(normKey(slug))) return index.byNorm.get(normKey(slug));
  return slug;
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
  return { byStem, byNorm, arr };
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

function resolveDisplayName(name, index) {
  const n = String(name || '').trim();
  if (!n) return null;
  return index.byNorm.get(normKey(n)) || index.byNorm.get(slugify(n)) || null;
}

function parseExtends(text) {
  const m = EXTENDS_RE.exec(text);
  if (!m) return null;
  if (m[1]) return path.basename(m[1]); // path form
  return m[2] || null;
}

/** Flatten a return body (join continued paren lines). */
function flattenBody(raw) {
  return raw
    .split(/\r?\n/)
    .map((l) => l.replace(/^\t/, '').trim())
    .filter((l) => l && !l.startsWith('#'))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitTop(expr, token) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < expr.length; i += 1) {
    const ch = expr[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (depth === 0 && expr.slice(i, i + token.length) === token) {
      parts.push(expr.slice(start, i).trim());
      i += token.length - 1;
      start = i + 1;
    }
  }
  parts.push(expr.slice(start).trim());
  return parts.filter(Boolean);
}

/**
 * @param {string} expr
 * @param {{ localDescriptors?: Map<string, string> }} [ctx]
 * @returns {object | null}
 */
function parseExpr(expr, ctx = {}) {
  let e = expr.trim();
  if (e.endsWith(';')) e = e.slice(0, -1).trim();
  while (e.startsWith('(') && e.endsWith(')')) {
    let depth = 0;
    let wrap = true;
    for (let i = 0; i < e.length; i += 1) {
      if (e[i] === '(') depth += 1;
      else if (e[i] === ')') {
        depth -= 1;
        if (depth === 0 && i < e.length - 1) {
          wrap = false;
          break;
        }
      }
    }
    if (!wrap) break;
    e = e.slice(1, -1).trim();
  }

  if (e === 'true') return { op: 'true' };
  if (e === 'false') return { op: 'false' };

  for (const [op, token] of [
    ['or', ' or '],
    ['and', ' and '],
  ]) {
    const parts = splitTop(e, token);
    if (parts.length > 1) {
      const kids = parts.map((p) => parseExpr(p, ctx));
      if (kids.some((k) => !k)) return null;
      return { op, args: kids };
    }
  }

  let m;
  if ((m = /^not\s+(.+)$/i.exec(e))) {
    const inner = parseExpr(m[1], ctx);
    return inner ? { op: 'not', arg: inner } : null;
  }

  if ((m = /^item\.hasType\(Type\.(\w+)\)$/.exec(e))) {
    return { op: 'hasType', type: m[1] };
  }
  if ((m = /^item\.hasTag\(Tag\.(\w+)\)$/.exec(e))) {
    return { op: 'hasTag', tag: m[1] };
  }
  if ((m = /^item\.gainsStack\(Stack\.(\w+)\)$/.exec(e))) {
    return { op: 'gainsStack', stack: m[1] };
  }
  if ((m = /^item\.getRarity\(\)\s*==\s*Rarity\.(\w+)$/.exec(e))) {
    return { op: 'rarityEq', rarity: m[1] };
  }
  if ((m = /^item\.getRarity\(\)\s*>=\s*Rarity\.(\w+)$/.exec(e))) {
    return { op: 'rarityGte', rarity: m[1] };
  }
  if ((m = /^item\.isClassItem\(Game\.Classes_Full\.(\w+)\)$/.exec(e))) {
    return { op: 'isClassItem', className: m[1] };
  }
  if (e === 'item.isClassItem()') return { op: 'isClassItem' };
  if (e === 'item.hasCooldown()') return { op: 'hasCooldown' };
  if (e === 'item.canBeEmpowered()') return { op: 'canBeEmpowered' };
  if (e === 'item.canDamage()') return { op: 'canDamage' };
  if (e === 'item.canActivate()') return { op: 'canActivate' };
  if (e === 'item.canBlock()') return { op: 'canBlock' };
  if (e === 'item.hasAttackEffect()') return { op: 'hasAttackEffect' };
  if (e === 'item.isWeapon()') return { op: 'isWeapon' };
  if (e === 'item.isCrafted()') return { op: 'isCrafted' };
  if (e === 'item.isBag()') return { op: 'isBag' };
  if (e === 'item.isTreasure()') return { op: 'isTreasure' };
  if (e === 'item.isNeutral()') return { op: 'isNeutral' };
  if (e === 'item.canUseStamina()') return { op: 'canUseStamina' };
  if (e === 'item.inflictsDebuffs()') return { op: 'inflictsDebuffs' };
  if (e === 'item.canModifyChance()') return { op: 'canModifyChance' };
  if (e === 'item.hasStartofBattle()') return { op: 'hasStartofBattle' };
  if (e === 'item.gainsBuffs()') return { op: 'gainsBuffs' };
  if (e === 'item.usesBuffs()') return { op: 'usesBuffs' };
  if (e === 'item.reactsToCharges()') return { op: 'reactsToCharges' };
  if (e === 'item.canHealOrLifesteal()') return { op: 'canHealOrLifesteal' };
  if (e === 'item.hasInventoryDuration()') return { op: 'hasInventoryDuration' };
  if (e === 'item.canStartNewRecipe()') return { op: 'canStartNewRecipe' };
  if (e === 'item.descriptor.isMeleeWeapon()') return { op: 'isMeleeWeapon' };
  if (e === 'item.descriptor.isRangedWeapon()') return { op: 'isRangedWeapon' };
  if (e === 'color == Affected.Primary') return { op: 'colorIs', color: 'primary' };
  if (e === 'color == Affected.Secondary') {
    return { op: 'colorIs', color: 'secondary' };
  }
  if (e === 'color == Affected.Tertiary') return { op: 'colorIs', color: 'tertiary' };

  // Food / frostbolt self-exclude
  if (e === 'item.descriptor != descriptor' || e === 'item.isA(descriptor)') {
    return e.startsWith('item.isA')
      ? { op: 'isSelf' }
      : { op: 'notSelf' };
  }
  if (e === 'not item.isA(descriptor)') return { op: 'notSelf' };

  // Chess opposite color
  if (e === 'item.pieceColor != pieceColor') {
    return { op: 'otherPieceColor' };
  }

  // class_name checks: item is DragonEgg / item is Dagger
  if ((m = /^item\s+is\s+(\w+)$/.exec(e))) {
    return { op: 'extendsScript', script: m[1] };
  }

  // Buy the Holy Light helper
  if (e === 'isLamp(item)') {
    return {
      op: 'or',
      args: [
        { op: 'isA', itemId: 'oil_lamp' },
        { op: 'isA', itemId: 'djinn_lamp' },
      ],
    };
  }

  // Parent canAffect (Whetstone3)
  if (e === '.canAffect(item)' || e === 'super.canAffect(item)') {
    return { op: 'parentCanAffect' };
  }

  // item.isA(...)
  if ((m = /^item\.isA\((.+)\)$/.exec(e))) {
    const ref = m[1].trim();
    if (ref === 'descriptor') return { op: 'isSelf' };
    if ((m = /^ItemBook\.(\w+)Descriptor$/.exec(ref))) {
      return { op: 'isA', bookKey: m[1] };
    }
    if ((m = /^(\w+)Descriptor$/.exec(ref))) {
      const local = ctx.localDescriptors?.get(m[1]);
      if (local) return { op: 'isA', itemId: local };
      return { op: 'isA', localVar: m[1] };
    }
    return { op: 'isA', ref, unsupported: true };
  }

  // Recombobulator bond — not available on static boards
  if (e === 'item.bondedBaseItem == self') {
    return { op: 'false' };
  }

  return { op: 'unsupported', raw: e };
}

function parseReturnBody(flat, ctx = {}) {
  // Card.gd if/else placed vs shop
  if (/^if placed:/.test(flat)) {
    return { op: 'cardAffect' };
  }
  if (flat.startsWith('return ')) {
    return parseExpr(flat.slice(7).trim(), ctx);
  }
  if (flat.startsWith('return')) return parseExpr(flat.slice(6).trim(), ctx);
  return { op: 'unsupported', raw: flat };
}

/** Resolve ItemBook.xxxDescriptor → item id from ItemBook.gd */
function loadBookDescriptors(index) {
  /** @type {Map<string, string>} bookKey → itemId */
  const map = new Map();
  if (!fs.existsSync(ITEM_BOOK)) return map;
  const text = fs.readFileSync(ITEM_BOOK, 'utf8');
  const re =
    /(\w+)Descriptor\s*=\s*getDescriptor\(\s*[\"']([^\"']+)[\"']\s*\)/g;
  let m;
  while ((m = re.exec(text))) {
    const id = resolveDisplayName(m[2], index);
    if (id) map.set(m[1], id);
  }
  return map;
}

function loadLocalDescriptors(text, index) {
  /** @type {Map<string, string>} varStem → itemId (without Descriptor suffix) */
  const map = new Map();
  const re =
    /(?:onready\s+)?var\s+(\w+)\s*=\s*ItemBook\.getDescriptor\(\s*[\"']([^\"']+)[\"']\s*\)/g;
  let m;
  while ((m = re.exec(text))) {
    let key = m[1];
    if (key.endsWith('Descriptor')) key = key.slice(0, -'Descriptor'.length);
    const id = resolveDisplayName(m[2], index);
    if (id) map.set(key, id);
  }
  // also: onready var oilLamp = ItemBook.getDescriptor("Oil Lamp")
  return map;
}

function countUnsupported(node) {
  if (!node || typeof node !== 'object') return 0;
  let n = node.op === 'unsupported' || node.unsupported ? 1 : 0;
  if (node.args) for (const a of node.args) n += countUnsupported(a);
  if (node.arg) n += countUnsupported(node.arg);
  return n;
}

function rewriteIsA(node, bookMap, localMap) {
  if (!node || typeof node !== 'object') return node;
  if (node.op === 'isA') {
    if (node.itemId) return { op: 'isA', itemId: node.itemId };
    if (node.bookKey && bookMap.has(node.bookKey)) {
      return { op: 'isA', itemId: bookMap.get(node.bookKey) };
    }
    if (node.localVar && localMap.has(node.localVar)) {
      return { op: 'isA', itemId: localMap.get(node.localVar) };
    }
    return { op: 'unsupported', raw: `isA(${node.bookKey || node.localVar || node.ref})` };
  }
  if (node.args) return { ...node, args: node.args.map((a) => rewriteIsA(a, bookMap, localMap)) };
  if (node.arg) return { ...node, arg: rewriteIsA(node.arg, bookMap, localMap) };
  return node;
}

const index = loadItemIndex();
const bookDescriptors = loadBookDescriptors(index);
const byId = Object.create(null);
/** @type {Map<string, object>} */
const byScript = new Map();
let parsed = 0;
let unsupported = 0;

for (const file of walk(ITEMS_DIR)) {
  // skip animation helpers
  if (file.includes(`${path.sep}Animations${path.sep}`)) continue;

  const text = fs.readFileSync(file, 'utf8');
  const stem = path.basename(file, '.gd');
  const itemId = resolveItemId(file, index);
  const parentRaw = parseExtends(text);
  const classNameMatch = CLASSNAME_RE.exec(text);
  const scriptName = classNameMatch?.[1] || stem;
  const parentScript =
    parentRaw && parentRaw !== 'Item' && parentRaw !== 'Node2D' && parentRaw !== 'Sprite'
      ? parentRaw
      : null;

  let entry = byId[itemId];
  if (!entry) {
    entry = {
      id: itemId,
      file: path.relative(ITEMS_DIR, file).replace(/\\/g, '/'),
    };
    byId[itemId] = entry;
  }
  entry.parentScript = parentScript;
  entry.scriptName = scriptName;
  byScript.set(stem, entry);
  byScript.set(scriptName, entry);
  byScript.set(normKey(stem), entry);
  byScript.set(normKey(scriptName), entry);

  const localDescriptors = loadLocalDescriptors(text, index);
  const parseCtx = { localDescriptors };

  FN_RE.lastIndex = 0;
  let m;
  while ((m = FN_RE.exec(text))) {
    const fn = m[1];
    const flat = flattenBody(m[3]);
    let rule = parseReturnBody(flat, parseCtx);
    rule = rewriteIsA(rule, bookDescriptors, localDescriptors);
    parsed += 1;
    unsupported += countUnsupported(rule);

    if (fn === 'canAffect') entry.primary = rule;
    else if (fn === 'canAffect_secondary') entry.secondary = rule;
    else if (fn === 'canAffect_tertiary') entry.tertiary = rule;
    else if (fn === 'canAffect_lightning') entry.lightning = rule;
    else if (fn === 'affectsEmpty') entry.affectsEmpty = rule;
    else if (fn === 'isAffectingDistinct') entry.distinct = rule;
  }
}

// Scenes that reuse another item's .gd (Goobling.tscn → Goobert.gd)
const catalogIdSet = new Set(index.arr.map((it) => it.id));
let sceneAliases = 0;
for (const file of walkTscn(ITEMS_DIR)) {
  if (file.includes(`${path.sep}Animations${path.sep}`)) continue;
  const parsedScene = parseTscnRootScript(file);
  if (!parsedScene) continue;
  const { sceneStem, scriptStem } = parsedScene;
  if (sceneStem === scriptStem) continue;
  // Prefer a dedicated .gd when present
  const ownGd = path.join(path.dirname(file), `${sceneStem}.gd`);
  if (fs.existsSync(ownGd)) continue;

  const sceneId = resolveStemToItemId(sceneStem, index);
  if (!catalogIdSet.has(sceneId)) continue;

  const donor =
    byScript.get(scriptStem) || byScript.get(normKey(scriptStem)) || null;
  if (!donor) continue;

  let entry = byId[sceneId];
  if (!entry) {
    entry = {
      id: sceneId,
      file: path.relative(ITEMS_DIR, file).replace(/\\/g, '/'),
      parentScript: donor.scriptName || scriptStem,
      scriptName: donor.scriptName || scriptStem,
    };
    byId[sceneId] = entry;
  } else {
    if (!entry.parentScript) {
      entry.parentScript = donor.scriptName || scriptStem;
    }
    if (!entry.scriptName) {
      entry.scriptName = donor.scriptName || scriptStem;
    }
  }

  for (const key of RULE_KEYS) {
    if (entry[key] == null && donor[key] != null) {
      entry[key] = donor[key];
      sceneAliases += 1;
    }
  }
}

// Inherit canAffect* from parent scripts
let inherited = 0;
for (const entry of Object.values(byId)) {
  const guard = new Set([entry.id]);
  let parentName = entry.parentScript;
  while (parentName) {
    const parent =
      byScript.get(parentName) || byScript.get(normKey(parentName)) || null;
    if (!parent || guard.has(parent.id)) break;
    guard.add(parent.id);
    for (const key of RULE_KEYS) {
      if (entry[key] == null && parent[key] != null) {
        entry[key] = parent[key];
        inherited += 1;
      }
    }
    parentName = parent.parentScript;
  }
}

const rules = Object.values(byId).filter((e) =>
  RULE_KEYS.some((k) => e[k] != null),
);

// Script family membership (item is DragonEgg / extends Dagger, …)
/** @type {Record<string, string[]>} */
const scriptFamilies = Object.create(null);
function ancestorsOf(entry) {
  const chain = [];
  const guard = new Set();
  let name = entry.scriptName || entry.id;
  let cur = entry;
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    if (cur.scriptName) chain.push(cur.scriptName);
    chain.push(path.basename(cur.file || '', '.gd'));
    const p = cur.parentScript;
    if (!p) break;
    cur = byScript.get(p) || byScript.get(normKey(p));
  }
  // also walk from parentScript names even if not in byId as items
  return [...new Set(chain.filter(Boolean))];
}

const catalogIds = new Set(index.arr.map((it) => it.id));
for (const entry of Object.values(byId)) {
  // Skip base-class-only scripts that never appear in the item catalog
  if (!catalogIds.has(entry.id)) continue;
  for (const script of ancestorsOf(entry)) {
    if (!scriptFamilies[script]) scriptFamilies[script] = [];
    if (!scriptFamilies[script].includes(entry.id)) {
      scriptFamilies[script].push(entry.id);
    }
  }
}
for (const k of Object.keys(scriptFamilies)) scriptFamilies[k].sort();

// hasAttackEffect
const ATTACK_FX_RE =
  /^func (onPreDealDamage_early|onPreDealDamage_late|onDealtDamage)\b/m;
/** @type {Map<string, { id: string, parentScript: string | null, local: boolean }>} */
const attackScripts = new Map();
for (const file of walk(ITEMS_DIR)) {
  if (file.includes(`${path.sep}Animations${path.sep}`)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const stem = path.basename(file, '.gd');
  const itemId = resolveItemId(file, index);
  const parentRaw = parseExtends(text);
  const classNameMatch = CLASSNAME_RE.exec(text);
  const scriptName = classNameMatch?.[1] || stem;
  const entry = {
    id: itemId,
    parentScript:
      parentRaw && parentRaw !== 'Item' ? parentRaw : null,
    local: ATTACK_FX_RE.test(text),
  };
  for (const key of [stem, scriptName, normKey(stem), normKey(scriptName), itemId]) {
    attackScripts.set(key, entry);
  }
}

function scriptHasAttackEffect(entry, guard = new Set()) {
  if (!entry || guard.has(entry.id)) return false;
  if (entry.local) return true;
  guard.add(entry.id);
  if (!entry.parentScript) return false;
  const parent =
    attackScripts.get(entry.parentScript) ||
    attackScripts.get(normKey(entry.parentScript));
  return scriptHasAttackEffect(parent, guard);
}

const hasAttackEffectIds = [
  ...new Set(
    [...attackScripts.values()]
      .filter((e) => scriptHasAttackEffect(e))
      .map((e) => e.id),
  ),
].sort();

/** parentById for parentCanAffect */
const parentById = Object.create(null);
for (const e of Object.values(byId)) {
  if (!e.parentScript) continue;
  const parent =
    byScript.get(e.parentScript) || byScript.get(normKey(e.parentScript));
  if (parent?.id) parentById[e.id] = parent.id;
}

// isCraftedItem() — item is a recipe OUTPUT (originatingRecipes not empty)
const craftedIds = new Set();
for (const it of index.arr) {
  const raw = String(it.recipesRaw || '');
  if (!raw) continue;
  for (const part of raw.split(',')) {
    const idx = part.lastIndexOf('>');
    if (idx < 0) continue;
    const outName = part.slice(idx + 1).trim();
    const id = resolveDisplayName(outName, index);
    if (id) craftedIds.add(id);
  }
}

// reactsToCharges() — has_method(onChargeReceived|onChargeLeft), incl. parents
const CHARGE_FX_RE = /^func (onChargeReceived|onChargeLeft)\b/m;
/** @type {Map<string, { id: string, parentScript: string | null, local: boolean }>} */
const chargeScripts = new Map();
for (const file of walk(ITEMS_DIR)) {
  if (file.includes(`${path.sep}Animations${path.sep}`)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const stem = path.basename(file, '.gd');
  const itemId = resolveItemId(file, index);
  const parentRaw = parseExtends(text);
  const classNameMatch = CLASSNAME_RE.exec(text);
  const scriptName = classNameMatch?.[1] || stem;
  const entry = {
    id: itemId,
    parentScript:
      parentRaw && parentRaw !== 'Item' ? parentRaw : null,
    local: CHARGE_FX_RE.test(text),
  };
  for (const key of [stem, scriptName, normKey(stem), normKey(scriptName), itemId]) {
    chargeScripts.set(key, entry);
  }
}

function scriptReactsToCharges(entry, guard = new Set()) {
  if (!entry || guard.has(entry.id)) return false;
  if (entry.local) return true;
  guard.add(entry.id);
  if (!entry.parentScript) return false;
  const parent =
    chargeScripts.get(entry.parentScript) ||
    chargeScripts.get(normKey(entry.parentScript));
  return scriptReactsToCharges(parent, guard);
}

const reactsToChargesIds = [
  ...new Set(
    [...chargeScripts.values()]
      .filter((e) => scriptReactsToCharges(e) && catalogIds.has(e.id))
      .map((e) => e.id),
  ),
].sort();

// gainsBuffs() / usesBuffs() from ItemData gain/use columns (ItemBook.getFlags)
function parseCsvFlags(raw) {
  return String(raw || '')
    .replace(/\s+/g, '')
    .split(',')
    .filter(Boolean);
}

function flagsHitBuff(flags) {
  return flags.some((f) => BUFF_GAIN_FLAGS.has(f));
}

function splitCsvLine(line) {
  /** @type {string[]} */
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      q = !q;
      continue;
    }
    if (ch === ',' && !q) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

const gainsBuffsIds = new Set();
const usesBuffsIds = new Set();
/** @type {Record<string, string[]>} ItemData gain flags per item (Poison, Heat, Buff, …) */
const gainedStacksById = Object.create(null);
/** @type {Record<string, string[]>} */
const usedStacksById = Object.create(null);
if (fs.existsSync(ITEM_DATA)) {
  const lines = fs.readFileSync(ITEM_DATA, 'utf8').split(/\r?\n/).filter(Boolean);
  const headers = splitCsvLine(lines[0]);
  const nameI = headers.indexOf('name');
  const gainI = headers.indexOf('gain');
  const useI = headers.indexOf('use');
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const id = resolveDisplayName(String(cols[nameI] || '').trim(), index);
    if (!id || !catalogIds.has(id)) continue;
    const gainFlags = parseCsvFlags(cols[gainI]);
    const useFlags = parseCsvFlags(cols[useI]);
    if (flagsHitBuff(gainFlags)) gainsBuffsIds.add(id);
    if (flagsHitBuff(useFlags)) usesBuffsIds.add(id);
    if (gainFlags.length) gainedStacksById[id] = gainFlags;
    if (useFlags.length) usedStacksById[id] = useFlags;
  }
}

const out = {
  extractedAt: new Date().toISOString(),
  count: rules.length,
  parsed,
  unsupportedApprox: unsupported,
  inheritedFields: inherited,
  hasAttackEffectCount: hasAttackEffectIds.length,
  hasAttackEffectIds,
  reactsToChargesCount: reactsToChargesIds.length,
  reactsToChargesIds,
  gainsBuffsCount: gainsBuffsIds.size,
  gainsBuffsIds: [...gainsBuffsIds].sort(),
  usesBuffsCount: usesBuffsIds.size,
  usesBuffsIds: [...usesBuffsIds].sort(),
  gainedStacksById,
  usedStacksById,
  craftedCount: craftedIds.size,
  craftedIds: [...craftedIds].sort(),
  parentById,
  scriptFamilies,
  bookDescriptors: Object.fromEntries(bookDescriptors),
  rarityRank: RARITY_RANK,
  byId: Object.fromEntries(
    rules.map((r) => {
      const { parentScript: _p, scriptName: _s, ...rest } = r;
      return [r.id, rest];
    }),
  ),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(
  `wrote ${OUT}: ${rules.length} items, ${parsed} funcs (~${unsupported} unsupported exprs, ${inherited} inherited fields, ${sceneAliases} scene-script aliases, ${hasAttackEffectIds.length} hasAttackEffect, ${reactsToChargesIds.length} reactsToCharges, ${gainsBuffsIds.size} gainsBuffs, ${craftedIds.size} crafted, ${Object.keys(scriptFamilies).length} script families)`,
);

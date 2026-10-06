/**
 * Evaluate extracted canAffect rules (assets/data/can-affect-rules.json)
 * against board items — mirrors Inventory.getAffectedCells CanAffect checks.
 *
 * isClassItem uses ItemDescriptor bitmasks from item-class-masks.json
 * (shop=no + gate/recipe inheritance), not the simplified items.class string.
 */

const CLASS_BITS = {
  None: 0,
  Ranger: 1,
  Reaper: 2,
  Berserker: 4,
  Pyromancer: 8,
  Mage: 16,
  Adventurer: 32,
  Engineer: 64,
  Neutral: 127,
};

const DEFAULT_RARITY_RANK = {
  Common: 0,
  Rare: 1,
  Epic: 2,
  Legendary: 3,
  Godly: 4,
  Unique: 5,
};

/** Item.Stack.Buff members (and aggregate labels). */
const BUFF_STACKS = new Set([
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
/** Item.Stack.Debuff members. */
const DEBUFF_STACKS = new Set(['Debuff', 'Poison', 'Blind', 'Cold']);

/** Debuff keywords used when stack flags aren't in the catalog. */
const DEBUFF_EFFECT_RE =
  /<(Poison|Blind|Cold|Heat|Vampirism|Spikes|Stun|Debuff|Weakness|Fatigue|Corruption)>/i;

/**
 * @typedef {{
 *   rulesById: Record<string, object> | null,
 *   classMasks: Record<string, number> | null,
 *   classBits: Record<string, number>,
 *   hasAttackEffectIds: Set<string>,
 *   reactsToChargesIds: Set<string>,
 *   gainsBuffsIds: Set<string>,
 *   usesBuffsIds: Set<string>,
 *   gainedStacksById: Record<string, string[]>,
 *   usedStacksById: Record<string, string[]>,
 *   craftedIds: Set<string>,
 *   scriptFamilies: Record<string, string[]>,
 *   parentById: Record<string, string>,
 *   rarityRank: Record<string, number>,
 *   startOfBattleIds: Set<string>,
 * }} CanAffectData
 */

/**
 * Item.gd hasStartofBattle() → has_method("onCombatStart").
 * @param {object | null} inventory
 */
function startOfBattleIdsFromInventory(inventory) {
  /** @type {Set<string>} */
  const ids = new Set();
  const byId = inventory?.byId || {};
  for (const [id, row] of Object.entries(byId)) {
    if (Array.isArray(row?.overrides) && row.overrides.includes('onCombatStart')) {
      ids.add(id);
    }
  }
  return ids;
}

/** @type {Promise<CanAffectData> | null} */
let dataPromise = null;

/**
 * @param {string} assetRoot site root ending in /
 */
export function loadCanAffectData(assetRoot) {
  if (!dataPromise) {
    const root = assetRoot.endsWith('/') ? assetRoot : `${assetRoot}/`;
    dataPromise = Promise.all([
      fetch(`${root}assets/data/can-affect-rules.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`${root}assets/data/item-class-masks.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`${root}assets/data/sim-item-inventory.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([rules, masks, inventory]) => ({
      rulesById: rules?.byId || null,
      classMasks: masks?.byId || null,
      classBits: masks?.classBits || CLASS_BITS,
      hasAttackEffectIds: new Set(rules?.hasAttackEffectIds || []),
      reactsToChargesIds: new Set(rules?.reactsToChargesIds || []),
      gainsBuffsIds: new Set(rules?.gainsBuffsIds || []),
      usesBuffsIds: new Set(rules?.usesBuffsIds || []),
      gainedStacksById: rules?.gainedStacksById || {},
      usedStacksById: rules?.usedStacksById || {},
      craftedIds: new Set(rules?.craftedIds || []),
      scriptFamilies: rules?.scriptFamilies || {},
      parentById: rules?.parentById || {},
      rarityRank: rules?.rarityRank || DEFAULT_RARITY_RANK,
      startOfBattleIds: startOfBattleIdsFromInventory(inventory),
    }));
  }
  return dataPromise;
}

/**
 * Item.gainsStack(Stack.X) via ItemData gain flags.
 * @param {string[] | null | undefined} flags
 * @param {string} stackName
 */
function flagsGainStack(flags, stackName) {
  const want = String(stackName || '');
  if (!want || !Array.isArray(flags) || !flags.length) return false;
  if (flags.includes(want)) return true;
  if (want === 'Buff') return flags.some((f) => BUFF_STACKS.has(f));
  if (want === 'Debuff') return flags.some((f) => DEBUFF_STACKS.has(f));
  if (want === 'BuffNoLuck') {
    return flags.some(
      (f) => f === 'BuffNoLuck' || (BUFF_STACKS.has(f) && f !== 'Lucky' && f !== 'Buff'),
    );
  }
  return false;
}

/** @deprecated use loadCanAffectData */
export function loadCanAffectRules(assetRoot) {
  return loadCanAffectData(assetRoot).then((d) => d.rulesById);
}

/**
 * Game ItemDescriptor.isClassItem — not Neutral (127) and not None (0).
 * @param {number | null | undefined} bits
 * @param {Record<string, number>} [classBits]
 */
export function isClassItemMask(bits, classBits = CLASS_BITS) {
  if (bits == null || !Number.isFinite(bits)) return false;
  const neutral = classBits.Neutral ?? 127;
  const none = classBits.None ?? 0;
  return bits !== neutral && bits !== none;
}

/**
 * @param {object | null | undefined} item
 */
function typesOf(item) {
  /** @type {string[]} */
  const out = [];
  const t = String(item?.type || '');
  if (t) out.push(t);
  const extra = item?.extraTypes;
  if (Array.isArray(extra)) {
    for (const x of extra) if (x) out.push(String(x));
  }
  if (/weapon/i.test(t) && !out.includes('Weapon')) out.push('Weapon');
  if (/chess/i.test(t) && !out.includes('ChessPiece')) out.push('ChessPiece');
  return out;
}

function hasType(item, typeName) {
  const want = String(typeName || '');
  if (!want) return false;
  const types = typesOf(item);
  if (types.some((t) => t === want || t.replace(/\s+/g, '') === want)) return true;
  if (want === 'Weapon') return types.some((t) => /weapon/i.test(t));
  return types.some((t) => t.toLowerCase() === want.toLowerCase());
}

function isWeapon(item) {
  return hasType(item, 'Weapon') || /weapon/i.test(String(item?.type || ''));
}

function canDamage(item) {
  const dmin = Number(item?.damageMin);
  if (Number.isFinite(dmin) && dmin > 0) return true;
  const tags = item?.tags;
  if (Array.isArray(tags) && tags.some((t) => /lifesteal/i.test(String(t)))) return true;
  return false;
}

/** ChessPiece.gd: "White" in name → White, else Black */
function pieceColorOf(item) {
  const blob = `${item?.id || ''} ${item?.name || ''}`;
  if (/white/i.test(blob)) return 'white';
  if (/black/i.test(blob)) return 'black';
  return null;
}

/**
 * @param {object} rule
 * @param {object} target
 * @param {{
 *   color?: string,
 *   source?: object | null,
 *   rulesById?: Record<string, object> | null,
 *   classMasks?: Record<string, number> | null,
 *   classBits?: Record<string, number>,
 *   hasAttackEffectIds?: Set<string> | null,
 *   craftedIds?: Set<string> | null,
 *   scriptFamilies?: Record<string, string[]>,
 *   parentById?: Record<string, string>,
 *   rarityRank?: Record<string, number>,
 * }} [ctx]
 */
export function evalRule(rule, target, ctx = {}) {
  if (!rule || typeof rule !== 'object') return false;
  switch (rule.op) {
    case 'true':
      return true;
    case 'false':
      return false;
    case 'not':
      return !evalRule(rule.arg, target, ctx);
    case 'or':
      return (rule.args || []).some((a) => evalRule(a, target, ctx));
    case 'and':
      return (rule.args || []).every((a) => evalRule(a, target, ctx));
    case 'hasType':
      return hasType(target, rule.type);
    case 'hasTag':
      return (
        Array.isArray(target?.tags) &&
        target.tags.some(
          (t) => String(t).toLowerCase() === String(rule.tag).toLowerCase(),
        )
      );
    case 'hasCooldown':
      return Number(target?.cooldown) > 0;
    case 'canDamage':
      return canDamage(target);
    case 'canBeEmpowered':
      return isWeapon(target) && canDamage(target);
    case 'canBlock':
      return Number(target?.block) > 0;
    case 'canActivate':
      return target?.canActivate !== false;
    case 'hasAttackEffect':
      return Boolean(
        target?.id && ctx.hasAttackEffectIds?.has(String(target.id)),
      );
    case 'isWeapon':
      return isWeapon(target);
    case 'isBag':
      return String(target?.type || '') === 'Bag';
    case 'isTreasure':
      // Best-effort: Unique rarity (randomUniquePool not in catalog yet)
      return String(target?.rarity || '') === 'Unique';
    case 'isNeutral': {
      const bits = ctx.classMasks?.[target?.id];
      const classBits = ctx.classBits || CLASS_BITS;
      if (bits != null) return bits === (classBits.Neutral ?? 127);
      return String(target?.class || 'Neutral') === 'Neutral';
    }
    case 'canUseStamina':
      return Number(target?.staminaCost ?? target?.stamina_cost) > 0;
    case 'inflictsDebuffs':
      if (target?.inflictsDebuffs) return true;
      return DEBUFF_EFFECT_RE.test(String(target?.effect || ''));
    case 'isMeleeWeapon':
      return /melee/i.test(String(target?.type || ''));
    case 'isRangedWeapon':
      return /ranged/i.test(String(target?.type || ''));
    case 'isClassItem': {
      const bits = ctx.classMasks?.[target?.id];
      const classBits = ctx.classBits || CLASS_BITS;
      if (bits != null) {
        if (!isClassItemMask(bits, classBits)) return false;
        if (rule.className) {
          const need = classBits[rule.className];
          return need != null && (bits & need) !== 0;
        }
        return true;
      }
      const cls = String(target?.class || 'Neutral');
      if (cls === 'Neutral' || cls === 'None' || !cls) return false;
      if (rule.className) return cls === rule.className;
      return true;
    }
    case 'isCrafted':
      // Game: descriptor.originatingRecipes not empty (recipe OUTPUT)
      return Boolean(
        target?.isCrafted ||
          (target?.id && ctx.craftedIds?.has(String(target.id))),
      );
    case 'rarityEq':
      return String(target?.rarity || '') === String(rule.rarity || '');
    case 'rarityGte': {
      const rank = ctx.rarityRank || DEFAULT_RARITY_RANK;
      const have = rank[String(target?.rarity || '')];
      const need = rank[String(rule.rarity || '')];
      return have != null && need != null && have >= need;
    }
    case 'notSelf':
      return Boolean(
        ctx.source?.id && target?.id && String(ctx.source.id) !== String(target.id),
      );
    case 'isSelf':
      return Boolean(
        ctx.source?.id && target?.id && String(ctx.source.id) === String(target.id),
      );
    case 'otherPieceColor': {
      const a = pieceColorOf(ctx.source);
      const b = pieceColorOf(target);
      return Boolean(a && b && a !== b);
    }
    case 'extendsScript': {
      const family = ctx.scriptFamilies?.[rule.script] || [];
      return Boolean(target?.id && family.includes(String(target.id)));
    }
    case 'isA':
      return Boolean(rule.itemId && target?.id && String(target.id) === String(rule.itemId));
    case 'cardAffect':
      // Full chain/deck logic needs combat state; board hover ≈ Card type.
      return hasType(target, 'Card');
    case 'parentCanAffect': {
      const parentId = ctx.parentById?.[ctx.source?.id];
      if (!parentId || !ctx.rulesById) return false;
      const parentEntry = ctx.rulesById[parentId];
      const key = ctx.ruleKey || 'primary';
      const parentRule = parentEntry?.[key];
      if (!parentRule) return false;
      return evalRule(parentRule, target, ctx);
    }
    case 'canModifyChance':
      return Number(target?.chance) > 0;
    case 'hasStartofBattle':
      return Boolean(
        target?.hasStartofBattle ||
          (target?.id && ctx.startOfBattleIds?.has(String(target.id))),
      );
    case 'canHealOrLifesteal': {
      const p = target?.params;
      if (p && typeof p === 'object' && (p.heal != null || p.lifesteal != null)) {
        return true;
      }
      return /<Heal>|<Lifesteal>|lifesteal/i.test(String(target?.effect || ''));
    }
    case 'gainsBuffs':
      return Boolean(
        target?.gainsBuffs ||
          (target?.id && ctx.gainsBuffsIds?.has(String(target.id))),
      );
    case 'usesBuffs':
      return Boolean(
        target?.usesBuffs ||
          (target?.id && ctx.usesBuffsIds?.has(String(target.id))),
      );
    case 'reactsToCharges':
      return Boolean(
        target?.reactsToCharges ||
          (target?.id && ctx.reactsToChargesIds?.has(String(target.id))),
      );
    case 'gainsStack': {
      if (target?.gainsStack) return true;
      const id = target?.id ? String(target.id) : '';
      const flags = id ? ctx.gainedStacksById?.[id] : null;
      if (flagsGainStack(flags, rule.stack)) return true;
      // Aggregate Buff shortcut when only gainsBuffsIds was loaded
      if (
        String(rule.stack) === 'Buff' &&
        id &&
        ctx.gainsBuffsIds?.has(id)
      ) {
        return true;
      }
      return false;
    }
    case 'hasInventoryDuration':
      if (target?.params?.dur != null) return true;
      return Boolean(target?.hasInventoryDuration);
    case 'canStartNewRecipe':
      return Boolean(target?.[rule.op]);
    case 'colorIs':
      return ctx.color === rule.color;
    case 'unsupported':
      return false;
    default:
      return false;
  }
}

/**
 * @param {Record<string, object> | null} rulesById
 * @param {object} sourceItem
 * @param {object | null} targetItem
 * @param {'primary'|'secondary'|'tertiary'|'lightning'} [color]
 * @param {Partial<CanAffectData> & { ruleKey?: string }} [extra]
 */
export function canAffectColor(
  rulesById,
  sourceItem,
  targetItem,
  color = 'primary',
  extra = {},
) {
  const key =
    color === 'secondary'
      ? 'secondary'
      : color === 'tertiary'
        ? 'tertiary'
        : color === 'lightning'
          ? 'lightning'
          : 'primary';

  const ctx = {
    color,
    source: sourceItem,
    rulesById,
    ruleKey: key,
    classMasks: extra.classMasks || null,
    classBits: extra.classBits || CLASS_BITS,
    hasAttackEffectIds: extra.hasAttackEffectIds || null,
    reactsToChargesIds: extra.reactsToChargesIds || null,
    gainsBuffsIds: extra.gainsBuffsIds || null,
    usesBuffsIds: extra.usesBuffsIds || null,
    gainedStacksById: extra.gainedStacksById || null,
    usedStacksById: extra.usedStacksById || null,
    craftedIds: extra.craftedIds || null,
    scriptFamilies: extra.scriptFamilies || {},
    parentById: extra.parentById || {},
    rarityRank: extra.rarityRank || DEFAULT_RARITY_RANK,
    startOfBattleIds: extra.startOfBattleIds || null,
  };

  const entry = rulesById?.[sourceItem?.id];
  if (!targetItem) {
    const emptyRule = entry?.affectsEmpty;
    if (!emptyRule) return false;
    if (emptyRule.op === 'colorIs') return emptyRule.color === color;
    if (emptyRule.op === 'true') return true;
    if (emptyRule.op === 'false') return false;
    return evalRule(emptyRule, sourceItem, ctx);
  }

  const rule = entry?.[key];
  if (!rule) return false;
  return evalRule(rule, targetItem, ctx);
}

/**
 * @param {Record<string, object> | null} rulesById
 * @param {object} sourceItem
 * @param {'primary'|'secondary'|'tertiary'|'lightning'} [color]
 */
export function isAffectingDistinct(rulesById, sourceItem, color = 'primary') {
  const rule = rulesById?.[sourceItem?.id]?.distinct;
  if (!rule) return false;
  if (rule.op === 'true') return true;
  if (rule.op === 'false') return false;
  if (rule.op === 'colorIs') return rule.color === color;
  // Rainbow Potion: Secondary or Tertiary
  if (rule.op === 'or') {
    return (rule.args || []).some(
      (a) => a?.op === 'colorIs' && a.color === color,
    );
  }
  return evalRule(rule, sourceItem, { color });
}

/**
 * Character combat-stat HUD (Character.Stat / StatIcons) + log events.
 * Display order matches CharacterStatsDisplay: ReflectStacks … MaxHealthGain.
 */

/**
 * @typedef {string} ActorStatKey
 */

/**
 * @param {number} n
 */
function stepify(n) {
  return Math.round(n * 10) / 10;
}

/**
 * @typedef {{
 *   key: string,
 *   file: string,
 *   fileNeg: string | null,
 *   suffix: string,
 *   label: string,
 *   tip?: string,
 *   stacks?: boolean,
 *   stripMinus?: boolean,
 * }} ActorHudStatDef
 */

/** @type {ActorHudStatDef[]} */
export const ACTOR_HUD_STATS = [
  {
    key: 'reflect_stacks',
    file: 'ReflectStacks.png',
    fileNeg: null,
    suffix: '',
    label: 'Reflect',
    tip: 'Reflect debuff stacks back to the attacker.',
    stacks: true,
  },
  {
    key: 'debuff_resist_stacks',
    file: 'DebuffResistStacks.png',
    fileNeg: null,
    suffix: '',
    label: 'Debuff resist',
    tip: 'Resist stacks — reduces debuffs applied to you.',
    stacks: true,
  },
  {
    key: 'crit_stacks',
    file: 'CritStacks.png',
    fileNeg: null,
    suffix: '',
    label: 'Crit',
    tip: 'Critical hit stacks on your attacks.',
    stacks: true,
  },
  {
    key: 'dodge_stacks',
    file: 'DodgeStacks.png',
    fileNeg: null,
    suffix: '',
    label: 'Dodge',
    tip: 'Dodge stacks — chance to avoid incoming hits.',
    stacks: true,
  },
  {
    key: 'crit_resist_stacks',
    file: 'CritResistStacks.png',
    fileNeg: null,
    suffix: '',
    label: 'Crit resist',
    tip: 'Stacks that reduce critical hits taken.',
    stacks: true,
  },
  {
    key: 'crit_resistance',
    file: 'CritResistance.png',
    fileNeg: null,
    suffix: '%',
    label: 'Crit resistance',
    tip: 'Flat % less likely to be critically hit.',
  },
  {
    key: 'stun_resistance',
    file: 'StunResistance.png',
    fileNeg: null,
    suffix: '%',
    label: 'Stun resistance',
    tip: 'Flat % less likely to be stunned.',
  },
  {
    key: 'heal_efficiency',
    file: 'HealEfficiency.png',
    fileNeg: 'HealEfficiency_negative.png',
    suffix: '%',
    label: 'Healing',
    tip: 'Bonus healing received (above 100%).',
    stripMinus: true,
  },
  {
    key: 'damage_resistance',
    file: 'DamageResistance.png',
    fileNeg: 'DamageResistance_negative.png',
    suffix: '%',
    label: 'Damage resistance',
    tip: 'Flat % less damage taken from hits.',
    stripMinus: true,
  },
  {
    key: 'melee_dmg_factor',
    file: 'MeleeDmgFactor.png',
    fileNeg: 'MeleeDmgFactor_negative.png',
    suffix: '%',
    label: 'Melee damage',
    tip: 'Bonus damage on melee weapon hits.',
  },
  {
    key: 'ranged_dmg_factor',
    file: 'RangedDmgFactor.png',
    fileNeg: 'RangedDmgFactor_negative.png',
    suffix: '%',
    label: 'Ranged damage',
    tip: 'Bonus damage on ranged weapon hits.',
  },
  {
    key: 'effect_dmg_factor',
    file: 'EffectDmgFactor.png',
    fileNeg: 'EffectDmgFactor_negative.png',
    suffix: '%',
    label: 'Effect damage',
    tip: 'Bonus damage on effect / proc hits.',
  },
  {
    key: 'unhealing',
    file: 'Unhealing.png',
    fileNeg: null,
    suffix: '%',
    label: 'Unhealing',
    tip: 'When you heal, the opponent takes % of that heal as damage.',
  },
  {
    key: 'stamina_regen',
    file: 'StaminaRegen.png',
    fileNeg: 'StaminaRegen_negative.png',
    suffix: '%',
    label: 'Stamina regen',
    tip: 'Extra stamina per second above your base 1/s regen.',
    stripMinus: true,
  },
  {
    key: 'max_health_gain',
    file: 'MaxHealthGain.png',
    fileNeg: 'MaxHealthGain_negative.png',
    suffix: '%',
    label: 'Max health gain',
    tip: 'Bonus % when you gain maximum HP.',
    stripMinus: true,
  },
];

/** @type {Record<string, { file: string, fileNeg: string | null, suffix: string, logNoun: string }>} */
export const ACTOR_STAT_META = Object.fromEntries(
  ACTOR_HUD_STATS.map((s) => [
    s.key,
    { file: s.file, fileNeg: s.fileNeg, suffix: s.suffix, logNoun: s.label },
  ]),
);

/**
 * Display units for HUD (game: (efficiency - 1) * 100).
 * @param {import('./actor.js').SimActor} actor
 * @param {ActorStatKey} [key]
 */
export function actorStatDisplay(actor, key = 'heal_efficiency') {
  const stats = collectActorHudStats(actor);
  return Number(stats[key]) || 0;
}

/**
 * HUD numbers for every combat-stat icon (0 = hidden).
 * @param {import('./actor.js').SimActor} actor
 */
export function collectActorHudStats(actor) {
  const regen = Number(actor.staminaRegen);
  return {
    reflect_stacks: Math.round(Number(actor.debuffReflectStacks) || 0),
    debuff_resist_stacks: Math.round(Number(actor.debuffResistStacks) || 0),
    crit_stacks: Math.round(Number(actor.critStacks) || 0),
    dodge_stacks: Math.round(Number(actor.dodgeStacks) || 0),
    crit_resist_stacks: Math.round(Number(actor.critResistStacks) || 0),
    crit_resistance: stepify(Number(actor.critResistance) || 0),
    stun_resistance: stepify(Number(actor.stunResistance) || 0),
    heal_efficiency: stepify((Number(actor._healAmp) || 0) * 100),
    damage_resistance: stepify(Number(actor.damageResistancePct) || 0),
    melee_dmg_factor: stepify((Number(actor.meleeDmgFactor) || 0) * 100),
    ranged_dmg_factor: stepify((Number(actor.rangedDmgFactor) || 0) * 100),
    effect_dmg_factor: stepify((Number(actor.effectDmgFactor) || 0) * 100),
    unhealing: stepify((Number(actor.unhealing) || 0) * 100),
    stamina_regen: stepify(((Number.isFinite(regen) ? regen : 1) - 1) * 100),
    max_health_gain: stepify((Number(actor._maxHealthGain) || 0) * 100),
  };
}

/**
 * @param {string} assetRoot
 * @param {string} statKey
 * @param {boolean} [negative]
 */
export function actorStatIconUrl(assetRoot, statKey, negative = false) {
  const root = assetRoot.endsWith('/') ? assetRoot : `${assetRoot}/`;
  const meta = ACTOR_STAT_META[statKey];
  const file =
    negative && meta?.fileNeg ? meta.fileNeg : meta?.file || 'HealEfficiency.png';
  return `${root}assets/icons/sim/stats/${file}`;
}

/**
 * @param {number} value
 * @param {ActorHudStatDef} def
 */
export function formatHudStatValue(value, def) {
  const n = Number(value) || 0;
  const shown = def.stripMinus ? Math.abs(n) : n;
  if (def.stacks) return String(Math.round(shown));
  const stepped = stepify(shown);
  return Number.isInteger(stepped) ? String(stepped) : String(stepped);
}

/**
 * Native hover title for a combat-stat HUD icon.
 * @param {ActorHudStatDef} def
 * @param {number} value display units from collectActorHudStats
 */
export function actorStatTooltip(def, value) {
  const raw = Number(value) || 0;
  const shown = formatHudStatValue(raw, def);
  const suffix = def.suffix || '';
  const sign = def.stacks || def.stripMinus ? '' : raw > 0 ? '+' : '';
  const valuePart = `${sign}${shown}${suffix}`;
  const tip = def.tip ? ` ${def.tip}` : '';
  return `${def.label}: ${valuePart}.${tip}`.trim();
}

/**
 * Game Character.giveStaminaRegeneration — adds to staminaRegen (base 1.0).
 * @param {import('./actor.js').SimActor} actor
 * @param {number} delta absolute stam/s added (not a %)
 * @param {{ t?: number, events?: import('../sim-events.js').SimEvent[] }} ctx
 * @param {{ itemId?: string, placementKey?: string, name?: string } | null} [origin]
 */
export function applyStaminaRegeneration(actor, delta, ctx, origin = null) {
  const d = Number(delta) || 0;
  if (!d) return;
  const cur = Number(actor.staminaRegen);
  actor.staminaRegen = (Number.isFinite(cur) ? cur : 1) + d;
  pushStatEvent(actor, ctx, origin, 'stamina_regen', stepify(d * 100));
}

/**
 * Apply a heal-efficiency delta (fraction, e.g. 0.06) and emit a `stat` log event.
 *
 * @param {import('./actor.js').SimActor} actor
 * @param {number} deltaFrac
 * @param {{ t?: number, events?: import('../sim-events.js').SimEvent[] }} ctx
 * @param {{ itemId?: string, placementKey?: string, name?: string } | null} [origin]
 */
export function applyHealEfficiency(actor, deltaFrac, ctx, origin = null) {
  const d = Number(deltaFrac) || 0;
  if (!d) return;
  actor._healAmp = (Number(actor._healAmp) || 0) + d;
  pushStatEvent(actor, ctx, origin, 'heal_efficiency', stepify(d * 100));
}

/**
 * Apply an unhealing delta (fraction, e.g. 0.15) and emit a `stat` log event.
 * Game HUD shows getUnhealing() × 100 (Blood Manipulation 15 → 15%).
 *
 * @param {import('./actor.js').SimActor} actor
 * @param {number} deltaFrac
 * @param {{ t?: number, events?: import('../sim-events.js').SimEvent[] }} ctx
 * @param {{ itemId?: string, placementKey?: string, name?: string } | null} [origin]
 */
export function applyUnhealing(actor, deltaFrac, ctx, origin = null) {
  const d = Number(deltaFrac) || 0;
  if (!d) return;
  actor.unhealing = Math.max(0, (Number(actor.unhealing) || 0) + d);
  pushStatEvent(actor, ctx, origin, 'unhealing', stepify(d * 100));
}

/**
 * Game Character.changeEffectDamageFactor — HUD Stat.EffectDmgFactor × 100.
 * Must write `effectDmgFactor` (not `effectDamageFactor`) or the icon never appears.
 *
 * @param {import('./actor.js').SimActor} actor
 * @param {number} deltaFrac e.g. 0.08 → 8%
 * @param {{ t?: number, events?: import('../sim-events.js').SimEvent[] }} ctx
 * @param {{ itemId?: string, placementKey?: string, name?: string } | null} [origin]
 */
export function applyEffectDmgFactor(actor, deltaFrac, ctx, origin = null) {
  const d = Number(deltaFrac) || 0;
  if (!d) return;
  actor.effectDmgFactor = (Number(actor.effectDmgFactor) || 0) + d;
  pushStatEvent(actor, ctx, origin, 'effect_dmg_factor', stepify(d * 100));
}

/**
 * @param {import('./actor.js').SimActor} actor
 * @param {{ t?: number, events?: import('../sim-events.js').SimEvent[] }} ctx
 * @param {{ itemId?: string, placementKey?: string, name?: string } | null} origin
 * @param {string} key
 * @param {number} deltaPct
 */
function pushStatEvent(actor, ctx, origin, key, deltaPct) {
  const events = ctx?.events;
  if (!Array.isArray(events)) return;
  const meta = ACTOR_STAT_META[key];
  const abs = Math.abs(deltaPct);
  const verb = deltaPct < 0 ? 'reduced' : 'increased';
  const suffix = meta?.suffix || '%';
  events.push({
    t: (Number(ctx.t) || 0) + 0.0015,
    type: 'stat',
    actor: actor.id,
    amount: deltaPct,
    itemId: origin?.itemId,
    placementKey: origin?.placementKey,
    label: `${meta?.logNoun || key} ${verb} by ${abs}${suffix}`,
    meta: {
      category: 'stat',
      stat: key,
      total: collectActorHudStats(actor)[key],
      suffix,
      originName: origin?.name,
    },
  });
}

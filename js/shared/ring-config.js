/** Game-faithful Magic Ring / Superior Ring effect encoding and labels. */

export const RING_TRIGGERS = Object.freeze([
  { value: 0, label: 'Start of battle' },
  { value: 1, label: 'Every cooldown' },
  { value: 2, label: 'Your health is low' },
  { value: 3, label: 'Opponent health is low' },
]);

export const RING_STACKS = Object.freeze([
  'lucky',
  'regeneration',
  'vampirism',
  'spikes',
  'mana',
  'empower',
  'heat',
  'poison',
  'blind',
  'cold',
]);

const STACK_LABELS = Object.freeze({
  lucky: 'Luck',
  regeneration: 'Regeneration',
  spikes: 'Spikes',
  mana: 'Mana',
  heat: 'Heat',
  vampirism: 'Vampirism',
  empower: 'Empower',
  poison: 'Poison',
  blind: 'Blind',
  cold: 'Cold',
});

const RING_EFFECTS = Object.freeze({ magic_ring: 2, superior_ring: 3 });

/** @param {string} id */
export function ringEffectCount(id) {
  return RING_EFFECTS[String(id)] || 0;
}

/** @param {string} stack */
export function ringStackLabel(stack) {
  return STACK_LABELS[String(stack)] || String(stack || 'Unknown');
}

/** @param {number} trigger */
export function ringTriggerLabel(trigger) {
  return RING_TRIGGERS[Number(trigger)]?.label || 'Unknown trigger';
}

/** @param {unknown} effect */
export function normalizeRingEffect(effect) {
  const trigger = Number(effect?.trigger);
  const stack = String(effect?.stack || '');
  return {
    trigger: Number.isInteger(trigger) && trigger >= 0 && trigger < 4 ? trigger : 0,
    stack: RING_STACKS.includes(stack) ? stack : RING_STACKS[0],
  };
}

/**
 * @param {unknown} effects
 * @param {number} count
 * @returns {{ trigger: number, stack: string }[]}
 */
export function normalizeRingEffects(effects, count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  const rows = Array.isArray(effects) ? effects : [];
  return Array.from({ length: n }, (_, i) => normalizeRingEffect(rows[i]));
}

/**
 * HistoryDB stores each pair as 2 trigger bits followed by 4 stack bits.
 * @param {number} raw
 * @param {number} count
 */
export function decodeRingEffects(raw, count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  const value = Number.isFinite(Number(raw)) ? Math.max(0, Math.floor(Number(raw))) : 0;
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const shift = (n - i - 1) * 6;
    const encoded = (value >> shift) & 0x3f;
    out.push({
      trigger: (encoded >> 4) & 0x3,
      stack: RING_STACKS[encoded & 0xf] || RING_STACKS[0],
    });
  }
  return out;
}

/** @param {Array<{ trigger: number, stack: string }>} effects */
export function encodeRingEffects(effects) {
  let value = 0;
  for (const effect of effects || []) {
    const row = normalizeRingEffect(effect);
    value = (value << 6) | (row.trigger << 4) | RING_STACKS.indexOf(row.stack);
  }
  return value;
}

/**
 * @param {unknown} persistent
 * @param {string} id
 */
export function ringEffectsFromPersistent(persistent, id) {
  const count = ringEffectCount(id);
  if (!count) return [];
  const data = persistent && typeof persistent === 'object' ? persistent : {};
  if (Array.isArray(data.effects)) return normalizeRingEffects(data.effects, count);
  const raw = Number(data.magicRing);
  if (!Number.isFinite(raw) || raw < 0) return [];
  return decodeRingEffects(raw, count);
}

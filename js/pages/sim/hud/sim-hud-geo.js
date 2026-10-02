/**
 * Game CombatUI geometry (Core/Character.tscn + Core/Opponent.tscn), in game px.
 *
 * Stage space: x = CombatUI.x − sheet left edge, y = CombatUI.y + 298
 * (298 leaves 5px headroom above the sheet for the Sword sprite).
 * The Sheet is 580×506 at scale (0.987085, 1) centered at (384, −40) for the
 * player and 581×507 centered at (417, −40) for the opponent, so the opponent's
 * shared rows sit 32.505px further left on its card — BODY_DX below.
 */

export const STAGE = { w: 573, h: 512 };

/** Sheet-local origins: player sheet left 97.745, opponent 130.25 */
export const BODY_DX = { player: 0, dummy: -32.505 };

export const SHEET = {
  player: { file: 'CombatSheet.png', left: 0, top: 5, w: 572.51, h: 506 },
  dummy: { file: 'CombatSheet_Opponent.png', left: 0, top: 4.5, w: 573.49, h: 507 },
};

/** NameBanner is a Sheet child, so its 505×125 art picks up the 0.987085 x-scale */
export const BANNER = {
  player: { left: 30.01, top: 10.5, w: 498.48, h: 125, flip: false },
  dummy: { left: 44.51, top: 9.5, w: 498.48, h: 125, flip: true },
};

/** CombatUI/Name: 403×51, Baskerville Regular 40, outline 3, centered */
export const NAME = {
  player: { left: 86.26, top: 58, w: 403, h: 51 },
  dummy: { left: 74.75, top: 58, w: 403, h: 51 },
};

/** CombatUI/Sheet/Sword: 98×116; opponent adds offset (−19.249, −26) + flip_h */
export const SWORD = {
  player: { left: 461.89, top: 0, w: 96.73, h: 116, flip: false },
  dummy: { left: 7.39, top: 1, w: 96.73, h: 116, flip: true },
};

/** Rows shared by both sides (player-card coords; shift by BODY_DX) */
export const ROWS = {
  hpLabel: { left: 109.26, top: 137, w: 129, h: 32 },
  hpBar: { left: 241.26, top: 134, w: 216, h: 33 },
  hpBorder: { left: 238.25, top: 129.63, w: 222.96, h: 41 },
  hpText: { left: 344.26, top: 135, w: 97, h: 32 },
  stamLabel: { left: 108.26, top: 186, w: 131, h: 32 },
  stamBar: { left: 244.26, top: 182, w: 214, h: 35 },
  stamBorder: { left: 240.25, top: 178.5, w: 221.75, h: 41 },
  stamText: { left: 328.26, top: 183, w: 112, h: 32 },
  buffsLabel: { left: 107.26, top: 240, w: 105, h: 32 },
  debuffsLabel: { left: 106.26, top: 342, w: 197, h: 32 },
};

/**
 * StackCounter instances: sprite center + native size × its Sprite scale, plus
 * the Label rect. `threshold` is BlockHud.scaleThreshold.
 * @type {Record<string, { file: string, cx: number, cy: number, w: number, h: number, label: { left: number, top: number, w: number, h: number }, threshold?: number }>}
 */
export const COUNTERS = {
  block: {
    file: 'Block.png',
    cx: 479.26,
    cy: 150,
    w: 80.27,
    h: 85.93,
    label: { left: 447.26, top: 131, w: 62, h: 41 },
    threshold: 250,
  },
  regeneration: {
    file: 'Regeneration.png',
    cx: 238.26,
    cy: 264,
    w: 68.8,
    h: 59.14,
    label: { left: 198.26, top: 256, w: 69, h: 41 },
  },
  lucky: {
    file: 'Lucky.png',
    cx: 318.33,
    cy: 260.93,
    w: 64.72,
    h: 62.34,
    label: { left: 288.26, top: 255, w: 69, h: 41 },
  },
  spikes: {
    file: 'Spikes.png',
    cx: 411.26,
    cy: 263,
    w: 80.97,
    h: 80.37,
    label: { left: 368.26, top: 255, w: 85, h: 34 },
  },
  vampirism: {
    file: 'Vampirism.png',
    cx: 185.26,
    cy: 314,
    w: 89.42,
    h: 56.65,
    label: { left: 148.26, top: 304, w: 72, h: 40 },
  },
  mana: {
    file: 'Mana.png',
    cx: 277.65,
    cy: 312.59,
    w: 55.21,
    h: 71.78,
    label: { left: 242.26, top: 303, w: 72, h: 40 },
  },
  heat: {
    file: 'Heat.png',
    cx: 375.26,
    cy: 309,
    w: 83.11,
    h: 83.11,
    label: { left: 339.26, top: 302, w: 72, h: 40 },
  },
  empower: {
    file: 'Empower.png',
    cx: 464.26,
    cy: 314,
    w: 80.52,
    h: 70.81,
    label: { left: 433.26, top: 303, w: 72, h: 40 },
  },
  protection: {
    file: 'Protection.png',
    cx: 497.26,
    cy: 274,
    w: 65.44,
    h: 75.31,
    label: { left: 463.26, top: 254, w: 72, h: 40 },
  },
  poison: {
    file: 'Poison.png',
    cx: 158.71,
    cy: 409.48,
    w: 75.59,
    h: 75.04,
    label: { left: 129.26, top: 415, w: 61, h: 41 },
  },
  blind: {
    file: 'Blind.png',
    cx: 240.92,
    cy: 404,
    w: 72.81,
    h: 68.05,
    label: { left: 206.26, top: 414, w: 69, h: 41 },
  },
  cold: {
    file: 'Cold.png',
    cx: 327.7,
    cy: 406.38,
    w: 69.12,
    h: 71.66,
    label: { left: 295.26, top: 412, w: 69, h: 41 },
  },
  weak: {
    file: 'Weak.png',
    cx: 407.92,
    cy: 400,
    w: 57.11,
    h: 51.87,
    label: { left: 373.26, top: 410, w: 69, h: 41 },
  },
};

/** CombatUI order: Buffs label then Regeneration … Protection */
export const BUFF_KEYS = [
  'regeneration',
  'lucky',
  'spikes',
  'vampirism',
  'mana',
  'heat',
  'empower',
  'protection',
];

export const DEBUFF_KEYS = ['poison', 'blind', 'cold', 'weak'];

/**
 * CharacterStatsDisplay: 60×60 grid, 6 per column, columns grow left for the
 * player and right for the opponent; CharacterStatIcon is 55×55 with a 60×26
 * label at (−11, 6).
 */
export const STATS = {
  player: { left: 37.26, top: 83, dir: -1 },
  dummy: { left: 536.75, top: 80, dir: 1 },
  step: 60,
  perColumn: 6,
  icon: 55,
  label: { dx: -11, dy: 6, w: 60, h: 26 },
};

/**
 * BlockHud.calcScale — counters grow with their value.
 * `0.5 + sqrt(value / 100)`, softened past `scaleThreshold`.
 * @param {number} value
 * @param {number} [threshold=50]
 */
export function counterScale(value, threshold = 50) {
  let v = Math.max(0, Number(value) || 0);
  if (v > threshold) v = threshold + (v - threshold) ** 0.65;
  return 0.5 + Math.sqrt(v / 100);
}

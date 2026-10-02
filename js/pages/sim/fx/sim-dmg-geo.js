/**
 * Game combat-label data: Interface/DamageNumbers/* (DamageNumber, BuffLabel,
 * the five .tres animations, base font + size curve), Core/Game.gd number
 * colors, Core/Character.gd spawn positions / attack tweens / HitAnimation.
 *
 * Units are game px and seconds, exactly as authored. The renderer scales by
 * the on-screen body height (see BODY).
 */

/**
 * Combat body box: Character.tscn `Mirroring/Sprite/Button` is 240×336 and
 * StartInCombat parks the sprite at (−112, −48), so the body center sits at
 * (−120, −40) from the Character origin. All spawn offsets below are relative
 * to that center, with +x pointing *inward* (toward the other fighter) so both
 * sides mirror the way the game mirrors `Mirroring` for the opponent.
 */
export const BODY = { w: 240, h: 336 };

/**
 * randDmgNumberPos / randHealNumberPos / randBuffLabelPos:
 * DMG_NUM_CENTER (−100,−40) and HEAL_NUM_CENTER (0,−40) are 20 / 120 px inward
 * of the body center, BUFFLABEL_CENTER (−100, 100) 140 px below it.
 */
export const SPAWN = {
  damage: { dx: 20, dy: 0, jx: 50, jy: 70 },
  heal: { dx: 120, dy: 0, jx: 50, jy: 70 },
  buff: { dx: 20, dy: 140, jx: 60, jy: 40 },
};

/** dmgNumBaseDir (0,−660) rotated −3°…−21°, mirrored for the opponent */
export const DIR = { speed: 660, minDeg: 3, maxDeg: 21 };

/** DamageNumber.gd / BuffLabel.gd `const g = 100.0` */
export const G = 100;

/** DamageNumber.spawnNumber: `rotation = linear_velocity.x * 0.001` */
export const ROT_PER_VX = 0.001;

/** DamageNumberBaseFont.tres outline color */
export const OUTLINE_INK = '#22120c';

/** RichTextLabel rect on both label scenes: 672 wide, top edge at −27 */
export const NUM_BOX = { left: -336, top: -27, w: 672 };
export const BUFF_BOX = { left: -264, top: -27, w: 529 };

/** Util.prepareFonts — the only sizes that exist; anything between rounds down */
export const FONT_SIZES = [
  60, 65, 70, 75, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200,
];

/**
 * DamageNumberSizeCurve.tres: two points (0,60) → (1,200) with flat tangents,
 * which is Godot's cubic bezier, i.e. smoothstep — not a straight line.
 * @param {number} amount
 */
export function numberFontSize(amount) {
  const t = Math.min(1, Math.max(0, (Number(amount) || 0) / 100));
  const s = t * t * (3 - 2 * t);
  const raw = Math.trunc(60 + 140 * s);
  let size = FONT_SIZES[0];
  for (const step of FONT_SIZES) {
    if (raw >= step) size = step;
  }
  return size;
}

/**
 * Util.prepareFonts: `font.outline_size = size / 25.0 + 2.5`
 * @param {number} fontSize
 */
export function outlineSize(fontSize) {
  return fontSize / 25 + 2.5;
}

/**
 * The game randomises spawn jitter, animation speed and lunge distance per
 * event — `randf_range`.
 * @param {number} a
 * @param {number} b
 */
export function rand(a, b) {
  return a + Math.random() * (b - a);
}

/**
 * Godot's Math::ease — animation key transitions.
 * @param {number} x 0–1
 * @param {number} c transition of the key the segment starts on
 */
export function ease(x, c) {
  const p = Math.min(1, Math.max(0, x));
  if (c > 0) {
    if (c < 1) return 1 - Math.pow(1 - p, 1 / c);
    return Math.pow(p, c);
  }
  if (c < 0) {
    if (p < 0.5) return Math.pow(p * 2, -c) * 0.5;
    return (1 - Math.pow(1 - (p - 0.5) * 2, -c)) * 0.5 + 0.5;
  }
  return 0;
}

/**
 * Item labels set the whole node's `modulate`, which multiplies the outline as
 * well as the glyphs — character numbers only tint the fill.
 * @param {string} hex
 */
export function tintInk(hex) {
  const parse = (s) => {
    const v = String(s).replace('#', '');
    return [0, 2, 4].map((i) => Number.parseInt(v.slice(i, i + 2), 16) || 0);
  };
  const ink = parse(OUTLINE_INK);
  const tint = parse(hex);
  const out = ink.map((c, i) => Math.round((c * tint[i]) / 255));
  return `#${out.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * @typedef {{ t: number, v: number[], tr?: number }} TrackKey
 */

/**
 * Sample a Godot value track (linear interp, `from` key transition eased).
 * @param {TrackKey[]} keys
 * @param {number} t
 * @returns {number[]}
 */
export function sampleTrack(keys, t) {
  if (!keys.length) return [0];
  if (t <= keys[0].t) return keys[0].v;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t > b.t) continue;
    const span = b.t - a.t;
    const raw = span <= 0 ? 1 : (t - a.t) / span;
    const c = a.tr ?? 1;
    const k = c === 1 ? raw : ease(raw, c);
    return a.v.map((v, idx) => v + (b.v[idx] - v) * k);
  }
  return keys[keys.length - 1].v;
}

/**
 * Label animations. `mod` is [brightness, alpha] from the Label:self_modulate
 * track; `scale` is the node scale track (x and y split where the game splits
 * them). `gravity` is DamageNumber.gd's gravity_scale.
 */
export const ANIMS = {
  /** DamageNumbersNormalAni.tres */
  Normal: {
    len: 1.1,
    gravity: 12,
    mod: [
      { t: 0, v: [1.2, 1], tr: 6.72715 },
      { t: 1.1, v: [1, 0] },
    ],
    scale: [
      { t: 0, v: [0.1, 0.1], tr: 0.5 },
      { t: 0.47, v: [1, 1], tr: 2.14355 },
      { t: 1.1, v: [0.2, 0.2] },
    ],
  },
  /** DamageNumbersCriticalAni.tres — x and y peak on different keys */
  Critical: {
    len: 1.1,
    gravity: 9.5,
    shake: { rate: 20, level: 50 },
    mod: [
      { t: 0, v: [1.2, 1], tr: 5.46414 },
      { t: 0.8, v: [1, 1], tr: 2 },
      { t: 1.1, v: [1, 0] },
    ],
    scaleX: [
      { t: 0, v: [0.1], tr: -2 },
      { t: 0.33, v: [1], tr: -2 },
      { t: 1.1, v: [0.2] },
    ],
    scaleY: [
      { t: 0, v: [0.1], tr: -2 },
      { t: 0.51, v: [1], tr: 2.54912 },
      { t: 1.1, v: [0.2] },
    ],
  },
  /** DamageNumbersHealAni.tres — rises on its own velocity, no gravity */
  Heal: {
    len: 0.9,
    gravity: 0,
    velocity: [0, -200],
    mod: [
      { t: 0, v: [1.8, 1], tr: 1 },
      { t: 0.5, v: [1.8, 1], tr: 1 },
      { t: 0.886064, v: [1, 0] },
    ],
    scale: [
      { t: 0, v: [0.4, 0.4], tr: 0.34151 },
      { t: 0.36, v: [1, 1], tr: 2 },
      { t: 0.887184, v: [0.4, 0.4] },
    ],
  },
  /** BuffLabel.tscn "Buff" — MISS, stun, resisted / protected / reflected */
  Buff: {
    len: 1.5,
    gravity: 1,
    mod: [
      { t: 0, v: [1, 1], tr: 3.249 },
      { t: 1.5, v: [1, 0] },
    ],
    scale: [
      { t: 0, v: [0.5, 0.5], tr: 0.5 },
      { t: 0.4, v: [1, 1], tr: 3.03143 },
      { t: 1.5, v: [0.6, 0.6] },
    ],
  },
  /**
   * BuffLabel.tscn "Damage" — the copy of the number that pops over the item
   * that caused it (Settings.damage_numbers defaults to DMG_NR_ALL, so the
   * game shows both the character number and this one).
   */
  ItemDamage: {
    len: 0.7,
    gravity: 1,
    velocity: [0, -75],
    mod: [
      { t: 0, v: [1, 1], tr: 1.93187 },
      { t: 0.108146, v: [1.5, 1], tr: 3.03143 },
      { t: 0.7, v: [1, 0] },
    ],
    scale: [
      { t: 0, v: [0, 0], tr: 2 },
      { t: 0.102313, v: [1, 1], tr: 4.92458 },
      { t: 0.7, v: [0.2, 0.8] },
    ],
    shake: { rate: 20, level: 30 },
  },
  /** BuffLabel.tscn "ItemBuff" — stack gain / loss over the item */
  ItemBuff: {
    len: 1,
    gravity: 1,
    velocity: [0, -75],
    mod: [
      { t: 0, v: [1, 1], tr: 4.75681 },
      { t: 1, v: [1, 0] },
    ],
    scale: [
      { t: 0, v: [0.8, 0.8], tr: 3.13833 },
      { t: 0.1, v: [0.9, 0.9], tr: -2 },
      { t: 1, v: [0.5, 0.5] },
    ],
  },
  /** BuffLabel.tscn "StatChange" — heal amp / DR / effect dmg on the item */
  StatChange: {
    len: 1.5,
    gravity: 1,
    velocity: [0, -75],
    mod: [
      { t: 0, v: [1, 1], tr: 4.75681 },
      { t: 1.5, v: [1, 0] },
    ],
    scale: [
      { t: 0, v: [0.8, 0.8], tr: 3.13833 },
      { t: 0.1, v: [0.9, 0.9], tr: -2 },
      { t: 1.5, v: [0.5, 0.5] },
    ],
  },
  /**
   * OutOfStaminaLabel.tscn "Show" — AnimationPlayer playback_speed 1.5, so
   * key times below are already ÷1.5 (wall-clock). Stays on the item (no rise).
   */
  OutOfStamina: {
    len: 0.841858 / 1.5,
    gravity: 0,
    velocity: [0, 0],
    mod: [
      { t: 0, v: [1, 0] },
      { t: 0.0651148 / 1.5, v: [1, 1] },
      { t: 0.7 / 1.5, v: [1, 1] },
      { t: 0.837202 / 1.5, v: [1, 0] },
    ],
    scale: [
      { t: 0, v: [0.5, 0.5] },
      { t: 0.058142 / 1.5, v: [1, 1] },
      { t: 0.68372 / 1.5, v: [1, 1] },
      { t: 0.841858 / 1.5, v: [0, 0] },
    ],
    /** degrees — sampled in paintLabel */
    rotDeg: [
      { t: 0.0674367 / 1.5, v: [0], tr: -2 },
      { t: 0.223249 / 1.5, v: [3], tr: -2 },
      { t: 0.365106 / 1.5, v: [-3], tr: -2 },
      { t: 0.490719 / 1.5, v: [3], tr: -2 },
      { t: 0.634902 / 1.5, v: [-3], tr: -2 },
      { t: 0.739532 / 1.5, v: [0], tr: -2 },
    ],
  },
};

/**
 * Game.damageNumberFormats + damageNumberColors. `Unhealing` damage reaches
 * takeDamage as DamageSource.Type.Unhealing, which Character.spawnLabel does
 * not branch on — so it pops as a plain white DealDamage number in game.
 */
export const NUMBER_TYPES = {
  damage: { color: '#ffffff', anim: 'Normal', sign: '' },
  critical: { color: '#ff1a1a', anim: 'Critical', sign: '' },
  heal: { color: '#38ed38', anim: 'Heal', sign: '+' },
  poison: { color: '#81ff1a', anim: 'Normal', sign: '' },
  spikes: { color: '#3bb932', anim: 'Normal', sign: '' },
  fatigue: { color: '#8e64bd', anim: 'Normal', sign: '' },
  loseHealth: { color: '#e27878', anim: 'Normal', sign: '' },
};

/** BuffLabel.gd label font + stack colors */
export const BUFF_LABEL = {
  font: 40,
  outline: 4,
  icon: 40,
  positive: '#96ff90',
  negative: '#ff9090',
  white: '#ffffff',
  /** randBuffLabelDir: Vector2(0, −75…−120) */
  riseMin: 75,
  riseMax: 120,
};

/** Interface.csv LABEL_* strings (English) */
export const LABEL_TEXT = {
  miss: 'MISS',
  outOfStamina: 'Out of stamina!',
  critResisted: 'Crit Resisted',
  stunResisted: 'Stun Resisted',
  /** @param {number} dur */
  stunned: (dur) => `STUNNED ${formatDur(dur)}s`,
  /** @param {number} n */
  nullified: (n) => `Nullified ${n}`,
  /** @param {number} n */
  resisted: (n) => `Resisted ${n}`,
  /** @param {number} n */
  protected: (n) => `Protected ${n}`,
  /** @param {number} n */
  reflected: (n) => `Reflected ${n}`,
};

/** Game.damageNumberColors for item-only pops (stamina / temp HP). */
export const ITEM_OTHER = {
  stamina: '#fff932',
  tempStamina: '#fffc8c',
  tempHp: '#9aff79',
};

/** OutOfStaminaLabel.tscn RichTextLabel default_color + DynamicFont outline */
export const OUT_OF_STAMINA = {
  color: '#ff8787',
  outline: '#3c261d',
  /** margin −166…170 → center box */
  box: { left: -168, top: -27, w: 336 },
};

/** spawnStatLabelOnItem uses a 50px stat icon; stacks stay 40. */
export const STAT_ICON = 50;

/**
 * BuffLabel.gd stepify(amount, 0.1) for CD / stun duration.
 * @param {number} n
 */
export function formatDur(n) {
  const s = Math.round((Number(n) || 0) * 10) / 10;
  return Number.isInteger(s) ? String(s) : String(s);
}

/**
 * HitAnimation (Character.tscn): 0.2s sprite `modulate` tint + squash, played
 * at playback_speed rand(0.9, 1.1). Colors are the game's multiply tints.
 */
export const HIT_ANIMS = {
  Hit: [1, 0.654902, 0.654902],
  Block: [0.784314, 0.784314, 0.784314],
  Fatigue: [0.729412, 0.658824, 0.827451],
  Poison: [0.494118, 1, 0.466667],
};

export const HIT_ANIM = {
  len: 0.2,
  speedMin: 0.9,
  speedMax: 1.1,
  tintAt: 0.0610814,
  squash: { t: 0.0290093, x: 1.03, y: 0.97 },
};

/** Character.playAttackAnimation — lunge inward, then ease back */
export const LUNGE = {
  distMin: 100,
  distMax: 160,
  fwdSpeed: 2600,
  backSpeed: 1000,
  jitterMin: 0.9,
  jitterMax: 1.1,
};

/** Character.playActivateAnimation — 40 px hop at 300 px/s */
export const HOP = { height: 40, speed: 300 };

/** Item.getNextFreeLabelPosition — five slots, each held 0.5 s, ±10 jitter */
export const ITEM_LABEL = {
  offsets: [
    [0, 0],
    [30, 30],
    [-30, 30],
    [30, -30],
    [-30, -30],
  ],
  hold: 0.5,
  jitter: 10,
  fallbackJitter: 30,
  /** Item.gd `const cellSize = Vector2(80, 80)` — slot offsets are in these px */
  cell: 80,
};

/**
 * Util.spawnLabelOnItem parents the BuffLabel to Game.UINode (same Node2D as
 * character damage numbers), not to the item. Font / icon / physics therefore
 * use the fighter body scale. Slot offsets stay in cell px so they still fan
 * around the on-screen piece when the bag is a different size than the avatar.
 *
 * @param {number} cellPx
 * @param {number} [bodyK]
 */
export function itemLabelScales(cellPx, bodyK) {
  const cell = Number(cellPx);
  const cellK = (cell > 0 ? cell : ITEM_LABEL.cell) / ITEM_LABEL.cell;
  const body = Number(bodyK);
  const k = body > 0 ? body : cellK;
  return { cellK, k };
}

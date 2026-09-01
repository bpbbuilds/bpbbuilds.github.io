/**
 * Game-shaped Combat Log sentences (LOG_* English templates).
 * Band Q/R — mirrors CombatEvent.asText + Interface.csv copy.
 */

import { ACTOR_STAT_META, actorStatIconUrl } from './engine/actor-stats.js';
import { formatCombatLogTime } from './sim-combat-time.js';
import { compareSimEvents } from './sim-events.js';

const STACK_FILES = {
  block: 'Block.png',
  lucky: 'Lucky.png',
  regeneration: 'Regeneration.png',
  vampirism: 'Vampirism.png',
  spikes: 'Spikes.png',
  mana: 'Mana.png',
  empower: 'Empower.png',
  heat: 'Heat.png',
  poison: 'Poison.png',
  blind: 'Blind.png',
  cold: 'Cold.png',
};

/**
 * @param {string} s
 */
export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {import('./sim-events.js').SimEvent} ev
 * @param {Map<string, object> | null | undefined} itemsById
 */
export function originName(ev, itemsById) {
  const sys =
    typeof ev.meta?.systemOrigin === 'string' ? ev.meta.systemOrigin.trim() : '';
  // Heal tab: EventType.Vampirism / Regeneration, not the weapon that proc’d vamp.
  if (ev.type === 'heal' || ev.meta?.category === 'hot') {
    if (
      sys === 'Regeneration' ||
      ev.meta?.stack === 'regeneration' ||
      /regeneration/i.test(String(ev.label || ''))
    ) {
      return 'Regeneration';
    }
    if (sys === 'Vampirism' || /vampirism/i.test(String(ev.label || ''))) {
      return 'Vampirism';
    }
  }
  if (sys && /^(Vampirism|Regeneration|Unhealing|Fatigue|Training Dummy|Spikes)$/i.test(sys)) {
    return sys;
  }
  if (ev.itemId && itemsById?.get(ev.itemId)?.name) {
    return String(itemsById.get(ev.itemId).name);
  }
  if (sys) return sys;
  if (ev.label) {
    const label = String(ev.label);
    const m = label.match(/\(([^)]+)\)\s*$/);
    if (m && m[1] && !/^\d/.test(m[1]) && !/^(consumed|approx|crit)$/i.test(m[1])) {
      return m[1];
    }
    const script = label.match(/^Script:\s*(.+?)(?:\s*\(approx\))?$/i);
    if (script) return script[1].trim();
    const kind = label.match(/^(?:Item|Pet|Spell|Card|Weapon|Food):\s*(.+)$/i);
    if (kind) return kind[1].trim();
    // "Blueberries: +1 Mana" / "Wooden Sword hit for 8"
    const colon = label.match(/^([^:]+):\s+/);
    if (colon) {
      const head = colon[1].trim();
      if (!/^(player|dummy)$/i.test(head)) return head;
    }
  }
  if (ev.itemId) return titleCase(ev.itemId);
  const stack = typeof ev.meta?.stack === 'string' ? ev.meta.stack.toLowerCase() : '';
  if (stack === 'regeneration') return 'Regeneration';
  if (stack === 'poison') return 'Poison';
  if (stack === 'spikes') return 'Spikes';
  if (ev.actor === 'dummy' || ev.target === 'player' && ev.type === 'damage' && !ev.itemId) {
    if (ev.actor === 'dummy') return 'Training Dummy';
  }
  if (ev.type === 'heal' && stack === 'regeneration') return 'Regeneration';
  return 'Combat';
}

/** @param {string} id */
function titleCase(id) {
  return String(id)
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * @param {import('./sim-events.js').SimEvent} ev
 */
export function stackKeyOf(ev) {
  const m = ev.meta?.stack;
  if (typeof m === 'string' && m) return m.toLowerCase();
  const label = String(ev.label || '');
  for (const key of Object.keys(STACK_FILES)) {
    if (new RegExp(key, 'i').test(label)) return key;
  }
  if (/block/i.test(label)) return 'block';
  return null;
}

/**
 * @param {string} assetRoot
 * @param {string} stack
 */
export function stackIconHtml(assetRoot, stack) {
  const root = assetRoot.endsWith('/') ? assetRoot : `${assetRoot}/`;
  const file = STACK_FILES[stack];
  if (!file) return escapeHtml(stack);
  const src = `${root}assets/icons/status/buff/${file}`;
  return `<img class="sim-clog__icon" src="${src}" alt="${escapeHtml(stack)}" width="18" height="18" draggable="false" />`;
}

/**
 * Noise / non-log lines (ticks, raw system chatter).
 * @param {import('./sim-events.js').SimEvent} ev
 */
export function isLogNoise(ev) {
  if (ev.type === 'tick' || ev.type === 'fight_start') return true;
  if (ev.type === 'charge') return true;
  if (ev.meta?.phase === 'tesla_prepare') return true;
  if (ev.meta?.noop) return true;
  if (ev.type === 'info' && ev.meta?.category === 'adjacency') return true;
  if (ev.type === 'info' && ev.meta?.category === 'system' && !ev.label) return true;
  if (ev.type === 'info' && ev.meta?.category === 'card') return true;
  if (ev.type === 'info' && /Items live \(combat delay/i.test(String(ev.label || ''))) {
    return true;
  }
  if (ev.type === 'info' && /^Armor DR \d+/i.test(String(ev.label || ''))) return true;
  if (ev.type === 'activate' && ev.meta?.combatStart) return true;
  if (ev.type === 'info' && /combat noop|card\(s\)/i.test(String(ev.label || ''))) {
    return true;
  }
  if (ev.type === 'cooldown') return true;
  // Game combat log: stamina spend is not a line (only regen / drain / out of stamina).
  if (ev.meta?.kind === 'block_strip' && ev.type === 'damage') return true;
  if (ev.type === 'stamina' && !ev.meta?.starved) {
    const lab = String(ev.label || '');
    if (!/\+|regenerat|gain/i.test(lab)) return true;
  }
  return false;
}

/**
 * Activation-class lines (Hide / Minimize / Show filter).
 * @param {import('./sim-events.js').SimEvent} ev
 */
export function isActivationLine(ev) {
  if (ev.type !== 'activate') return false;
  // Passive bags (Fanny Pack) are not cooldown activations.
  if (ev.meta?.handler === 'fanny_pack') return false;
  return true;
}

/**
 * Player-side line? (You vs Opponent chrome).
 * @param {import('./sim-events.js').SimEvent} ev
 */
export function isPlayerLine(ev) {
  const key = ev.placementKey ? String(ev.placementKey) : '';
  if (key.startsWith('opp:')) {
    if (ev.type === 'damage' && ev.target === 'player') return false;
    if (ev.type === 'debuff' && ev.target === 'player') return false;
    return false;
  }
  if (ev.actor === 'dummy') return false;
  if (ev.actor === 'player') return true;
  if (
    ev.target === 'dummy' &&
    (ev.type === 'buff' || ev.type === 'heal' || ev.type === 'stat')
  ) {
    return false;
  }
  if (ev.target === 'player' && (ev.type === 'damage' || ev.type === 'debuff')) {
    return false;
  }
  return true;
}

/**
 * @param {import('./sim-events.js').SimEvent} ev
 * @param {{
 *   itemsById?: Map<string, object> | null,
 *   assetRoot?: string,
 *   playerWon?: boolean | null,
 *   useCombatClock?: boolean,
 * }} [ctx]
 * @returns {{ html: string, plain: string } | null}
 */
export function formatLogLine(ev, ctx = {}) {
  if (isLogNoise(ev)) return null;

  const itemsById = ctx.itemsById || null;
  const assetRoot = ctx.assetRoot || '../';
  const origin = originName(ev, itemsById);
  const sys =
    typeof ev.meta?.systemOrigin === 'string' ? ev.meta.systemOrigin.trim() : '';
  const depth = Math.max(0, Number(ev.meta?.depth) || 0);
  const tStr = ctx.useCombatClock
    ? formatCombatLogTime(ev.t, 2)
    : Number(ev.t).toFixed(2);
  const prefix =
    depth > 0 ? `${'  '.repeat(depth)} &gt; ` : `${tStr}:  `;
  const plainPrefix =
    depth > 0 ? `${'  '.repeat(depth)} > ` : `${tStr}:  `;

  /** @param {string} bodyHtml @param {string} bodyPlain */
  const pack = (bodyHtml, bodyPlain) => ({
    html: `${prefix}${bodyHtml}`,
    plain: `${plainPrefix}${bodyPlain}`,
  });

  switch (ev.type) {
    case 'damage': {
      const amt = Number(ev.amount);
      const dmg = Number.isFinite(amt) ? String(Math.round(amt)) : '?';
      if (ev.meta?.critical) {
        const colored = `<strong class="sim-clog__crit">${escapeHtml(dmg)}</strong>`;
        return pack(
          `Dealt ${colored} critical damage (${escapeHtml(origin)}).`,
          `Dealt ${dmg} critical damage (${origin}).`,
        );
      }
      return pack(
        `Dealt ${escapeHtml(dmg)} damage (${escapeHtml(origin)}).`,
        `Dealt ${dmg} damage (${origin}).`,
      );
    }
    case 'miss':
      return pack(
        `Missed an attack (${escapeHtml(origin)}).`,
        `Missed an attack (${origin}).`,
      );
    case 'heal': {
      const amt = Number(ev.amount);
      const n = Number.isFinite(amt) ? String(Math.round(amt)) : '?';
      const isMaxHp =
        ev.meta?.kind === 'maxHp' ||
        ev.meta?.handler === 'piggybank' ||
        ev.meta?.maxHp === true ||
        /maximum health/i.test(String(ev.label || ''));
      if (isMaxHp) {
        return pack(
          `Gained ${escapeHtml(n)} maximum health (${escapeHtml(origin)}).`,
          `Gained ${n} maximum health (${origin}).`,
        );
      }
      // Game: EventType.Vampirism / Regeneration origins render as icons, not names.
      const originIconStack =
        (sys === 'Vampirism' || /vampirism/i.test(String(ev.label || '')) ||
          ev.meta?.stack === 'vampirism') &&
        'vampirism';
      const regenIcon =
        (sys === 'Regeneration' || ev.meta?.stack === 'regeneration') &&
        origin === 'Regeneration' &&
        'regeneration';
      const iconStack = originIconStack || regenIcon || null;
      if (iconStack) {
        const icon = stackIconHtml(assetRoot, iconStack);
        return pack(
          `Regenerated ${escapeHtml(n)} health (${icon}).`,
          `Regenerated ${n} health (${origin}).`,
        );
      }
      return pack(
        `Regenerated ${escapeHtml(n)} health (${escapeHtml(origin)}).`,
        `Regenerated ${n} health (${origin}).`,
      );
    }
    case 'stamina': {
      const amt = Number(ev.amount);
      const n = Number.isFinite(amt) ? String(Math.abs(Math.round(amt * 10) / 10)) : '?';
      if (ev.meta?.starved) {
        return pack(
          `${escapeHtml(origin)}: out of stamina.`,
          `${origin}: out of stamina.`,
        );
      }
      // Game LOG_Stamina = "Regenerated …"; useStamina → Used (meta.kind === 'used').
      const used =
        ev.meta?.kind === 'used' ||
        amt < 0 ||
        (/−|-/.test(String(ev.label || '')) && !/regenerat|\+/i.test(String(ev.label || '')));
      if (used) {
        return pack(
          `Used ${escapeHtml(n)} stamina (${escapeHtml(origin)}).`,
          `Used ${n} stamina (${origin}).`,
        );
      }
      return pack(
        `Regenerated ${escapeHtml(n)} stamina (${escapeHtml(origin)}).`,
        `Regenerated ${n} stamina (${origin}).`,
      );
    }
    case 'buff':
    case 'debuff': {
      const amt = Number(ev.amount);
      const n = Number.isFinite(amt) ? String(Math.round(Math.abs(amt))) : '1';
      const stack = stackKeyOf(ev);
      const label = String(ev.label || '');
      // Weapon damage grows (Torch / axe / …). Game LOG_DamageBuff — never invent Block.
      if (!stack && ev.type === 'buff' && /\bdamage\b/i.test(label)) {
        const verb = amt < 0 ? 'lost' : 'gained';
        const signed = amt < 0 ? `-${n}` : `+${n}`;
        return pack(
          `${escapeHtml(origin)} ${verb} ${escapeHtml(signed)} damage (${escapeHtml(origin)}).`,
          `${origin} ${verb} ${signed} damage (${origin}).`,
        );
      }
      if (!stack && ev.type === 'buff') {
        const raw = label.trim();
        if (!raw) return null;
        return pack(escapeHtml(raw), raw);
      }
      const resolved = stack || (ev.type === 'debuff' ? 'poison' : 'block');
      const icon = stackIconHtml(assetRoot, resolved);
      // Game log: buffs "Gained", debuffs applied "Inflicted", removals "Lost",
      // intentional spends LOG_USE_BUFF "Used" (CombatEvent used=true).
      let verb = 'Gained';
      if (ev.type === 'debuff') {
        verb = amt < 0 ? 'Lost' : 'Inflicted';
      } else if (amt < 0) {
        verb = ev.meta?.used ? 'Used' : 'Lost';
      }
      return pack(
        `${verb} ${escapeHtml(n)} ${icon} (${escapeHtml(origin)}).`,
        `${verb} ${n} ${resolved} (${origin}).`,
      );
    }
    case 'activate':
      return pack(
        `${escapeHtml(origin)} activated.`,
        `${origin} activated.`,
      );
    case 'stat': {
      const stat = String(ev.meta?.stat || 'heal_efficiency');
      const amt = Number(ev.amount);
      const n = Number.isFinite(amt) ? amt : 0;
      const abs = Math.abs(n);
      const neg = n < 0;
      const suf = typeof ev.meta?.suffix === 'string' ? ev.meta.suffix : '%';
      const noun = ACTOR_STAT_META[stat]?.logNoun || 'Stat';
      const verb = neg ? 'reduced' : 'increased';
      const src = actorStatIconUrl(assetRoot, stat, neg);
      const icon = `<img class="sim-clog__icon sim-clog__icon--stat" src="${src}" alt="" width="18" height="18" draggable="false" />`;
      return pack(
        `${noun} ${verb} by ${icon} ${escapeHtml(String(abs))}${escapeHtml(suf)} (${escapeHtml(origin)}).`,
        `${noun} ${verb} by ${abs}${suf} (${origin}).`,
      );
    }
    case 'fight_end': {
      let text = String(ev.label || '').trim();
      if (!text || /^fight/i.test(text) || /^time/i.test(text)) {
        if (ctx.playerWon === true) text = 'Round won.';
        else if (ctx.playerWon === false) text = 'Round lost.';
        else text = 'Round ended.';
      }
      return pack(escapeHtml(text), text);
    }
    case 'info': {
      const label = String(ev.label || '').trim();
      if (!label) return null;
      return pack(escapeHtml(label), label);
    }
    default: {
      const label = String(ev.label || '').trim();
      if (!label) return null;
      return pack(escapeHtml(label), label);
    }
  }
}

/**
 * Keep parent → child chains contiguous (damage → heal → unhealing).
 * @param {import('./sim-events.js').SimEvent[]} sorted
 */
function nestLogEventChains(sorted) {
  /** @type {Map<number | string, import('./sim-events.js').SimEvent[]>} */
  const byParent = new Map();
  /** @type {import('./sim-events.js').SimEvent[]} */
  const roots = [];
  for (const ev of sorted) {
    const pid = ev.meta?.parentId;
    if (pid != null) {
      const list = byParent.get(pid) || [];
      list.push(ev);
      byParent.set(pid, list);
    } else {
      roots.push(ev);
    }
  }
  /** @type {import('./sim-events.js').SimEvent[]} */
  const out = [];
  /** @param {import('./sim-events.js').SimEvent} ev */
  function walk(ev) {
    out.push(ev);
    const id = ev.meta?.eventId;
    if (id == null) return;
    const kids = byParent.get(id);
    if (!kids?.length) return;
    for (const ch of kids) walk(ch);
  }
  for (const r of roots) walk(r);
  return out.length === sorted.length ? out : sorted;
}

/**
 * Enrich events with stable index + side + activation flags for the log UI.
 * @param {import('./sim-events.js').SimEvent[]} events
 * @param {{
 *   dummyEndHp?: number,
 *   playerEndHp?: number,
 *   itemsById?: Map<string, object> | null,
 *   assetRoot?: string,
 *   useCombatClock?: boolean,
 * }} [ctx]
 */
export function prepareLogEvents(events, ctx = {}) {
  const playerWon =
    typeof ctx.dummyEndHp === 'number' ? ctx.dummyEndHp <= 0 : null;

  const sorted = nestLogEventChains([...(events || [])].sort(compareSimEvents));

  /** Resolve parent/child depth (Band R) from meta.parentId → event index */
  /** @type {Map<string | number, number>} */
  const idToIndex = new Map();
  for (let i = 0; i < sorted.length; i++) {
    // Only real eventIds — falling back to array index collides with numeric ids
    // (e.g. Unhealing at index 2 overwrote heal eventId 2 → flat depth).
    const id = sorted[i].meta?.eventId ?? sorted[i].meta?.id;
    if (id != null) idToIndex.set(/** @type {any} */ (id), i);
  }
  /** @type {number[]} */
  const depths = sorted.map((ev) =>
    typeof ev.meta?.depth === 'number' ? Number(ev.meta.depth) : 0,
  );
  for (let i = 0; i < sorted.length; i++) {
    const parent = sorted[i].meta?.parentId;
    if (parent == null || depths[i] > 0) continue;
    const pIdx = idToIndex.get(/** @type {any} */ (parent));
    depths[i] = typeof pIdx === 'number' ? (depths[pIdx] || 0) + 1 : 1;
  }

  /** @type {{
   *   ev: import('./sim-events.js').SimEvent,
   *   index: number,
   *   player: boolean,
   *   activation: boolean,
   *   html: string,
   *   plain: string,
   * }[]} */
  const lines = [];
  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];
    const view =
      depths[i] > 0
        ? { ...ev, meta: { ...(ev.meta || {}), depth: depths[i] } }
        : ev;
    const formatted = formatLogLine(view, {
      playerWon,
      itemsById: ctx.itemsById,
      assetRoot: ctx.assetRoot,
      useCombatClock: ctx.useCombatClock,
    });
    if (!formatted) continue;
    lines.push({
      ev: view,
      index: i,
      player: isPlayerLine(view),
      activation: isActivationLine(view),
      html: formatted.html,
      plain: formatted.plain,
    });
  }
  return { lines, playerWon };
}

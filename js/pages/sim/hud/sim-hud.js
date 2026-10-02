/**
 * In-game combat HUD — game Core/Character.tscn `CombatUI` (sheet, name banner,
 * Health / Stamina bars, buff + debuff StackCounters, CharacterStatsDisplay).
 *
 * Every rect comes from sim-hud-geo.js in game px and is drawn inside a stage
 * scaled by --hud-k, so the whole panel is 1:1 with the game at any size.
 */

import {
  ACTOR_HUD_STATS,
  actorStatIconUrl,
  actorStatTooltip,
  formatHudStatValue,
} from '../engine/actor-stats.js';
import {
  BANNER,
  BODY_DX,
  BUFF_KEYS,
  COUNTERS,
  DEBUFF_KEYS,
  NAME,
  ROWS,
  SHEET,
  STAGE,
  STATS,
  SWORD,
  counterScale,
} from './sim-hud-geo.js';

const STACK_LABEL = {
  block: 'Block',
  lucky: 'Lucky',
  regeneration: 'Regeneration',
  vampirism: 'Vampirism',
  spikes: 'Spikes',
  mana: 'Mana',
  empower: 'Empower',
  heat: 'Heat',
  protection: 'Protection',
  poison: 'Poison',
  blind: 'Blind',
  cold: 'Cold',
  weak: 'Weak',
};

/** Game `Game.classNameBanners` — Interface/Combat/NameBanner_{Class}.png */
const NAME_BANNER_BY_CLASS = {
  adventurer: 'NameBanner_Adventurer.png',
  berserker: 'NameBanner_Berserker.png',
  engineer: 'NameBanner_Engineer.png',
  mage: 'NameBanner_Mage.png',
  pyromancer: 'NameBanner_Pyromancer.png',
  ranger: 'NameBanner_Ranger.png',
  reaper: 'NameBanner_Reaper.png',
};

function escapeTitle(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}

/** Game Util.stepify(n, 0.1) — nearest tenth, clean of float junk. */
function stepifyTenth(n) {
  return Math.round((Number(n) || 0) * 10) / 10;
}

/** Game Util.floorStepify(n, 0.1) — Staminabar current stamina. */
function floorStepifyTenth(n) {
  return stepifyTenth((Number(n) || 0) - 0.05 + 1e-5);
}

/** Staminabar.gd label: floorStepify(cur, 0.1) / stepify(max, 0.1). */
function formatStaminaNum(n) {
  return stepifyTenth(n).toFixed(1).replace(/\.0$/, '');
}

/**
 * @param {string} root
 * @param {string | null | undefined} heroClass
 */
function nameBannerUrl(root, heroClass) {
  const key = String(heroClass || '')
    .trim()
    .toLowerCase();
  const file = NAME_BANNER_BY_CLASS[key] || NAME_BANNER_BY_CLASS.ranger;
  return `${root}assets/icons/sim/hud/${file}`;
}

function hudArtUrl(root, file) {
  return `${root}assets/icons/sim/hud/${file}`;
}

function stackIconUrl(root, file) {
  return `${root}assets/icons/status/buff/${file}`;
}

/** @param {{ left: number, top: number, w: number, h: number }} r */
function rectStyle(r) {
  return `left:${r.left}px;top:${r.top}px;width:${r.w}px;height:${r.h}px`;
}

/** Sprites are centered on their position (game Sprite.centered) */
function spriteStyle(c) {
  const left = (c.cx - c.w / 2).toFixed(2);
  const top = (c.cy - c.h / 2).toFixed(2);
  return `left:${left}px;top:${top}px;width:${c.w}px;height:${c.h}px`;
}

/**
 * Crossed blades for the boot skeleton (real HUDs draw the Sheet/Sword).
 * @param {string} [assetRoot]
 */
export function hudClashHtml(assetRoot = '../') {
  const root = assetRoot.endsWith('/') ? assetRoot : `${assetRoot}/`;
  const src = hudArtUrl(root, 'Sword.png');
  return `
    <span class="sim-hud-vs" aria-hidden="true">
      <img class="sim-hud-vs__blade sim-hud-vs__blade--you" src="${src}" alt="" width="98" height="116" draggable="false" />
      <img class="sim-hud-vs__blade sim-hud-vs__blade--foe" src="${src}" alt="" width="98" height="116" draggable="false" />
    </span>
  `;
}

/**
 * One StackCounter: sprite scaled about its center + centered count label.
 * @param {string} root
 * @param {string} key
 */
function counterHtml(root, key) {
  const c = COUNTERS[key];
  if (!c) return '';
  const label = STACK_LABEL[key] || key;
  return `
    <span class="sim-hud__counter" data-hud-counter="${key}" title="${label}">
      <img
        class="sim-hud__counter-icon"
        style="${spriteStyle(c)}"
        src="${stackIconUrl(root, c.file)}"
        alt=""
        draggable="false"
      />
      <span class="sim-hud__counter-num" style="${rectStyle(c.label)}"></span>
    </span>
  `;
}

/**
 * @param {'player' | 'dummy'} side
 * @param {string} title
 * @param {'player' | 'opponent'} banner
 * @param {string} [assetRoot]
 * @param {string | null | undefined} [heroClass]
 */
export function actorHudHtml(
  side,
  title,
  banner = 'player',
  assetRoot = '../',
  heroClass = null,
) {
  const root = assetRoot.endsWith('/') ? assetRoot : `${assetRoot}/`;
  const key = side === 'dummy' ? 'dummy' : 'player';
  const sheet = SHEET[key];
  const bannerGeo = BANNER[key];
  const name = NAME[key];
  const sword = SWORD[key];
  const stats = STATS[key];
  const bannerClass =
    banner === 'opponent' ? 'sim-hud__banner--opponent' : 'sim-hud__banner--player';

  return `
    <section class="sim-hud" data-hud="${side}" aria-label="${title}">
      <div class="sim-hud__stage" style="width:${STAGE.w}px;height:${STAGE.h}px">
        <img class="sim-hud__sheet" style="${rectStyle(sheet)}" src="${hudArtUrl(root, sheet.file)}" alt="" draggable="false" />
        <div class="sim-hud__banner ${bannerClass}" style="${rectStyle(bannerGeo)}">
          <img
            class="sim-hud__banner-art${bannerGeo.flip ? ' is-flipped' : ''}"
            src="${nameBannerUrl(root, heroClass)}"
            alt=""
            draggable="false"
          />
        </div>
        <span class="sim-hud__name" style="${rectStyle(name)}">${title}</span>
        <img
          class="sim-hud__sword${sword.flip ? ' is-flipped' : ''}"
          style="${rectStyle(sword)}"
          src="${hudArtUrl(root, 'Sword.png')}"
          alt=""
          draggable="false"
        />
        <div class="sim-hud__body" style="left:${BODY_DX[key]}px">
          <span class="sim-hud__label" style="${rectStyle(ROWS.hpLabel)}">Health</span>
          <div class="sim-hud__bar sim-hud__bar--hp" style="${rectStyle(ROWS.hpBar)}" role="meter" aria-label="Health">
            <span class="sim-hud__trail" data-hud-hp-trail></span>
            <span class="sim-hud__fill sim-hud__fill--hp" data-hud-hp-fill></span>
          </div>
          <img class="sim-hud__bar-border" style="${rectStyle(ROWS.hpBorder)}" src="${hudArtUrl(root, 'BarBorder1.png')}" alt="" draggable="false" />
          <span class="sim-hud__bar-text" style="${rectStyle(ROWS.hpText)}" data-hud-hp>0/0</span>

          <span class="sim-hud__label" style="${rectStyle(ROWS.stamLabel)}">Stamina</span>
          <div class="sim-hud__bar sim-hud__bar--stam" style="${rectStyle(ROWS.stamBar)}" role="meter" aria-label="Stamina">
            <span class="sim-hud__fill sim-hud__fill--stam" data-hud-stam-fill></span>
          </div>
          <img class="sim-hud__bar-border is-flipped" style="${rectStyle(ROWS.stamBorder)}" src="${hudArtUrl(root, 'BarBorder1.png')}" alt="" draggable="false" />
          <span class="sim-hud__bar-text" style="${rectStyle(ROWS.stamText)}" data-hud-stam>0/0</span>

          <span class="sim-hud__label" style="${rectStyle(ROWS.buffsLabel)}">Buffs</span>
          <div class="sim-hud__stacks" data-hud-buffs role="list" aria-label="Buffs">
            ${BUFF_KEYS.map((k) => counterHtml(root, k)).join('')}
          </div>

          <span class="sim-hud__label" style="${rectStyle(ROWS.debuffsLabel)}">Debuffs</span>
          <div class="sim-hud__stacks" data-hud-debuffs role="list" aria-label="Debuffs">
            ${DEBUFF_KEYS.map((k) => counterHtml(root, k)).join('')}
          </div>
        </div>
        <div class="sim-hud__over" style="left:${BODY_DX[key]}px">
          ${counterHtml(root, 'block')}
        </div>
        <div
          class="sim-hud__stats"
          style="left:${stats.left}px;top:${stats.top}px"
          data-hud-stats
          role="list"
          aria-label="Combat stats"
        ></div>
      </div>
    </section>
  `;
}

/**
 * @param {HTMLElement} rootEl
 * @param {string} assetRoot
 * @param {{ iconEnlarge?: boolean }} [opts]
 */
export function bindActorHud(rootEl, assetRoot, opts = {}) {
  const root = assetRoot.endsWith('/') ? assetRoot : `${assetRoot}/`;
  const side = rootEl.dataset.hud === 'dummy' ? 'dummy' : 'player';
  const hpFill = rootEl.querySelector('[data-hud-hp-fill]');
  const hpTrail = rootEl.querySelector('[data-hud-hp-trail]');
  const hpText = rootEl.querySelector('[data-hud-hp]');
  const stamFill = rootEl.querySelector('[data-hud-stam-fill]');
  const stamText = rootEl.querySelector('[data-hud-stam]');
  const statsEl = rootEl.querySelector('[data-hud-stats]');
  /** Fixed sprite size when Icon enlargement is off (≈ mid-stack game size). */
  const FIXED_ICON_SCALE = 1;
  let iconEnlarge = opts.iconEnlarge !== false;
  /** @type {Map<string, { host: HTMLElement, icon: HTMLElement | null, num: HTMLElement | null, shown: number | null }>} */
  const counters = new Map();
  for (const host of rootEl.querySelectorAll('[data-hud-counter]')) {
    if (!(host instanceof HTMLElement)) continue;
    const key = host.getAttribute('data-hud-counter') || '';
    const icon = host.querySelector('.sim-hud__counter-icon');
    const num = host.querySelector('.sim-hud__counter-num');
    counters.set(key, {
      host,
      icon: icon instanceof HTMLElement ? icon : null,
      num: num instanceof HTMLElement ? num : null,
      shown: null,
    });
  }
  let trailPct = 100;
  let trailTimer = 0;
  let lastStatsHtml = null;
  let lastHpKey = '';
  let lastStamKey = '';
  /** @type {object | null} */
  let lastSnap = null;
  let lastSeekT = 0;

  /**
   * BlockHud.updateHud: hide at 0, else scale the sprite by calcScale(value)
   * (when enlargement is on) and print the raw count.
   * @param {string} key
   * @param {number} value
   * @param {string} [titleExtra]
   */
  function paintCounter(key, value, titleExtra = '') {
    const slot = counters.get(key);
    if (!slot) return;
    const n = Math.max(0, Math.round(Number(value) || 0));
    const label = STACK_LABEL[key] || key;
    const title = n > 0 ? `${label}: ${n}${titleExtra}` : label;
    if (slot.host.getAttribute('title') !== title) {
      slot.host.setAttribute('title', title);
    }
    if (slot.shown === n) return;
    slot.shown = n;
    slot.host.classList.toggle('is-on', n > 0);
    if (slot.num) {
      const digits = n > 0 ? String(n) : '';
      slot.num.textContent = digits;
      // Keep 4+ digit counts inside the fixed geo label rect
      slot.num.style.fontSize =
        digits.length >= 5 ? '18px' : digits.length >= 4 ? '22px' : '';
    }
    if (slot.icon) {
      const k =
        n > 0
          ? iconEnlarge
            ? counterScale(n, COUNTERS[key]?.threshold ?? 50)
            : FIXED_ICON_SCALE
          : 0;
      slot.icon.style.transform = `scale(${k.toFixed(4)})`;
    }
  }

  /**
   * @param {{
   *   hp: number,
   *   maxHp: number,
   *   stamina?: number,
   *   maxStamina?: number,
   *   block?: number,
   *   temp?: Record<string, { amount: number, expiresAt: number }>,
   *   combatStats?: Record<string, number>,
   * } & Record<string, number | object>} snap
   * @param {number} [seekT=0]
   */
  function apply(snap, seekT = 0) {
    lastSnap = snap;
    lastSeekT = Number(seekT) || 0;
    const hp = Math.max(0, Number(snap.hp) || 0);
    const maxHp = Math.max(1, Number(snap.maxHp) || 1);
    const stam = Math.max(0, Number(snap.stamina) || 0);
    const maxStam = Math.max(0.1, Number(snap.maxStamina) || 1);
    const pct = Math.min(100, (hp / maxHp) * 100);
    // Healthbar.gd: round(curHealth) + "/" + round(maxHealth)
    const hpKey = `${Math.round(hp)}/${Math.round(maxHp)}`;
    const stamKey = `${formatStaminaNum(floorStepifyTenth(stam))}/${formatStaminaNum(stepifyTenth(maxStam))}`;

    if (hpFill instanceof HTMLElement) hpFill.style.width = `${pct}%`;
    if (hpTrail instanceof HTMLElement) {
      if (pct < trailPct - 0.05) {
        window.clearTimeout(trailTimer);
        trailTimer = window.setTimeout(() => {
          trailPct = pct;
          if (hpTrail instanceof HTMLElement) hpTrail.style.width = `${trailPct}%`;
        }, 280);
      } else if (pct >= trailPct) {
        trailPct = pct;
        window.clearTimeout(trailTimer);
      }
      hpTrail.style.width = `${Math.max(trailPct, pct)}%`;
    }
    if (hpText && hpKey !== lastHpKey) {
      lastHpKey = hpKey;
      hpText.textContent = hpKey;
    }
    if (stamFill instanceof HTMLElement) {
      stamFill.style.width = `${Math.min(100, (stam / maxStam) * 100)}%`;
    }
    if (stamText && stamKey !== lastStamKey) {
      lastStamKey = stamKey;
      stamText.textContent = stamKey;
    }

    const t = Number(seekT) || 0;
    for (const key of counters.keys()) {
      const temp = snap.temp?.[key];
      const remaining = temp ? Number(temp.expiresAt) - t : 0;
      const extra =
        Number(temp?.amount) > 0 && remaining > 1e-6
          ? ` · ${remaining >= 10 ? Math.round(remaining) : remaining.toFixed(1).replace(/\.0$/, '')}s left`
          : '';
      paintCounter(key, Number(snap[key]) || 0, extra);
    }

    if (statsEl instanceof HTMLElement) {
      const values =
        snap.combatStats || {
          unhealing: Math.round((Number(snap.unhealing) || 0) * 1000) / 10,
          heal_efficiency: Math.round((Number(snap.healAmp) || 0) * 1000) / 10,
        };
      const statsHtml = statsRackHtml(root, side, values);
      if (statsHtml !== lastStatsHtml) {
        lastStatsHtml = statsHtml;
        statsEl.innerHTML = statsHtml;
      }
    }
  }

  /** Flash panel on hit */
  function hitFlash() {
    rootEl.classList.remove('sim-hud--hit');
    void rootEl.offsetWidth;
    rootEl.classList.add('sim-hud--hit');
  }

  /**
   * @param {boolean} on
   */
  function setIconEnlarge(on) {
    iconEnlarge = Boolean(on);
    for (const slot of counters.values()) slot.shown = null;
    if (lastSnap) apply(lastSnap, lastSeekT);
  }

  return {
    apply,
    hitFlash,
    setIconEnlarge,
    el: rootEl,
    destroy() {
      window.clearTimeout(trailTimer);
    },
  };
}

/**
 * CharacterStatsDisplay: only changed stats get an icon, packed down the 60px
 * grid; the player's columns grow left, the opponent's right.
 * @param {string} root
 * @param {'player' | 'dummy'} side
 * @param {Record<string, number>} values
 */
function statsRackHtml(root, side, values) {
  const grid = STATS[side];
  const parts = [];
  let i = 0;
  for (const def of ACTOR_HUD_STATS) {
    const raw = Number(values[def.key]) || 0;
    if (Math.abs(raw) < (def.stacks ? 0.5 : 0.05)) continue;
    const col = Math.floor(i / STATS.perColumn) * grid.dir;
    const row = i % STATS.perColumn;
    const cx = col * STATS.step;
    const cy = row * STATS.step;
    i += 1;
    const title = escapeTitle(actorStatTooltip(def, raw));
    const src = actorStatIconUrl(root, def.key, raw < 0);
    const iconStyle = `left:${cx - STATS.icon / 2}px;top:${cy - STATS.icon / 2}px;width:${STATS.icon}px;height:${STATS.icon}px`;
    const numStyle = `left:${cx + STATS.label.dx}px;top:${cy + STATS.label.dy}px;width:${STATS.label.w}px;height:${STATS.label.h}px`;
    parts.push(`
      <span class="sim-hud__stat" role="listitem" title="${title}" aria-label="${title}">
        <img class="sim-hud__stat-icon" style="${iconStyle}" src="${src}" alt="" draggable="false" />
        <span class="sim-hud__stat-val" style="${numStyle}">${formatHudStatValue(raw, def)}${def.suffix || ''}</span>
      </span>
    `);
  }
  return parts.join('');
}

/**
 * Pick nearest snapshot at or before t.
 * @param {import('../../sim-events.js').SimSnapshot[] | undefined} snapshots
 * @param {number} t
 * @param {'player' | 'dummy'} side
 */
export function snapAt(snapshots, t, side) {
  if (!Array.isArray(snapshots) || !snapshots.length) return null;
  const at = Number(t);
  const useT = Number.isFinite(at) ? at : 0;
  let best = null;
  let bestT = -Infinity;
  for (const s of snapshots) {
    const st = Number(s.t) || 0;
    if (st > useT + 1e-6) continue;
    if (st > bestT + 1e-9 || Math.abs(st - bestT) <= 1e-9) {
      best = s;
      bestT = st;
    }
  }
  if (!best) best = snapshots[0];
  return side === 'player' ? best.player : best.dummy;
}

/**
 * In-game combat HUD (Health / Stamina / Buffs / Debuffs) for sim actors.
 * Layout mirrors Build Viewer / combat character panels.
 */

import {
  ACTOR_HUD_STATS,
  actorStatIconUrl,
  actorStatTooltip,
  formatHudStatValue,
} from './engine/actor-stats.js';

/** Game CombatUI buff sheet: 3 on top, 4 on bottom */
const BUFF_TOP = ['regeneration', 'lucky', 'spikes'];
const BUFF_BOT = ['vampirism', 'mana', 'heat', 'empower'];

/** Debuffs: 3 on top; bottom keeps 4 empty slots for matching sheet height */
const DEBUFF_TOP = ['poison', 'blind', 'cold'];
const DEBUFF_BOT = [];

function escapeTitle(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}

/** Game Util.stepify(n, 0.1) — nearest tenth, clean of float junk. */
function stepifyTenth(n) {
  return Math.round((Number(n) || 0) * 10) / 10;
}

/**
 * Game Util.floorStepify(n, 0.1) — Staminabar current stamina.
 * @param {number} n
 */
function floorStepifyTenth(n) {
  return stepifyTenth((Number(n) || 0) - 0.05 + 1e-5);
}

/**
 * Staminabar.gd label: floorStepify(cur, 0.1) / stepify(max, 0.1).
 * @param {number} n
 */
function formatStaminaNum(n) {
  const s = stepifyTenth(n).toFixed(1);
  return s.replace(/\.0$/, '');
}

const STACK_LABEL = {
  block: 'Block',
  lucky: 'Lucky',
  regeneration: 'Regeneration',
  vampirism: 'Vampirism',
  spikes: 'Spikes',
  mana: 'Mana',
  empower: 'Empower',
  heat: 'Heat',
  poison: 'Poison',
  blind: 'Blind',
  cold: 'Cold',
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

/**
 * @param {string} root
 * @param {string} key stack key e.g. regeneration
 */
function stackIconUrl(root, key) {
  const file =
    {
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
    }[key] || 'Block.png';
  return `${root}assets/icons/status/buff/${file}`;
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
  const bannerClass =
    banner === 'opponent' ? 'sim-hud__banner--opponent' : 'sim-hud__banner--player';
  const bannerSrc = nameBannerUrl(root, heroClass);
  return `
    <section class="sim-hud" data-hud="${side}" aria-label="${title}">
      <header class="sim-hud__banner ${bannerClass}">
        <img class="sim-hud__banner-art" src="${bannerSrc}" alt="" width="505" height="125" draggable="false" />
        <span class="sim-hud__name">${title}</span>
      </header>
      <div class="sim-hud__row sim-hud__row--hp">
        <span class="sim-hud__label">Health</span>
        <div class="sim-hud__bar sim-hud__bar--hp" role="meter" aria-label="Health">
          <span class="sim-hud__trail sim-hud__trail--hp" data-hud-hp-trail></span>
          <span class="sim-hud__fill sim-hud__fill--hp" data-hud-hp-fill></span>
          <span class="sim-hud__bar-text" data-hud-hp>0/0</span>
        </div>
        <span class="sim-hud__block" data-hud-block hidden></span>
      </div>
      <div class="sim-hud__row">
        <span class="sim-hud__label">Stamina</span>
        <div class="sim-hud__bar sim-hud__bar--stam" role="meter" aria-label="Stamina">
          <span class="sim-hud__fill sim-hud__fill--stam" data-hud-stam-fill></span>
          <span class="sim-hud__bar-text" data-hud-stam>0/0</span>
        </div>
      </div>
      <div class="sim-hud__section">
        <span class="sim-hud__section-label">Buffs</span>
        <div class="sim-hud__stacks sim-hud__stacks--buff" data-hud-buffs role="list" aria-label="Buffs"></div>
      </div>
      <div class="sim-hud__section">
        <span class="sim-hud__section-label">Debuffs</span>
        <div class="sim-hud__stacks sim-hud__stacks--debuff" data-hud-debuffs role="list" aria-label="Debuffs"></div>
      </div>
      <div class="sim-hud__floats" data-hud-floats aria-hidden="true"></div>
      <div class="sim-hud__stats" data-hud-stats role="list" aria-label="Combat stats"></div>
    </section>
  `;
}

/**
 * @param {HTMLElement} rootEl
 * @param {string} assetRoot
 */
export function bindActorHud(rootEl, assetRoot) {
  const root = assetRoot.endsWith('/') ? assetRoot : `${assetRoot}/`;
  const hpFill = rootEl.querySelector('[data-hud-hp-fill]');
  const hpTrail = rootEl.querySelector('[data-hud-hp-trail]');
  const hpText = rootEl.querySelector('[data-hud-hp]');
  const blockEl = rootEl.querySelector('[data-hud-block]');
  const stamFill = rootEl.querySelector('[data-hud-stam-fill]');
  const stamText = rootEl.querySelector('[data-hud-stam]');
  const buffsEl = rootEl.querySelector('[data-hud-buffs]');
  const debuffsEl = rootEl.querySelector('[data-hud-debuffs]');
  const floatsEl = rootEl.querySelector('[data-hud-floats]');
  const statsEl = rootEl.querySelector('[data-hud-stats]');
  let trailPct = 100;
  let trailTimer = 0;
  let lastBuffHtml = null;
  let lastDebuffHtml = null;
  let lastBlockHtml = null;
  let lastStatsHtml = null;
  let lastHpKey = '';
  let lastStamKey = '';

  /**
   * @param {string} key
   * @param {Record<string, number>} stacks
   * @param {Record<string, { amount: number, expiresAt: number }> | undefined} tempMap
   * @param {number} seekT
   * @param {{ always?: boolean }} [opts]
   */
  function stackCell(key, stacks, tempMap, seekT, opts = {}) {
    const n = Math.max(0, Math.round(Number(stacks[key]) || 0));
    if (n <= 0 && !opts.always) return '';
    const label = STACK_LABEL[key] || key;
    const temp = tempMap?.[key];
    const tempAmt = temp ? Math.max(0, Math.round(Number(temp.amount) || 0)) : 0;
    const expiresAt = temp ? Number(temp.expiresAt) : NaN;
    const remaining =
      tempAmt > 0 && Number.isFinite(expiresAt) ? expiresAt - seekT : 0;
    const isTemp = remaining > 1e-6;
    const timeStr = isTemp
      ? remaining >= 10
        ? `${Math.round(remaining)}s`
        : `${remaining.toFixed(1).replace(/\.0$/, '')}s`
      : '';
    const title =
      n > 0
        ? isTemp
          ? `${label}: ${n} · ${timeStr} left`
          : `${label}: ${n}`
        : label;
    const emptyClass = n <= 0 ? ' is-empty' : '';
    const tempClass = isTemp ? ' sim-hud__stack--temp' : '';
    const timeHtml = isTemp
      ? `<span class="sim-hud__stack-time">${timeStr}</span>`
      : '';
    const countHtml =
      n > 0 ? `<span class="sim-hud__stack-count">${n}</span>` : '';
    return `
      <span class="sim-hud__stack${emptyClass}${tempClass}" role="listitem" title="${title}">
        <img class="sim-hud__stack-icon" src="${stackIconUrl(root, key)}" alt="" width="28" height="28" draggable="false" />
        ${countHtml}
        ${timeHtml}
      </span>
    `;
  }

  /**
   * Fixed sheet slots: top row 3, bottom row 4 (game CombatUI).
   * @param {string[]} top
   * @param {string[]} bot
   * @param {Record<string, number>} stacks
   * @param {Record<string, { amount: number, expiresAt: number }> | undefined} tempMap
   * @param {number} seekT
   */
  function stacksGridHtml(top, bot, stacks, tempMap, seekT) {
    const topCells = top
      .map((key) => stackCell(key, stacks, tempMap, seekT, { always: true }))
      .join('');
    const botKeys = [...bot];
    while (botKeys.length < 4) botKeys.push('');
    const botCells = botKeys
      .slice(0, 4)
      .map((key) =>
        key
          ? stackCell(key, stacks, tempMap, seekT, { always: true })
          : `<span class="sim-hud__stack is-empty" aria-hidden="true"></span>`,
      )
      .join('');
    return `
      <div class="sim-hud__stacks-row sim-hud__stacks-row--top">${topCells}</div>
      <div class="sim-hud__stacks-row sim-hud__stacks-row--bot">${botCells}</div>
    `;
  }

  /**
   * @param {HTMLElement | null} host
   * @param {string} html
   * @param {'buff' | 'debuff'} which
   */
  function paintStacks(host, html, which) {
    if (!(host instanceof HTMLElement)) return;
    if (which === 'buff') {
      if (html === lastBuffHtml) return;
      lastBuffHtml = html;
    } else {
      if (html === lastDebuffHtml) return;
      lastDebuffHtml = html;
    }
    host.innerHTML = html;
  }

  /**
   * @param {{
   *   hp: number,
   *   maxHp: number,
   *   stamina?: number,
   *   maxStamina?: number,
   *   block?: number,
   *   regeneration?: number,
   *   poison?: number,
   *   heat?: number,
   *   cold?: number,
   *   blind?: number,
   *   spikes?: number,
   *   vampirism?: number,
   *   empower?: number,
   *   lucky?: number,
   *   mana?: number,
   *   healAmp?: number,
   *   temp?: Record<string, { amount: number, expiresAt: number }>,
   * }} snap
   * @param {number} [seekT=0]
   */
  function apply(snap, seekT = 0) {
    const hp = Math.max(0, Number(snap.hp) || 0);
    const maxHp = Math.max(1, Number(snap.maxHp) || 1);
    const stam = Math.max(0, Number(snap.stamina) || 0);
    const maxStam = Math.max(0.1, Number(snap.maxStamina) || 1);
    const pct = Math.min(100, (hp / maxHp) * 100);
    const hpKey = `${Math.round(hp)}/${Math.round(maxHp)}`;
    // Staminabar.gd: floorStepify(cur, 0.1) / stepify(max, 0.1)
    const stamKey = `${formatStaminaNum(floorStepifyTenth(stam))}/${formatStaminaNum(stepifyTenth(maxStam))}`;
    if (hpFill instanceof HTMLElement) {
      hpFill.style.width = `${pct}%`;
    }
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

    const buffStacks = {
      block: Number(snap.block) || 0,
      lucky: Number(snap.lucky) || 0,
      regeneration: Number(snap.regeneration) || 0,
      vampirism: Number(snap.vampirism) || 0,
      spikes: Number(snap.spikes) || 0,
      mana: Number(snap.mana) || 0,
      empower: Number(snap.empower) || 0,
      heat: Number(snap.heat) || 0,
    };
    const debuffStacks = {
      poison: Number(snap.poison) || 0,
      blind: Number(snap.blind) || 0,
      cold: Number(snap.cold) || 0,
    };
    const tempMap = snap.temp;
    const t = Number(seekT) || 0;

    if (blockEl instanceof HTMLElement) {
      const blockHtml = stackCell('block', buffStacks, tempMap, t);
      if (blockHtml !== lastBlockHtml) {
        lastBlockHtml = blockHtml;
        if (blockHtml) {
          blockEl.hidden = false;
          blockEl.innerHTML = blockHtml;
        } else {
          blockEl.hidden = true;
          blockEl.replaceChildren();
        }
      }
    }

    paintStacks(
      buffsEl instanceof HTMLElement ? buffsEl : null,
      stacksGridHtml(BUFF_TOP, BUFF_BOT, buffStacks, tempMap, t),
      'buff',
    );
    paintStacks(
      debuffsEl instanceof HTMLElement ? debuffsEl : null,
      stacksGridHtml(DEBUFF_TOP, DEBUFF_BOT, debuffStacks, tempMap, t),
      'debuff',
    );

    if (statsEl instanceof HTMLElement) {
      const values = snap.combatStats || {
        unhealing: Math.round((Number(snap.unhealing) || 0) * 1000) / 10,
        heal_efficiency: Math.round((Number(snap.healAmp) || 0) * 1000) / 10,
      };
      const parts = [];
      for (const def of ACTOR_HUD_STATS) {
        const raw = Number(values[def.key]) || 0;
        const min = def.stacks ? 0.5 : 0.05;
        if (Math.abs(raw) < min) continue;
        const neg = raw < 0;
        const shown = formatHudStatValue(raw, def);
        const suffix = def.suffix || '';
        const title = escapeTitle(actorStatTooltip(def, raw));
        const src = actorStatIconUrl(root, def.key, neg);
        parts.push(`
          <span class="sim-hud__stat" role="listitem" title="${title}" aria-label="${title}">
            <img class="sim-hud__stat-icon" src="${src}" alt="" width="40" height="40" draggable="false" />
            <span class="sim-hud__stat-val">${shown}${suffix}</span>
          </span>
        `);
      }
      const statsHtml = parts.join('');
      if (statsHtml !== lastStatsHtml) {
        lastStatsHtml = statsHtml;
        statsEl.innerHTML = statsHtml;
      }
    }
  }

  /**
   * @param {number} amount
   * @param {'damage' | 'miss' | 'heal' | 'buff' | 'debuff'} kind
   */
  function floatNum(amount, kind) {
    if (!(floatsEl instanceof HTMLElement)) return;
    const span = document.createElement('span');
    span.className = `sim-fx-float sim-fx-float--${kind}`;
    if (kind === 'miss') span.textContent = 'Miss';
    else if (kind === 'heal') span.textContent = `+${amount}`;
    else if (kind === 'buff' || kind === 'debuff') {
      span.textContent = `${amount > 0 ? '+' : ''}${amount}`;
    } else span.textContent = `-${amount}`;
    floatsEl.appendChild(span);
    window.setTimeout(() => span.remove(), 900);
  }

  /** Flash panel on hit */
  function hitFlash() {
    rootEl.classList.remove('sim-hud--hit');
    void rootEl.offsetWidth;
    rootEl.classList.add('sim-hud--hit');
  }

  return {
    apply,
    floatNum,
    hitFlash,
    el: rootEl,
    destroy() {
      window.clearTimeout(trailTimer);
      floatsEl?.replaceChildren();
    },
  };
}

/**
 * Pick nearest snapshot at or before t.
 * @param {import('./sim-events.js').SimSnapshot[] | undefined} snapshots
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

/**
 * Board activation VFX + HUD sync from snapshots / events.
 */

import { snapAt } from './sim-hud.js';
import { COMBAT_DELAY } from './sim-combat-time.js';
import { createChargeFx } from './sim-charge-fx.js';
import { createSimItemChrome } from './sim-item-chrome.js';

/**
 * @param {{
 *   boardEl: HTMLElement,
 *   playerHud: ReturnType<import('./sim-hud.js').bindActorHud>,
 *   dummyHud: ReturnType<import('./sim-hud.js').bindActorHud>,
 *   run: import('./sim-events.js').SimRun,
 *   assetRoot?: string,
 * }} opts
 */
export function createSimFx(opts) {
  const playerMax = opts.run.playerMaxHp ?? 200;
  const dummyMax = opts.run.dummyMaxHp ?? 1200;

  /** @param {string | undefined} placementKey */
  function pulseItem(placementKey) {
    if (!placementKey || !opts.boardEl) return;
    const el = opts.boardEl.querySelector(
      `[data-placement-key="${CSS.escape(placementKey)}"]`,
    );
    if (!(el instanceof HTMLElement)) return;
    el.classList.remove('sim-fx-pulse');
    void el.offsetWidth;
    el.classList.add('sim-fx-pulse');
    spawnRing(el);
  }

  /** @param {HTMLElement} el */
  function spawnRing(el) {
    const ring = document.createElement('span');
    ring.className = 'sim-fx-ring';
    ring.setAttribute('aria-hidden', 'true');
    el.appendChild(ring);
    window.setTimeout(() => ring.remove(), 520);
  }

  const chargeFx = createChargeFx({
    boardEl: opts.boardEl,
    assetRoot: opts.assetRoot,
    onPulse: (key) => pulseItem(key),
  });
  chargeFx.loadRun(opts.run);
  const itemChrome = createSimItemChrome({
    boardEl: opts.boardEl,
    run: opts.run,
    assetRoot: opts.assetRoot,
  });

  /**
   * @param {number} t
   */
  function seek(t) {
    const snaps = opts.run.snapshots;
    let p = snapAt(snaps, t, 'player');
    let d = snapAt(snaps, t, 'dummy');
    if (!p) {
      p = {
        hp: playerMax,
        maxHp: playerMax,
        stamina: 5,
        maxStamina: 5,
        block: 0,
        regeneration: 0,
        poison: 0,
        heat: 0,
        cold: 0,
        blind: 0,
        spikes: 0,
        vampirism: 0,
        empower: 0,
        lucky: 0,
        mana: 0,
        dead: false,
        healAmp: 0,
        unhealing: 0,
      };
    }
    if (!d) {
      d = {
        hp: dummyMax,
        maxHp: dummyMax,
        stamina: 5,
        maxStamina: 5,
        block: 0,
        regeneration: 0,
        poison: 0,
        heat: 0,
        cold: 0,
        blind: 0,
        spikes: 0,
        vampirism: 0,
        empower: 0,
        lucky: 0,
        mana: 0,
        dead: false,
        healAmp: 0,
        unhealing: 0,
      };
    }
    if (!snaps?.length) {
      let dHp = dummyMax;
      let pHp = playerMax;
      let pAmp = 0;
      let dAmp = 0;
      let pUnh = 0;
      let dUnh = 0;
      for (const ev of opts.run.events || []) {
        if (ev.t > t + 1e-6) break;
        if (ev.type === 'damage' && ev.target === 'dummy') {
          dHp =
            typeof ev.meta?.dummyHp === 'number'
              ? Number(ev.meta.dummyHp)
              : Math.max(0, dHp - (Number(ev.amount) || 0));
        }
        if (ev.type === 'damage' && ev.target === 'player') {
          pHp =
            typeof ev.meta?.playerHp === 'number'
              ? Number(ev.meta.playerHp)
              : Math.max(0, pHp - (Number(ev.amount) || 0));
        }
        if (ev.type === 'heal' && ev.target === 'player') {
          pHp =
            typeof ev.meta?.playerHp === 'number'
              ? Number(ev.meta.playerHp)
              : Math.min(playerMax, pHp + (Number(ev.amount) || 0));
        }
        if (ev.type === 'stat' && ev.meta?.stat === 'heal_efficiency') {
          const tot = Number(ev.meta.total);
          if (Number.isFinite(tot)) {
            if (ev.actor === 'dummy') dAmp = tot / 100;
            else pAmp = tot / 100;
          }
        }
        if (ev.type === 'stat' && ev.meta?.stat === 'unhealing') {
          const tot = Number(ev.meta.total);
          if (Number.isFinite(tot)) {
            if (ev.actor === 'dummy') dUnh = tot / 100;
            else pUnh = tot / 100;
          }
        }
      }
      p = { ...p, hp: pHp, maxHp: playerMax, healAmp: pAmp, unhealing: pUnh };
      d = { ...d, hp: dHp, maxHp: dummyMax, healAmp: dAmp, unhealing: dUnh };
    }
    opts.playerHud.apply(p, t);
    opts.dummyHud.apply(d, t);
    chargeFx.setTime(t);
    itemChrome.seek(t);
  }

  /**
   * Visual-only flash during playback (bars via seek).
   * @param {import('./sim-events.js').SimEvent} ev
   */
  function flashEvent(ev) {
    const atStart =
      opts.run.mode !== 'demo' &&
      Math.abs(Number(ev.t) - COMBAT_DELAY) < 0.04;
    if (atStart && (ev.type === 'buff' || ev.type === 'debuff' || ev.type === 'heal' || ev.type === 'stat')) {
      return;
    }
    if (ev.type === 'charge' || (ev.type === 'activate' && ev.meta?.chargePath)) {
      chargeFx.flashEvent(ev);
    }
    if (ev.meta?.phase === 'tesla_advance' && typeof ev.meta.targetKey === 'string') {
      pulseItem(ev.meta.targetKey);
      pulseItem(ev.placementKey);
      return;
    }
    if (
      ev.meta?.phase === 'charge_received' ||
      (ev.type === 'activate' && ev.meta?.miniActivate)
    ) {
      pulseItem(ev.placementKey);
      return;
    }
    if (ev.type === 'activate' && (ev.actor === 'player' || ev.actor === 'dummy')) {
      pulseItem(ev.placementKey);
      return;
    }
    if (ev.type === 'damage' && ev.target === 'dummy') {
      pulseItem(ev.placementKey);
      opts.dummyHud.floatNum(Number(ev.amount) || 0, 'damage');
      opts.dummyHud.hitFlash();
      return;
    }
    if (ev.type === 'damage' && ev.target === 'player') {
      pulseItem(ev.placementKey);
      opts.playerHud.floatNum(Number(ev.amount) || 0, 'damage');
      opts.playerHud.hitFlash();
      return;
    }
    if (ev.type === 'miss') {
      pulseItem(ev.placementKey);
      const hud = ev.target === 'player' ? opts.playerHud : opts.dummyHud;
      hud.floatNum(0, 'miss');
      return;
    }
    if (ev.type === 'heal' && ev.target === 'player') {
      opts.playerHud.floatNum(Number(ev.amount) || 0, 'heal');
      return;
    }
    if (ev.type === 'buff') {
      const hud = ev.target === 'dummy' ? opts.dummyHud : opts.playerHud;
      hud.floatNum(Number(ev.amount) || 0, 'buff');
      return;
    }
    if (ev.type === 'debuff') {
      const hud = ev.target === 'dummy' ? opts.dummyHud : opts.playerHud;
      hud.floatNum(Number(ev.amount) || 0, 'debuff');
    }
  }

  seek(opts.run.mode === 'demo' ? 0 : COMBAT_DELAY);

  /** @param {string | null | undefined} placementKey */
  function highlightPlacement(placementKey) {
    opts.boardEl
      ?.querySelectorAll('.sim-log-hi')
      .forEach((el) => el.classList.remove('sim-log-hi'));
    if (!placementKey) return;
    const el = opts.boardEl?.querySelector(
      `[data-placement-key="${CSS.escape(placementKey)}"]`,
    );
    if (el instanceof HTMLElement) el.classList.add('sim-log-hi');
  }

  return {
    seek,
    flashEvent,
    applyEvent: flashEvent,
    pulseItem,
    highlightPlacement,
    destroy() {
      itemChrome.destroy();
      chargeFx.destroy();
      opts.boardEl?.querySelectorAll('.sim-fx-ring').forEach((n) => n.remove());
      opts.boardEl
        ?.querySelectorAll('.sim-log-hi')
        .forEach((n) => n.classList.remove('sim-log-hi'));
    },
  };
}

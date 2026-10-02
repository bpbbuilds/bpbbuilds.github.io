/**
 * Board activation VFX + HUD sync from snapshots / events.
 */

import { snapAt } from '../hud/sim-hud.js';
import { COMBAT_DELAY } from '../sim-combat-time.js';
import { createChargeFx } from './sim-charge-fx.js';
import { createStaminaHonk } from './sim-stamina-sfx.js';
import { createSimItemChrome, queryLivePlacement } from './sim-item-chrome.js';
import { createDamageNumbers } from './sim-dmg-numbers.js';
import { bindItemOverlays } from './sim-item-labels.js';
import { NUMBER_TYPES } from './sim-dmg-geo.js';
import { createItemAnims } from './sim-item-anims.js';
import { setPotionLevel } from '../../../shared/item-live-art/index.js';
import { readSimSoundsMuted } from '../shell/sim-view-prefs.js';

/**
 * @param {{
 *   boardEl: HTMLElement,
 *   playerHud: ReturnType<import('../../hud/sim-hud.js').bindActorHud>,
 *   dummyHud: ReturnType<import('../../hud/sim-hud.js').bindActorHud>,
 *   run: import('../../sim-events.js').SimRun,
 *   assetRoot?: string,
 *   labelsEnabled?: boolean,
 * }} opts
 */
export function createSimFx(opts) {
  const playerMax = opts.run.playerMaxHp ?? 200;
  const dummyMax = opts.run.dummyMaxHp ?? 1200;

  const itemAnims = createItemAnims({
    boardEl: opts.boardEl,
    assetRoot: opts.assetRoot,
  });
  itemAnims.indexConsumes(opts.run.events);

  const staminaHonk = createStaminaHonk(opts.assetRoot);
  const chargeFx = createChargeFx({
    boardEl: opts.boardEl,
    assetRoot: opts.assetRoot,
    onPulse: (key) => itemAnims.mini(key),
  });
  staminaHonk.setMuted(readSimSoundsMuted());
  chargeFx.setMuted(readSimSoundsMuted());
  chargeFx.loadRun(opts.run);
  const itemChrome = createSimItemChrome({
    boardEl: opts.boardEl,
    run: opts.run,
    assetRoot: opts.assetRoot,
  });

  /** @returns {HTMLElement | null} */
  function fieldEl() {
    const board = opts.boardEl;
    if (board instanceof HTMLElement) {
      return board.closest('.sim-field');
    }
    return document.querySelector('.sim-field');
  }

  const dmgNumbers = createDamageNumbers({
    fieldEl,
    boardEl: opts.boardEl,
    labelsEnabled: opts.labelsEnabled !== false,
  });
  const itemFx = bindItemOverlays({
    dmgNumbers,
    boardEl: opts.boardEl,
    assetRoot: opts.assetRoot,
  });

  /**
   * @param {import('../../sim-events.js').SimEvent} ev
   * @returns {'you' | 'foe' | null}
   */
  function actingSide(ev) {
    if (ev.actor === 'player') return 'you';
    if (ev.actor === 'dummy') return 'foe';
    return null;
  }

  /**
   * Character.dealDamage → playAttackAnimation (lunge). NOT dealEffectDamage,
   * spikes reflect, fatigue, or poison/spike DoT.
   * @param {import('../../sim-events.js').SimEvent} ev
   */
  function isWeaponDealDamage(ev) {
    const m = ev.meta || {};
    if (m.isAttack === false) return false;
    if (m.effect || m.spikes || m.fatigue) return false;
    if (m.stack === 'spikes' || m.stack === 'poison') return false;
    if (ev.actor === 'system') return false;
    // Prefer explicit flag; fall back for older rows / dummy swings.
    if (m.isAttack === true) return actingSide(ev) != null;
    return actingSide(ev) != null;
  }

  /**
   * Item.activate(damageRes) → playActivateAnimation (hop). Weapon.attack calls
   * dealDamage (lunge) first, so hop is skipped while attackMovingForward.
   * Bare activate() / food / potions pass null → no hop. Opt in via meta.
   * @param {import('../../sim-events.js').SimEvent} ev
   */
  function shouldFighterHop(ev) {
    return Boolean(ev.meta?.fighterHop);
  }

  /**
   * Character.dealDamage → playAttackAnimation on the attacker.
   * @param {import('../../sim-events.js').SimEvent} ev
   * @param {'you' | 'foe'} target
   */
  function maybeLungeAttacker(ev, target) {
    if (!isWeaponDealDamage(ev)) return;
    const actor = actingSide(ev);
    if (actor && actor !== target) dmgNumbers.lunge(actor);
  }

  /**
   * @param {import('../../sim-events.js').SimEvent} ev
   */
  function maybeHopActor(ev) {
    if (!shouldFighterHop(ev)) return;
    const actor = actingSide(ev);
    if (actor) dmgNumbers.hop(actor);
  }

  /**
   * @param {string | undefined} target
   * @returns {'you' | 'foe'}
   */
  function targetSide(target) {
    return target === 'dummy' ? 'foe' : 'you';
  }

  /**
   * Game.damageNumberColors branch order in Character.takeDamage: crit first,
   * then the damage source type.
   * @param {import('../../sim-events.js').SimEvent} ev
   * @returns {keyof typeof NUMBER_TYPES}
   */
  function numberTypeOf(ev) {
    const m = ev.meta || {};
    if (m.critical) return 'critical';
    if (m.fatigue || m.stack === 'fatigue') return 'fatigue';
    if (m.spikes || m.stack === 'spikes') return 'spikes';
    if (m.stack === 'poison') return 'poison';
    return 'damage';
  }

  let lastSeekT = -1;

  /**
   * @param {number} t
   */
  function seek(t) {
    // A jump (scrub / round switch) is not playback — clear labels in flight.
    if (lastSeekT >= 0 && (t < lastSeekT - 1e-6 || t > lastSeekT + 0.5)) {
      dmgNumbers.clear();
      itemAnims.clearInFlight();
    }
    lastSeekT = t;
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
    itemAnims.syncConsumed(t);
    const consumed = itemAnims.consumedEntries?.();
    if (consumed) {
      for (const [key, at] of consumed) {
        const el = queryLivePlacement(opts.boardEl, key);
        setPotionLevel(el, t + 1e-6 >= at ? -1 : 0, { ms: 0 });
      }
    }
  }

  /**
   * Visual-only flash during playback (bars via seek).
   * @param {import('../../sim-events.js').SimEvent} ev
   */
  function flashEvent(ev) {
    if (ev.type === 'charge' || (ev.type === 'activate' && ev.meta?.chargePath)) {
      chargeFx.flashEvent(ev);
    }
    if (ev.meta?.phase === 'tesla_advance' && typeof ev.meta.targetKey === 'string') {
      itemAnims.mini(ev.meta.targetKey);
      itemAnims.mini(ev.placementKey);
      return;
    }
    if (
      ev.meta?.phase === 'charge_received' ||
      (ev.type === 'activate' && ev.meta?.miniActivate)
    ) {
      itemAnims.mini(ev.placementKey);
      return;
    }
    if (ev.type === 'activate') {
      itemAnims.play(ev.placementKey, {
        itemId: ev.itemId,
        consume: Boolean(ev.meta?.consume),
        t: ev.t,
      });
      if (ev.meta?.consume) {
        setPotionLevel(queryLivePlacement(opts.boardEl, ev.placementKey), -1);
      }
      // Character.playActivateAnimation only when activate(damageRes) — not every item tick.
      maybeHopActor(ev);
      return;
    }
    if (ev.type === 'damage') {
      const side = targetSide(ev.target);
      const m = ev.meta || {};
      // Item.removeBlock strips stacks — the game labels that on the item.
      if (m.kind === 'block_strip') {
        itemFx.itemStack({ ...ev, type: 'buff', amount: -(Number(ev.amount) || 0) });
        return;
      }
      const type = numberTypeOf(ev);
      // Character.spawnLabel uses damageRes.damage, not the post-block hit.
      const shown = Number(m.damage ?? ev.amount) || 0;
      dmgNumbers.number(side, type, shown);
      itemFx.itemNumber(ev, type, shown);
      const blocked = m.healthDamage === 0 || (m.blocked > 0 && m.blocked >= shown);
      // HitAnimation is on the defender (takeDamage). Lunge is on the attacker (dealDamage).
      dmgNumbers.hit(side, type === 'fatigue' ? 'Fatigue' : blocked ? 'Block' : 'Hit');
      maybeLungeAttacker(ev, side);
      if (side === 'foe') opts.dummyHud.hitFlash();
      else opts.playerHud.hitFlash();
      return;
    }
    if (ev.type === 'miss') {
      const side = targetSide(ev.target);
      dmgNumbers.miss(side);
      itemFx.itemMiss(ev);
      // Miss still went through Character.dealDamage → playAttackAnimation.
      maybeLungeAttacker(ev, side);
      return;
    }
    if (ev.type === 'heal') {
      const amount = Number(ev.amount) || 0;
      // TemporaryMaxHealth is item-only (spawnLabel_other), not a Health number.
      if (ev.meta?.kind === 'maxHp') {
        itemFx.itemOther(ev);
        return;
      }
      const side = targetSide(ev.target);
      dmgNumbers.number(side, 'heal', amount);
      itemFx.itemNumber(ev, 'heal', amount);
      return;
    }
    if (ev.type === 'stamina') {
      if (ev.meta?.starved) {
        itemAnims.noStamina(ev.placementKey);
        itemFx.itemOutOfStamina(ev);
        staminaHonk.play(ev);
        return;
      }
      if (ev.meta?.kind === 'used') return;
      itemFx.itemOther(ev);
      return;
    }
    if (ev.type === 'stat') {
      itemFx.itemStat(ev);
      return;
    }
    if (ev.type === 'cooldown') {
      // CooldownAdvance only pops when something moved the CD along (Dragon
      // Knight, Tesla, …). Every activation also logs its own cooldown row —
      // that one is log bookkeeping and must not label the item.
      if (ev.meta?.kind === 'advance') itemFx.itemWeaponStat(ev);
      return;
    }
    if (ev.meta?.kind === 'damage_buff') {
      itemFx.itemWeaponStat(ev);
      return;
    }
    if (ev.type === 'buff' || ev.type === 'debuff') {
      if (itemFx.statusOnFighter(ev, targetSide)) return;
      const side = targetSide(ev.target);
      // Poison / spike ticks (engine/ticks.js) — damage numbers, not stack labels.
      if (ev.meta?.category === 'dot' && ev.meta?.systemOrigin) {
        const type = ev.meta.stack === 'spikes' ? 'spikes' : 'poison';
        dmgNumbers.number(side, type, Number(ev.amount) || 0);
        itemFx.itemNumber(ev, type, Number(ev.amount) || 0);
        dmgNumbers.hit(side, 'Hit');
        if (side === 'foe') opts.dummyHud.hitFlash();
        else opts.playerHud.hitFlash();
        return;
      }
      if (ev.meta?.stack === 'poison' && (Number(ev.amount) || 0) > 0) {
        dmgNumbers.hit(side, 'Poison');
      }
      itemFx.itemStack(ev);
    }
  }

  /** @type {Map<import('../../sim-events.js').SimEvent, number>} */
  const scrubShown = new Map();
  const SCRUB_REPEAT_MS = 400;

  /**
   * Labels for the moment under the scrubber. The game keeps popping them
   * while you step through a fight, so a paused scrub reads like playback.
   * Each event re-spawns at most once per SCRUB_REPEAT_MS so a slow drag does
   * not stack copies of the same hit.
   * @param {import('../../sim-events.js').SimEvent[]} list
   */
  function scrubEvents(list) {
    if (!Array.isArray(list) || !list.length) return;
    const now = performance.now();
    if (scrubShown.size > 256) {
      for (const [ev, at] of scrubShown) {
        if (now - at > SCRUB_REPEAT_MS) scrubShown.delete(ev);
      }
    }
    for (const ev of list) {
      const at = scrubShown.get(ev);
      if (at != null && now - at < SCRUB_REPEAT_MS) continue;
      scrubShown.set(ev, now);
      flashEvent(ev);
    }
  }

  seek(opts.run.mode === 'demo' ? 0 : COMBAT_DELAY);

  /** @param {string | null | undefined} placementKey */
  function highlightPlacement(placementKey) {
    opts.boardEl
      ?.querySelectorAll('.sim-log-hi')
      .forEach((el) => el.classList.remove('sim-log-hi'));
    if (!placementKey) return;
    const el = queryLivePlacement(opts.boardEl, placementKey);
    if (el) el.classList.add('sim-log-hi');
  }

  return {
    seek,
    flashEvent,
    scrubEvents,
    applyEvent: flashEvent,
    pulseItem: (key) => itemAnims.play(key),
    highlightPlacement,
    /** Labels run in game seconds — keep them in step with playback speed. */
    setRate(next) {
      dmgNumbers.setRate(next);
      itemAnims.setRate(next);
    },
    /** Floating damage / buff text over fighters and bag items. */
    setLabelsEnabled(on) {
      dmgNumbers.setLabelsEnabled(on);
    },
    /** Mute fight sounds (stamina toot, charge spark, and later clips). */
    setSoundsMuted(on) {
      const muted = on === true;
      staminaHonk.setMuted(muted);
      chargeFx.setMuted(muted);
    },
    /** Scrubbing is not playback: drop anything still in flight. */
    clearLabels() {
      dmgNumbers.clear();
      itemAnims.clearInFlight();
    },
    destroy() {
      itemChrome.destroy();
      chargeFx.destroy();
      dmgNumbers.destroy();
      itemAnims.destroy();
      opts.boardEl
        ?.querySelectorAll('.sim-log-hi')
        .forEach((n) => n.classList.remove('sim-log-hi'));
    },
  };
}

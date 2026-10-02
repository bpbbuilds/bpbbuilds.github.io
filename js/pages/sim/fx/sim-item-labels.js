/**
 * Item battle overlays — Util.spawnLabelOnItem / spawnBuffLabel_item /
 * spawnStatLabelOnItem / spawnMissLabel (the item copy).
 */

import { actorStatIconUrl, ACTOR_STAT_META } from '../engine/actor-stats.js';
import { queryLivePlacement } from './sim-item-chrome.js';
import { COUNTERS } from '../hud/sim-hud-geo.js';
import {
  NUMBER_TYPES,
  BUFF_LABEL,
  LABEL_TEXT,
  ITEM_OTHER,
  OUT_OF_STAMINA,
  STAT_ICON,
  formatDur,
} from './sim-dmg-geo.js';

/**
 * @param {{
 *   dmgNumbers: ReturnType<import('./sim-dmg-numbers.js').createDamageNumbers>,
 *   boardEl: HTMLElement,
 *   assetRoot?: string,
 * }} opts
 */
export function bindItemOverlays(opts) {
  function root() {
    const base = opts.assetRoot || '../';
    return base.endsWith('/') ? base : `${base}/`;
  }

  /** @param {string | undefined} key */
  function itemEl(key) {
    return queryLivePlacement(opts.boardEl, key);
  }

  /** @param {string | null | undefined} stack */
  function stackIcon(stack) {
    const file = stack ? COUNTERS[stack]?.file : null;
    if (!file) return null;
    return `${root()}assets/icons/status/buff/${file}`;
  }

  /** @param {string} name */
  function tipIcon(name) {
    return `${root()}assets/tooltips/icons/${name}.png`;
  }

  /**
   * @param {import('../../sim-events.js').SimEvent} ev
   * @param {keyof typeof NUMBER_TYPES} type
   * @param {number} amount
   */
  function itemNumber(ev, type, amount) {
    const el = itemEl(ev.placementKey);
    if (!(el instanceof HTMLElement)) return;
    const def = NUMBER_TYPES[type] || NUMBER_TYPES.damage;
    opts.dmgNumbers.itemLabel(el, {
      anim: 'ItemDamage',
      color: def.color,
      text: `${def.sign}${Math.round(amount)}`,
      shake: type === 'critical',
    });
  }

  /** @param {import('../../sim-events.js').SimEvent} ev */
  function itemMiss(ev) {
    const el = itemEl(ev.placementKey);
    if (!(el instanceof HTMLElement)) return;
    opts.dmgNumbers.itemLabel(el, {
      anim: 'ItemDamage',
      color: BUFF_LABEL.white,
      text: LABEL_TEXT.miss,
    });
  }

  /**
   * Util.spawnBuffLabel_item — tint flips when the stack landed on the foe.
   * @param {import('../../sim-events.js').SimEvent} ev
   */
  function itemStack(ev) {
    const el = itemEl(ev.placementKey);
    if (!(el instanceof HTMLElement)) return;
    const amount = Math.round(Number(ev.amount) || 0);
    if (!amount) return;
    const stack = typeof ev.meta?.stack === 'string' ? ev.meta.stack : null;
    let positive = ev.type !== 'debuff';
    if (amount < 0) positive = !positive;
    if (ev.target === 'dummy') positive = !positive;
    opts.dmgNumbers.itemLabel(el, {
      anim: 'ItemBuff',
      color: positive ? BUFF_LABEL.positive : BUFF_LABEL.negative,
      text: `${amount > 0 ? '+' : ''}${amount}`,
      icon: stackIcon(stack),
    });
  }

  /**
   * spawnLabel_other — stamina / temp max HP sit on the item, Damage anim.
   * @param {import('../../sim-events.js').SimEvent} ev
   */
  function itemOther(ev) {
    const el = itemEl(ev.placementKey);
    if (!(el instanceof HTMLElement)) return;
    const amount = Number(ev.amount) || 0;
    if (!amount) return;
    const kind = String(ev.meta?.kind || '');
    let color = ITEM_OTHER.stamina;
    if (kind === 'maxHp' || ev.meta?.stat === 'max_health') color = ITEM_OTHER.tempHp;
    else if (kind === 'temp_stamina' || ev.type === 'stamina' && ev.meta?.temp) {
      color = ITEM_OTHER.tempStamina;
    }
    const sign = amount > 0 ? '+' : '';
    opts.dmgNumbers.itemLabel(el, {
      anim: 'ItemDamage',
      color,
      text: `${sign}${Math.round(amount)}`,
    });
  }

  /**
   * spawnStatLabelOnItem — StatChange, 50px icon, stepify 0.1 + suffix.
   * @param {import('../../sim-events.js').SimEvent} ev
   */
  function itemStat(ev) {
    const el = itemEl(ev.placementKey);
    if (!(el instanceof HTMLElement)) return;
    const key = typeof ev.meta?.stat === 'string' ? ev.meta.stat : '';
    const amount = Number(ev.amount) || 0;
    if (!amount) return;
    const stepped = Math.round(amount * 10) / 10;
    const suffix = ACTOR_STAT_META[key]?.suffix || ev.meta?.suffix || '';
    const onOpponent = ev.actor === 'dummy';
    let positive = amount > 0;
    if (onOpponent) positive = !positive;
    opts.dmgNumbers.itemLabel(el, {
      anim: 'StatChange',
      color: positive ? BUFF_LABEL.positive : BUFF_LABEL.negative,
      text: `${amount > 0 ? '+' : ''}${stepped}${suffix}`,
      icon: actorStatIconUrl(root(), key, amount < 0),
      iconSize: STAT_ICON,
    });
  }

  /**
   * Item.addBonusDamage → DamageBuff; advanceCooldownSeconds → CooldownAdvance.
   * @param {import('../../sim-events.js').SimEvent} ev
   */
  function itemWeaponStat(ev) {
    const el = itemEl(ev.placementKey);
    if (!(el instanceof HTMLElement)) return;
    const amount = Number(ev.amount) || 0;
    if (!amount) return;
    const kind = String(ev.meta?.kind || ev.meta?.category || '');
    if (kind === 'advance' || ev.type === 'cooldown') {
      opts.dmgNumbers.itemLabel(el, {
        anim: 'ItemBuff',
        color: BUFF_LABEL.positive,
        text: `${formatDur(amount)}s`,
        icon: tipIcon('Cooldown'),
      });
      return;
    }
    opts.dmgNumbers.itemLabel(el, {
      anim: 'ItemBuff',
      color: amount > 0 ? BUFF_LABEL.positive : BUFF_LABEL.negative,
      text: `${amount > 0 ? '+' : ''}${Math.round(amount)}`,
      icon: tipIcon('Damage'),
    });
  }

  /**
   * Character-side stun / resisted / protected / reflected (Buff anim).
   * @param {import('../../sim-events.js').SimEvent} ev
   * @param {(target: string | undefined) => 'you' | 'foe'} targetSide
   */
  function statusOnFighter(ev, targetSide) {
    const kind = String(ev.meta?.kind || '');
    const stack = typeof ev.meta?.stack === 'string' ? ev.meta.stack : null;
    const n = Math.abs(Math.round(Number(ev.amount) || 0));
    const side = targetSide(ev.target);
    if (kind === 'stunned' || (stack === 'stun' && kind !== 'stun_resisted')) {
      const dur = Number(ev.amount) || 0;
      if (dur <= 0) return true;
      opts.dmgNumbers.statusLabel(side, {
        text: LABEL_TEXT.stunned(dur),
        tone: 'negative',
      });
      return true;
    }
    if (kind === 'stun_resisted') {
      opts.dmgNumbers.statusLabel(side, {
        text: LABEL_TEXT.stunResisted,
        tone: 'positive',
      });
      return true;
    }
    if (kind === 'crit_resisted') {
      opts.dmgNumbers.statusLabel(side, {
        text: LABEL_TEXT.critResisted,
        tone: 'positive',
      });
      return true;
    }
    if (kind === 'nullified') {
      opts.dmgNumbers.statusLabel(side, {
        text: LABEL_TEXT.nullified(n || 1),
        tone: 'negative',
        icon: stackIcon(stack),
      });
      return true;
    }
    if (kind === 'resisted') {
      opts.dmgNumbers.statusLabel(side, {
        text: LABEL_TEXT.resisted(n || 1),
        tone: 'positive',
        icon: stackIcon(stack),
      });
      return true;
    }
    if (kind === 'protected') {
      const buff = ev.type === 'buff';
      opts.dmgNumbers.statusLabel(side, {
        text: LABEL_TEXT.protected(n || 1),
        tone: buff ? 'positive' : 'negative',
        icon: stackIcon(stack),
      });
      return true;
    }
    if (kind === 'reflected') {
      opts.dmgNumbers.statusLabel(side, {
        text: LABEL_TEXT.reflected(n || 1),
        tone: 'positive',
        icon: stackIcon(stack),
      });
      return true;
    }
    return false;
  }

  /**
   * Item.playOutOfStaminaAnimation → OutOfStaminaLabel on the item origin.
   * @param {import('../../sim-events.js').SimEvent} ev
   */
  function itemOutOfStamina(ev) {
    const el = itemEl(ev.placementKey);
    if (!(el instanceof HTMLElement)) return;
    opts.dmgNumbers.itemLabel(el, {
      anim: 'OutOfStamina',
      color: OUT_OF_STAMINA.color,
      text: LABEL_TEXT.outOfStamina,
      box: OUT_OF_STAMINA.box,
      face: 'display',
      centered: true,
      outlineColor: OUT_OF_STAMINA.outline,
    });
  }

  return {
    itemNumber,
    itemMiss,
    itemStack,
    itemOther,
    itemOutOfStamina,
    itemStat,
    itemWeaponStat,
    statusOnFighter,
  };
}

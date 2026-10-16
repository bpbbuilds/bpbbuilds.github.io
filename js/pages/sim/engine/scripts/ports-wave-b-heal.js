/**
 * Band AD Wave B — heal / shell / light accessories.
 */

import {
  BUFF_KEYS,
  cleanseRandomDebuffs,
  grantStacks,
  spendStacks,
} from '../buff-economy.js';
import { healActor, requestedHealAmount, tryUseStamina } from '../actor.js';
import { applyUnhealing } from '../actor-stats.js';
import { eventSideForPiece } from '../vs-board.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { modifiedParamValue } from '../placement-instance.js';
import { addSpeed, multiplyStaminaCost } from '../piece-stats.js';
import { getStackAmount } from '../stacks.js';
import { afterEffectFinished, itemHasType, pushActivate } from './ports-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/**
 * @param {import('../actor.js').SimActor} actor
 * @param {() => number} rng
 */
function useRandomBuff(actor, rng, opts = {}) {
  const have = BUFF_KEYS.filter((k) => getStackAmount(actor, /** @type {any} */ (k)) > 0);
  if (!have.length) return null;
  const stack = have[Math.floor(rng() * have.length)] || have[0];
  const { spent } = spendStacks(actor, stack, 1, opts);
  return spent > 0 ? stack : null;
}

/** @param {object} ctx @param {object} piece @param {string} type */
function countLinkedType(ctx, piece, type) {
  const { graph, itemsById, canAffect, pieces } = ctx;
  const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
  let n = 0;
  for (const other of pieces || []) {
    if (!links.some((l) => l.key === other.placementKey)) continue;
    if (itemHasType(itemsById.get(other.itemId), type)) n += 1;
  }
  return n;
}

/** @param {object} ctx @param {object} piece @param {string[]} types */
function countLinkedAnyType(ctx, piece, types) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  return (ctx.pieces || []).filter((other) =>
    links.some((link) => link.key === other.placementKey) &&
    types.some((type) => itemHasType(other, type)),
  ).length;
}

function bindSunArmor(piece, ctx) {
  if (piece._sunArmorBound) return;
  piece._sunArmorBound = true;
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  for (const other of ctx.pieces || []) {
    if (!links.some((link) => link.key === other.placementKey)) continue;
    if (!itemHasType(other, 'fire')) continue;
    const dynamic = Array.isArray(other._dynamicTypes) ? other._dynamicTypes : [];
    if (!dynamic.some((type) => String(type).toLowerCase() === 'holy')) dynamic.push('holy');
    other._dynamicTypes = dynamic;
  }
}

/** Ghost.gd — prepare unhealing; CD spend random buff → heal. */
/** @type {ScriptHandler} */
export const ghostPort = {
  handlerId: 'ghost',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const unh = getPName(piece.params, 'unhealing', 10) / 100;
    if (unh) ctx.player.unhealing = (Number(ctx.player.unhealing) || 0) + unh;
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    pushActivate(piece, ctx, 'ghost', `Accessory: ${piece.name}`);
    const used = useRandomBuff(player, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    if (!used) return true;
    const healAmt = Math.max(1, Math.round(getPName(piece.params, 'heal', getP1(piece.params, 8))));
    const healed = healActor(player, healAmt);
    if (healed > 0) {
      events.push({
        t: t + 0.003,
        type: 'heal',
        target: 'player',
        amount: healed,
        label: `${piece.name}: heal +${healed} (spent ${used})`,
        meta: { category: 'heal', script: true, handler: 'ghost' },
      });
    }
    return true;
  },
};

/** FalseLife.gd — prepare max-HP amp + overheal→maxHP; CD heal (+ dark bonus). */
/** @type {ScriptHandler} */
export const falseLifePort = {
  handlerId: 'false_life',
  family: 'unique',
  onPrepare(piece, ctx) {
    const amp = getPName(piece.params, 'healthamp', 10) / 100;
    ctx.player._maxHealthGain = (Number(ctx.player._maxHealthGain) || 0) + amp;
    ctx.player._overhealToMaxHp = true;
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    const dark = countLinkedType(ctx, piece, 'dark');
    const base = modifiedParamValue(
      piece,
      getPName(piece.params, 'heal', getP1(piece.params, 6)),
      'heal',
    );
    const perDark = modifiedParamValue(
      piece,
      getPName(piece.params, 'heal_dark', getP2(piece.params, 2)),
      'heal_dark',
    );
    const healAmt = base + perDark * dark;
    const side = eventSideForPiece(piece);
    const want = requestedHealAmount(player, healAmt);
    healActor(player, healAmt);
    // Same pattern as Staff of Unhealing: log meter amount on the piece's side so
    // vs-board opponent heals don't credit the human, and flushUnloggedHeal won't duplicate.
    if (player._lastHeal) player._lastHeal.meterAttached = true;
    events.push({
      t: t + 0.003,
      type: 'heal',
      actor: side,
      target: side,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      amount: want,
      label: `${piece.name}: heal +${want}`,
      meta: {
        category: 'heal',
        script: true,
        handler: 'false_life',
        loggedAmount: want,
        meterAttached: true,
        requestedHealAmount: healAmt,
      },
    });
    // FalseLife.gd calls heal() before activate() in doCooldownEffect().
    pushActivate(piece, { ...ctx, t: t + 0.006 }, 'false_life', `Accessory: ${piece.name}`);
    return true;
  },
};

/** ShellTotem.gd — prepare stamina × holy; CD empower-or-heal by HP threshold. */
/** @type {ScriptHandler} */
export const shellTotemPort = {
  handlerId: 'shell_totem',
  family: 'unique',
  onPrepare(piece, ctx) {
    const holy = countLinkedType(ctx, piece, 'holy');
    const stam =
      (-getPName(piece.params, 'stamina', getP3(piece.params, 0)) / 100) * holy;
    if (stam && holy) {
      multiplyStaminaCost(piece, stam);
    }
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    const cost = Math.max(0, Number(piece.staminaCost) || 0);
    if (tryUseStamina(player, cost) === 'starve') return true;
    const th = getPName(piece.params, 'healtht', getP1(piece.params, 0)) / 100;
    const rel = player.maxHp > 0 ? player.hp / player.maxHp : 1;
    if (rel > th) {
      grantStacks(player, 'empower', 1, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      events.push({
        t: t + 0.003,
        type: 'buff',
        target: 'player',
        amount: 1,
        label: `${piece.name}: +1 Empower`,
        meta: { category: 'buff', stack: 'empower', script: true, handler: 'shell_totem' },
      });
    } else {
      const healAmt = getPName(piece.params, 'heal', getP2(piece.params, 0));
      const healed = healActor(player, healAmt);
      if (healed > 0) {
        events.push({
          t: t + 0.003,
          type: 'heal',
          target: 'player',
          amount: healed,
          label: `${piece.name}: heal +${healed}`,
          meta: { category: 'heal', script: true, handler: 'shell_totem' },
        });
      }
    }
    pushActivate(piece, ctx, 'shell_totem', `Weapon: ${piece.name}`);
    return true;
  },
};

/** Shelly.gd — prepare potion speed + debuff vulnerability; CD cleanse+heal. */
/** @type {ScriptHandler} */
export const shellyPort = {
  handlerId: 'shelly',
  family: 'unique',
  onPrepare(piece, ctx) {
    const speed = getPName(piece.params, 'speed', getP3(piece.params, 10)) / 100;
    const n = countLinkedType(ctx, piece, 'potion');
    if (n && speed) addSpeed(piece, n * speed);
    const rawChance = Number(piece.chance ?? ctx.itemsById.get(piece.itemId)?.chance);
    const chance = Number.isFinite(rawChance)
      ? rawChance
      : getPName(piece.params, 'chance', 0);
    ctx.player.debuffCleanseProtectChance =
      (Number(ctx.player.debuffCleanseProtectChance) || 0) - chance;
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    const n = Math.trunc(getPName(piece.params, 'debuffs', getP1(piece.params, 1)));
    cleanseRandomDebuffs(player, n, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
      cleanse: true,
      rng,
    });
    const healAmt = modifiedParamValue(
      piece,
      getPName(piece.params, 'heal', getP2(piece.params, 6)),
      'heal',
    );
    const requested = requestedHealAmount(player, healAmt);
    const healed = healActor(player, healAmt);
    if (player._lastHeal) player._lastHeal.meterAttached = true;
    if (requested > 0) {
      events.push({
        t: t + 0.003,
        actor: eventSideForPiece(piece),
        type: 'heal',
        target: eventSideForPiece(piece),
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        amount: requested,
        label: `${piece.name}: heal +${requested}`,
        meta: {
          category: 'heal',
          script: true,
          handler: piece.itemId,
          loggedAmount: requested,
          meterAttached: true,
          applied: healed,
        },
      });
    }
    pushActivate(piece, { ...ctx, t: t + 0.006 }, piece.itemId, `Pet: ${piece.name}`);
    return true;
  },
};

/** ShinyShell.gd */
/** @type {ScriptHandler} */
export const shinyShellPort = {
  handlerId: 'shiny_shell',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    const holy = countLinkedType(ctx, piece, 'holy');
    const base = modifiedParamValue(
      piece,
      getPName(piece.params, 'heal', getP1(piece.params, 0)),
      'heal',
    );
    const perHoly = modifiedParamValue(
      piece,
      getPName(piece.params, 'heal_bonus', getP2(piece.params, 0)),
      'heal_bonus',
    );
    const healed = healActor(player, base + holy * perHoly);
    if (healed > 0) {
      events.push({
        t: t + 0.003,
        type: 'heal',
        target: 'player',
        amount: healed,
        label: `${piece.name}: heal +${healed}`,
        meta: { category: 'heal', script: true, handler: 'shiny_shell' },
      });
    }
    afterEffectFinished(piece, ctx, 'shiny_shell', { label: `Accessory: ${piece.name}` });
    return true;
  },
};

/** SpellScrollLight.gd */
/** @type {ScriptHandler} */
export const spellScrollLightPort = {
  handlerId: 'spell_scroll_light',
  family: 'unique',
  onPrepare(piece, ctx) {
    const speed = getPName(piece.params, 'speed', getP1(piece.params, 10)) / 100;
    const n = countLinkedType(ctx, piece, 'holy');
    if (n && speed) addSpeed(piece, n * speed);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    cleanseRandomDebuffs(player, 1, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const debuffs =
      (player.stacks.poison || 0) + (player.stacks.blind || 0) + (player.stacks.cold || 0);
    if (debuffs <= 0) {
      const healAmt = modifiedParamValue(
        piece,
        getPName(piece.params, 'heal', getP1(piece.params, 0)),
        'heal',
      );
      const healed = healActor(player, healAmt);
      if (healed > 0) {
        events.push({
          t: t + 0.003,
          type: 'heal',
          target: 'player',
          amount: healed,
          label: `${piece.name}: heal +${healed}`,
          meta: { category: 'heal', script: true, handler: 'spell_scroll_light' },
        });
      }
    }
    pushActivate(piece, ctx, 'spell_scroll_light', `Scroll: ${piece.name}`);
    return true;
  },
};

/** StaffofUnhealing.gd — heal; mana path enables temporary full unhealing. */
/** @type {ScriptHandler} */
export const staffOfUnhealingPort = {
  handlerId: 'staff_of_unhealing',
  family: 'unique',
  onPrepare(piece) {
    piece._unhealBuff = false;
    piece._unhealUntil = null;
  },
  onTick(piece, ctx) {
    if (!piece._unhealBuff || piece._unhealUntil == null || ctx.t < piece._unhealUntil) return;
    applyUnhealing(ctx.player, -1, ctx, piece);
    piece._unhealBuff = false;
    piece._unhealUntil = null;
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    // Game: activate() only after Sufficient stamina (StaffofUnhealing.gd).
    if (tryUseStamina(player, piece.staminaCost ?? 0) === 'starve') return true;
    const healAmt = modifiedParamValue(
      piece,
      getPName(piece.params, 'heal', getP1(piece.params, 0)),
      'heal',
    );
    const manaCost = getP2(piece.params, 0);
    const mana = getStackAmount(player, 'mana');
    if (mana >= manaCost) {
      spendStacks(player, 'mana', manaCost, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      if (!piece._unhealBuff) {
        piece._unhealBuff = true;
        applyUnhealing(player, 1, ctx, piece);
      }
      const dur = modifiedParamValue(
        piece,
        getPName(piece.params, 'dur_unhealing', getPName(piece.params, 'p4', 0)),
        'dur_unhealing',
      );
      piece._unhealUntil = t + dur;
    }
    const side = eventSideForPiece(piece);
    const want = requestedHealAmount(player, healAmt);
    healActor(player, healAmt);
    // Game logs the meter amount even at full HP; mark attached so flushUnloggedHeal
    // does not duplicate a generic "Heal +N" line (which was stealing Unhealing procs).
    if (player._lastHeal) player._lastHeal.meterAttached = true;
    if (want > 0) {
      events.push({
        t: t + 0.003,
        type: 'heal',
        actor: side,
        target: side,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        amount: want,
        label: `${piece.name}: heal +${want}`,
        meta: {
          category: 'heal',
          script: true,
          handler: 'staff_of_unhealing',
          loggedAmount: want,
        },
      });
    }
    pushActivate(piece, { ...ctx, t: t + 0.006 }, 'staff_of_unhealing', `Weapon: ${piece.name}`);
    return true;
  },
};

/** SunArmor.gd — start block/heat; CD spend heat → heal+cleanse. */
/** @type {ScriptHandler} */
export const sunArmorPort = {
  handlerId: 'sun_armor',
  family: 'unique',
  onPrepare(piece, ctx) {
    bindSunArmor(piece, ctx);
  },
  onCombatStart(piece, ctx) {
    bindSunArmor(piece, ctx);
    const { player, events, t } = ctx;
    const catalogBlock = Number(ctx.itemsById?.get?.(piece.itemId)?.block);
    const blockBase = Number.isFinite(catalogBlock) ? catalogBlock : getP1(piece.params, 8);
    const block = Math.max(0, Math.round(piece.blockGrant ?? blockBase));
    const heatPer = Math.max(0, Number(getP1(piece.params, 1)) || 0);
    const n = countLinkedAnyType(ctx, piece, ['fire', 'holy']);
    grantStacks(player, 'block', block, { originKey: piece.placementKey, originId: piece.itemId });
    if (n && heatPer) {
      grantStacks(player, 'heat', n * heatPer, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    events.push({
      t,
      type: 'buff',
      target: 'player',
      amount: block,
      label: `${piece.name}: +${block} Block`,
      meta: { category: 'buff', stack: 'block', script: true, handler: 'sun_armor' },
    });
    pushActivate(piece, ctx, 'sun_armor', `Armor: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    const need = Math.trunc(getP2(piece.params, 5));
    if ((player.stacks.heat || 0) >= need) {
      spendStacks(player, 'heat', need, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      const healAmt = Math.max(
        0,
        Math.round(modifiedParamValue(
          piece,
          getPName(piece.params, 'heal', getP3(piece.params, 10)),
          'heal',
        )),
      );
      const healed = healActor(player, healAmt);
      const cleanses = Math.max(0, Math.trunc(getP4(piece.params, 1)));
      if (cleanses) {
        cleanseRandomDebuffs(player, cleanses, rng, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      }
      if (healed > 0) {
        events.push({
          t: t + 0.003,
          type: 'heal',
          target: 'player',
          amount: healed,
          label: `${piece.name}: heal +${healed}`,
          meta: { category: 'heal', script: true, handler: 'sun_armor' },
        });
      }
      ctx.bus?.emit?.('used_heat', {
        piece,
        event: {
          t,
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          stack: 'heat',
          amount: need,
        },
        t,
      });
    }
    pushActivate(piece, ctx, 'sun_armor', `Armor: ${piece.name}`);
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const WAVE_B_HEAL_PORTS = {
  ghost: ghostPort,
  false_life: falseLifePort,
  shell_totem: shellTotemPort,
  shelly: shellyPort,
  shiny_shell: shinyShellPort,
  spell_scroll_light: spellScrollLightPort,
  staff_of_unhealing: staffOfUnhealingPort,
  sun_armor: sunArmorPort,
};

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
import { eventSideForPiece } from '../vs-board.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { addSpeed, multiplyStaminaCost } from '../piece-stats.js';
import { getStackAmount } from '../stacks.js';
import { itemHasType, pushActivate } from './ports-util.js';
import { markFoodConsumed } from './food-helpers.js';

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
  onCombatStart(piece, ctx) {
    const amp = getPName(piece.params, 'healthamp', 10) / 100;
    ctx.player._maxHealthGain = (Number(ctx.player._maxHealthGain) || 0) + amp;
    ctx.player._overhealToMaxHp = true;
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'false_life', `Accessory: ${piece.name}`);
    const dark = countLinkedType(ctx, piece, 'dark');
    const base = Math.max(1, Math.round(getPName(piece.params, 'heal', getP1(piece.params, 6))));
    const bonus = Math.max(0, Math.round(getPName(piece.params, 'heal_dark', getP2(piece.params, 2)) * dark));
    const healAmt = base + bonus;
    const side = eventSideForPiece(piece);
    const want = requestedHealAmount(player, healAmt);
    healActor(player, healAmt);
    // Same pattern as Staff of Unhealing: log meter amount on the piece's side so
    // vs-board opponent heals don't credit the human, and flushUnloggedHeal won't duplicate.
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
          handler: 'false_life',
          loggedAmount: want,
          meterAttached: true,
          requestedHealAmount: healAmt,
        },
      });
    }
    return true;
  },
};

/** ShellTotem.gd — prepare stamina × holy; CD empower-or-heal by HP threshold. */
/** @type {ScriptHandler} */
export const shellTotemPort = {
  handlerId: 'shell_totem',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const holy = countLinkedType(ctx, piece, 'holy');
    const stam = -Math.abs(getPName(piece.params, 'stamina', 10) / 100) * holy;
    if (stam && holy) {
      multiplyStaminaCost(piece, stam);
    }
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'shell_totem', `Accessory: ${piece.name}`);
    const cost = Math.max(1, Math.round(piece.staminaCost || getP1(piece.params, 1)));
    if (tryUseStamina(player, cost) === 'starve') return true;
    const th = getPName(piece.params, 'healtht', getP2(piece.params, 50)) / 100;
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
      const healAmt = Math.max(1, Math.round(getPName(piece.params, 'heal', getP3(piece.params, 8))));
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
    return true;
  },
};

/** Shelly.gd — prepare potion speed + debuff vulnerability; CD cleanse+heal. */
/** @type {ScriptHandler} */
export const shellyPort = {
  handlerId: 'shelly',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const speed = getPName(piece.params, 'speed', getP1(piece.params, 10)) / 100;
    const n = countLinkedType(ctx, piece, 'potion');
    if (n && speed) addSpeed(piece, n * speed);
    const vuln = Math.max(0, Number(piece.chance) || getPName(piece.params, 'chance', 10));
    if (vuln) {
      if (!ctx.player.stackResist) ctx.player.stackResist = {};
      for (const k of ['poison', 'blind', 'cold']) {
        ctx.player.stackResist[k] = (Number(ctx.player.stackResist[k]) || 0) - vuln;
      }
    }
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    pushActivate(piece, ctx, 'shelly', `Pet: ${piece.name}`);
    const n = Math.max(1, Math.round(getPName(piece.params, 'debuffs', getP2(piece.params, 1))));
    cleanseRandomDebuffs(player, n, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const healAmt = Math.max(1, Math.round(getPName(piece.params, 'heal', getP3(piece.params, 6))));
    const healed = healActor(player, healAmt);
    if (healed > 0) {
      events.push({
        t: t + 0.003,
        type: 'heal',
        target: 'player',
        amount: healed,
        label: `${piece.name}: heal +${healed}`,
        meta: { category: 'heal', script: true, handler: 'shelly' },
      });
    }
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
    pushActivate(piece, ctx, 'shiny_shell', `Accessory: ${piece.name}`);
    const holy = countLinkedType(ctx, piece, 'holy');
    const base = Math.max(1, Math.round(getPName(piece.params, 'heal', getP1(piece.params, 8))));
    const bonus = Math.max(0, Math.round(getPName(piece.params, 'heal_bonus', getP2(piece.params, 2)) * holy));
    const healed = healActor(player, base + bonus);
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
    markFoodConsumed(piece, ctx, 'shiny_shell');
    return true;
  },
};

/** SpellScrollLight.gd */
/** @type {ScriptHandler} */
export const spellScrollLightPort = {
  handlerId: 'spell_scroll_light',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const speed = getPName(piece.params, 'speed', getP1(piece.params, 10)) / 100;
    const n = countLinkedType(ctx, piece, 'holy');
    if (n && speed) addSpeed(piece, n * speed);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    pushActivate(piece, ctx, 'spell_scroll_light', `Scroll: ${piece.name}`);
    cleanseRandomDebuffs(player, 1, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const debuffs =
      (player.stacks.poison || 0) + (player.stacks.blind || 0) + (player.stacks.cold || 0);
    if (debuffs <= 0) {
      const healAmt = Math.max(1, Math.round(getPName(piece.params, 'heal', getP2(piece.params, 10))));
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
    return true;
  },
};

/** StaffofUnhealing.gd — heal; mana path enables temporary full unhealing. */
/** @type {ScriptHandler} */
export const staffOfUnhealingPort = {
  handlerId: 'staff_of_unhealing',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._unhealBuff = false;
    piece._unhealUntil = null;
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    if (piece._unhealBuff && piece._unhealUntil != null && t >= piece._unhealUntil) {
      player.unhealing = Math.max(0, (Number(player.unhealing) || 0) - 1);
      piece._unhealBuff = false;
      piece._unhealUntil = null;
    }
    // Game: activate() only after Sufficient stamina (StaffofUnhealing.gd).
    if (tryUseStamina(player, piece.staminaCost || 1) === 'starve') return true;
    pushActivate(piece, ctx, 'staff_of_unhealing', `Weapon: ${piece.name}`);
    const healAmt = Math.max(1, Math.round(getPName(piece.params, 'heal', getP1(piece.params, 8))));
    const manaCost = Math.max(
      1,
      Math.round(getPName(piece.params, 'manat', getP2(piece.params, 3))),
    );
    const mana = Number(player.stacks.mana) || 0;
    if (mana >= manaCost) {
      spendStacks(player, 'mana', manaCost, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      if (!piece._unhealBuff) {
        piece._unhealBuff = true;
        player.unhealing = (Number(player.unhealing) || 0) + 1;
      }
      const dur = Math.max(0.5, getPName(piece.params, 'dur_unhealing', 3));
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
    return true;
  },
};

/** SunArmor.gd — start block/heat; CD spend heat → heal+cleanse. */
/** @type {ScriptHandler} */
export const sunArmorPort = {
  handlerId: 'sun_armor',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { player, events, t } = ctx;
    const block = Math.max(1, Math.round(piece.blockGrant || getP1(piece.params, 8)));
    const heatPer = Math.max(0, Math.round(getPName(piece.params, 'heat', getP1(piece.params, 1))));
    const n = countLinkedType(ctx, piece, 'fire') + countLinkedType(ctx, piece, 'holy');
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
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    pushActivate(piece, ctx, 'sun_armor', `Armor: ${piece.name}`);
    const need = Math.max(1, Math.round(getP2(piece.params, 5)));
    if ((player.stacks.heat || 0) < need) return true;
    spendStacks(player, 'heat', need, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const healAmt = Math.max(1, Math.round(getPName(piece.params, 'heal', getP3(piece.params, 10))));
    const healed = healActor(player, healAmt);
    const cleanses = Math.max(
      0,
      Math.round(getPName(piece.params, 'debuffs', getPName(piece.params, 'p4', 1))),
    );
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

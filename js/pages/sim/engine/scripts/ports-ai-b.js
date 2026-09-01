/**
 * Band AI Wave B — armor deepen (HolyArmor / LeatherArmor).
 */

import {
  grantStacks,
  spendStacks,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getPName } from '../params.js';
import { gainStacks } from '../stacks.js';
import { pushActivate } from './ports-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/**
 * HolyArmor.gd — Block + Regen×Holy links; CD cleansePoison(p2).
 * @type {ScriptHandler}
 */
export const holyArmorPort = {
  handlerId: 'holy_armor',
  family: 'start_buff',
  onCombatStart(piece, ctx) {
    const { t, player, events, graph, itemsById, canAffect } = ctx;
    const block = Math.max(1, Math.round(piece.blockGrant || getPName(piece.params, 'block', 10)));
    grantStacks(player, 'block', block, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const per = Math.max(0, Math.round(getP1(piece.params, 1)));
    const regen = links.length * per;
    if (regen > 0) {
      grantStacks(player, 'regeneration', regen, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    events.push({
      t,
      type: 'buff',
      target: 'player',
      amount: block,
      label: `${piece.name}: +${block} Block${regen ? ` +${regen} Regen` : ''}`,
      meta: { category: 'buff', script: true, handler: 'holy_armor' },
    });
    pushActivate(piece, ctx, 'holy_armor', `Armor: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'holy_armor', `Armor: ${piece.name}`);
    const n = Math.max(1, Math.round(getP2(piece.params, 1)));
    const spent = spendStacks(player, 'poison', n, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    if (spent.spent > 0) {
      events.push({
        t: t + 0.004,
        type: 'buff',
        target: 'player',
        amount: -spent.spent,
        label: `${piece.name}: cleanse ${spent.spent} Poison`,
        meta: { category: 'buff', stack: 'poison', script: true, handler: 'holy_armor' },
      });
    }
    return true;
  },
};

/**
 * LeatherArmor.gd — preCombat debuffResistStacks(p1); combat-start Block.
 * @type {ScriptHandler}
 */
export const leatherArmorPort = {
  handlerId: 'leather_armor',
  family: 'start_buff',
  onCombatStart(piece, ctx) {
    const { t, player, events } = ctx;
    const resist = Math.max(0, Math.round(getP1(piece.params, 3)));
    if (resist > 0) {
      player.debuffResistStacks = (Number(player.debuffResistStacks) || 0) + resist;
      events.push({
        t: t + 0.002,
        type: 'info',
        label: `${piece.name}: +${resist} debuff resist`,
        meta: { category: 'system', script: true, handler: 'leather_armor' },
      });
    }
    const block = Math.max(1, Math.round(piece.blockGrant || getPName(piece.params, 'block', 12)));
    gainStacks(player, 'block', block);
    events.push({
      t,
      type: 'buff',
      target: 'player',
      amount: block,
      label: `${piece.name}: +${block} Block`,
      meta: { category: 'buff', stack: 'block', script: true, handler: 'leather_armor' },
    });
  },
};

/** @type {Record<string, ScriptHandler>} */
export const AI_B_PORTS = {
  holy_armor: holyArmorPort,
  leather_armor: leatherArmorPort,
};

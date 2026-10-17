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
import { itemHasType, pushActivate } from './ports-util.js';

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
    const blockRaw = Number.isFinite(Number(piece.blockGrant))
      ? Number(piece.blockGrant)
      : Number(itemsById.get(piece.itemId)?.block) || getPName(piece.params, 'block', 0);
    const block = Number.isFinite(blockRaw) ? blockRaw : 0;
    grantStacks(player, 'block', block, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const holyLinks = links.filter((link) => itemHasType(itemsById.get(link.id), 'holy'));
    const per = getPName(piece.params, 'regen', getP1(piece.params, 0));
    const regen = holyLinks.length * (Number.isFinite(Number(per)) ? Number(per) : 0);
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
    const raw = getPName(piece.params, 'cleanse', getP2(piece.params, 0));
    const n = Number.isFinite(Number(raw)) ? Number(raw) : 0;
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
    pushActivate(piece, ctx, 'holy_armor', `Armor: ${piece.name}`);
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

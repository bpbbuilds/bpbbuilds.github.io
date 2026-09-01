/**
 * Band AE Wave C — spear block-strip family.
 */

import { grantStacks, spendStacks } from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getPName } from '../params.js';
import { dealHit } from './handlers.js';
import { itemHasType } from './ports-util.js';
import {
  countEmptyAffectCells,
  removeBlock,
  weaponStrike,
} from './ports-wave-c-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** @param {object} ctx @param {object} piece @param {string} type */
function countLinkedType(ctx, piece, type) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  let n = 0;
  for (const other of ctx.pieces || []) {
    if (!links.some((l) => l.key === other.placementKey)) continue;
    if (itemHasType(ctx.itemsById.get(other.itemId), type)) n += 1;
  }
  return n;
}

/** Spear.gd */
/** @type {ScriptHandler} */
export const spearPort = {
  handlerId: 'spear',
  family: 'weapon_base',
  onCombatStart(piece, ctx) {
    const per = Math.max(1, Math.round(getPName(piece.params, 'blockremoval', getP1(piece.params, 2))));
    piece._blockStrip = per * countEmptyAffectCells(ctx, piece);
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'spear');
  },
  onDealtDamage(piece, ctx) {
    const strip = piece._blockStrip || 0;
    if (strip <= 0) return;
    removeBlock(ctx.dummy, strip, ctx, piece);
  },
};

/** LongSpear.gd */
/** @type {ScriptHandler} */
export const longSpearPort = {
  handlerId: 'long_spear',
  family: 'weapon_base',
  onCombatStart(piece, ctx) {
    const per = Math.max(1, Math.round(getPName(piece.params, 'block', getP1(piece.params, 2))));
    piece._blockStrip = per * countEmptyAffectCells(ctx, piece);
    piece._damResist = Math.abs(getPName(piece.params, 'dam', getP2(piece.params, 5)) / 100);
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'long_spear');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    const strip = piece._blockStrip || 0;
    if (strip) removeBlock(ctx.dummy, strip, ctx, piece);
    const resist = piece._damResist || 0;
    if (resist) {
      ctx.dummy.damageResistancePct = Math.max(
        0,
        (Number(ctx.dummy.damageResistancePct) || 0) - resist * 100,
      );
    }
    ctx.events.push({
      t: ctx.t + 0.008,
      type: 'info',
      label: `${piece.name}: strip block / resist`,
      meta: { category: 'system', script: true, handler: 'long_spear' },
    });
  },
};

/** PoisonSpear.gd */
/** @type {ScriptHandler} */
export const poisonSpearPort = {
  handlerId: 'poison_spear',
  family: 'weapon_base',
  onCombatStart(piece, ctx) {
    const empty = countEmptyAffectCells(ctx, piece);
    const nature = countLinkedType(ctx, piece, 'nature');
    const per = Math.max(1, Math.round(getPName(piece.params, 'blockremoval', getP1(piece.params, 2))));
    piece._blockStrip = per * (empty + nature);
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'poison_spear');
  },
  onDealtDamage(piece, ctx) {
    const poison = Math.max(1, Math.round(getPName(piece.params, 'poison', getP1(piece.params, 2))));
    const selfPoison = Math.max(0, Math.round(getPName(piece.params, 'poison2', getP2(piece.params, 1))));
    grantStacks(ctx.dummy, 'poison', poison, {
      originKey: piece.placementKey,
      originId: piece.itemId,
      rng: ctx.rng,
      opponent: ctx.player,
    });
    if (selfPoison) {
      grantStacks(ctx.player, 'poison', selfPoison, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    const strip = piece._blockStrip || 0;
    if (strip) removeBlock(ctx.dummy, strip, ctx, piece);
    ctx.events.push({
      t: ctx.t + 0.008,
      type: 'debuff',
      target: 'dummy',
      amount: poison,
      label: `${piece.name}: +${poison} Poison`,
      meta: { category: 'debuff', stack: 'poison', script: true, handler: 'poison_spear' },
    });
  },
};

/** MoltenSpear.gd — miss + heat → same-swing convert; always strip block. */
/** @type {ScriptHandler} */
export const moltenSpearPort = {
  handlerId: 'molten_spear',
  family: 'weapon_base',
  onCombatStart(piece, ctx) {
    const empty = countEmptyAffectCells(ctx, piece);
    const fire = countLinkedType(ctx, piece, 'fire');
    const per = Math.max(1, Math.round(getPName(piece.params, 'blockremoval', getP1(piece.params, 2))));
    piece._blockStrip = per * (empty + fire);
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'molten_spear');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit && !piece._moltenConvert) {
      const need = Math.max(1, Math.round(getPName(piece.params, 'heatt', getP2(piece.params, 3))));
      if ((ctx.player.stacks.heat || 0) >= need) {
        spendStacks(ctx.player, 'heat', need, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
        const bonus = Math.max(1, Math.round(getPName(piece.params, 'missdam', getP1(piece.params, 4))));
        piece._moltenConvert = true;
        dealHit(piece, ctx, (hit.raw || 0) + bonus);
        piece._moltenConvert = false;
        return;
      }
    }
    const strip = piece._blockStrip || 0;
    if (strip) removeBlock(ctx.dummy, strip, ctx, piece);
    ctx.events.push({
      t: ctx.t + 0.008,
      type: 'info',
      label: `${piece.name}: molten strip`,
      meta: { category: 'system', script: true, handler: 'molten_spear' },
    });
  },
};

/** @type {Record<string, ScriptHandler>} */
export const WAVE_C_SPEAR_PORTS = {
  spear: spearPort,
  long_spear: longSpearPort,
  poison_spear: poisonSpearPort,
  molten_spear: moltenSpearPort,
};

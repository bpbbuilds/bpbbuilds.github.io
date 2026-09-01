/**
 * Band AM — gem eggs (pet-like start + CD grants).
 */

import { grantStacks } from '../buff-economy.js';
import { getP1, getP3 } from '../params.js';
import { pushActivate } from './ports-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

function petActivate(piece, ctx, handler) {
  pushActivate(piece, ctx, handler, `Pet: ${piece.name}`);
}

/** RubyEgg.gd */
/** @type {ScriptHandler} */
export const rubyEggPort = {
  handlerId: 'ruby_egg',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    const n = Math.max(1, Math.round(getP1(piece.params, 1)));
    ctx.player.debuffReflectStacks = (ctx.player.debuffReflectStacks || 0) + n;
    grantStacks(ctx.player, 'heat', Math.max(1, Math.round(getP3(piece.params, 1))), {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    petActivate(piece, ctx, 'ruby_egg');
  },
  onCooldownEffect(piece, ctx) {
    petActivate(piece, ctx, 'ruby_egg');
    ctx.player.debuffReflectStacks =
      (ctx.player.debuffReflectStacks || 0) + Math.max(1, Math.round(getP1(piece.params, 1)));
    grantStacks(ctx.player, 'heat', Math.max(1, Math.round(getP3(piece.params, 1))), {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    return true;
  },
};

/** EmeraldEgg.gd */
/** @type {ScriptHandler} */
export const emeraldEggPort = {
  handlerId: 'emerald_egg',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    grantStacks(ctx.player, 'lucky', Math.max(1, Math.round(getP1(piece.params, 1))), {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    petActivate(piece, ctx, 'emerald_egg');
  },
  onCooldownEffect(piece, ctx) {
    petActivate(piece, ctx, 'emerald_egg');
    grantStacks(ctx.player, 'lucky', Math.max(1, Math.round(getP1(piece.params, 1))), {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    return true;
  },
};

/** SapphireEgg.gd */
/** @type {ScriptHandler} */
export const sapphireEggPort = {
  handlerId: 'sapphire_egg',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    grantStacks(ctx.player, 'mana', Math.max(1, Math.round(getP1(piece.params, 1))), {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    petActivate(piece, ctx, 'sapphire_egg');
  },
  onCooldownEffect(piece, ctx) {
    petActivate(piece, ctx, 'sapphire_egg');
    grantStacks(ctx.player, 'mana', Math.max(1, Math.round(getP1(piece.params, 1))), {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    return true;
  },
};

export const AM_EGG_PORTS = {
  ruby_egg: rubyEggPort,
  emerald_egg: emeraldEggPort,
  sapphire_egg: sapphireEggPort,
};

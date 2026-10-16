/**
 * Band AM — gem eggs (pet-like start and source-defined effects).
 */

import { grantStacks } from '../buff-economy.js';
import { changeReflectStacks } from '../actor-stats.js';
import { getP1, getP3 } from '../params.js';
import { pushActivate } from './ports-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

function petActivate(piece, ctx, handler) {
  pushActivate(piece, ctx, handler, `Pet: ${piece.name}`);
}

/** RubyEgg.gd — start-of-battle only (no combat CD; hatch is shop-side). */
/** @type {ScriptHandler} */
export const rubyEggPort = {
  handlerId: 'ruby_egg',
  family: 'start_buff',
  onPreCombatStart(piece, ctx) {
    const n = Math.trunc(getP1(piece.params, 0));
    changeReflectStacks(ctx.player, n, ctx, piece);
  },
  onCombatStart(piece, ctx) {
    // doCooldownEffect(false) — heat + activate; reflect already from onPreCombatStart
    grantStacks(ctx.player, 'heat', Math.trunc(getP3(piece.params, 0)), {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    petActivate(piece, ctx, 'ruby_egg');
  },
};

/** EmeraldEgg.gd */
/** @type {ScriptHandler} */
export const emeraldEggPort = {
  handlerId: 'emerald_egg',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    grantStacks(ctx.player, 'lucky', Math.round(getP1(piece.params, 1)), {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    petActivate(piece, ctx, 'emerald_egg');
  },
  onCooldownEffect(piece, ctx) {
    grantStacks(ctx.player, 'lucky', Math.round(getP1(piece.params, 1)), {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    petActivate(piece, ctx, 'emerald_egg');
    return true;
  },
};

/** SapphireEgg.gd */
/** @type {ScriptHandler} */
export const sapphireEggPort = {
  handlerId: 'sapphire_egg',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    grantStacks(ctx.player, 'mana', getP1(piece.params, 0), {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    petActivate(piece, ctx, 'sapphire_egg');
  },
};

export const AM_EGG_PORTS = {
  ruby_egg: rubyEggPort,
  emerald_egg: emeraldEggPort,
  sapphire_egg: sapphireEggPort,
};

/**
 * Band AM — leftover gooberts (peer-activate, not stamina CD).
 */

import { grantStacks } from '../buff-economy.js';
import { getP2, getP3, getP4, getP5, getP6, getPName } from '../params.js';
import { getStackAmount, gainStacks } from '../stacks.js';
import {
  empowerLinkedWeapons,
  goobertHeal,
  goobertPeerTick,
  goobertPort,
} from './ports-wave-d-goobert.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/**
 * @param {string} handlerId
 * @param {(piece: object, ctx: import('./handlers.js').ScriptCtx) => void} effect
 * @returns {ScriptHandler}
 */
function variantGoobert(handlerId, effect) {
  return {
    handlerId,
    family: 'pet_like',
    onCombatStart(piece) {
      piece._goobertActs = 0;
    },
    onCooldownEffect() {
      return false;
    },
    onPeerActivated(listener, _activated, ctx) {
      goobertPeerTick(listener, ctx, () => effect(listener, ctx));
    },
  };
}

function healAmt(piece) {
  return Math.max(1, Math.round(getPName(piece.params, 'heal', getP2(piece.params, 8))));
}

function rainbowCore(piece, ctx, handler, extra) {
  const block = Math.max(1, Math.round(piece.blockGrant || getPName(piece.params, 'block', 8)));
  gainStacks(ctx.player, 'block', block);
  goobertHeal(piece, ctx, handler, healAmt(piece));
  const vamp = Math.max(1, Math.round(getPName(piece.params, 'vampirism', getP3(piece.params, 1))));
  grantStacks(ctx.player, 'vampirism', vamp, {
    originKey: piece.placementKey,
    originId: piece.itemId,
  });
  extra();
}

/** PoisonGoobert.gd */
const poisonGoobertPort = variantGoobert('poison_goobert', (piece, ctx) => {
  goobertHeal(piece, ctx, 'poison_goobert', healAmt(piece));
  grantStacks(ctx.dummy, 'poison', Math.max(1, Math.round(getP3(piece.params, 1))), {
    originKey: piece.placementKey,
    originId: piece.itemId,
  });
});

/** ChiliGoobert.gd */
const chiliGoobertPort = variantGoobert('chili_goobert', (piece, ctx) => {
  goobertHeal(piece, ctx, 'chili_goobert', healAmt(piece));
  grantStacks(ctx.player, 'heat', Math.max(1, Math.round(getP3(piece.params, 1))), {
    originKey: piece.placementKey,
    originId: piece.itemId,
  });
});

/** BroccoliGoobert.gd — no heal; lucky vs regen. */
const broccoliGoobertPort = variantGoobert('broccoli_goobert', (piece, ctx) => {
  const need = Math.max(1, Math.round(getPName(piece.params, 'luckt', 5)));
  if ((getStackAmount(ctx.player, 'lucky') || 0) >= need) {
    grantStacks(ctx.player, 'regeneration', Math.max(1, Math.round(getPName(piece.params, 'regen', 2))), {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
  } else {
    grantStacks(ctx.player, 'lucky', Math.max(1, Math.round(getPName(piece.params, 'luck', 1))), {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
  }
});

/** ToastGoobert.gd */
const toastGoobertPort = variantGoobert('toast_goobert', (piece, ctx) => {
  const th = getPName(piece.params, 'staminat', 4);
  const stam = getPName(piece.params, 'stamina', 2);
  if ((Number(ctx.player.stamina) || 0) < th) {
    ctx.player.stamina = Math.min(
      Number(ctx.player.maxStamina) || 20,
      (Number(ctx.player.stamina) || 0) + stam,
    );
  } else {
    grantStacks(ctx.player, 'regeneration', Math.max(1, Math.round(getPName(piece.params, 'regen', 2))), {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
  }
});

/** RainbowGoobert.gd */
const rainbowGoobertPort = variantGoobert('rainbow_goobert', (piece, ctx) => {
  rainbowCore(piece, ctx, 'rainbow_goobert', () => {
    const n = Math.max(1, Math.round(getP4(piece.params, 1)));
    grantStacks(ctx.dummy, 'blind', n, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    grantStacks(ctx.dummy, 'poison', n, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    empowerLinkedWeapons(piece, ctx, 'rainbow_goobert', getP5(piece.params, 2));
  });
});

/** RainbowGoobertPyromancer.gd */
const rainbowGoobertPyromancerPort = variantGoobert('rainbow_goobert_pyromancer', (piece, ctx) => {
  rainbowCore(piece, ctx, 'rainbow_goobert_pyromancer', () => {
    grantStacks(ctx.player, 'heat', Math.max(1, Math.round(getP4(piece.params, 1))), {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    grantStacks(ctx.dummy, 'blind', Math.max(1, Math.round(getPName(piece.params, 'blind', 1))), {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    empowerLinkedWeapons(piece, ctx, 'rainbow_goobert_pyromancer', getP5(piece.params, 2));
  });
});

/** RainbowGoobertAdventurer.gd */
const rainbowGoobertAdventurerPort = variantGoobert('rainbow_goobert_adventurer', (piece, ctx) => {
  rainbowCore(piece, ctx, 'rainbow_goobert_adventurer', () => {
    grantStacks(ctx.player, 'regeneration', Math.max(1, Math.round(getP4(piece.params, 1))), {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    grantStacks(ctx.dummy, 'blind', Math.max(1, Math.round(getP5(piece.params, 1))), {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    empowerLinkedWeapons(piece, ctx, 'rainbow_goobert_adventurer', getP6(piece.params, 2));
  });
});

/** RainbowGoobertEngineer.gd */
const rainbowGoobertEngineerPort = variantGoobert('rainbow_goobert_engineer', (piece, ctx) => {
  rainbowCore(piece, ctx, 'rainbow_goobert_engineer', () => {
    const stam = getPName(piece.params, 'stamina', 2);
    ctx.player.stamina = Math.min(
      Number(ctx.player.maxStamina) || 20,
      (Number(ctx.player.stamina) || 0) + stam,
    );
    grantStacks(ctx.player, 'regeneration', Math.max(1, Math.round(getPName(piece.params, 'regen', 1))), {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    grantStacks(ctx.dummy, 'blind', Math.max(1, Math.round(getPName(piece.params, 'blind', 1))), {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    empowerLinkedWeapons(
      piece,
      ctx,
      'rainbow_goobert_engineer',
      getPName(piece.params, 'dambonus', 2),
    );
  });
});

export const AM_GOOBERT_PORTS = {
  // Goobling.tscn reuses Goobert.gd; retain its catalog identity for source
  // inventory/ledger ownership instead of reporting the generic base id.
  goobling: { ...goobertPort, handlerId: 'goobling' },
  poison_goobert: poisonGoobertPort,
  chili_goobert: chiliGoobertPort,
  broccoli_goobert: broccoliGoobertPort,
  toast_goobert: toastGoobertPort,
  rainbow_goobert: rainbowGoobertPort,
  rainbow_goobert_pyromancer: rainbowGoobertPyromancerPort,
  rainbow_goobert_adventurer: rainbowGoobertAdventurerPort,
  rainbow_goobert_engineer: rainbowGoobertEngineerPort,
};

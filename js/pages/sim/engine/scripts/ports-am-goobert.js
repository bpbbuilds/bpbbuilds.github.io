/**
 * Band AM — leftover gooberts (peer-activate, not stamina CD).
 */

import { grantStacks } from '../buff-economy.js';
import { giveStamina, healActor } from '../actor.js';
import { getP, getP2, getP3, getP4, getP5, getP6, getPName } from '../params.js';
import { getStackAmount, gainStacks } from '../stacks.js';
import {
  empowerLinkedWeapons,
  goobertHeal,
  goobertPeerTick,
  goobertPort,
} from './ports-wave-d-goobert.js';
import { pushActivate } from './ports-util.js';
import { eventSideForPiece } from '../vs-board.js';

// `empowerLinkedWeapons` applies the source addBonusDamage mutation to linked weapons.

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
    onPrepare(piece) {
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
  return getPName(piece.params, 'heal', getP2(piece.params, 0));
}

function rainbowCore(piece, ctx, handler, extra) {
  const block = Number(piece.block ?? ctx.itemsById.get(piece.itemId)?.block) || 0;
  if (block > 0) gainStacks(ctx.player, 'block', block);
  goobertHeal(piece, ctx, handler, healAmt(piece), { activate: false });
  const vamp = getPName(piece.params, 'vampirism', getP3(piece.params, 0));
  if (vamp > 0) {
    grantStacks(ctx.player, 'vampirism', vamp, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
  }
  extra();
  pushActivate(piece, ctx, handler, `Pet: ${piece.name}`);
}

/** PoisonGoobert.gd */
const poisonGoobertPort = variantGoobert('poison_goobert', (piece, ctx) => {
  goobertHeal(piece, ctx, 'poison_goobert', healAmt(piece), { activate: false });
  grantStacks(ctx.dummy, 'poison', Math.max(1, Math.round(getP3(piece.params, 1))), {
    originKey: piece.placementKey,
    originId: piece.itemId,
  });
  pushActivate(piece, ctx, 'poison_goobert', `Pet: ${piece.name}`);
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
  const th = getPName(piece.params, 'staminat', getP2(piece.params, 4));
  const stam = getPName(piece.params, 'stamina', getP3(piece.params, 2));
  const regen = Math.trunc(getPName(piece.params, 'regen', getP4(piece.params, 2)));
  if ((Number(ctx.player.stamina) || 0) < th) {
    giveStamina(ctx.player, stam);
    if (stam > 0) {
      ctx.events.push({
        t: ctx.t,
        type: 'stamina',
        actor: eventSideForPiece(piece),
        target: eventSideForPiece(piece),
        amount: stam,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${stam} stamina`,
        meta: { category: 'stamina', kind: 'gained', script: true, handler: 'toast_goobert' },
      });
    }
  } else if (regen) {
    grantStacks(ctx.player, 'regeneration', regen, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
  }
  pushActivate(piece, ctx, 'toast_goobert', `Pet: ${piece.name}`);
});

/** RainbowGoobert.gd */
const rainbowGoobertPort = variantGoobert('rainbow_goobert', (piece, ctx) => {
  const { player, dummy, events, itemsById, t, rng } = ctx;
  const block = Number(piece.block ?? itemsById.get(piece.itemId)?.block) || 0;
  if (block > 0) {
    gainStacks(player, 'block', block, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
  }
  const heal = getPName(piece.params, 'heal', getP2(piece.params, 0));
  const healed = healActor(player, heal);
  if (healed > 0) {
    events.push({
      t: t + 0.003,
      type: 'heal',
      actor: 'player',
      target: 'player',
      amount: healed,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: heal +${healed}`,
      meta: { category: 'heal', script: true, handler: 'rainbow_goobert' },
    });
  }
  const vampirism = getP3(piece.params, 0);
  if (vampirism > 0) {
    grantStacks(player, 'vampirism', vampirism, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
  }
  const debuff = getP4(piece.params, 0);
  if (debuff > 0) {
    gainStacks(dummy, 'blind', debuff, { rng, opponent: player });
    gainStacks(dummy, 'poison', debuff, { rng, opponent: player });
  }
  empowerLinkedWeapons(piece, ctx, 'rainbow_goobert', getP5(piece.params, 0));
  pushActivate(piece, ctx, 'rainbow_goobert', `Pet: ${piece.name}`);
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
    const regen = getP4(piece.params, 0);
    if (regen > 0) {
      grantStacks(ctx.player, 'regeneration', regen, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    const blind = getP5(piece.params, 0);
    if (blind > 0) {
      grantStacks(ctx.dummy, 'blind', blind, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    empowerLinkedWeapons(piece, ctx, 'rainbow_goobert_adventurer', getP6(piece.params, 0));
  });
});

/** RainbowGoobertEngineer.gd */
const rainbowGoobertEngineerPort = variantGoobert('rainbow_goobert_engineer', (piece, ctx) => {
  const { player, dummy, itemsById, rng } = ctx;
  const block = Number(piece.block ?? itemsById.get(piece.itemId)?.block) || 0;
  if (block > 0) gainStacks(player, 'block', block);
  goobertHeal(piece, ctx, 'rainbow_goobert_engineer', healAmt(piece), { activate: false });

  const stamina = getPName(piece.params, 'stamina', getP6(piece.params, 0));
  if (stamina > 0) giveStamina(player, stamina);

  const vamp = getPName(piece.params, 'vampirism', getP3(piece.params, 0));
  if (vamp > 0) {
    grantStacks(player, 'vampirism', vamp, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
  }

  const regen = getPName(piece.params, 'regen', getP4(piece.params, 0));
  if (regen > 0) {
    grantStacks(player, 'regeneration', regen, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
  }

  const blind = getPName(piece.params, 'blind', getP5(piece.params, 0));
  if (blind > 0) gainStacks(dummy, 'blind', blind, { rng, opponent: player });

  empowerLinkedWeapons(
    piece,
    ctx,
    'rainbow_goobert_engineer',
    getPName(piece.params, 'dambonus', getP(piece.params, 6, 0)),
  );
  pushActivate(piece, ctx, 'rainbow_goobert_engineer', `Pet: ${piece.name}`);
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

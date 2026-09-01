/**
 * Band AP 250 — leftover aura / food / link MAP items → `.gd` ports.
 */

import { healActor } from '../actor.js';
import { useMana } from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { addBonusDamage, addSpeed } from '../piece-stats.js';
import { getStackAmount } from '../stacks.js';
import { canBeEmpoweredPiece } from './food-helpers.js';
import { itemHasType, pushActivate } from './ports-util.js';
import { weaponStrike } from './ports-wave-c-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

function origin(piece) {
  return { originKey: piece.placementKey, originId: piece.itemId };
}

function linked(ctx, piece, color) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  return (ctx.pieces || []).filter((o) =>
    links.some((l) => l.key === o.placementKey && (!color || l.color === color)),
  );
}

function auraDamage(ctx, piece, amount, pred) {
  const n = Math.max(0, Number(amount) || 0);
  if (!n) return;
  for (const o of linked(ctx, piece)) {
    if (pred && !pred(o)) continue;
    addBonusDamage(o, n);
  }
}

/** HeroSword.gd — dam aura on empowerable stars; Weapon CD. */
const heroSwordPort = {
  handlerId: 'hero_sword',
  family: 'synergy_aura',
  onCombatStart(piece, ctx) {
    auraDamage(ctx, piece, getPName(piece.params, 'dam', getP1(piece.params, 1)), (o) =>
      canBeEmpoweredPiece(o),
    );
    pushActivate(piece, ctx, 'hero_sword', `Weapon: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'hero_sword');
  },
};

/** Crossblades.gd — primary dam / secondary speed; on-hit self perm dam+speed; strike. */
const crossbladesPort = {
  handlerId: 'crossblades',
  family: 'synergy_aura',
  onCombatStart(piece, ctx) {
    const dam = getPName(piece.params, 'dambuff', getP1(piece.params, 10));
    for (const o of linked(ctx, piece, 'primary')) {
      if (canBeEmpoweredPiece(o)) addBonusDamage(o, dam);
    }
    const spd = getPName(piece.params, 'speedbuff', getP2(piece.params, 65)) / 100;
    for (const o of linked(ctx, piece, 'secondary')) {
      if ((Number(o.cooldown) || 0) > 0 && (Number(o.cooldown) || 0) < 500) addSpeed(o, spd);
    }
    pushActivate(piece, ctx, 'crossblades', `Weapon: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'crossblades');
  },
  onPreDealDamageEarly(piece, _ctx, res) {
    if (res && !res.hit) return;
    addBonusDamage(piece, getPName(piece.params, 'damincrease', getP3(piece.params, 1)));
    addSpeed(piece, getPName(piece.params, 'speedincrease', getP4(piece.params, 4)) / 100);
  },
};

/** ShepherdsCrook.gd — buff cleanse-protect + blind/cold resist; dam aura; no weapon CD. */
const shepherdsCrookPort = {
  handlerId: 'shepherds_crook',
  family: 'synergy_aura',
  onCombatStart(piece, ctx) {
    const prot = Number(piece.chance) || Number(ctx.itemsById.get(piece.itemId)?.chance) || 35;
    ctx.player.buffCleanseProtectChance = (Number(ctx.player.buffCleanseProtectChance) || 0) + prot;
    const resist =
      Number(piece.chance2) || Number(ctx.itemsById.get(piece.itemId)?.chance2) || 50;
    ctx.player.stackResist = ctx.player.stackResist || {};
    ctx.player.stackResist.blind = (Number(ctx.player.stackResist.blind) || 0) + resist;
    ctx.player.stackResist.cold = (Number(ctx.player.stackResist.cold) || 0) + resist;
    auraDamage(ctx, piece, getPName(piece.params, 'dam', getP1(piece.params, 2)), (o) =>
      canBeEmpoweredPiece(o),
    );
    pushActivate(piece, ctx, 'shepherds_crook', `Accessory: ${piece.name}`);
  },
};

/** Mananana.gd — if mana ≥ manat: spend, heal, stamina; always activate; repeating food CD. */
const manananaPort = {
  handlerId: 'mananana',
  family: 'food',
  onCooldownEffect(piece, ctx) {
    const need = Math.max(1, Math.round(getPName(piece.params, 'manat', getP1(piece.params, 2))));
    if (getStackAmount(ctx.player, 'mana') >= need) {
      useMana(ctx.player, need, origin(piece));
      const heal = Math.max(1, Math.round(getPName(piece.params, 'heal', getP2(piece.params, 10))));
      const got = healActor(ctx.player, heal);
      if (got > 0) {
        ctx.events.push({
          t: ctx.t + 0.002,
          type: 'heal',
          target: 'player',
          amount: got,
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          label: `${piece.name}: +${got} HP`,
          meta: { category: 'heal', script: true, handler: 'mananana' },
        });
      }
      const stam = Math.max(1, Math.round(getPName(piece.params, 'stamina', getP3(piece.params, 2))));
      ctx.player.stamina = Math.min(
        Number(ctx.player.maxStamina) || 20,
        (Number(ctx.player.stamina) || 0) + stam,
      );
      ctx.events.push({
        t: ctx.t + 0.003,
        type: 'stamina',
        amount: stam,
        label: `${piece.name}: +${stam} stamina`,
        meta: { category: 'stamina', script: true, handler: 'mananana' },
      });
    }
    pushActivate(piece, ctx, 'mananana', `Food: ${piece.name}`);
    return true;
  },
};

/** Pan.gd — pre-combat +dam × food stars; Weapon CD. */
const panPort = {
  handlerId: 'pan',
  family: 'weapon_base',
  onPreCombatStart(piece, ctx) {
    const n = linked(ctx, piece).filter((o) => itemHasType(ctx.itemsById.get(o.itemId), 'food'))
      .length;
    addBonusDamage(piece, getP1(piece.params, 1) * n);
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'pan');
  },
};

export const AP_AURA_PORTS = {
  hero_sword: heroSwordPort,
  crossblades: crossbladesPort,
  shepherds_crook: shepherdsCrookPort,
  mananana: manananaPort,
  pan: panPort,
};

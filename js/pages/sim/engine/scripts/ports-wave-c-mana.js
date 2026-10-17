/**
 * Band AE Wave C — mana-spend weapons (AG 204–206 deepen).
 */

import {
  BUFF_KEYS,
  giveMostBuffs,
  grantStacks,
  onBuffChanged,
  spendStacks,
  useMana,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getP4, getP5, getPName } from '../params.js';
import {
  addBonusDamage,
  addSpeed,
  changeVaryingDamageFromBuffChange,
} from '../piece-stats.js';
import { dealHit, stealLife } from './handlers.js';
import { weaponStrike } from './ports-wave-c-util.js';
import { getStackAmount } from '../stacks.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** MagicStaff.gd — mana → temp dam this swing + perm bonus. */
/** @type {ScriptHandler} */
export const magicStaffPort = {
  handlerId: 'magic_staff',
  family: 'on_hit',
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'magic_staff', {
      onPreDealDamageEarly(res) {
        const cost = Number(getP1(piece.params, 2));
        if (!Number.isFinite(cost)) return;
        if (cost > 0 && (ctx.player.stacks.mana || 0) < cost) return;
        if (cost > 0 && useMana(ctx.player, cost, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        }).spent <= 0) {
          return;
        }
        const temp = Number(getP2(piece.params, 4));
        const perm = Number(getP3(piece.params, 1));
        if (perm) addBonusDamage(piece, perm);
        ctx.events.push({
          t: ctx.t + 0.008,
          type: 'buff',
          label: `${piece.name}: mana → +${temp}/${perm} dmg`,
          meta: { category: 'buff', script: true, handler: 'magic_staff' },
        });
        res.damage = (Number(res.damage) || 0) + (Number.isFinite(temp) ? temp : 0);
      },
    });
  },
};

/** SpectralDagger.gd — on hit mana → bonus spectral (ignore block). */
/** @type {ScriptHandler} */
export const spectralDaggerPort = {
  handlerId: 'spectral_dagger',
  family: 'on_hit',
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'spectral_dagger');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit || piece._spectralSwing) return;
    const cost = Math.max(1, Math.round(getP1(piece.params, 2)));
    if (
      useMana(ctx.player, cost, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      }).spent <= 0
    ) {
      return;
    }
    const bonus = Math.max(1, Math.round(getP2(piece.params, 4)));
    piece._spectralSwing = true;
    dealHit(piece, ctx, bonus, `${piece.name}: spectral`, { ignoreBlock: true });
    piece._spectralSwing = false;
    ctx.events.push({
      t: ctx.t + 0.008,
      type: 'buff',
      label: `${piece.name}: spectral +${bonus}`,
      meta: { category: 'buff', script: true, handler: 'spectral_dagger' },
    });
  },
};

/** SpikedStaff.gd */
/** @type {ScriptHandler} */
export const spikedStaffPort = {
  handlerId: 'spiked_staff',
  family: 'on_hit',
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'spiked_staff');
  },
  onDealtDamage(piece, ctx) {
    const cost = Math.max(1, Math.round(getPName(piece.params, 'mana', getP1(piece.params, 2))));
    if (
      useMana(ctx.player, cost, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      }).spent <= 0
    ) {
      return;
    }
    const emp = Math.max(1, Math.round(getPName(piece.params, 'empower', getP2(piece.params, 1))));
    grantStacks(ctx.player, 'empower', emp, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    if (ctx.player.battleRage) {
      const spikes = Math.max(1, Math.round(getPName(piece.params, 'spikes', getP3(piece.params, 1))));
      grantStacks(ctx.player, 'spikes', spikes, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    ctx.events.push({
      t: ctx.t + 0.008,
      type: 'buff',
      target: 'player',
      amount: emp,
      label: `${piece.name}: +${emp} Empower`,
      meta: { category: 'buff', stack: 'empower', script: true, handler: 'spiked_staff' },
    });
  },
};

/** StaffofFire.gd */
/** @type {ScriptHandler} */
export const staffOfFirePort = {
  handlerId: 'staff_of_fire',
  family: 'on_hit',
  onPrepare(piece) {
    piece._fireActs = 0;
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'staff_of_fire');
  },
  onPreDealDamageEarly(piece, ctx) {
    const heatCost = Math.trunc(getPName(piece.params, 'heat', getP2(piece.params, 0)));
    const manaCost = Math.trunc(getPName(piece.params, 'mana', getP1(piece.params, 0)));
    if (getStackAmount(ctx.player, 'heat') < heatCost) return;
    if (getStackAmount(ctx.player, 'mana') < manaCost) return;
    useMana(ctx.player, manaCost, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    spendStacks(ctx.player, 'heat', heatCost, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const dam = Math.trunc(getPName(piece.params, 'bonusdam', getP3(piece.params, 0)));
    addBonusDamage(piece, dam);
    piece._fireActs = (piece._fireActs || 0) + 1;
    ctx.events.push({
      t: ctx.t + 0.008,
      type: 'buff',
      label: `${piece.name}: +${dam} dmg`,
      meta: { category: 'buff', script: true, handler: 'staff_of_fire' },
    });
  },
};

/** CritwoodStaff.gd — mana → temp dam + timed party crit. */
/** @type {ScriptHandler} */
export const critwoodStaffPort = {
  handlerId: 'critwood_staff',
  family: 'on_hit',
  onPrepare(piece) {
    piece._critBuff = false;
    piece._critAffected = [];
    piece._critUntil = null;
    piece._tryCrownInvuln = (nowT) => {
      if (!piece._critBuff || piece._critUntil == null || nowT < piece._critUntil) return;
      for (const affected of piece._critAffected || []) {
        affected.critChance = Math.max(0, (Number(affected.critChance) || 0) - 100);
      }
      piece._critAffected = [];
      piece._critBuff = false;
      piece._critUntil = null;
    };
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'critwood_staff');
  },
  onPreDealDamageEarly(piece, ctx, damageRes) {
    const cost = Math.max(1, Math.round(getP1(piece.params, 3)));
    if ((ctx.player.stacks.mana || 0) < cost) return;
    if (!piece._critBuff) {
      piece._critAffected = [];
      for (const other of ctx.pieces || []) {
        piece._critAffected.push(other);
        other.critChance = (Number(other.critChance) || 0) + 100;
      }
      piece._critBuff = true;
    }
    useMana(ctx.player, cost, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const temp = Math.max(1, Math.round(getP2(piece.params, 5)));
    damageRes.damage = (Number(damageRes.damage) || 0) + temp;
    const dur = Math.max(0.5, getPName(piece.params, 'dur', 3));
    piece._critUntil = ctx.t + dur;
    ctx.events.push({
      t: ctx.t + 0.008,
      type: 'buff',
      label: `${piece.name}: crit buff +${temp}`,
      meta: { category: 'buff', script: true, handler: 'critwood_staff' },
    });
  },
};

/** CupcakeStaff.gd — mana → most buffs; buff deltas scale damage. */
function bindCupcakeBuff(piece, ctx) {
  const per = Number(getPName(piece.params, 'dam', getP3(piece.params, 1))) || 0;
  if (piece._cupcakeBuffBound) return;
  piece._cupcakeBuffBound = true;
  onBuffChanged(ctx.player, (ch) => {
    if (!per || !BUFF_KEYS.includes(String(ch.stack))) return;
    changeVaryingDamageFromBuffChange(piece, ch, per);
  });
}

/** @type {ScriptHandler} */
export const cupcakeStaffPort = {
  handlerId: 'cupcake_staff',
  family: 'on_hit',
  onPrepare(piece, ctx) {
    bindCupcakeBuff(piece, ctx);
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'cupcake_staff');
  },
  onPreDealDamageEarly(piece, ctx) {
    const need = Math.max(1, Math.round(getPName(piece.params, 'manat', getP1(piece.params, 3))));
    if ((ctx.player.stacks.mana || 0) < need) return;
    useMana(ctx.player, need, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const n = Math.max(1, Math.round(getPName(piece.params, 'buffs', getP2(piece.params, 1))));
    giveMostBuffs(ctx.player, n, ctx.rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    ctx.events.push({
      t: ctx.t + 0.008,
      type: 'buff',
      label: `${piece.name}: most buffs ×${n}`,
      meta: { category: 'buff', script: true, handler: 'cupcake_staff' },
    });
  },
};

/** JynxStaff.gd */
function jynxStaffTargets(ctx, piece) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  const hasExtractedRules = Boolean(ctx.canAffect?.rulesById);
  return (ctx.pieces || []).filter((other) => {
    if (piece.side != null && other.side !== piece.side) return false;
    if (!links.some((link) => link.key === other.placementKey)) return false;
    if (hasExtractedRules) return true;
    const item = ctx.itemsById.get(other.itemId) || other;
    const cooldown = Number(item.cooldown ?? other.cooldown);
    return cooldown > 0 && cooldown < 500;
  });
}

/** @type {ScriptHandler} */
export const jynxStaffPort = {
  handlerId: 'jynx_staff',
  family: 'on_hit',
  onPrepare(piece) {
    piece._jynxActs = 0;
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'jynx_staff');
  },
  onPreDealDamageEarly(piece, ctx, damageRes) {
    const cost = Math.trunc(getPName(piece.params, 'manat', getP1(piece.params, 0)));
    if (
      useMana(ctx.player, cost, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      }).spent <= 0
    ) {
      return;
    }
    const dam = getPName(piece.params, 'dam', getP2(piece.params, 0));
    addBonusDamage(piece, dam);
    if (damageRes) damageRes.damage = (Number(damageRes.damage) || 0) + dam;
    const maxActs = Math.trunc(getPName(piece.params, 'max', getP4(piece.params, 0)));
    const speed = getPName(piece.params, 'speed', getP3(piece.params, 0)) / 100;
    if ((piece._jynxActs || 0) < maxActs) {
      for (const other of jynxStaffTargets(ctx, piece)) addSpeed(other, speed);
      piece._jynxActs = (piece._jynxActs || 0) + 1;
    }
    const luckRm = Math.trunc(getPName(piece.params, 'luck', getP5(piece.params, 0)));
    if ((ctx.dummy.stacks.lucky || 0) > 0) {
      spendStacks(ctx.dummy, 'lucky', luckRm, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    ctx.events.push({
      t: ctx.t + 0.008,
      type: 'buff',
      label: `${piece.name}: mana spend`,
      meta: { category: 'buff', script: true, handler: 'jynx_staff' },
    });
  },
};

/** Manathirst.gd — onPrepare listens; one stealLife per mana gain that crosses getP1. */
/** @type {ScriptHandler} */
export const manathirstPort = {
  handlerId: 'manathirst',
  family: 'on_hit',
  onPreCombatStart(piece, ctx) {
    piece._manaGained = 0;
    if (piece._manathirstBound) return;
    piece._manathirstBound = true;
    // getP1() is `manat` (30). One crossing per mana event; leftover stays.
    const need = Math.max(
      1,
      Math.round(getPName(piece.params, 'manat', getP1(piece.params, 30))),
    );
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'mana' || !(ch.amount > 0)) return;
      piece._manaGained = (piece._manaGained || 0) + ch.amount;
      if ((piece._manaGained || 0) < need) return;
      piece._manaGained -= need;
      const dam = Number(getPName(piece.params, 'dam', getP2(piece.params, 10))) || 0;
      const vamp = Number(ctx.player.stacks.vampirism) || 0;
      const ls = Number(getPName(piece.params, 'lifesteal', getP3(piece.params, 100))) / 100;
      const now = Number(ctx.player._simT);
      if (Number.isFinite(now)) ctx.t = now;
      stealLife(piece, ctx, dam + vamp, ls);
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'manathirst');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    const mana = Math.round(getPName(piece.params, 'mana', getP4(piece.params, 2)));
    if (!(mana > 0)) return;
    grantStacks(ctx.player, 'mana', mana, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
  },
};

/** @type {Record<string, ScriptHandler>} */
export const WAVE_C_MANA_PORTS = {
  magic_staff: magicStaffPort,
  spectral_dagger: spectralDaggerPort,
  spiked_staff: spikedStaffPort,
  staff_of_fire: staffOfFirePort,
  critwood_staff: critwoodStaffPort,
  cupcake_staff: cupcakeStaffPort,
  jynx_staff: jynxStaffPort,
  manathirst: manathirstPort,
};

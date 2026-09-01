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
import { getP1, getP2, getP3, getPName } from '../params.js';
import { addBonusDamage, addBonusDamageFromBuffChange, addSpeed } from '../piece-stats.js';
import { healActor } from '../actor.js';
import { hasCombatCooldown } from './food-helpers.js';
import { dealHit } from './handlers.js';
import { weaponStrike } from './ports-wave-c-util.js';

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
      beforeDeal(raw) {
        const cost = Math.max(
          1,
          Math.round(getPName(piece.params, 'manat', getP1(piece.params, 2))),
        );
        if ((ctx.player.stacks.mana || 0) < cost) return raw;
        if (
          useMana(ctx.player, cost, {
            originKey: piece.placementKey,
            originId: piece.itemId,
          }).spent <= 0
        ) {
          return raw;
        }
        const temp = Math.max(
          0,
          Math.round(getPName(piece.params, 'dam_temp', getP2(piece.params, 4))),
        );
        const perm = Math.max(
          0,
          Math.round(getPName(piece.params, 'dam_perm', getP3(piece.params, 1))),
        );
        if (perm) addBonusDamage(piece, perm);
        ctx.events.push({
          t: ctx.t + 0.008,
          type: 'buff',
          label: `${piece.name}: mana → +${temp}/${perm} dmg`,
          meta: { category: 'buff', script: true, handler: 'magic_staff' },
        });
        return raw + temp;
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
  onCombatStart(piece) {
    piece._fireActs = 0;
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'staff_of_fire');
  },
  onDealtDamage(piece, ctx) {
    const heatCost = Math.max(1, Math.round(getP2(piece.params, 2)));
    const manaCost = Math.max(1, Math.round(getP1(piece.params, 2)));
    if ((ctx.player.stacks.heat || 0) < heatCost) return;
    if (
      useMana(ctx.player, manaCost, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      }).spent <= 0
    ) {
      return;
    }
    spendStacks(ctx.player, 'heat', heatCost, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const dam = Math.max(1, Math.round(getP3(piece.params, 2)));
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
  onCombatStart(piece) {
    piece._critBuff = false;
    piece._critSaved = [];
    piece._tryCrownInvuln = (nowT) => {
      if (!piece._critBuff || piece._critUntil == null || nowT < piece._critUntil) return;
      for (const s of piece._critSaved || []) {
        s.piece.critChance = s.critChance;
      }
      piece._critSaved = [];
      piece._critBuff = false;
      piece._critUntil = null;
    };
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'critwood_staff', {
      beforeDeal(raw) {
        const cost = Math.max(1, Math.round(getP1(piece.params, 3)));
        if ((ctx.player.stacks.mana || 0) < cost) return raw;
        useMana(ctx.player, cost, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
        const temp = Math.max(1, Math.round(getP2(piece.params, 5)));
        if (!piece._critBuff) {
          piece._critSaved = [];
          for (const other of ctx.pieces || []) {
            piece._critSaved.push({ piece: other, critChance: Number(other.critChance) || 0 });
            other.critChance = Math.max(Number(other.critChance) || 0, 100);
          }
          piece._critBuff = true;
        }
        const dur = Math.max(0.5, getPName(piece.params, 'dur', 3));
        piece._critUntil = ctx.t + dur;
        ctx.events.push({
          t: ctx.t + 0.008,
          type: 'buff',
          label: `${piece.name}: crit buff +${temp}`,
          meta: { category: 'buff', script: true, handler: 'critwood_staff' },
        });
        return raw + temp;
      },
    });
  },
};

/** CupcakeStaff.gd — mana → most buffs; buff deltas scale damage. */
/** @type {ScriptHandler} */
export const cupcakeStaffPort = {
  handlerId: 'cupcake_staff',
  family: 'on_hit',
  onCombatStart(piece, ctx) {
    const per = Number(getPName(piece.params, 'dam', getP3(piece.params, 1))) || 0;
    onBuffChanged(ctx.player, (ch) => {
      if (!per || !BUFF_KEYS.includes(String(ch.stack))) return;
      addBonusDamageFromBuffChange(piece, ch, per);
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'cupcake_staff');
  },
  onDealtDamage(piece, ctx) {
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
/** @type {ScriptHandler} */
export const jynxStaffPort = {
  handlerId: 'jynx_staff',
  family: 'on_hit',
  onCombatStart(piece) {
    piece._jynxActs = 0;
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'jynx_staff');
  },
  onDealtDamage(piece, ctx) {
    const cost = Math.max(1, Math.round(getPName(piece.params, 'manat', getP1(piece.params, 2))));
    if (
      useMana(ctx.player, cost, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      }).spent <= 0
    ) {
      return;
    }
    const dam = Math.max(1, Math.round(getPName(piece.params, 'dam', getP2(piece.params, 1))));
    addBonusDamage(piece, dam);
    const maxActs = Math.max(1, Math.round(getPName(piece.params, 'max', getP3(piece.params, 3))));
    const speed = getPName(piece.params, 'speed', 5) / 100;
    if ((piece._jynxActs || 0) < maxActs && speed) {
      const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
      for (const other of ctx.pieces || []) {
        if (!links.some((l) => l.key === other.placementKey)) continue;
        if (hasCombatCooldown(other)) addSpeed(other, speed);
      }
      piece._jynxActs = (piece._jynxActs || 0) + 1;
    }
    const luckRm = Math.max(0, Math.round(getPName(piece.params, 'luck', 1)));
    if (luckRm && (ctx.dummy.stacks.lucky || 0) > 0) {
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

/** Manathirst.gd — on-hit mana; any mana gain fills lifesteal meter. */
/** @type {ScriptHandler} */
export const manathirstPort = {
  handlerId: 'manathirst',
  family: 'on_hit',
  onCombatStart(piece, ctx) {
    piece._manaGained = 0;
    const need = Math.max(1, Math.round(getP1(piece.params, 5)));
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'mana' || !(ch.amount > 0)) return;
      piece._manaGained = (piece._manaGained || 0) + ch.amount;
      while ((piece._manaGained || 0) >= need) {
        piece._manaGained -= need;
        const ls = Math.max(1, Math.round(getPName(piece.params, 'dam', getP3(piece.params, 4))));
        const healed = healActor(ctx.player, ls + (ctx.player.stacks.vampirism || 0));
        if (healed > 0) {
          ctx.events.push({
            t: ctx.t + 0.008,
            type: 'heal',
            target: 'player',
            amount: healed,
            label: `${piece.name}: lifesteal +${healed}`,
            meta: { category: 'heal', script: true, handler: 'manathirst' },
          });
        }
      }
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'manathirst');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    const mana = Math.max(1, Math.round(getPName(piece.params, 'mana', getP2(piece.params, 1))));
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

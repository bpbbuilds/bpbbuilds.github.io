/**
 * Band AG 198–199 — Wave D hard weapons deepened vs .gd.
 */

import {
  cleanseRandomDebuffs,
  grantStacks,
  grantTemporaryStacks,
  inflictRandomDebuffs,
  onBuffChanged,
  spendStacks,
  stealRandomBuff,
  useMana,
  BUFF_KEYS,
} from '../buff-economy.js';
import { grantInvuln, grantStun, healActor, isInvulnerable } from '../actor.js';
import { affectedTargets } from '../board-graph.js';
import { emitPathCharge } from '../charge-delivery.js';
import { getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { addBonusDamage, addSpeed } from '../piece-stats.js';
import { gainStacks, getStackAmount } from '../stacks.js';
import { grantTimedSpeed, refreshTimedSpeed } from '../timed-speed.js';
import { deliverCharge } from '../charge-delivery.js';
import { itemHasType } from './ports-util.js';
import {
  countEmptyAffectCells,
  removeBuffsFraction,
  removeBlock,
  removeRandomBuffs,
  rollItemChance,
  stealBuffsFraction,
  weaponStrike,
} from './ports-wave-c-util.js';
import { rollPercent } from '../rng.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** @param {object} ctx @param {object} piece @param {string} type */
function countType(ctx, piece, type) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  let n = 0;
  for (const other of ctx.pieces || []) {
    if (!links.some((l) => l.key === other.placementKey)) continue;
    if (itemHasType(ctx.itemsById.get(other.itemId), type)) n += 1;
  }
  return n;
}

/** @param {object} ctx @param {object} piece @param {(id: string) => boolean} pred */
function countPred(ctx, piece, pred) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  let n = 0;
  for (const other of ctx.pieces || []) {
    if (!links.some((l) => l.key === other.placementKey)) continue;
    if (pred(other.itemId)) n += 1;
  }
  return n;
}

/** HolySpear.gd */
/** @type {ScriptHandler} */
export const holySpearPort = {
  handlerId: 'holy_spear',
  family: 'weapon_base',
  onCombatStart(piece, ctx) {
    const empty = countEmptyAffectCells(ctx, piece);
    const holy = countType(ctx, piece, 'holy');
    const slots = empty + holy;
    const per = Math.max(1, Math.round(getPName(piece.params, 'blockremoval', getP1(piece.params, 2))));
    piece._blockStrip = per * slots;
    piece._cleanses = slots;
    piece._spearState = 'Inactive';
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'holy_spear');
  },
  onDealtDamage(piece, ctx, hit) {
    if (hit?.hit) {
      if (piece._blockStrip) removeBlock(ctx.dummy, piece._blockStrip, ctx, piece);
      const n = Math.max(0, piece._cleanses || 0);
      if (n) {
        cleanseRandomDebuffs(ctx.player, n, ctx.rng, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      }
    }
    if (piece._spearState !== 'Inactive') return;
    if (isInvulnerable(ctx.player, ctx.t)) return;
    const need = Math.max(1, Math.round(getPName(piece.params, 'manat', getP2(piece.params, 4))));
    if ((ctx.player.stacks.mana || 0) < need) return;
    useMana(ctx.player, need, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const dur = Math.max(0.5, getPName(piece.params, 'dur_invu', getPName(piece.params, 'dur_invuln', 1)));
    grantInvuln(ctx.player, dur, ctx.t);
    const speed = getPName(piece.params, 'speed', getP3(piece.params, 10)) / 100;
    grantTimedSpeed(piece, speed, ctx.t + dur, 'holy_spear');
    piece._spearState = 'Used';
  },
};

/** Automanaton.gd */
/** @type {ScriptHandler} */
export const automanatonPort = {
  handlerId: 'automanaton',
  family: 'on_hit',
  onCombatStart(piece) {
    piece._autoLowHp = false;
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'automanaton');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    const cost = Math.max(1, Math.round(getPName(piece.params, 'manat', getPName(piece.params, 'mana', 2))));
    if ((ctx.player.stacks.mana || 0) >= cost) {
      useMana(ctx.player, cost, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      const blind = Math.max(1, Math.round(getPName(piece.params, 'blind', 1)));
      const durBlind = Math.max(0.5, getPName(piece.params, 'dur_blind', 2));
      grantTemporaryStacks(ctx.dummy, 'blind', blind, durBlind, ctx.t, {
        originKey: piece.placementKey,
        originId: piece.itemId,
        rng: ctx.rng,
        opponent: ctx.player,
      });
      if (rollItemChance(piece, ctx.rng)) {
        grantStun(ctx.dummy, Math.max(0.5, getPName(piece.params, 'dur_stun', 1)), ctx.t);
      }
      const cleanse = Math.max(1, Math.round(getPName(piece.params, 'cleanse', 1)));
      cleanseRandomDebuffs(ctx.player, cleanse, ctx.rng, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    const thresh = getPName(piece.params, 'healtht', 50) / 100;
    const rel = ctx.player.maxHp > 0 ? ctx.player.hp / ctx.player.maxHp : 1;
    if (!piece._autoLowHp && rel < thresh) {
      piece._autoLowHp = true;
      const speed = getPName(piece.params, 'speed', 10) / 100;
      const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
      for (const other of ctx.pieces || []) {
        if (!links.some((l) => l.key === other.placementKey)) continue;
        grantTimedSpeed(other, speed, ctx.t + Math.max(1, getPName(piece.params, 'dur_dmgreduction', 3)), 'automanaton');
      }
      const resistDur = Math.max(1, getPName(piece.params, 'dur_dmgreduction', 3));
      ctx.player.damageResistancePct = (ctx.player.damageResistancePct || 0) + getPName(piece.params, 'dmgreduction', 20);
      piece._autoResistUntil = ctx.t + resistDur;
      piece._onTimedSpeedEnd = (tag) => {
        if (tag === 'automanaton' && piece._autoResistUntil && ctx.t >= piece._autoResistUntil) {
          ctx.player.damageResistancePct = Math.max(
            0,
            (ctx.player.damageResistancePct || 0) - getPName(piece.params, 'dmgreduction', 20),
          );
        }
      };
      gainStacks(ctx.player, 'block', Math.max(1, Math.round(getP2(piece.params, 4))));
    }
  },
};

/** Bazooka.gd */
/** @type {ScriptHandler} */
export const bazookaPort = {
  handlerId: 'bazooka',
  family: 'on_hit',
  onCombatStart(piece) {
    piece._bazoUses = 0;
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'bazooka');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    const max = Math.max(1, Math.round(getPName(piece.params, 'max', 3)));
    if ((piece._bazoUses || 0) >= max) return;
    const need = Math.max(1, Math.round(getPName(piece.params, 'heatt', getP1(piece.params, 3))));
    if ((ctx.player.stacks.heat || 0) < need) return;
    spendStacks(ctx.player, 'heat', need, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    piece._bazoUses = (piece._bazoUses || 0) + 1;
    const luck = Math.max(1, Math.round(getPName(piece.params, 'luck', 1)));
    grantStacks(ctx.player, 'lucky', luck, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    gainStacks(ctx.player, 'block', Math.max(1, Math.round(getP2(piece.params, 4))));
    grantStun(ctx.dummy, Math.max(0.5, getPName(piece.params, 'dur_stun', 1)), ctx.t);
    grantStun(ctx.player, Math.max(0.5, getPName(piece.params, 'dur_stunself', 0.5)), ctx.t);
    const luckt = Math.max(1, Math.round(getPName(piece.params, 'luckt', 3)));
    if ((ctx.player.stacks.lucky || 0) >= luckt) {
      piece._stunResist = true;
    }
  },
};

/** Chainsaw.gd */
/** @type {ScriptHandler} */
export const chainsawPort = {
  handlerId: 'chainsaw',
  family: 'on_hit',
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'chainsaw');
  },
  onPrepare(piece) {
    piece._chainsawCharged = false;
  },
  onChargeReceived(piece) {
    piece._chainsawCharged = true;
  },
  onPreDealDamageEarly(piece, ctx, damageRes) {
    if (!damageRes?.hit) return;
    const fraction = Math.max(0, getPName(piece.params, 'buffs', 5) / 100);
    const limit = 1000;
    if ((piece.numCharges || 0) > 0) {
      stealBuffsFraction(ctx.dummy, ctx.player, fraction, limit, ctx.rng, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    } else {
      removeBuffsFraction(ctx.dummy, fraction, limit, ctx.rng, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    // Item.reduceSpeed() mutates the saw's own speed scale, not the
    // opponent actor. The modifier persists after the successful hit.
    addSpeed(piece, -getPName(piece.params, 'slow', 5) / 100);
  },
};

/** CupcakeDragon.gd */
/** @type {ScriptHandler} */
export const cupcakeDragonPort = {
  handlerId: 'cupcake_dragon',
  family: 'on_hit',
  onCombatStart(piece, ctx) {
    const n = countType(ctx, piece, 'food');
    const speed = getPName(piece.params, 'speed', 10) / 100;
    if (n && speed) addSpeed(piece, n * speed);
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'cupcake_dragon');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    const removeN = Math.max(1, Math.round(getPName(piece.params, 'remove', 1)));
    removeRandomBuffs(ctx.dummy, removeN, ctx.rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const gainN = Math.max(1, Math.round(getPName(piece.params, 'gain', 1)));
    const pool = BUFF_KEYS.filter((k) => getStackAmount(ctx.dummy, /** @type {any} */ (k)) > 0);
    if (!pool.length) return;
    const choice = pool[Math.floor(ctx.rng() * pool.length)] || pool[0];
    grantStacks(ctx.player, choice, gainN, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
  },
};

/** PrismaticSword.gd */
/** @type {ScriptHandler} */
export const prismaticSwordPort = {
  handlerId: 'prismatic_sword',
  family: 'on_hit',
  onCombatStart(piece, ctx) {
    const magic = countType(ctx, piece, 'magic');
    const holy = countType(ctx, piece, 'holy');
    const dark = countType(ctx, piece, 'dark');
    const vamp = countType(ctx, piece, 'vampiric') || countType(ctx, piece, 'vamp');
    const speed = getPName(piece.params, 'speed', 5) / 100;
    if (magic) addSpeed(piece, speed * magic);
    piece._prismHoly = holy;
    piece._prismDark = dark;
    piece._prismVamp = vamp;
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'prismatic_sword');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    const damPer = Math.max(1, Math.round(getPName(piece.params, 'dam', 2)));
    if (piece._prismHoly) addBonusDamage(piece, damPer * piece._prismHoly);
    if (piece._prismDark && rollPercent(Math.min(100, 15 * piece._prismDark), ctx.rng)) {
      const n = Math.max(1, Math.round(getPName(piece.params, 'debuffs', 1)));
      inflictRandomDebuffs(ctx.dummy, n, ctx.rng, {
        originKey: piece.placementKey,
        originId: piece.itemId,
        opponent: ctx.player,
      });
    }
    const ls = getPName(piece.params, 'lifesteal', 10) / 100;
    const mult = Math.max(1, piece._prismVamp || 1);
    const healed = healActor(ctx.player, Math.ceil((hit.healthDamage || 0) * ls * mult));
    if (healed > 0) {
      ctx.events.push({
        t: ctx.t + 0.008,
        type: 'heal',
        target: 'player',
        amount: healed,
        label: `${piece.name}: lifesteal +${healed}`,
        meta: { category: 'heal', script: true, handler: 'prismatic_sword' },
      });
    }
  },
};

/** StoneGolem.gd */
function activateStoneGolem(piece, ctx) {
  if (piece._stoneRegenDone) return;
  const need = Math.max(
    1,
    Math.round(getPName(piece.params, 'regen', getPName(piece.params, 'regent', getP2(piece.params, 3)))),
  );
  if (getStackAmount(ctx.player, 'regeneration') < need) return;
  const used = spendStacks(ctx.player, 'regeneration', need, {
    originKey: piece.placementKey,
    originId: piece.itemId,
  });
  if (used.spent < need) return;

  // StoneGolem.gd uses getBlock() (the item's tooltip Block value), not p3.
  const block = Math.max(1, Math.round(Number(piece.blockGrant) || 0));
  grantStacks(ctx.player, 'block', block, {
    originKey: piece.placementKey,
    originId: piece.itemId,
  });
  const cd = getP4(piece.params, 0);
  if (cd > 0) {
    piece.baseCooldown = cd;
    piece.cooldown = cd;
  }
  piece._stoneRegenDone = true;
}

/** @type {ScriptHandler} */
export const stoneGolemPort = {
  handlerId: 'stone_golem',
  family: 'on_hit',
  onPrepare(piece, ctx) {
    // StoneGolem.gd connects during onPrepare, before any combat-start effects
    // can grant Regeneration.
    piece._stoneRegenDone = false;
    onBuffChanged(ctx.player, (change) => {
      if (change.stack === 'regeneration' && change.amount > 0) {
        activateStoneGolem(piece, ctx);
      }
    });
  },
  onCombatStart(piece, ctx) {
    const n = countPred(ctx, piece, (id) => /bag_of_stones|stone_bag/i.test(id));
    const per = Math.max(1, Math.round(getPName(piece.params, 'bonusdam', getP1(piece.params, 1))));
    if (n) addBonusDamage(piece, n * per);
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'stone_golem');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    const emp = Math.max(1, Math.round(getPName(piece.params, 'empower', 1)));
    grantStacks(ctx.player, 'empower', emp, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    if (rollItemChance(piece, ctx.rng)) {
      grantStun(ctx.dummy, Math.max(0.5, getPName(piece.params, 'dur_stun', 1)), ctx.t);
    }
  },
};

/** WaterElemental.gd */
/** @type {ScriptHandler} */
export const waterElementalPort = {
  handlerId: 'water_elemental',
  family: 'on_hit',
  onCombatStart(piece, ctx) {
    const ice = countType(ctx, piece, 'ice');
    const speed = getPName(piece.params, 'speed', 5) / 100;
    if (ice) addSpeed(piece, speed * ice);
    piece._manaSpent = 0;
    piece._waterStage = 0;
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'water_elemental');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    let manaGain = Math.max(1, Math.round(getPName(piece.params, 'mana', 1)));
    if (countType(ctx, piece, 'nature') && rollPercent(50, ctx.rng)) {
      manaGain += Math.max(0, Math.round(getPName(piece.params, 'mana2', 1)));
    }
    grantStacks(ctx.player, 'mana', manaGain, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const t1 = Math.max(1, Math.round(getPName(piece.params, 'manat1', 2)));
    const t2 = Math.max(t1 + 1, Math.round(getPName(piece.params, 'manat2', 4)));
    const t3 = Math.max(t2 + 1, Math.round(getPName(piece.params, 'manat3', 6)));
    const cost = Math.max(1, Math.round(getP1(piece.params, 2)));
    if ((ctx.player.stacks.mana || 0) >= cost) {
      useMana(ctx.player, cost, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      piece._manaSpent = (piece._manaSpent || 0) + cost;
      const spent = piece._manaSpent;
      if (spent >= t1 && piece._waterStage < 1) piece._waterStage = 1;
      if (spent >= t2 && piece._waterStage < 2) {
        piece._waterStage = 2;
        addBonusDamage(piece, Math.max(1, Math.round(getPName(piece.params, 'dam', 2))));
      }
      if (spent >= t3 && piece._waterStage < 3) piece._waterStage = 3;
    }
    if ((piece._waterStage || 0) >= 1) {
      healActor(ctx.player, Math.max(1, Math.round(getPName(piece.params, 'heal', getP2(piece.params, 6)))));
    }
    if ((piece._waterStage || 0) >= 3) {
      grantStacks(ctx.dummy, 'cold', Math.max(1, Math.round(getPName(piece.params, 'cold', 1))), {
        originKey: piece.placementKey,
        originId: piece.itemId,
        rng: ctx.rng,
        opponent: ctx.player,
      });
    }
  },
};

/** LightningStaff.gd — path sendCharge + cell dam */
/** @type {ScriptHandler} */
export const lightningStaffPort = {
  handlerId: 'lightning_staff',
  family: 'on_hit',
  onCombatStart(piece) {
    piece._litHits = 0;
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'lightning_staff');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    const cost = Math.max(1, Math.round(getPName(piece.params, 'manat', getPName(piece.params, 'mana', 2))));
    if ((ctx.player.stacks.mana || 0) >= cost) {
      useMana(ctx.player, cost, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      addBonusDamage(piece, Math.max(1, Math.round(getPName(piece.params, 'dam', getP2(piece.params, 1)))));
    }
    piece._litHits = (piece._litHits || 0) + 1;
    const every = Math.max(1, Math.round(getPName(piece.params, 'num', getP3(piece.params, 3))));
    if (piece._litHits < every) return;
    piece._litHits = 0;
    const flat = Math.max(0, Math.round(getPName(piece.params, 'dam_flat', 1)));
    const perTile = Math.max(0, Math.round(getPName(piece.params, 'dam_tile', 1)));
    emitPathCharge(piece, ctx, {
      durPerTile: getPName(piece.params, 'dur', 2) || 2,
      label: `${piece.name}: sendCharge`,
      onCellEnter(target, step) {
        if (!target) return;
        const bonus = flat + perTile * (step.cellIndex || 0);
        if (bonus) addBonusDamage(target, bonus);
      },
    });
  },
};

/** ThunderDrake.gd — timed speed + chargeReceived/Left */
/** @type {ScriptHandler} */
export const thunderDrakePort = {
  handlerId: 'thunder_drake',
  family: 'on_hit',
  onCombatStart(piece) {
    piece._drakeHits = 0;
    piece._drakeBuffOn = false;
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'thunder_drake');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    piece._drakeHits = (piece._drakeHits || 0) + 1;
    const every = Math.max(1, Math.round(getPName(piece.params, 'hits', getP1(piece.params, 3))));
    if (piece._drakeHits < every) return;
    piece._drakeHits = 0;
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    const targets = (ctx.pieces || []).filter((o) =>
      links.some((l) => l.key === o.placementKey),
    );
    const mult = Math.max(1, targets.length);
    const speed = (getPName(piece.params, 'speed', 10) / 100) * mult;
    const dur = Math.max(0.5, getPName(piece.params, 'dur', 3));
    const until = ctx.t + dur;
    if (!piece._drakeBuffOn) {
      piece._drakeBuffOn = true;
      for (const other of targets) {
        refreshTimedSpeed(other, speed, until, `drake:${piece.placementKey}`);
        deliverCharge(other, ctx, { emitterKey: piece.placementKey });
        other._onTimedSpeedEnd = (tag) => {
          if (tag === `drake:${piece.placementKey}`) {
            piece._drakeBuffOn = false;
            other.numCharges = Math.max(0, (other.numCharges || 1) - 1);
          }
        };
      }
    } else {
      for (const other of targets) {
        other.numCharges = Math.max(0, (other.numCharges || 1) - 1);
        deliverCharge(other, ctx, { emitterKey: piece.placementKey });
        refreshTimedSpeed(other, speed, until, `drake:${piece.placementKey}`);
      }
    }
  },
};

/** @type {Record<string, ScriptHandler>} */
export const WAVE_D_WEAPON_PORTS = {
  holy_spear: holySpearPort,
  automanaton: automanatonPort,
  bazooka: bazookaPort,
  chainsaw: chainsawPort,
  cupcake_dragon: cupcakeDragonPort,
  prismatic_sword: prismaticSwordPort,
  stone_golem: stoneGolemPort,
  water_elemental: waterElementalPort,
  lightning_staff: lightningStaffPort,
  thunder_drake: thunderDrakePort,
};

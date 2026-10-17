/**
 * Band AP 249 — leftover `weapon_perm_bonus_on_hit` MAP items → `.gd` ports.
 */

import {
  spendStacks,
  useLucky,
  useMana,
  useRegeneration,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getP4, getP5, getPName } from '../params.js';
import { addBonusDamage, addSpeed, purgeBonusDamage } from '../piece-stats.js';
import { giveBuffPower } from '../buff-power.js';
import { gainStacks, getStackAmount } from '../stacks.js';
import { canBeEmpoweredPiece } from './food-helpers.js';
import {
  countEmptyAffectCells,
  removeBlock,
  removeRandomBuffs,
  weaponStrike,
} from './ports-wave-c-util.js';
import { rollItemChance } from '../chance.js';
import { pushActivationAudit } from '../report-weapon-audit.js';
import { itemHasType } from './ports-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

function origin(piece) {
  return { originKey: piece.placementKey, originId: piece.itemId };
}

function linked(ctx, piece) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  return (ctx.pieces || []).filter((o) => links.some((l) => l.key === o.placementKey));
}

function buffStacks(actor) {
  let n = 0;
  for (const k of ['lucky', 'regeneration', 'vampirism', 'spikes', 'mana', 'empower', 'heat']) {
    n += getStackAmount(actor, /** @type {any} */ (k));
  }
  return n;
}

/** Axe.gd — perm +1 on hit (current hit included). */
const axePort = {
  handlerId: 'axe',
  family: 'weapon_base',
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'axe');
  },
  onPreDealDamageEarly(piece, _ctx, res) {
    if (res && !res.hit) return;
    const bonus = Math.max(1, Math.round(getP1(piece.params, 1)));
    addBonusDamage(piece, bonus);
    // Axe.gd applies its permanent bonus before the active hit resolves.
    // The shared damage pipeline has already rolled this hit, so update it too.
    if (res) res.damage = (Number(res.damage) || 0) + bonus;
  },
};

/** DoubleAxe.gd — perm p1 / p2 in rage; extra CD when rage starts. */
const doubleAxePort = {
  handlerId: 'double_axe',
  family: 'weapon_base',
  onPrepare(piece, ctx) {
    piece._axeRaged = false;
    ctx.bus?.on?.('battle_rage_started', (payload = {}) => {
      if (payload.actor && payload.actor !== ctx.player) return;
      if (piece._axeRaged) return;
      doubleAxePort.onCooldownEffect(piece, ctx);
      piece._axeRaged = true;
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'double_axe');
  },
  onPreDealDamageEarly(piece, ctx, res) {
    if (res && !res.hit) return;
    const bonus = piece._axeRaged ? getP2(piece.params, 3) : getP1(piece.params, 2);
    addBonusDamage(piece, bonus);
    if (res) res.damage = (Number(res.damage) || 0) + (Number(bonus) || 0);
  },
};

/** Halberd.gd — block power on blockers; perm dam; late strip leftover → self block. */
const halberdPort = {
  handlerId: 'halberd',
  family: 'weapon_base',
  onPrepare(piece, ctx) {
    const fac = getPName(piece.params, 'blockfactor', getP3(piece.params, 35)) / 100;
    const blockers = linked(ctx, piece).filter((o) =>
      (Number(o.blockGrant) || 0) > 0 || o.kind === 'armor' || o.kind === 'shield',
    );
    for (const o of blockers) {
      giveBuffPower(o, 'block', fac);
    }
    const per = Math.max(0, Math.round(getPName(piece.params, 'blockremoval', getP2(piece.params, 4))));
    piece._blockStrip =
      per * (blockers.length + countEmptyAffectCells(ctx, piece));
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'halberd');
  },
  onPreDealDamageEarly(piece, _ctx, res) {
    if (res && !res.hit) return;
    const dam = getPName(piece.params, 'dam', getP1(piece.params, 1));
    if (res) res.damage = (Number(res.damage) || 0) + dam;
    addBonusDamage(piece, dam);
  },
  onPreDealDamageLate(piece, ctx) {
    const want = Number(piece._blockStrip) || 0;
    if (want <= 0) return;
    const have = Number(ctx.dummy.block) || 0;
    const take = Math.min(have, want);
    if (take) removeBlock(ctx.dummy, take, ctx, piece);
    const leftover = want - take;
    if (leftover > 0) gainStacks(ctx.player, 'block', leftover);
  },
};

/** MagicTorch.gd — spend mana → perm on self + empowerable stars. */
const magicTorchPort = {
  handlerId: 'magic_torch',
  family: 'weapon_base',
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'magic_torch');
  },
  onPreDealDamageEarly(piece, ctx, res) {
    if (res && !res.hit) return;
    const need = Number(getP1(piece.params, 1));
    if (!Number.isFinite(need)) return;
    if (need > 0 && !(useMana(ctx.player, need, origin(piece)).spent > 0)) return;
    const dam = Number(getP2(piece.params, 1));
    if (!Number.isFinite(dam)) return;
    addBonusDamage(piece, dam);
    for (const o of linked(ctx, piece)) {
      if (canBeEmpoweredPiece(o)) addBonusDamage(o, dam);
    }
  },
};

/** MoltenDagger.gd — if heat ≥ p1, perm + spend heat. */
const moltenDaggerPort = {
  handlerId: 'molten_dagger',
  family: 'weapon_base',
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'molten_dagger');
  },
  onPreDealDamageEarly(piece, ctx, res) {
    if (res && !res.hit) return;
    // MoltenDagger.gd caches int(getP1()) / int(getP2()); zero remains a
    // valid source value and addBonusDamage only affects future attacks.
    const need = Math.trunc(getP1(piece.params, 0));
    if ((getStackAmount(ctx.player, 'heat') || 0) < need) return;
    const dam = Math.trunc(getP2(piece.params, 0));
    addBonusDamage(piece, dam);
    spendStacks(ctx.player, 'heat', need, origin(piece));
  },
};

/** NullBlade.gd — luck: current+perm dam; regen: strip buffs, speed if foe empty. */
const nullBladePort = {
  handlerId: 'null_blade',
  family: 'weapon_base',
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'null_blade');
  },
  onPreDealDamageEarly(piece, ctx, res) {
    if (res && !res.hit) return;
    const luckNeed = Math.trunc(getPName(piece.params, 'luckt', getP1(piece.params, 0)));
    const dam = Math.trunc(getPName(piece.params, 'dam', getP2(piece.params, 0)));
    if ((getStackAmount(ctx.player, 'lucky') || 0) >= luckNeed) {
      useLucky(ctx.player, luckNeed, origin(piece));
      if (dam) {
        if (res) res.damage = (Number(res.damage) || 0) + dam;
        addBonusDamage(piece, dam);
      }
    }
    const regenNeed = Math.trunc(getPName(piece.params, 'regent', getP3(piece.params, 0)));
    if ((getStackAmount(ctx.player, 'regeneration') || 0) < regenNeed) return;
    useRegeneration(ctx.player, regenNeed, origin(piece));
    removeRandomBuffs(
      ctx.dummy,
      Math.trunc(getPName(piece.params, 'buffs', getP4(piece.params, 0))),
      ctx.rng,
      origin(piece),
    );
    if (buffStacks(ctx.dummy) <= 0) {
      addSpeed(piece, getPName(piece.params, 'speed', getP5(piece.params, 5)) / 100);
    }
  },
};

/** RibSawBlade.gd — retain foe weapons in prepare; purge removable damage on hit. */
const ribSawBladePort = {
  handlerId: 'rib_saw_blade',
  family: 'weapon_base',
  onPrepare(piece, ctx) {
    piece._ribOppWeapons = (ctx.allPieces || []).filter((other) => {
      if (!other || other === piece || other.side === piece.side) return false;
      const item = ctx.itemsById?.get?.(other.itemId);
      if (!itemHasType(item, 'weapon')) return false;
      return Number(item.damageMin) > 0 || itemHasType(item, 'lifesteal');
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'rib_saw_blade');
  },
  onPreDealDamageEarly(piece, _ctx, res) {
    if (res && !res.hit) return;
    const removeDam = Math.max(0, Number(getPName(piece.params, 'dam', getP1(piece.params, 0))) || 0);
    for (const weapon of piece._ribOppWeapons || []) {
      purgeBonusDamage(weapon, removeDam);
    }
    const bonusDam = Math.max(
      0,
      Number(getPName(piece.params, 'bonusdam', getP2(piece.params, 0))) || 0,
    );
    if (bonusDam) addBonusDamage(piece, bonusDam);
  },
};

/** Torch.gd — on hit, rollChance() → addBonusDamage(getP1()) (current hit included). */
const torchPort = {
  handlerId: 'torch',
  family: 'weapon_base',
  onCooldownEffect(piece, ctx) {
    pushActivationAudit(piece, ctx);
    return weaponStrike(piece, ctx, 'torch');
  },
  onPreDealDamageEarly(piece, ctx, res) {
    if (!res?.hit) return;
    if (!rollItemChance(piece, ctx.rng)) return;
    const grow = getPName(piece.params, 'p1', getP1(piece.params, 1));
    if (!grow) return;
    addBonusDamage(piece, grow);
    ctx.events.push({
      t: ctx.t + 0.008,
      type: 'buff',
      amount: grow,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: +${grow} damage`,
      meta: {
        category: 'weapon',
        script: true,
        handler: 'torch',
        kind: 'damage_buff',
      },
    });
  },
};

export const AP_PERM_PORTS = {
  axe: axePort,
  double_axe: doubleAxePort,
  halberd: halberdPort,
  magic_torch: magicTorchPort,
  molten_dagger: moltenDaggerPort,
  null_blade: nullBladePort,
  rib_saw_blade: ribSawBladePort,
  torch: torchPort,
};

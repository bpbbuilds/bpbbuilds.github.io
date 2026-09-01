/**
 * Band AP 249 — leftover `weapon_perm_bonus_on_hit` MAP items → `.gd` ports.
 */

import { isBattleRaging } from '../battle-rage.js';
import {
  spendStacks,
  useLucky,
  useMana,
  useRegeneration,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { addBonusDamage, addSpeed } from '../piece-stats.js';
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
    addBonusDamage(piece, Math.max(1, Math.round(getP1(piece.params, 1))));
  },
};

/** DoubleAxe.gd — perm p1 / p2 in rage; extra CD when rage starts. */
const doubleAxePort = {
  handlerId: 'double_axe',
  family: 'weapon_base',
  onCombatStart(piece, ctx) {
    piece._axeRaged = false;
    ctx.bus?.on?.('battle_rage_started', () => {
      if (piece._axeRaged) return;
      piece._axeRaged = true;
      doubleAxePort.onCooldownEffect(piece, ctx);
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'double_axe');
  },
  onPreDealDamageEarly(piece, ctx, res) {
    if (res && !res.hit) return;
    const raging = piece._axeRaged || isBattleRaging(ctx.player, ctx.t);
    addBonusDamage(
      piece,
      Math.max(1, Math.round(raging ? getP2(piece.params, 3) : getP1(piece.params, 2))),
    );
  },
};

/** Halberd.gd — block power on blockers; perm dam; late strip leftover → self block. */
const halberdPort = {
  handlerId: 'halberd',
  family: 'weapon_base',
  onCombatStart(piece, ctx) {
    const fac = getPName(piece.params, 'blockfactor', getP3(piece.params, 35)) / 100;
    for (const o of linked(ctx, piece)) {
      if ((Number(o.blockGrant) || 0) <= 0) continue;
      o.blockGrant = Math.max(1, Math.round((Number(o.blockGrant) || 0) * (1 + fac)));
    }
    const per = Math.max(0, Math.round(getPName(piece.params, 'blockremoval', getP2(piece.params, 4))));
    piece._blockStrip =
      per * (linked(ctx, piece).length + countEmptyAffectCells(ctx, piece));
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'halberd', {
      beforeDeal() {
        const want = Number(piece._blockStrip) || 0;
        if (want <= 0) return;
        const have = Number(ctx.dummy.block) || 0;
        const take = Math.min(have, want);
        if (take) removeBlock(ctx.dummy, take, ctx, piece);
        const leftover = want - take;
        if (leftover > 0) gainStacks(ctx.player, 'block', leftover);
      },
    });
  },
  onPreDealDamageEarly(piece, _ctx, res) {
    if (res && !res.hit) return;
    addBonusDamage(piece, Math.max(1, Math.round(getPName(piece.params, 'dam', getP1(piece.params, 1)))));
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
    const need = Math.max(1, Math.round(getP1(piece.params, 1)));
    if (!(useMana(ctx.player, need, origin(piece)).spent > 0)) return;
    const dam = Math.max(1, Math.round(getP2(piece.params, 1)));
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
    const need = Math.max(1, Math.round(getP1(piece.params, 1)));
    if ((getStackAmount(ctx.player, 'heat') || 0) < need) return;
    addBonusDamage(piece, Math.max(1, Math.round(getP2(piece.params, 2))));
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
    const luckNeed = Math.max(1, Math.round(getPName(piece.params, 'luckt', getP1(piece.params, 1))));
    const dam = Math.max(1, Math.round(getPName(piece.params, 'dam', getP2(piece.params, 2))));
    if (useLucky(ctx.player, luckNeed, origin(piece)).spent > 0) {
      addBonusDamage(piece, dam);
    }
    const regenNeed = Math.max(1, Math.round(getPName(piece.params, 'regent', getP3(piece.params, 1))));
    if ((getStackAmount(ctx.player, 'regeneration') || 0) < regenNeed) return;
    useRegeneration(ctx.player, regenNeed, origin(piece));
    removeRandomBuffs(
      ctx.dummy,
      Math.max(1, Math.round(getPName(piece.params, 'buffs', 3))),
      ctx.rng,
      origin(piece),
    );
    if (buffStacks(ctx.dummy) <= 0) {
      addSpeed(piece, getPName(piece.params, 'speed', 5) / 100);
    }
  },
};

/** RibSawBlade.gd — purge foe weapons (empty vs dummy); perm bonusdam. */
const ribSawBladePort = {
  handlerId: 'rib_saw_blade',
  family: 'weapon_base',
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'rib_saw_blade');
  },
  onPreDealDamageEarly(piece, _ctx, res) {
    if (res && !res.hit) return;
    addBonusDamage(piece, getPName(piece.params, 'bonusdam', getP2(piece.params, 0.5)));
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
    if (res && !res.hit) return;
    if (!rollItemChance(piece, ctx.rng)) return;
    const grow = Math.max(1, Math.round(getP1(piece.params, 1)));
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

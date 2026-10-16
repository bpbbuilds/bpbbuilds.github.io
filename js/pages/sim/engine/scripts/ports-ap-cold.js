/**
 * Band AP 246 — leftover `cd_cold` / `cd_poison` MAP items → `.gd` ports.
 */

import { healActor } from '../actor.js';
import { applyEffectDmgFactor, applyHealEfficiency } from '../actor-stats.js';
import {
  giveRandomBuffs,
  grantStacks,
  onBuffChanged,
  spendStacks,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { advanceCooldownPercent, advanceCooldownSeconds } from '../cooldown.js';
import { dealEffectDamage } from './handlers.js';
import { getP1, getP2, getP3, getP4, getP5, getP6, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { applyFoodPrepareSpeed } from './food-helpers.js';
import { gainStacks, getStackAmount } from '../stacks.js';
import { itemHasType, afterEffectFinished, pushActivate } from './ports-util.js';
import { eventSideForPiece } from '../vs-board.js';

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

function linkedByColor(ctx, piece, color) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  return (ctx.pieces || []).filter((o) =>
    links.some((l) => l.key === o.placementKey && l.color === color),
  );
}

function pickNoRepeat(piece, key, rng) {
  let opts = piece[key];
  if (!Array.isArray(opts) || !opts.length) opts = [0, 1, 2];
  const pick = opts[Math.floor(rng() * opts.length)] ?? 0;
  piece[key] = [0, 1, 2].filter((x) => x !== pick);
  return pick;
}

/** IceArmor.gd — start block + cold; CD spend heat → more cold + block. */
const iceArmorPort = {
  handlerId: 'ice_armor',
  family: 'unique',
  onCombatStart(piece, ctx) {
    gainStacks(ctx.player, 'block', Number(ctx.itemsById.get(piece.itemId)?.block) || 100);
    grantStacks(ctx.dummy, 'cold', Math.max(1, Math.round(getP1(piece.params, 4))), origin(piece));
    pushActivate(piece, ctx, 'ice_armor', `Armor: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    const need = Math.max(1, Math.round(getP2(piece.params, 1)));
    if (getStackAmount(ctx.player, 'heat') >= need) {
      spendStacks(ctx.player, 'heat', need, origin(piece));
      grantStacks(ctx.dummy, 'cold', Math.max(1, Math.round(getP3(piece.params, 2))), origin(piece));
      gainStacks(ctx.player, 'block', Math.max(1, Math.round(getP4(piece.params, 10))));
    }
    pushActivate(piece, ctx, 'ice_armor', `Armor: ${piece.name}`);
    return true;
  },
};

/** Snowcake.gd — inflict cold; at coldt, effect-dmg factor + minDam hit. */
const snowcakePort = {
  handlerId: 'snowcake',
  family: 'food',
  onCooldownEffect(piece, ctx) {
    const cold = Math.trunc(getPName(piece.params, 'cold', getP1(piece.params, 1)));
    grantStacks(
      ctx.dummy,
      'cold',
      cold,
      {
        ...origin(piece),
        rng: ctx.rng,
        opponent: ctx.player,
      },
    );
    const need = Math.trunc(getPName(piece.params, 'coldt', getP2(piece.params, 10)));
    if (getStackAmount(ctx.dummy, 'cold') >= need) {
      applyEffectDmgFactor(
        ctx.player,
        getPName(piece.params, 'damfactor', getP3(piece.params, 10)) / 100,
        ctx,
        piece,
      );
      const dam = Number(ctx.itemsById.get(piece.itemId)?.damageMin);
      if (Number.isFinite(dam) && dam > 0) dealEffectDamage(piece, ctx, dam);
    }
    pushActivate(piece, ctx, 'snowcake', `Food: ${piece.name}`);
    return true;
  },
};

/** Ukulele.gd — musical stars advance other CDs; CD heal / buffs / cold. */
const ukulelePort = {
  handlerId: 'ukulele',
  family: 'unique',
  onPrepare(piece, ctx) {
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    const n = links.filter((link) => link.color === 'primary').length;
    const spd = getP5(piece.params, 0) / 100;
    if (n && spd) addSpeed(piece, spd * n);
    applyHealEfficiency(
      ctx.player,
      getP1(piece.params, 0) / 100,
      ctx,
      piece,
    );
    const chanceRaw = Number(piece.chance ?? ctx.itemsById.get(piece.itemId)?.chance);
    const amp = Number.isFinite(chanceRaw) ? chanceRaw : 0;
    for (const o of ctx.pieces || []) {
      o.buffAmpChance = (Number(o.buffAmpChance) || 0) + amp;
    }
    const pool = (ctx.pieces || []).filter(
      (o) =>
        o.placementKey !== piece.placementKey &&
        o.cooldown > 0 &&
        o.cooldown < 500 &&
        !itemHasType(ctx.itemsById.get(o.itemId), 'musical'),
    );
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(ctx.rng() * (i + 1));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    piece._ukePool = pool;
    piece._ukeIdx = 0;
    piece._ukeOpts = [0, 1, 2];
    const pct = getP6(piece.params, 0);
    ctx.bus?.on?.('piece_activated', (payload) => {
      const other = payload?.piece;
      if (!other || other === piece) return;
      if (!linkedByColor(ctx, piece, 'secondary').some((o) => o === other)) return;
      if (!itemHasType(ctx.itemsById.get(other.itemId), 'musical')) return;
      const list = piece._ukePool || [];
      while (list.length) {
        const idx = (Number(piece._ukeIdx) || 0) % list.length;
        const target = list[idx];
        if (target?.alive && target.cooldown > 0 && target.cooldown < 500) {
          piece._ukeIdx = (idx + 1) % list.length;
          advanceCooldownPercent(target, pct, ctx);
          return;
        }
        list.splice(idx, 1);
        piece._ukeIdx = list.length ? idx % list.length : 0;
      }
    });
  },
  onCooldownEffect(piece, ctx) {
    const pick = pickNoRepeat(piece, '_ukeOpts', ctx.rng);
    if (pick === 0) {
      const heal = Math.trunc(getP2(piece.params, 0));
      const got = healActor(ctx.player, heal);
      if (got > 0) {
        ctx.events.push({
          t: ctx.t + 0.002,
          type: 'heal',
          target: eventSideForPiece(piece),
          amount: got,
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          label: `${piece.name}: +${got} HP`,
          meta: { category: 'heal', script: true, handler: 'ukulele' },
        });
      }
    } else if (pick === 1) {
      giveRandomBuffs(
        ctx.player,
        Math.trunc(getP3(piece.params, 0)),
        ctx.rng,
        origin(piece),
      );
    } else {
      grantStacks(
        ctx.dummy,
        'cold',
        Math.trunc(getP4(piece.params, 0)),
        origin(piece),
      );
    }
    pushActivate(piece, ctx, 'ukulele', `Accessory: ${piece.name}`);
    return true;
  },
};

/** DoomCap.gd — poison + reduce opponent heal efficiency. */
const doomCapPort = {
  handlerId: 'doom_cap',
  family: 'food',
  // DoomCap.gd extends Food without overriding prepare(). Preserve the
  // inherited linked-food speed bonus before its cooldown effect runs.
  onPrepare(piece, ctx) {
    applyFoodPrepareSpeed(piece, ctx);
  },
  onCooldownEffect(piece, ctx) {
    grantStacks(
      ctx.dummy,
      'poison',
      Math.trunc(getPName(piece.params, 'poison', getP1(piece.params, 3))),
      origin(piece),
    );
    applyHealEfficiency(
      ctx.dummy,
      -getPName(piece.params, 'healreduction', getP2(piece.params, 10)) / 100,
      ctx,
      piece,
    );
    // DoomCap.gd performs its effects before the cooldown activation is logged.
    pushActivate(piece, ctx, 'doom_cap', `Food: ${piece.name}`);
    return true;
  },
};

/** FlyAgaric.gd — inflict poison. */
const flyAgaricPort = {
  handlerId: 'fly_agaric',
  family: 'food',
  // FlyAgaric.gd extends Food without overriding prepare(). Preserve the
  // inherited Food.prepare food-link haste before its cooldown effect runs.
  onPrepare(piece, ctx) {
    applyFoodPrepareSpeed(piece, ctx);
  },
  onCooldownEffect(piece, ctx) {
    grantStacks(ctx.dummy, 'poison', Math.round(getP1(piece.params)), origin(piece));
    // FlyAgaric.gd inflicts Poison before activate().
    pushActivate(piece, ctx, 'fly_agaric', `Food: ${piece.name}`);
    return true;
  },
};

/** PoisonGrenade.gd — poison dummy + self then consume; charge advances CD; lucky → poison crit. */
const poisonGrenadePort = {
  handlerId: 'poison_grenade',
  family: 'unique',
  onPrepare(piece, ctx) {
    piece._grenadeCrit = false;
    const need = Math.max(1, Math.round(getPName(piece.params, 'luckt', getP4(piece.params, 5))));
    const ch = Number(ctx.itemsById.get(piece.itemId)?.chance) || 30;
    onBuffChanged(ctx.player, (chg) => {
      const lucky = getStackAmount(ctx.player, 'lucky');
      if (chg.amount > 0 && !piece._grenadeCrit && lucky >= need) {
        piece._grenadeCrit = true;
        ctx.dummy.poisonCritChance = (Number(ctx.dummy.poisonCritChance) || 0) + ch;
      } else if (chg.amount < 0 && piece._grenadeCrit && lucky < need) {
        piece._grenadeCrit = false;
        ctx.dummy.poisonCritChance = (Number(ctx.dummy.poisonCritChance) || 0) - ch;
      }
    });
  },
  onChargeReceived(piece, ctx) {
    const sec = getPName(piece.params, 'cdadvance', getP3(piece.params, 1));
    advanceCooldownSeconds(piece, sec, ctx);
  },
  onCooldownEffect(piece, ctx) {
    grantStacks(
      ctx.dummy,
      'poison',
      Math.max(1, Math.round(getPName(piece.params, 'poison', getP1(piece.params, 20)))),
      origin(piece),
    );
    grantStacks(
      ctx.player,
      'poison',
      Math.max(1, Math.round(getPName(piece.params, 'poison2', getP2(piece.params, 12)))),
      origin(piece),
    );
    afterEffectFinished(piece, ctx, 'poison_grenade');
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const AP_COLD_PORTS = {
  ice_armor: iceArmorPort,
  snowcake: snowcakePort,
  ukulele: ukulelePort,
  doom_cap: doomCapPort,
  fly_agaric: flyAgaricPort,
  poison_grenade: poisonGrenadePort,
};

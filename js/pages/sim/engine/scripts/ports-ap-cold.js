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
import { advanceCooldownSeconds } from '../cooldown.js';
import { dealDamage } from '../damage.js';
import { getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { gainStacks, getStackAmount } from '../stacks.js';
import { itemHasType, afterEffectFinished, pushActivate } from './ports-util.js';

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
    pushActivate(piece, ctx, 'ice_armor', `Armor: ${piece.name}`);
    const need = Math.max(1, Math.round(getP2(piece.params, 1)));
    if (getStackAmount(ctx.player, 'heat') >= need) {
      spendStacks(ctx.player, 'heat', need, origin(piece));
      grantStacks(ctx.dummy, 'cold', Math.max(1, Math.round(getP3(piece.params, 2))), origin(piece));
      gainStacks(ctx.player, 'block', Math.max(1, Math.round(getP4(piece.params, 10))));
    }
    return true;
  },
};

/** Snowcake.gd — inflict cold; at coldt, effect-dmg factor + minDam hit. */
const snowcakePort = {
  handlerId: 'snowcake',
  family: 'food',
  onCooldownEffect(piece, ctx) {
    pushActivate(piece, ctx, 'snowcake', `Food: ${piece.name}`);
    grantStacks(
      ctx.dummy,
      'cold',
      Math.max(1, Math.round(getPName(piece.params, 'cold', getP1(piece.params, 1)))),
      origin(piece),
    );
    const need = Math.max(1, Math.round(getPName(piece.params, 'coldt', getP2(piece.params, 10))));
    if (getStackAmount(ctx.dummy, 'cold') >= need) {
      applyEffectDmgFactor(
        ctx.player,
        getPName(piece.params, 'damfactor', getP3(piece.params, 10)) / 100,
        ctx,
        piece,
      );
      const dam = Math.max(1, Math.round(Number(ctx.itemsById.get(piece.itemId)?.damageMin) || 10));
      const res = dealDamage(ctx.player, ctx.dummy, {
        amount: dam,
        canMiss: false,
        canCrit: false,
        isAttack: false,
        nowT: ctx.t,
        rng: ctx.rng,
      });
      ctx.events.push({
        t: ctx.t + 0.003,
        type: 'damage',
        actor: 'player',
        target: 'dummy',
        amount: res.healthDamage,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: ${res.healthDamage} effect dmg`,
        meta: { category: 'damage', script: true, handler: 'snowcake', effect: true },
      });
    }
    return true;
  },
};

/** Ukulele.gd — musical stars advance other CDs; CD heal / buffs / cold. */
const ukulelePort = {
  handlerId: 'ukulele',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const n = linked(ctx, piece).length;
    const spd = getPName(piece.params, 'speed', getPName(piece.params, 'p5', 10)) / 100;
    if (n && spd) addSpeed(piece, spd * n);
    applyHealEfficiency(
      ctx.player,
      getPName(piece.params, 'healamp', getP1(piece.params, 20)) / 100,
      ctx,
      piece,
    );
    const amp = Number(ctx.itemsById.get(piece.itemId)?.chance) || 15;
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
    const pct = getPName(piece.params, 'advance', 20) / 100;
    ctx.bus?.on?.('piece_activated', (payload) => {
      const other = payload?.piece;
      if (!other || other === piece) return;
      if (!linkedByColor(ctx, piece, 'secondary').some((o) => o === other)) return;
      if (!itemHasType(ctx.itemsById.get(other.itemId), 'musical')) return;
      const list = (piece._ukePool || []).filter((o) => o.alive && o.cooldown > 0 && o.cooldown < 500);
      if (!list.length) return;
      let idx = Number(piece._ukeIdx) || 0;
      const target = list[idx % list.length];
      piece._ukeIdx = (idx + 1) % list.length;
      const period = Number(target.baseCooldown) || Number(target.cooldown) || 0;
      if (period > 0) advanceCooldownSeconds(target, period * pct, ctx);
    });
  },
  onCooldownEffect(piece, ctx) {
    const pick = pickNoRepeat(piece, '_ukeOpts', ctx.rng);
    pushActivate(piece, ctx, 'ukulele', `Accessory: ${piece.name}`);
    if (pick === 0) {
      const heal = Math.max(1, Math.round(getPName(piece.params, 'heal', getP2(piece.params, 30))));
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
          meta: { category: 'heal', script: true, handler: 'ukulele' },
        });
      }
    } else if (pick === 1) {
      giveRandomBuffs(
        ctx.player,
        Math.max(1, Math.round(getPName(piece.params, 'buffs', getP3(piece.params, 5)))),
        ctx.rng,
        origin(piece),
      );
    } else {
      grantStacks(
        ctx.dummy,
        'cold',
        Math.max(1, Math.round(getPName(piece.params, 'cold', getP4(piece.params, 4)))),
        origin(piece),
      );
    }
    return true;
  },
};

/** DoomCap.gd — poison + reduce opponent heal efficiency. */
const doomCapPort = {
  handlerId: 'doom_cap',
  family: 'food',
  onCooldownEffect(piece, ctx) {
    pushActivate(piece, ctx, 'doom_cap', `Food: ${piece.name}`);
    grantStacks(
      ctx.dummy,
      'poison',
      Math.max(1, Math.round(getPName(piece.params, 'poison', getP1(piece.params, 3)))),
      origin(piece),
    );
    applyHealEfficiency(
      ctx.dummy,
      -getPName(piece.params, 'healreduction', getP2(piece.params, 10)) / 100,
      ctx,
      piece,
    );
    return true;
  },
};

/** FlyAgaric.gd — inflict poison. */
const flyAgaricPort = {
  handlerId: 'fly_agaric',
  family: 'food',
  onCooldownEffect(piece, ctx) {
    pushActivate(piece, ctx, 'fly_agaric', `Food: ${piece.name}`);
    grantStacks(ctx.dummy, 'poison', Math.max(1, Math.round(getP1(piece.params, 1))), origin(piece));
    return true;
  },
};

/** PoisonGrenade.gd — poison dummy + self then consume; charge advances CD; lucky → poison crit. */
const poisonGrenadePort = {
  handlerId: 'poison_grenade',
  family: 'unique',
  onCombatStart(piece, ctx) {
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

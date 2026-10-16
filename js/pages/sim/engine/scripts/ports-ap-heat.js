/**
 * Band AP 246 — leftover `cd_heat` MAP items → `.gd` ports.
 */

import { healActor, tryUseStamina } from '../actor.js';
import { isBattleRaging } from '../battle-rage.js';
import {
  BUFF_KEYS,
  cleanseRandomDebuffs,
  giveRandomBuffs,
  grantStacks,
  spendStacks,
} from '../buff-economy.js';
import { changeCritStacks } from '../actor-stats.js';
import { affectedTargets } from '../board-graph.js';
import { deactivateCooldown } from '../cooldown.js';
import { getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { addSpeed, multiplyStaminaCost } from '../piece-stats.js';
import { getStackAmount } from '../stacks.js';
import { itemHasType, afterEffectFinished, pushActivate } from './ports-util.js';
import { eventFoeSide, eventSideForPiece } from '../vs-board.js';

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

function countId(ctx, id, side) {
  return (ctx.pieces || []).filter(
    (o) => o.alive && o.itemId === id && (side == null || o.side === side),
  ).length;
}

/** BurningCoal.gd inventory: heat + cleanse then consume. Weapon/armor in gem-sockets. */
const burningCoalPort = {
  handlerId: 'burning_coal',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    grantStacks(
      ctx.player,
      'heat',
      Math.max(1, Math.round(getP4(piece.params, 2))),
      origin(piece),
    );
    cleanseRandomDebuffs(ctx.player, Math.max(1, Math.round(getPName(piece.params, 'p5', 3))), ctx.rng, origin(piece));
    afterEffectFinished(piece, ctx, 'burning_coal');
    return true;
  },
};

/** ChiliPepper.gd — heat + heal; cleanse 1 if heat ≥ heatt. */
const chiliPepperPort = {
  handlerId: 'chili_pepper',
  family: 'food',
  onCooldownEffect(piece, ctx) {
    grantStacks(
      ctx.player,
      'heat',
      Math.max(1, Math.round(getPName(piece.params, 'heat', getP1(piece.params, 1)))),
      origin(piece),
    );
    const heal = Math.max(1, Math.round(getPName(piece.params, 'heal', getP2(piece.params, 5))));
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
        meta: { category: 'heal', script: true, handler: 'chili_pepper' },
      });
    }
    const need = Math.max(1, Math.round(getPName(piece.params, 'heatt', getP3(piece.params, 10))));
    if (getStackAmount(ctx.player, 'heat') >= need) {
      cleanseRandomDebuffs(ctx.player, 1, ctx.rng, origin(piece));
    }
    // ChiliPepper.gd activates after heat, heal, and threshold cleanse.
    pushActivate(piece, ctx, 'chili_pepper', `Food: ${piece.name}`);
    return true;
  },
};

/** DraconicOrb.gd — heat bank → crit tokens; CD strip dummy spikes → heat. */
const draconicOrbPort = {
  handlerId: 'draconic_orb',
  family: 'unique',
  onPrepare(piece, ctx) {
    piece._orbHeat = 0;
    const th = Math.trunc(getP1(piece.params, 15));
    const crits = getPName(piece.params, 'crits', getP2(piece.params, 3));
    ctx.bus?.on?.('character_heat_changed', (payload = {}) => {
      if (payload.actor && payload.actor !== ctx.player) return;
      if (!(Number(payload.amount) > 0) || piece._orbHeat >= th) return;
      piece._orbHeat += Number(payload.amount);
      if (piece._orbHeat >= th) {
        changeCritStacks(ctx.player, crits, ctx, origin(piece));
      }
    });
  },
  onCooldownEffect(piece, ctx) {
    const take = Math.trunc(getP3(piece.params, 1));
    const per = Math.trunc(getP4(piece.params, 1));
    const have = getStackAmount(ctx.dummy, 'spikes');
    if (have > 0) {
      const lost = Math.min(have, take);
      spendStacks(ctx.dummy, 'spikes', lost, origin(piece));
      grantStacks(ctx.player, 'heat', lost * per, origin(piece));
    }
    pushActivate(piece, ctx, 'draconic_orb', `Accessory: ${piece.name}`);
    return true;
  },
};

/** DragonSet.gd — CD heat only while raging; full dragon gear → lifesteal on hits. */
const dragonSetPort = {
  handlerId: 'dragon_set',
  family: 'unique',
  onPrepare(piece, ctx) {
    // DragonSet.gd waits until preCombatStart() to deactivate its CD. Keeping
    // preparation side-effect free preserves the source's pre-combat snapshot.
    ctx.bus?.on?.('battle_rage_started', (event = {}) => {
      if (event.actor && event.actor !== ctx.player) return;
      piece._cdLocked = false;
      const period = Math.max(0.35, Number(piece.baseCooldown) || 0.7);
      piece.cooldown = period;
      piece.triggerTime = period;
    });
    ctx.bus?.on?.('battle_rage_ended', (event = {}) => {
      if (event.actor && event.actor !== ctx.player) return;
      piece._cdLocked = true;
      piece.cooldown = 999;
      piece.triggerTime = 999;
    });
    const set =
      countId(ctx, 'dragonscale_armor', piece.side) > 0 &&
      countId(ctx, 'dragonskin_boots', piece.side) > 0 &&
      countId(ctx, 'dragon_claws', piece.side) > 0;
    if (!set) return;
    const ls = getPName(piece.params, 'lifesteal', getP2(piece.params, 2)) / 100;
    const cap = getPName(piece.params, 'max', getP3(piece.params, 30)) / 100;
    ctx.bus?.on?.('piece_dealt_damage', (payload) => {
      if (!payload?.hit?.hit) return;
      if (payload.canApplyLifesteal === false || payload.hit.canApplyLifesteal === false) return;
      if (eventSideForPiece(payload.piece) !== eventFoeSide(piece)) return;
      const dmg = Number(payload.hit.damage) || Number(payload.hit.healthDamage) || 0;
      if (!(dmg > 0)) return;
      const heat = getStackAmount(ctx.player, 'heat');
      const fac = Math.min(cap, ls * heat);
      const got = healActor(ctx.player, Math.ceil(fac * dmg));
      if (got > 0) {
        const side = eventSideForPiece(piece);
        ctx.events.push({
          t: ctx.t,
          type: 'heal',
          actor: side,
          target: side,
          amount: got,
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          label: `${piece.name}: +${got} HP`,
          meta: { category: 'heal', script: true, handler: 'dragon_set' },
        });
      }
    });
  },
  onPreCombatStart(piece) {
    deactivateCooldown(piece);
  },
  onCooldownEffect(piece, ctx) {
    if (!isBattleRaging(ctx.player, ctx.t)) return true;
    const heat = Math.trunc(getPName(piece.params, 'heat', getP1(piece.params, 1)));
    grantStacks(
      ctx.player,
      'heat',
      heat,
      origin(piece),
    );
    // DragonSet.gd gives Heat before its activation event.
    pushActivate(piece, ctx, 'dragon_set', `Skill: ${piece.name}`);
    return true;
  },
};

/** EnergyConversion.gd — food speed onPrepare; CD spend stam → heat or random buffs. */
const energyConversionPort = {
  handlerId: 'energy_conversion',
  family: 'unique',
  // Game onPrepare — before first CD arm.
  onPrepare(piece, ctx) {
    const foods = linked(ctx, piece).filter((o) =>
      itemHasType(ctx.itemsById.get(o.itemId), 'food'),
    );
    const n = foods.length;
    const spd = getPName(piece.params, 'speed', getP4(piece.params, 25)) / 100;
    if (n && spd) addSpeed(piece, spd * n);
  },
  onCooldownEffect(piece, ctx) {
    const cost = Number(piece.staminaCost) || 0.7;
    if (tryUseStamina(ctx.player, cost) === 'starve') return false;
    const need = Math.trunc(getPName(piece.params, 'heatt', getP2(piece.params, 20)));
    if (getStackAmount(ctx.player, 'heat') >= need) {
      giveRandomBuffs(
        ctx.player,
        Math.trunc(getPName(piece.params, 'buffs', getP3(piece.params, 5))),
        ctx.rng,
        { ...origin(piece), availableBuffs: BUFF_KEYS.filter((k) => k !== 'heat') },
      );
    } else {
      grantStacks(
        ctx.player,
        'heat',
        Math.trunc(getPName(piece.params, 'heat', getP1(piece.params, 4))),
        origin(piece),
      );
    }
    pushActivate(piece, ctx, 'energy_conversion', `Skill: ${piece.name}`);
    return true;
  },
};

/** Everburning.gd — stam factor on burning weapons; CD heat × flames then consume. */
const everburningPort = {
  handlerId: 'everburning',
  family: 'unique',
  onPrepare(piece, ctx) {
    piece._everFlames = countId(ctx, 'flame', piece.side);
    const stam = -getPName(piece.params, 'stamina', getP2(piece.params, 60)) / 100;
    for (const o of ctx.pieces || []) {
      if (o.side !== piece.side) continue;
      if (o.itemId === 'burning_sword' || o.itemId === 'burning_blade') {
        multiplyStaminaCost(o, stam);
      }
    }
  },
  onCooldownEffect(piece, ctx) {
    const n = Number.isFinite(Number(piece._everFlames))
      ? Number(piece._everFlames)
      : countId(ctx, 'flame', piece.side);
    if (n > 0) {
      const heat = Number(getPName(piece.params, 'heat', getP1(piece.params, 1)));
      grantStacks(ctx.player, 'heat', heat * n, origin(piece));
    }
    afterEffectFinished(piece, ctx, 'everburning');
    return true;
  },
};

export const AP_HEAT_PORTS = {
  burning_coal: burningCoalPort,
  chili_pepper: chiliPepperPort,
  draconic_orb: draconicOrbPort,
  dragon_set: dragonSetPort,
  energy_conversion: energyConversionPort,
  everburning: everburningPort,
};

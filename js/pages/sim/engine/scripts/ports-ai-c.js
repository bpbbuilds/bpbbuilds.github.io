/**
 * Band AI Wave C (1/2) — pet deepen from Items/*.gd.
 * Do not mark inventory DEEP here.
 */

import {
  giveRandomBuffs,
  grantStacks,
  onBuffChanged,
  stealStack,
  useLucky,
  useMana,
} from '../buff-economy.js';
import { healActor, tryUseStamina } from '../actor.js';
import { applyHealEfficiency } from '../actor-stats.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { rollPercent } from '../rng.js';
import { itemHasType, pushActivate, pushBuffGrants } from './ports-util.js';
import { linkedWith } from './ports-ai-c-util.js';
import { eventSideForPiece } from '../vs-board.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** BadgerSpirit.gd — low-HP % heal once; CD mana → max HP. */
/** @type {ScriptHandler} */
export const badgerSpiritPort = {
  handlerId: 'badger_spirit',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    piece._badgerArmed = true;
    const th = getPName(piece.params, 'healtht', 50) / 100;
    ctx.bus?.on?.('player_damaged', (payload) => {
      if (!piece._badgerArmed || !payload?.hit) return;
      const player = ctx.player;
      const rel = player.maxHp > 0 ? player.hp / player.maxHp : 1;
      if (rel >= th) return;
      piece._badgerArmed = false;
      const pct = getPName(piece.params, 'heal', 20) / 100;
      const amt = Math.max(1, Math.round(player.maxHp * pct));
      const healed = healActor(player, amt);
      if (healed > 0) {
        ctx.events.push({
          t: payload?.t ?? ctx.t,
          type: 'heal',
          target: 'player',
          amount: healed,
          label: `${piece.name}: low HP heal +${healed}`,
          meta: { category: 'heal', script: true, handler: 'badger_spirit' },
        });
      }
    });
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, graph, itemsById, canAffect } = ctx;
    pushActivate(piece, ctx, 'badger_spirit', `Pet: ${piece.name}`);
    const need = Math.max(1, Math.round(getPName(piece.params, 'manat', getP1(piece.params, 5))));
    if ((Number(player.stacks.mana) || 0) < need) return true;
    if (
      useMana(player, need, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      }).spent <= 0
    ) {
      return true;
    }
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const base = Math.max(1, Math.round(getPName(piece.params, 'maxhealth', getP2(piece.params, 5))));
    const bonus = Math.max(
      0,
      Math.round(getPName(piece.params, 'maxhealth_bonus', getP3(piece.params, 2))),
    );
    const hp = base + links.length * bonus;
    player.maxHp += hp;
    player.hp = Math.min(player.maxHp, player.hp + hp);
    events.push({
      t: t + 0.004,
      type: 'heal',
      target: 'player',
      amount: hp,
      label: `${piece.name}: +${hp} max HP`,
      meta: { category: 'heal', script: true, handler: 'badger_spirit' },
    });
    return true;
  },
};

/** Crow.gd — speed + debuff amp pulses; steal Lucky. */
/** @type {ScriptHandler} */
export const crowPort = {
  handlerId: 'crow',
  family: 'unique',
  onCombatStart(piece) {
    piece._crowActs = 0;
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, dummy, events } = ctx;
    pushActivate(piece, ctx, 'crow', `Pet: ${piece.name}`);
    const maxActs = Math.max(1, Math.round(getPName(piece.params, 'max', getP2(piece.params, 5))));
    const speedBonus = getPName(piece.params, 'speed', getP1(piece.params, 10)) / 100;
    const amp = Math.max(0, Number(piece.chance) || getPName(piece.params, 'chance', 10));
    const acts = Number(piece._crowActs) || 0;
    if (acts < maxActs) {
      for (const { other } of linkedWith(ctx, piece)) {
        if (!(other.cooldown > 0 || other.baseCooldown > 0)) continue;
        addSpeed(other, speedBonus);
        // debuffAmpChance mirrors buffAmpChance; amp apply path is still shallow engine-side
        other.debuffAmpChance = (Number(other.debuffAmpChance) || 0) + amp;
      }
      piece._crowActs = acts + 1;
    }
    const luck = Math.max(1, Math.round(getPName(piece.params, 'luck', getP3(piece.params, 1))));
    const take = Math.min(luck, Number(dummy.stacks.lucky) || 0);
    if (take > 0) {
      stealStack(dummy, player, 'lucky', take, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      events.push({
        t: t + 0.004,
        type: 'buff',
        target: 'player',
        amount: take,
        label: `${piece.name}: steal ${take} Lucky`,
        meta: { category: 'buff', stack: 'lucky', script: true, handler: 'crow' },
      });
    }
    return true;
  },
};

/** EvilHat.gd — unhealing prepare; debuff→regen; strip→crit; CD random buffs. */
/** @type {ScriptHandler} */
export const evilHatPort = {
  handlerId: 'evil_hat',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const darkN = linkedWith(
      ctx,
      piece,
      (o, link) =>
        link.color === 'secondary' && itemHasType(ctx.itemsById.get(o.itemId), 'dark'),
    ).length;
    let unh = getPName(piece.params, 'unhealing', 10) / 100;
    unh += darkN * (getPName(piece.params, 'unhealing2', 5) / 100);
    if (unh) ctx.player.unhealing = (Number(ctx.player.unhealing) || 0) + unh;

    const regenPer = Math.max(0, Math.round(getPName(piece.params, 'regen', 1)));
    const chance = Number(piece.chance) || getPName(piece.params, 'chance', 50);
    // Gap: no origin-item filter on debuff bus — any poison/blind/cold gain rolls regen
    onBuffChanged(ctx.dummy, (ch) => {
      if (!(ch.amount > 0) || !['poison', 'blind', 'cold'].includes(ch.stack)) return;
      let give = 0;
      for (let i = 0; i < ch.amount; i += 1) {
        if (rollPercent(chance, ctx.rng)) give += regenPer;
      }
      if (give > 0) {
        grantStacks(ctx.player, 'regeneration', give, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      }
    });
    const critPer = Math.max(
      0,
      Number(piece.chance2) || getPName(piece.params, 'chance2', 5),
    );
    onBuffChanged(ctx.dummy, (ch) => {
      if (!(ch.amount < 0) || !critPer) return;
      for (const { other } of linkedWith(ctx, piece, (_o, link) => link.color === 'primary')) {
        if (!(other.damageMax > 0 || other.damageMin > 0)) continue;
        other.critChance = (Number(other.critChance) || 0) + critPer * -ch.amount;
      }
    });
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, dummy, events, rng } = ctx;
    pushActivate(piece, ctx, 'evil_hat', `Accessory: ${piece.name}`);
    const selfN = Math.max(1, Math.round(getPName(piece.params, 'buffs', getP1(piece.params, 2))));
    const oppN = Math.max(1, Math.round(getPName(piece.params, 'buffs2', getP2(piece.params, 1))));
    const selfPicked = giveRandomBuffs(player, selfN, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'evil_hat', selfPicked);
    const oppPicked = giveRandomBuffs(dummy, oppN, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'evil_hat', oppPicked, 0.01, 'dummy');
    return true;
  },
};

/** MechaBat.gd — Lucky/stamina vamp branches; charged neighbor lifesteal. */
/** @type {ScriptHandler} */
export const mechaBatPort = {
  handlerId: 'mecha_bat',
  family: 'custom_cd',
  onCombatStart(piece, ctx) {
    piece._mechaLifesteal = false;
    const lsPct = getPName(piece.params, 'lifesteal', 20) / 100;
    const keys = new Set(linkedWith(ctx, piece).map(({ other }) => other.placementKey));
    ctx.bus?.on?.('piece_dealt_damage', (payload) => {
      if (!piece._mechaLifesteal || !payload?.hit?.hit) return;
      const src = payload.piece;
      if (!src || !keys.has(src.placementKey)) return;
      // Game: ceil(damageRes.damage × lifesteal%) — full damage, not healthDamage.
      const dmg = Number(payload.hit.damage ?? payload.hit.healthDamage) || 0;
      if (dmg <= 0) return;
      const amt = Math.max(1, Math.ceil(dmg * lsPct));
      const healed = healActor(ctx.player, amt);
      if (healed > 0) {
        const side = eventSideForPiece(piece);
        ctx.events.push({
          t: payload.t ?? ctx.t,
          type: 'heal',
          actor: side,
          target: side,
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          amount: healed,
          label: `${piece.name}: retaliate lifesteal +${healed}`,
          meta: {
            category: 'heal',
            script: true,
            handler: 'mecha_bat',
            meterAttached: true,
            requestedHealAmount: amt,
          },
        });
      }
    });
  },
  onChargeReceived(piece) {
    piece._mechaLifesteal = (piece.numCharges || 0) >= 1;
  },
  onChargeLeft(piece) {
    piece._mechaLifesteal = (piece.numCharges || 0) >= 1;
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    let numVamp = 0;
    const luckNeed = Math.max(1, Math.round(getPName(piece.params, 'luckt', 3)));
    const luckUse = Math.max(1, Math.round(getPName(piece.params, 'luck', 1)));
    const vamp2 = Math.max(0, Math.round(getPName(piece.params, 'vampirism2', 1)));
    // Game: if lucky ≥ luckt, always useLucky then always add vampirism2
    // (not gated on spend success — MechaBat.gd lines 16–18).
    if ((Number(player.stacks.lucky) || 0) >= luckNeed) {
      useLucky(player, luckUse, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      numVamp += vamp2;
    }
    const vamp1 = Math.max(0, Math.round(getPName(piece.params, 'vampirism', getP1(piece.params, 1))));
    if (tryUseStamina(player, piece.staminaCost || 1) === 'ok') {
      numVamp += vamp1;
    } else if (numVamp === 0) {
      // Only surface starve when the tick grants nothing (GD still ticks the bar).
      events.push({
        t,
        type: 'stamina',
        label: `${piece.name}: out of stamina`,
        meta: { category: 'stamina', script: true, starved: true, handler: 'mecha_bat' },
      });
    }
    // Game: giveVampirism + activate() only when numVamp > 0.
    if (numVamp > 0) {
      pushActivate(piece, ctx, 'mecha_bat', `Pet: ${piece.name}`);
      grantStacks(player, 'vampirism', numVamp, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    return true;
  },
};

/** MercuryElemental.gd — attack→block; stamina-used→poison; CD stamina. */
/** @type {ScriptHandler} */
export const mercuryElementalPort = {
  handlerId: 'mercury_elemental',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    const links = linkedWith(ctx, piece);
    const ids = new Set(links.map(({ other }) => other.itemId));
    piece._mercStam =
      Math.max(0, Math.round(getPName(piece.params, 'stamina', getP1(piece.params, 1)))) *
      Math.max(1, ids.size || links.length || 1);
    piece._mercStamUsed = 0;
    const blockPct = (Number(piece.blockGrant) || getPName(piece.params, 'block', 10)) / 100;
    ctx.bus?.on?.('piece_dealt_damage', (payload) => {
      if (!payload?.hit?.hit) return;
      const dam = Number(payload.hit.healthDamage) || 0;
      if (dam > 0 && blockPct > 0) {
        const b = Math.max(1, Math.round(blockPct * dam));
        grantStacks(ctx.player, 'block', b, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      }
      // Gap: no character_used_stamina bus — proxy via attacker staminaCost on hit
      const cost = Math.max(0, Number(payload.piece?.staminaCost) || 0);
      if (cost <= 0) return;
      piece._mercStamUsed = (Number(piece._mercStamUsed) || 0) + cost;
      const th = Math.max(0.5, getPName(piece.params, 'staminat', 3));
      const poison = Math.max(0, Math.round(getPName(piece.params, 'poison', 1)));
      const selfP = Math.max(0, Math.round(getPName(piece.params, 'poison2', 0)));
      const ticks = Math.floor(piece._mercStamUsed / th);
      if (ticks <= 0) return;
      piece._mercStamUsed -= ticks * th;
      if (poison) {
        grantStacks(ctx.dummy, 'poison', ticks * poison, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      }
      if (selfP) {
        grantStacks(ctx.player, 'poison', ticks * selfP, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      }
    });
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'mercury_elemental', `Pet: ${piece.name}`);
    const stam = Number(piece._mercStam) || Math.max(1, Math.round(getP1(piece.params, 2)));
    player.stamina = Math.min(player.maxStamina || 20, (player.stamina || 0) + stam);
    events.push({
      t: t + 0.004,
      type: 'stamina',
      amount: stam,
      label: `${piece.name}: +${stam} stamina`,
      meta: { category: 'stamina', script: true, handler: 'mercury_elemental' },
    });
    return true;
  },
};

/** ParadiseBirb.gd — speed + buff/heal amp pulses; retire at max. */
/** @type {ScriptHandler} */
export const paradiseBirbPort = {
  handlerId: 'paradise_birb',
  family: 'pet_like',
  onCombatStart(piece) {
    piece._birbActs = 0;
  },
  onCooldownEffect(piece, ctx) {
    const { t, events } = ctx;
    pushActivate(piece, ctx, 'paradise_birb', `Pet: ${piece.name}`);
    const maxActs = Math.max(1, Math.round(getPName(piece.params, 'max', getP2(piece.params, 4))));
    const speedBonus = getPName(piece.params, 'speed', getP1(piece.params, 10)) / 100;
    const healAmp = getPName(piece.params, 'healamp', 5) / 100;
    const amp = Math.max(0, Number(piece.chance) || getPName(piece.params, 'chance', 10));
    const acts = Number(piece._birbActs) || 0;
    if (acts < maxActs) {
      for (const { other } of linkedWith(ctx, piece)) {
        addSpeed(other, speedBonus);
        other.buffAmpChance = (Number(other.buffAmpChance) || 0) + amp;
      }
      // Gap: per-item healAmp not wired — fold onto player heal amp (actor._healAmp)
      if (healAmp) applyHealEfficiency(ctx.player, healAmp, ctx, piece);
      piece._birbActs = acts + 1;
      if (piece._birbActs >= maxActs) {
        piece.alive = false;
        piece.charges = 0;
      }
    }
    events.push({
      t: t + 0.004,
      type: 'info',
      label: `${piece.name}: buff/heal amp pulse`,
      meta: { category: 'adjacency', script: true, handler: 'paradise_birb' },
    });
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const WAVE_AI_C_PORTS_A = {
  badger_spirit: badgerSpiritPort,
  crow: crowPort,
  evil_hat: evilHatPort,
  mecha_bat: mechaBatPort,
  mercury_elemental: mercuryElementalPort,
  paradise_birb: paradiseBirbPort,
};

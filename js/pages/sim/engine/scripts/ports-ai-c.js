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
import { giveStamina, healActor, tryUseStamina } from '../actor.js';
import { applyHealEfficiency, applyUnhealing } from '../actor-stats.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getP4, getP5, getPName } from '../params.js';
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
  // BadgerSpirit.gd connects during onPrepare.
  onPrepare(piece, ctx) {
    piece._badgerArmed = true;
    const th = getPName(piece.params, 'healtht', 50) / 100;
    ctx.bus?.on?.('character_damaged', (payload) => {
      if (payload?.actor && payload.actor !== ctx.player) return;
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
  onPrepare(piece) {
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
        addSpeed(other, speedBonus);
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
  onPrepare(piece, ctx) {
    const darkN = linkedWith(
      ctx,
      piece,
      (o, link) =>
        link.color === 'secondary' && itemHasType(ctx.itemsById.get(o.itemId), 'dark'),
    ).length;
    let unh = getPName(piece.params, 'unhealing', getP4(piece.params, 10)) / 100;
    unh += darkN * (getPName(piece.params, 'unhealing2', getP5(piece.params, 5)) / 100);
    if (unh) applyUnhealing(ctx.player, unh, ctx, piece);

    const regenPer = Math.trunc(getPName(piece.params, 'regen', getP3(piece.params, 1)));
    const chanceRaw = piece.chance ?? ctx.itemsById?.get?.(piece.itemId)?.chance;
    const chance = chanceRaw == null || !Number.isFinite(Number(chanceRaw))
      ? 0
      : Number(chanceRaw);
    const isOwnerOrigin = (ch) => {
      const origin = (ctx.pieces || []).find((o) => o.placementKey === ch?.originKey);
      return Boolean(origin && origin.side === piece.side);
    };
    onBuffChanged(ctx.player, (ch) => {
      if (!isOwnerOrigin(ch) || !(ch.amount > 0) || !['poison', 'blind', 'cold'].includes(ch.stack)) return;
      let give = 0;
      for (let i = 0; i < ch.amount; i += 1) {
        if (rollPercent(chance, ctx.rng)) give += regenPer;
      }
      if (give > 0) {
        grantStacks(ctx.player, 'regeneration', give, {
          originKey: piece.placementKey,
          originId: piece.itemId,
          rng: ctx.rng,
        });
      }
    });
    const critRaw = piece.chance2 ?? ctx.itemsById?.get?.(piece.itemId)?.chance2;
    const critPer = critRaw == null || !Number.isFinite(Number(critRaw))
      ? 0
      : Number(critRaw);
    onBuffChanged(ctx.dummy, (ch) => {
      if (!isOwnerOrigin(ch) || !(ch.amount < 0) || !critPer) return;
      for (const { other } of linkedWith(ctx, piece, (_o, link) => link.color === 'primary')) {
        const item = ctx.itemsById.get(other.itemId);
        const min = Number(other.damageMin ?? item?.damageMin);
        const lifesteal = (item?.tags || []).some((tag) => /lifesteal/i.test(String(tag)));
        if (!(min > 0 || lifesteal)) continue;
        other.critChance = (Number(other.critChance) || 0) + critPer * -ch.amount;
      }
    });
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, dummy, events, rng } = ctx;
    const selfN = Math.trunc(getPName(piece.params, 'buffs', getP1(piece.params, 2)));
    const oppN = Math.trunc(getPName(piece.params, 'buffs2', getP2(piece.params, 1)));
    const selfPicked = giveRandomBuffs(player, selfN, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
      rng,
    });
    pushBuffGrants(events, piece, player, t, 'evil_hat', selfPicked);
    const oppPicked = giveRandomBuffs(dummy, oppN, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
      rng,
    });
    pushBuffGrants(events, piece, player, t, 'evil_hat', oppPicked, 0.01, 'dummy');
    pushActivate(piece, ctx, 'evil_hat', `Pet: ${piece.name}`);
    return true;
  },
};

/** MechaBat.gd — Lucky/stamina vamp branches; charged neighbor lifesteal. */
/** @type {ScriptHandler} */
export const mechaBatPort = {
  handlerId: 'mecha_bat',
  family: 'custom_cd',
  onPrepare(piece, ctx) {
    piece._mechaLifesteal = false;
    piece.state = false;
    const lsPct = getPName(piece.params, 'lifesteal', getP5(piece.params, 20)) / 100;
    const keys = new Set(linkedWith(ctx, piece).map(({ other }) => other.placementKey));
    ctx.bus?.on?.('character_damaged', (payload = {}) => {
      if (payload.actor && payload.actor !== ctx.player) return;
      if (payload.attacker && payload.attacker !== ctx.dummy) return;
      if (!piece._mechaLifesteal) return;
      const hit = typeof payload.hit === 'object' ? payload.hit : { hit: payload.hit === true };
      if (!hit.hit) return;
      const damage = payload.damage;
      const source = damage?.damageSource ?? payload.damageSource;
      if (source?.canApplyLifesteal === false) return;
      if (typeof source?.canApplyLifesteal === 'function' && !source.canApplyLifesteal()) return;
      const origin = source?.originPiece ?? source?.origin;
      const originKey = typeof origin === 'string' ? origin : origin?.placementKey;
      if (!originKey || !keys.has(originKey)) return;
      // Game: ceil(damageRes.damage × lifesteal%) — full damage, not healthDamage.
      const dmg = Number(damage?.damage ?? payload.damage?.healthDamage ?? payload.healthDamage) || 0;
      if (dmg <= 0) return;
      const amt = Math.ceil(dmg * lsPct);
      if (amt <= 0) return;
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
    if (Number(piece.numCharges) === 1) {
      piece._mechaLifesteal = true;
      piece.state = true;
    }
  },
  onChargeLeft(piece) {
    if (Number(piece.numCharges) === 0) {
      piece._mechaLifesteal = false;
      piece.state = false;
    }
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    let numVamp = 0;
    const luckNeed = Math.round(getPName(piece.params, 'luckt', getP2(piece.params, 3)));
    const luckUse = Math.round(getPName(piece.params, 'luck', getP3(piece.params, 1)));
    const vamp2 = Math.round(getPName(piece.params, 'vampirism2', getP4(piece.params, 1)));
    // Game: if lucky ≥ luckt, always useLucky then always add vampirism2
    // (not gated on spend success — MechaBat.gd lines 16–18).
    if ((Number(player.stacks.lucky) || 0) >= luckNeed) {
      useLucky(player, luckUse, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      numVamp += vamp2;
    }
    const vamp1 = Math.round(getPName(piece.params, 'vampirism', getP1(piece.params, 1)));
    if (tryUseStamina(player, Math.max(0, Number(piece.staminaCost) || 0)) === 'ok') {
      numVamp += vamp1;
    }
    // Game: giveVampirism + activate() only when numVamp > 0.
    if (numVamp > 0) {
      grantStacks(player, 'vampirism', numVamp, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      pushActivate(piece, ctx, 'mecha_bat', `Pet: ${piece.name}`);
    }
    return true;
  },
};

/** MercuryElemental.gd — attack→block; stamina-used→poison; CD stamina. */
/** @type {ScriptHandler} */
export const mercuryElementalPort = {
  handlerId: 'mercury_elemental',
  family: 'pet_like',
  // MercuryElemental.gd connects both signals during onPrepare, before the
  // first incoming attack or stamina use can occur.
  onPrepare(piece, ctx) {
    const links = linkedWith(ctx, piece);
    piece._mercStam =
      getPName(piece.params, 'stamina', getP1(piece.params, 1)) * links.length;
    piece._mercStamUsed = 0;
    const catalogBlock = ctx.itemsById?.get?.(piece.itemId)?.block;
    const blockRaw = Number.isFinite(Number(piece.blockGrant))
      ? Number(piece.blockGrant)
      : Number.isFinite(Number(catalogBlock))
        ? Number(catalogBlock)
        : getPName(piece.params, 'block', 0);
    const blockPct = blockRaw / 100;
    ctx.bus?.on?.('character_damaged', (payload = {}) => {
      if (payload.actor && payload.actor !== ctx.player) return;
      if (payload.attacker && payload.attacker !== ctx.dummy) return;
      const hit = typeof payload.hit === 'object' ? Boolean(payload.hit.hit) : Boolean(payload.hit);
      const damage = payload.damage;
      const source = damage?.damageSource ?? payload.damageSource;
      if (!hit || source?.isAttack === false || source?.canTriggerItems === false) return;
      const dam = Number(damage?.damage ?? payload.damageAmount) || 0;
      if (dam > 0 && blockPct > 0) {
        const b = blockPct * dam;
        grantStacks(ctx.player, 'block', b, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      }
    });
    ctx.bus?.on?.('stamina_used', (payload = {}) => {
      if (payload.actor && payload.actor !== ctx.player) return;
      const amount = Number(payload.amount) || 0;
      if (!(amount > 0)) return;
      piece._mercStamUsed = (Number(piece._mercStamUsed) || 0) + amount;
      const th = getPName(piece.params, 'staminat', 0);
      if (!(th > 0)) return;
      const poison = getPName(piece.params, 'poison', 0);
      const selfP = getPName(piece.params, 'poison2', 0);
      const ticks = Math.floor(piece._mercStamUsed / th);
      if (ticks <= 0) return;
      piece._mercStamUsed -= ticks * th;
      if (poison > 0) {
        grantStacks(ctx.dummy, 'poison', ticks * poison, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      }
      if (selfP > 0) {
        grantStacks(ctx.player, 'poison', ticks * selfP, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      }
      ctx.events?.push?.({
        t: payload.t ?? ctx.t,
        type: 'info',
        actor: eventSideForPiece(piece),
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: mini activate`,
        meta: { category: 'system', script: true, handler: 'mercury_elemental', miniActivate: true },
      });
    });
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    const stam = Number.isFinite(Number(piece._mercStam))
      ? Number(piece._mercStam)
      : getPName(piece.params, 'stamina', getP1(piece.params, 1));
    const before = Number(player.stamina) || 0;
    giveStamina(player, stam);
    const gained = (Number(player.stamina) || 0) - before;
    if (gained > 0) {
      events.push({
        t: t + 0.004,
        type: 'stamina',
        amount: gained,
        label: `${piece.name}: +${gained} stamina`,
        meta: { category: 'stamina', kind: 'gained', script: true, handler: 'mercury_elemental' },
      });
    }
    pushActivate(piece, ctx, 'mercury_elemental', `Pet: ${piece.name}`);
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

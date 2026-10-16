/**
 * Band AO — leftover shields (chance-block + beforeBlock / afterBlock).
 */

import { drainStamina, healActor } from '../actor.js';
import { grantStacks, onBuffChanged, spendStacks } from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { giveBuffPower } from '../buff-power.js';
import { getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { dealEffectDamage } from './handlers.js';
import { itemHasType, pushActivate, pushBuffGrants } from './ports-util.js';
import { applyHealEfficiency } from '../actor-stats.js';
import { rollPercent } from '../rng.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

function registerShield(piece, ctx, opts) {
  const catalog = ctx.itemsById.get(piece.itemId);
  const chanceRaw = piece.chance != null ? piece.chance : catalog?.chance;
  const chanceValue = Number(chanceRaw);
  const chance = Number.isFinite(chanceValue) ? chanceValue : 30;
  const damblock = Math.max(
    1,
    Math.round(opts.damblock ?? getPName(piece.params, 'damblock', getP1(piece.params, 7))),
  );
  const baseGetter = opts.getDamblock;
  const readDamblock = () => {
    const base = Number(baseGetter ? baseGetter() : damblock) || 0;
    const add = Number(piece.paramAdd?.damblock) || 0;
    const rawMult = Number(piece.paramMult?.damblock);
    const multiplier = Number.isFinite(rawMult) && rawMult !== 0 ? rawMult : 1;
    return (base + add) * multiplier;
  };
  if (!ctx.player._shields) ctx.player._shields = [];
  const liveCtx = () => ({
    ...ctx,
    t: Number(ctx.player?._simT) || ctx.t,
  });
  ctx.player._shields.push({
    piece,
    chance,
    damblock,
    getDamblock: readDamblock,
    beforeBlock(payload) {
      if (!piece.alive) return;
      opts.beforeBlock?.(payload, liveCtx());
    },
    afterBlock(payload) {
      if (!piece.alive) return;
      const drain = Math.max(
        0,
        Number(getPName(piece.params, 'stamina', getP2(piece.params, 0.3))) || 0,
      );
      if (drain > 0) {
        drainStamina(ctx.player, drain, {
          events: liveCtx().events,
          t: liveCtx().t,
          actorSide: 'player',
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          label: `${piece.name}: Removed ${drain} stamina`,
          handler: piece.itemId,
        });
      }
      opts.afterBlock?.(payload, liveCtx());
      pushActivate(piece, liveCtx(), piece.itemId, `Shield: ${piece.name}`);
    },
  });
}

function linked(ctx, piece) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  return (ctx.pieces || []).filter((o) => links.some((l) => l.key === o.placementKey));
}

function origin(piece) {
  return { originKey: piece.placementKey, originId: piece.itemId, piece };
}

const frozenBucklerPort = {
  handlerId: 'frozen_buckler',
  family: 'unique',
  onPrepare(piece) {
    piece._coldN = 0;
  },
  onCombatStart(piece, ctx) {
    const maxC = Number(getP4(piece.params, 0)) || 0;
    const cold = Number(getP3(piece.params, 0)) || 0;
    registerShield(piece, ctx, {
      afterBlock() {
        if (piece._coldN < maxC) {
          piece._coldN += 1;
          grantStacks(ctx.dummy, 'cold', cold, origin(piece));
        }
      },
    });
  },
};

const heartShieldPort = {
  handlerId: 'heart_shield',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const fac = getPName(piece.params, 'block', 20) / 100;
    for (const o of linked(ctx, piece)) {
      if (Number(o.blockGrant) > 0) o.blockGrant = Math.round(o.blockGrant * (1 + fac));
    }
    applyHealEfficiency(ctx.player, getPName(piece.params, 'healamp', 30) / 100, ctx, piece);
    piece._heartActive = false;
    piece._regenGiven = 0;
    const maxR = Math.max(1, Math.round(getPName(piece.params, 'max_regen', 4)));
    const onBlk = Math.max(1, Math.round(getPName(piece.params, 'regen', 1)));
    const need = Math.max(1, Math.round(getPName(piece.params, 'regent', 7)));
    registerShield(piece, ctx, {
      afterBlock() {
        if (piece._regenGiven < maxR) {
          grantStacks(ctx.player, 'regeneration', onBlk, origin(piece));
          piece._regenGiven += onBlk;
        }
      },
    });
    onBuffChanged(ctx.player, (change) => {
      if (piece._heartActive || change.stack !== 'regeneration' || change.amount <= 0) return;
      if ((Number(ctx.player.stacks.regeneration) || 0) < need) return;
      piece._heartActive = true;
      spendStacks(ctx.player, 'regeneration', need, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      const hp = Math.max(0, Math.round(getPName(piece.params, 'maxhealth', 150)));
      ctx.player.maxHp += hp;
      ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + hp);
      ctx.events.push({
        t: ctx.t,
        type: 'buff',
        target: 'player',
        amount: hp,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${hp} Max Health`,
        meta: { category: 'buff', stack: 'maxhealth', script: true, handler: 'heart_shield' },
      });
    });
    // The activated override also blocks ranged/effect damage; the normal
    // Shield registration covers melee attacks through damage.js.
    ctx.bus?.on?.('pre_take_damage', (payload) => {
      if (!piece._heartActive || payload?.defender !== ctx.player) return;
      const source = payload.source || {};
      if (source.isAttack !== false && source.isMelee !== false) return;
      if (!source.isEffectDamage && source.isAttack === false) return;
      if (!rollPercent(Number(piece.chance) || 30, ctx.rng)) return;
      const damage = payload.damage;
      const cut = Math.min(Math.max(0, Number(damage?.damage) || 0), Math.max(1, Math.round(getPName(piece.params, 'damblock', 20))));
      if (cut > 0) {
        damage.damage -= cut;
        damage.reduced = (damage.reduced || 0) + cut;
        drainStamina(ctx.player, Math.max(0, Number(getP2(piece.params, 0.7)) || 0), {
          events: ctx.events,
          t: ctx.t,
          actorSide: 'player',
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          label: `${piece.name}: Removed stamina`,
          handler: piece.itemId,
        });
        if (piece._regenGiven < maxR) {
          grantStacks(ctx.player, 'regeneration', onBlk, origin(piece));
          piece._regenGiven += onBlk;
        }
        pushActivate(piece, ctx, piece.itemId, `Shield: ${piece.name}`);
      }
    });
  },
};

const moonShieldPort = {
  handlerId: 'moon_shield',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._blk = 0;
    const need = Math.max(1, Math.round(getP4(piece.params, 4)));
    const fac = getP3(piece.params, 20) / 100;
    for (const o of linked(ctx, piece)) {
      if (Number(o.blockGrant) > 0) o.blockGrant = Math.round(o.blockGrant * (1 + fac));
    }
    registerShield(piece, ctx, {});
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'block' || !(ch.amount > 0)) return;
      piece._blk += ch.amount;
      const mana = Math.floor(piece._blk / need);
      if (mana <= 0) return;
      piece._blk %= need;
      grantStacks(ctx.player, 'mana', mana, origin(piece));
    });
  },
};

/**
 * PineProtector.gd extends SpikedShield.gd —
 * food stars: maxSpikes += maxspikes_food × foods; food activate → +damblock2 (cap maxblock) + heal;
 * beforeBlock: give spikes (cap maxSpikes); afterBlock: drain stamina + activate (registerShield).
 */
const pineProtectorPort = {
  handlerId: 'pine_protector',
  family: 'unique',
  onPrepare(piece, ctx) {
    piece._spikesGiven = 0;
    piece._damblockIncrease = 0;
    const baseDam = Math.max(
      1,
      Math.round(getPName(piece.params, 'damblock', getP1(piece.params, 10))),
    );
    const spikesPer = Math.max(
      1,
      Math.round(getPName(piece.params, 'spikes', getP3(piece.params, 1))),
    );
    const maxBase = Math.max(
      0,
      Math.round(getPName(piece.params, 'maxspikes', getP4(piece.params, 5))),
    );
    const perFood = Math.max(0, Math.round(getPName(piece.params, 'maxspikes_food', 1)));
    const foods = linked(ctx, piece).filter((o) =>
      itemHasType(ctx.itemsById.get(o.itemId), 'food'),
    ).length;
    piece._maxSpikes = maxBase + perFood * foods;
    piece._damblock2 = Math.max(
      1,
      Math.round(getPName(piece.params, 'damblock2', getPName(piece.params, 'p5', 1))),
    );
    piece._maxblock = Math.max(
      0,
      Math.round(getPName(piece.params, 'maxblock', getPName(piece.params, 'p6', 10))),
    );
    piece._healOnFood = Math.max(
      1,
      Math.round(getPName(piece.params, 'heal', getPName(piece.params, 'p7', 8))),
    );

    registerShield(piece, ctx, {
      damblock: baseDam,
      getDamblock: () => baseDam + (Number(piece._damblockIncrease) || 0),
      // SpikedShield.beforeBlock — give spikes before damage resolves.
      beforeBlock(_payload, liveCtx) {
        const left = piece._maxSpikes - (Number(piece._spikesGiven) || 0);
        if (!(left > 0)) return;
        const n = Math.min(left, spikesPer);
        piece._spikesGiven += n;
        grantStacks(ctx.player, 'spikes', n, {
          ...origin(piece),
          silentLog: true,
        });
        pushBuffGrants(liveCtx.events, piece, liveCtx.player, liveCtx.t, 'pine_protector', {
          spikes: n,
        });
      },
    });
  },
  // PineProtector.onItemActivated — starred food activate → damblock up + heal.
  onPeerActivated(listener, activated, ctx) {
    if (!itemHasType(ctx.itemsById.get(activated.itemId), 'food')) return;
    const cap = Number(listener._maxblock) || 0;
    const step = Number(listener._damblock2) || 1;
    const cur = Number(listener._damblockIncrease) || 0;
    if (cur < cap) {
      listener._damblockIncrease = cur + Math.min(step, cap - cur);
    }
    const healAmt = Math.max(1, Math.round(Number(listener._healOnFood) || 8));
    const healed = healActor(ctx.player, healAmt);
    if (healed > 0 || (ctx.player._lastHeal && !ctx.player._lastHeal.meterAttached)) {
      const logged = Number(ctx.player._lastHeal?.loggedAmount) || healed;
      if (ctx.player._lastHeal) ctx.player._lastHeal.meterAttached = true;
      ctx.events.push({
        t: ctx.t + 0.002,
        type: 'heal',
        actor: 'player',
        target: 'player',
        amount: logged,
        itemId: listener.itemId,
        placementKey: listener.placementKey,
        label: `${listener.name}: heal +${logged}`,
        meta: { category: 'heal', script: true, handler: 'pine_protector' },
      });
    }
  },
};

const shieldOfValorPort = {
  handlerId: 'shield_of_valor',
  family: 'unique',
  onPrepare(piece, ctx) {
    const fac = getP3(piece.params, 20) / 100;
    if (!fac) return;
    for (const o of linked(ctx, piece)) {
      if (Number(ctx.itemsById.get(o.itemId)?.block) > 0) giveBuffPower(o, 'block', fac);
    }
  },
  onCombatStart(piece, ctx) {
    registerShield(piece, ctx, {});
  },
};

const spikedShieldPort = {
  handlerId: 'spiked_shield',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._spikesGiven = 0;
    const spikes = Math.max(1, Math.round(getPName(piece.params, 'spikes', 2)));
    const maxS = Math.max(spikes, Math.round(getPName(piece.params, 'maxspikes', 8)));
    registerShield(piece, ctx, {
      beforeBlock() {
        const left = maxS - (Number(piece._spikesGiven) || 0);
        if (!(left > 0)) return;
        const n = Math.min(left, spikes);
        piece._spikesGiven += n;
        grantStacks(ctx.player, 'spikes', n, origin(piece));
      },
    });
  },
};

const spikedWallPort = {
  handlerId: 'spiked_wall',
  family: 'unique',
  onCombatStart(piece, ctx) {
    spikedShieldPort.onCombatStart(piece, ctx);
    const malus = getPName(piece.params, 'staminaregen', 20) / 100;
    ctx.player.staminaRegen = Math.max(0, (Number(ctx.player.staminaRegen) || 1) * (1 - malus));
    ctx.player._battleRageDur =
      (Number(ctx.player._battleRageDur) || 0) + getPName(piece.params, 'dur_rage', 2);
  },
};

const sunShieldPort = {
  handlerId: 'sun_shield',
  family: 'unique',
  onPrepare(piece, ctx) {
    piece._sunShieldPrepared = true;
    piece._blk = 0;
    piece._sunShieldBonusDamage = 0;
    const linkedKeys = new Set(linked(ctx, piece).map((target) => target.placementKey));
    const blockPerTick = Math.max(1, Math.trunc(getP3(piece.params, 1)));
    const damagePerTick = Math.trunc(getP4(piece.params, 0));
    onBuffChanged(ctx.player, (change) => {
      if (change.stack !== 'block' || !(change.amount > 0)) return;
      if (!linkedKeys.has(change.originKey)) return;
      piece._blk += change.amount;
      const ticks = Math.floor(piece._blk / blockPerTick);
      if (ticks <= 0) return;
      piece._blk %= blockPerTick;
      const liveCtx = {
        ...ctx,
        t: Number(ctx.player?._simT) || ctx.t,
      };
      dealEffectDamage(
        piece,
        liveCtx,
        ticks * (damagePerTick + (Number(piece._sunShieldBonusDamage) || 0)),
      );
      liveCtx.events.push({
        t: liveCtx.t,
        type: 'info',
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: mini activate`,
        meta: { category: 'system', script: true, handler: 'sun_shield', miniActivate: true },
      });
    });
  },
  onCombatStart(piece, ctx) {
    if (!piece._sunShieldPrepared) this.onPrepare(piece, ctx);
    registerShield(piece, ctx, {});
  },
  addBonusDamageOnTick(piece, _ctx, damage) {
    piece._sunShieldBonusDamage = (Number(piece._sunShieldBonusDamage) || 0) + (Number(damage) || 0);
  },
};

/** @type {Record<string, ScriptHandler>} */
export const AO_SHIELD_PORTS = {
  frozen_buckler: frozenBucklerPort,
  heart_shield: heartShieldPort,
  moon_shield: moonShieldPort,
  pine_protector: pineProtectorPort,
  shield_of_valor: shieldOfValorPort,
  spiked_shield: spikedShieldPort,
  spiked_wall: spikedWallPort,
  sun_shield: sunShieldPort,
};

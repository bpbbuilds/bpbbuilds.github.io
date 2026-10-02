/**
 * Band AO — leftover shields (chance-block + beforeBlock / afterBlock).
 */

import { healActor, tryUseStamina } from '../actor.js';
import { grantStacks, onBuffChanged } from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { dealHit } from './handlers.js';
import { itemHasType, pushActivate, pushBuffGrants } from './ports-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

function registerShield(piece, ctx, opts) {
  const chance =
    Number(ctx.itemsById.get(piece.itemId)?.chance) || Number(piece.chance) || 30;
  const damblock = Math.max(
    1,
    Math.round(opts.damblock ?? getPName(piece.params, 'damblock', getP1(piece.params, 7))),
  );
  if (!ctx.player._shields) ctx.player._shields = [];
  ctx.player._shields.push({
    piece,
    chance,
    damblock,
    getDamblock: opts.getDamblock,
    beforeBlock(payload) {
      if (!piece.alive) return;
      opts.beforeBlock?.(payload);
    },
    afterBlock(payload) {
      if (!piece.alive) return;
      opts.afterBlock?.(payload);
      const drain = Math.max(
        0,
        Number(getPName(piece.params, 'stamina', getP2(piece.params, 0.3))) || 0,
      );
      if (drain > 0) tryUseStamina(ctx.player, drain);
      pushActivate(piece, ctx, piece.itemId, `Shield: ${piece.name}`);
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
  onCombatStart(piece, ctx) {
    piece._coldN = 0;
    const maxC = Math.max(1, Math.round(getP4(piece.params, 3)));
    const cold = Math.max(1, Math.round(getP3(piece.params, 1)));
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
    piece._regenGiven = 0;
    const maxR = Math.max(1, Math.round(getPName(piece.params, 'max_regen', 4)));
    const onBlk = Math.max(1, Math.round(getPName(piece.params, 'regen', 1)));
    registerShield(piece, ctx, {
      afterBlock() {
        if (piece._regenGiven < maxR) {
          grantStacks(ctx.player, 'regeneration', onBlk, origin(piece));
          piece._regenGiven += onBlk;
        }
      },
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
  onCombatStart(piece, ctx) {
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
      beforeBlock() {
        const left = piece._maxSpikes - (Number(piece._spikesGiven) || 0);
        if (!(left > 0)) return;
        const n = Math.min(left, spikesPer);
        piece._spikesGiven += n;
        grantStacks(ctx.player, 'spikes', n, {
          ...origin(piece),
          silentLog: true,
        });
        pushBuffGrants(ctx.events, piece, ctx.player, ctx.t, 'pine_protector', {
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
  onCombatStart(piece, ctx) {
    const fac = getP3(piece.params, 20) / 100;
    for (const o of linked(ctx, piece)) {
      if (Number(o.blockGrant) > 0) o.blockGrant = Math.round(o.blockGrant * (1 + fac));
    }
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
  onCombatStart(piece, ctx) {
    piece._blk = 0;
    const per = Math.max(1, Math.round(getP3(piece.params, 4)));
    const dam = Math.max(1, Math.round(getP4(piece.params, 4)));
    registerShield(piece, ctx, {});
    ctx.bus?.on?.('afterBlock', () => {
      piece._blk += 1;
      const ticks = Math.floor(piece._blk / per);
      if (ticks <= 0) return;
      piece._blk %= per;
      dealHit(piece, ctx, ticks * dam, '', { ignoreBlock: true });
    });
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

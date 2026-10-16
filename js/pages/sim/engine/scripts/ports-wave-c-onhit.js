/**
 * Band AE Wave C — on-hit chance / steal / strip weapons.
 */

import {
  BUFF_KEYS,
  grantStacks,
  grantTemporaryStacks,
  inflictRandomDebuffs,
  onBuffChanged,
  stealRandomBuff,
  useMana,
} from '../buff-economy.js';
import { getP1, getP2, getP3, getP4, getP5, getPName } from '../params.js';
import { effectDuration, scaleEffectDuration } from '../effect-duration.js';
import { modifiedParamValue } from '../placement-instance.js';
import { addAccuracy, addBonusDamage, addSpeed, multiplyStaminaCost } from '../piece-stats.js';
import { dealEffectDamage, dealHit } from './handlers.js';
import { affectedTargets } from '../board-graph.js';
import { healActor, grantStun } from '../actor.js';
import { pushActivate } from './ports-util.js';
import { eventSideForPiece } from '../vs-board.js';
import { randInt } from '../rng.js';
import {
  removeRandomBuffs,
  rollItemChance,
  weaponStrike,
} from './ports-wave-c-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** Hammer.gd — chance stun on hit. */
/** @type {ScriptHandler} */
export const hammerPort = {
  handlerId: 'hammer',
  family: 'on_hit',
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'hammer');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit || !rollItemChance(piece, ctx.rng)) return;
    const dur = scaleEffectDuration(
      piece,
      modifiedParamValue(
        piece,
        getPName(piece.params, 'dur_stun', getP1(piece.params, 1)),
        'dur_stun',
      ),
    );
    grantStun(ctx.dummy, dur, ctx.t, {
      origin: piece,
      meta: { category: 'debuff', script: true, handler: 'hammer' },
    });
  },
};

/** LuckyShortbow.gd */
/** @type {ScriptHandler} */
export const luckyShortbowPort = {
  handlerId: 'lucky_shortbow',
  family: 'on_hit',
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'lucky_shortbow');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit || !rollItemChance(piece, ctx.rng)) return;
    grantStacks(ctx.player, 'lucky', 1, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    ctx.events.push({
      t: ctx.t + 0.008,
      type: 'buff',
      target: 'player',
      amount: 1,
      label: `${piece.name}: +1 Lucky`,
      meta: { category: 'buff', stack: 'lucky', script: true, handler: 'lucky_shortbow' },
    });
  },
};

/** ThornShortbow.gd */
/** @type {ScriptHandler} */
export const thornShortbowPort = {
  handlerId: 'thorn_shortbow',
  family: 'on_hit',
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'thorn_shortbow');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit || !rollItemChance(piece, ctx.rng)) return;
    grantStacks(ctx.player, 'spikes', 1, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
  },
};

/** SnowStick.gd */
/** @type {ScriptHandler} */
export const snowStickPort = {
  handlerId: 'snow_stick',
  family: 'on_hit',
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'snow_stick');
  },
  onPreDealDamageEarly(piece, ctx, hit) {
    if (!hit?.hit) return;
    const cold = Math.trunc(getPName(piece.params, 'cold', getP1(piece.params, 2)));
    const selfCold = Math.trunc(getPName(piece.params, 'cold2', getP2(piece.params, 1)));
    if (cold > 0) {
      grantStacks(ctx.dummy, 'cold', cold, {
        originKey: piece.placementKey,
        originId: piece.itemId,
        rng: ctx.rng,
        opponent: ctx.player,
      });
    }
    if (selfCold) {
      grantStacks(ctx.player, 'cold', selfCold, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    ctx.events.push({
      t: ctx.t + 0.008,
      type: 'debuff',
      target: 'dummy',
      amount: cold,
      label: `${piece.name}: +${cold} Cold`,
      meta: { category: 'debuff', stack: 'cold', script: true, handler: 'snow_stick' },
    });
  },
};

/** Boomerang.gd */
/** @type {ScriptHandler} */
export const boomerangPort = {
  handlerId: 'boomerang',
  family: 'on_hit',
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'boomerang');
  },
  onPreDealDamageEarly(piece, ctx, hit) {
    if (!hit?.hit) return;
    const stamRed = Math.abs(getPName(piece.params, 'stamina', getP1(piece.params, 10)) / 100);
    if (stamRed) multiplyStaminaCost(piece, -stamRed);
    if (!rollItemChance(piece, ctx.rng)) return;
    const stolen = stealRandomBuff(ctx.dummy, ctx.player, 1, ctx.rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const n = Object.values(stolen).reduce((a, b) => a + b, 0);
    if (n > 0) {
      ctx.events.push({
        t: ctx.t + 0.008,
        type: 'buff',
        actor: eventSideForPiece(piece),
        target: eventSideForPiece(piece),
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        amount: n,
        label: `${piece.name}: stole buff`,
        meta: { category: 'buff', script: true, handler: 'boomerang' },
      });
    }
  },
};

/** Daggerang.gd — same steal pattern. */
/** @type {ScriptHandler} */
export const daggerangPort = {
  handlerId: 'daggerang',
  family: 'on_hit',
  onPrepare(piece, ctx) {
    ctx.bus?.on?.('actor_stunned', (payload) => {
      if (!piece.alive || payload?.actor !== ctx.dummy) return;
      const raw = randInt(piece.damageMin, piece.damageMax, ctx.rng);
      dealHit(piece, ctx, raw);
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'daggerang');
  },
  onPreDealDamageEarly(piece, ctx, hit) {
    if (!hit?.hit) return;
    const stamRed = Math.abs(getPName(piece.params, 'stamina', getP1(piece.params, 10)) / 100);
    if (stamRed) multiplyStaminaCost(piece, -stamRed);
    if (!rollItemChance(piece, ctx.rng)) return;
    const stolen = stealRandomBuff(ctx.dummy, ctx.player, 1, ctx.rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const n = Object.values(stolen).reduce((a, b) => a + b, 0);
    if (n > 0) {
      ctx.events.push({
        t: ctx.t + 0.008,
        type: 'buff',
        actor: eventSideForPiece(piece),
        target: eventSideForPiece(piece),
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        amount: n,
        label: `${piece.name}: stole buff`,
        meta: { category: 'buff', script: true, handler: 'daggerang' },
      });
    }
  },
};

/** BrassKnuckles.gd — crit/acc on hit + chance stun; rage → speed. */
/** @type {ScriptHandler} */
export const brassKnucklesPort = {
  handlerId: 'brass_knuckles',
  family: 'on_hit',
  onPrepare(piece, ctx) {
    const rageSpeed = getP4(piece.params, 15) / 100;
    piece._knuckleRageOn = false;
    ctx.bus?.on?.('battle_rage_started', (payload) => {
      if (payload?.actor && payload.actor !== ctx.player) return;
      if (piece._knuckleRageOn || !rageSpeed) return;
      addSpeed(piece, rageSpeed);
      piece._knuckleRageOn = true;
    });
    ctx.bus?.on?.('battle_rage_ended', (payload) => {
      if (payload?.actor && payload.actor !== ctx.player) return;
      if (!piece._knuckleRageOn || !rageSpeed) return;
      addSpeed(piece, -rageSpeed);
      piece._knuckleRageOn = false;
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'brass_knuckles');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    const acc = Math.max(0, getP2(piece.params, 2));
    const critPct = piece.chance2 > 0 ? piece.chance2 : getPName(piece.params, 'chance2', 5);
    piece.critChance = (Number(piece.critChance) || 0) + critPct;
    if (acc) addAccuracy(piece, acc);
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    for (const other of ctx.pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      other.critChance = (Number(other.critChance) || 0) + critPct;
      if (acc && (other.kind === 'weapon' || other.damageMax > 0)) addAccuracy(other, acc);
    }
    if (rollItemChance(piece, ctx.rng)) {
      const dur = Math.max(0, effectDuration(piece, 'dur_stun', 1));
      grantStun(ctx.dummy, dur, ctx.t, {
        origin: piece,
        meta: { category: 'debuff', script: true, handler: 'brass_knuckles' },
      });
    }
  },
};

/** ThorsHammer.gd — stun + mana → effect dmg + temp blind. */
/** @type {ScriptHandler} */
export const thorsHammerPort = {
  handlerId: 'thors_hammer',
  family: 'on_hit',
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'thors_hammer');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    const { player, dummy, rng, t, events } = ctx;
    if (rollItemChance(piece, rng)) {
      const dur = scaleEffectDuration(
        piece,
        modifiedParamValue(
          piece,
          getPName(piece.params, 'dur_stun', getP1(piece.params, 0.5)),
          'dur_stun',
        ),
      );
      grantStun(dummy, dur, t, {
        origin: piece,
        meta: { category: 'debuff', script: true, handler: 'thors_hammer' },
      });
    }
    const need = Math.trunc(getPName(piece.params, 'manat', getP2(piece.params, 2)));
    if ((player.stacks.mana || 0) < need) return;
    useMana(player, need, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const effectDmg = Math.trunc(getPName(piece.params, 'dam', getP3(piece.params, 12)));
    dealEffectDamage(piece, ctx, effectDmg);
    const blind = Math.trunc(getPName(piece.params, 'blind', getP4(piece.params, 5)));
    const dur = scaleEffectDuration(
      piece,
      modifiedParamValue(
        piece,
        getPName(piece.params, 'dur_blind', getP5(piece.params, 2)),
        'dur_blind',
      ),
    );
    const blindGain = grantTemporaryStacks(dummy, 'blind', blind, dur, t, {
      rng,
      opponent: player,
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    if (blindGain.gained > 0) {
      events.push({
        t: t + 0.01,
        type: 'debuff',
        target: 'dummy',
        amount: blindGain.gained,
        label: `${piece.name}: +${blindGain.gained} Blind`,
        meta: {
          category: 'debuff',
          stack: 'blind',
          script: true,
          handler: 'thors_hammer',
          temp: true,
          duration: dur,
        },
      });
    }
  },
};

/** AmethystWhelp.gd */
/** @type {ScriptHandler} */
export const amethystWhelpPort = {
  handlerId: 'amethyst_whelp',
  family: 'on_hit',
  onCombatStart(piece, ctx) {
    const n = Math.max(1, Math.round(getP1(piece.params, 2)));
    inflictRandomDebuffs(ctx.dummy, n, ctx.rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
      rng: ctx.rng,
      opponent: ctx.player,
    });
    ctx.events.push({
      t: ctx.t,
      type: 'debuff',
      target: 'dummy',
      amount: n,
      label: `${piece.name}: random debuffs ×${n}`,
      meta: { category: 'debuff', script: true, handler: 'amethyst_whelp' },
    });
    pushActivate(piece, ctx, 'amethyst_whelp', `Weapon: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'amethyst_whelp');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    removeRandomBuffs(ctx.dummy, 1, ctx.rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
  },
};

/** ChainWhip.gd — strip buffs; purge listener → bonus dmg; rage heal. */
/** @type {ScriptHandler} */
function chainWhipPreDealDamage(piece, ctx, hit) {
  if (!hit?.hit) return;
  const n = Math.max(1, Math.round(getP1(piece.params, 1)));
  removeRandomBuffs(ctx.dummy, n, ctx.rng, {
    originKey: piece.placementKey,
    originId: piece.itemId,
  });
  if (ctx.player.battleRage) {
    const healed = healActor(ctx.player, Math.max(1, Math.round(getP2(piece.params, 4))));
    if (healed > 0) {
      ctx.events.push({
        t: ctx.t + 0.008,
        type: 'heal',
        target: 'player',
        amount: healed,
        label: `${piece.name}: rage heal +${healed}`,
        meta: { category: 'heal', script: true, handler: 'chain_whip' },
      });
    }
  }
}

export const chainWhipPort = {
  handlerId: 'chain_whip',
  family: 'on_hit',
  onPrepare(piece, ctx) {
    piece._buffsPurged = 0;
    const per = Math.max(0, Math.round(getP3(piece.params, 1)));
    onBuffChanged(ctx.dummy, (ch) => {
      if (!(ch.amount < 0) || !BUFF_KEYS.includes(String(ch.stack))) return;
      const origin = [...(ctx.allPieces || ctx.pieces || [])].find(
        (candidate) => candidate.placementKey === ch.originKey,
      );
      // ChainWhip.gd checks the Item origin's character, not only the whip's
      // own placement. Preserve that distinction when another allied item
      // strips the opponent's buffs through the same character.
      if (origin) {
        if (eventSideForPiece(origin) !== eventSideForPiece(piece)) return;
      } else if (ch.originKey !== piece.placementKey) {
        return;
      }
      const n = Math.abs(ch.amount);
      piece._buffsPurged = (piece._buffsPurged || 0) + n;
      if (per) addBonusDamage(piece, n * per);
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'chain_whip', {
      onPreDealDamageEarly: (hit) => chainWhipPreDealDamage(piece, ctx, hit),
    });
  },
  onPreDealDamageEarly(piece, ctx, hit) {
    chainWhipPreDealDamage(piece, ctx, hit);
  },
};

/** @type {Record<string, ScriptHandler>} */
export const WAVE_C_ONHIT_PORTS = {
  hammer: hammerPort,
  lucky_shortbow: luckyShortbowPort,
  thorn_shortbow: thornShortbowPort,
  snow_stick: snowStickPort,
  boomerang: boomerangPort,
  daggerang: daggerangPort,
  brass_knuckles: brassKnucklesPort,
  thors_hammer: thorsHammerPort,
  amethyst_whelp: amethystWhelpPort,
  chain_whip: chainWhipPort,
};

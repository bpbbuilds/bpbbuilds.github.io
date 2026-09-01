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
import { getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { addAccuracy, addBonusDamage, addSpeed, multiplyStaminaCost } from '../piece-stats.js';
import { dealHit } from './handlers.js';
import { affectedTargets } from '../board-graph.js';
import { healActor, grantStun } from '../actor.js';
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
    const dur = Math.max(0.5, getPName(piece.params, 'dur_stun', getP1(piece.params, 1)));
    grantStun(ctx.dummy, dur, ctx.t);
    ctx.events.push({
      t: ctx.t + 0.008,
      type: 'debuff',
      target: 'dummy',
      amount: 1,
      label: `${piece.name}: Stun (${dur}s)`,
      meta: { category: 'debuff', stack: 'stun', script: true, handler: 'hammer' },
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
    ctx.events.push({
      t: ctx.t + 0.008,
      type: 'buff',
      target: 'player',
      amount: 1,
      label: `${piece.name}: +1 Spikes`,
      meta: { category: 'buff', stack: 'spikes', script: true, handler: 'thorn_shortbow' },
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
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    const cold = Math.max(1, Math.round(getPName(piece.params, 'cold', getP1(piece.params, 2))));
    const selfCold = Math.max(0, Math.round(getPName(piece.params, 'cold2', getP2(piece.params, 1))));
    grantStacks(ctx.dummy, 'cold', cold, {
      originKey: piece.placementKey,
      originId: piece.itemId,
      rng: ctx.rng,
      opponent: ctx.player,
    });
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
  onDealtDamage(piece, ctx, hit) {
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
        target: 'player',
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
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'daggerang');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    const stamRed = Math.abs(getPName(piece.params, 'stamina', getP1(piece.params, 10)) / 100);
    if (stamRed) multiplyStaminaCost(piece, -stamRed);
    if (!rollItemChance(piece, ctx.rng)) return;
    stealRandomBuff(ctx.dummy, ctx.player, 1, ctx.rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    ctx.events.push({
      t: ctx.t + 0.008,
      type: 'buff',
      target: 'player',
      amount: 1,
      label: `${piece.name}: stole buff`,
      meta: { category: 'buff', script: true, handler: 'daggerang' },
    });
  },
};

/** BrassKnuckles.gd — crit/acc on hit + chance stun; rage → speed. */
/** @type {ScriptHandler} */
export const brassKnucklesPort = {
  handlerId: 'brass_knuckles',
  family: 'on_hit',
  onCombatStart(piece, ctx) {
    const rageSpeed = getP4(piece.params, 15) / 100;
    piece._knuckleRageOn = false;
    // Approx battle_rage via Empower spikes from Extra Angy / similar
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'empower') return;
      const raging = (ctx.player.stacks.empower || 0) >= 3;
      if (raging && !piece._knuckleRageOn && rageSpeed) {
        addSpeed(piece, rageSpeed);
        piece._knuckleRageOn = true;
        ctx.player.battleRage = true;
      } else if (!raging && piece._knuckleRageOn && rageSpeed) {
        addSpeed(piece, -rageSpeed);
        piece._knuckleRageOn = false;
        ctx.player.battleRage = false;
      }
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
      const dur = Math.max(0.5, getPName(piece.params, 'dur_stun', 1));
      grantStun(ctx.dummy, dur, ctx.t);
      ctx.events.push({
        t: ctx.t + 0.008,
        type: 'debuff',
        target: 'dummy',
        amount: 1,
        label: `${piece.name}: Stun (${dur}s)`,
        meta: { category: 'debuff', stack: 'stun', script: true, handler: 'brass_knuckles' },
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
    const { player, dummy, rng, events, t } = ctx;
    if (rollItemChance(piece, rng)) {
      const dur = Math.max(0.5, getPName(piece.params, 'dur_stun', 1));
      grantStun(dummy, dur, t);
      events.push({
        t: t + 0.008,
        type: 'debuff',
        target: 'dummy',
        amount: 1,
        label: `${piece.name}: Stun`,
        meta: { category: 'debuff', stack: 'stun', script: true, handler: 'thors_hammer' },
      });
    }
    const need = Math.max(1, Math.round(getPName(piece.params, 'manat', getP1(piece.params, 3))));
    if ((player.stacks.mana || 0) < need) return;
    if (
      useMana(player, need, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      }).spent <= 0
    ) {
      return;
    }
    const effectDmg = Math.max(1, Math.round(getPName(piece.params, 'dam', getP2(piece.params, 8))));
    dealHit(piece, ctx, effectDmg);
    const blind = Math.max(1, Math.round(getPName(piece.params, 'blind', getP3(piece.params, 2))));
    const dur = Math.max(0.5, getPName(piece.params, 'dur_blind', 3));
    grantTemporaryStacks(dummy, 'blind', blind, dur, t, {
      rng,
      opponent: player,
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    events.push({
      t: t + 0.01,
      type: 'debuff',
      target: 'dummy',
      amount: blind,
      label: `${piece.name}: +${blind} Blind`,
      meta: { category: 'debuff', stack: 'blind', script: true, handler: 'thors_hammer' },
    });
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
export const chainWhipPort = {
  handlerId: 'chain_whip',
  family: 'on_hit',
  onCombatStart(piece, ctx) {
    piece._buffsPurged = 0;
    const per = Math.max(0, Math.round(getP3(piece.params, 1)));
    onBuffChanged(ctx.dummy, (ch) => {
      if (!(ch.amount < 0) || !BUFF_KEYS.includes(String(ch.stack))) return;
      if (ch.originKey !== piece.placementKey) return;
      const n = Math.abs(ch.amount);
      piece._buffsPurged = (piece._buffsPurged || 0) + n;
      if (per) addBonusDamage(piece, n * per);
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'chain_whip');
  },
  onDealtDamage(piece, ctx, hit) {
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

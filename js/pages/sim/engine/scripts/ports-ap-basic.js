/**
 * Band AP 247 — leftover MAP `basic_cd` uniques (not true Weapon-CD twins).
 */

import { grantStun, tryUseStamina } from '../actor.js';
import { grantStacks, onBuffChanged, spendStacks, stealRandomBuff } from '../buff-economy.js';
import { dealDamage } from '../damage.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getPName } from '../params.js';
import { effectDuration, scaleEffectDuration } from '../effect-duration.js';
import { PRIORITY } from '../combat-start-priority.js';
import { addBonusDamage, addSpeed } from '../piece-stats.js';
import { getStackAmount } from '../stacks.js';
import { dealHit } from './handlers.js';
import { itemHasType, pushActivate, pushBuffGrants } from './ports-util.js';
import { forAttackEffects, prepareBow } from '../attack-effects.js';
import { rollItemChance, weaponStrike } from './ports-wave-c-util.js';
import { randInt } from '../rng.js';
import { modifiedParamValue } from '../placement-instance.js';

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

function starve(piece, ctx, handler) {
  ctx.events.push({
    t: ctx.t,
    type: 'stamina',
    label: `${piece.name}: out of stamina`,
    meta: { category: 'stamina', script: true, starved: true, handler },
  });
}

/**
 * Phoenix.gd / inherited Phoenix2.gd resurrection listener. The source
 * connects during Item.prepare(), before combat-start self-health effects, and
 * emits `reincarnated` so listeners such as Dark Lantern can react to any
 * resurrection source.
 */
export function preparePhoenix(piece, ctx) {
  piece._phxUsed = false;
  const onDamaged = (payload = {}) => {
    const p = ctx.player;
    if (payload.actor && payload.actor !== p) return;
    if (piece._phxUsed) return;
    if (p.hp > 0 && !p.dead) return;
    const heat = getStackAmount(p, 'heat') || 0;
    if (heat <= 0) return;
    piece._phxUsed = true;
    const hp = Math.min(
      p.maxHp,
      Math.max(1, Math.round(getPName(piece.params, 'reincarnate_health', 6) * heat)),
    );
    p.dead = false;
    p.hp = hp;
    // Character.reincarnate emits before Phoenix consumes Heat or activates.
    ctx.bus?.emit?.('reincarnated', {
      actor: p,
      sourceId: piece.itemId,
      placementKey: piece.placementKey,
      t: ctx.t,
      triggerEvent: payload,
    });
    spendStacks(p, 'heat', heat, origin(piece));
    ctx.events?.push?.({
      t: ctx.t,
      type: 'heal',
      actor: p.id,
      target: p.id,
      amount: hp,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: reincarnate to ${hp} HP`,
      meta: { category: 'heal', script: true, handler: piece.itemId, reincarnate: true, playerHp: p.hp },
    });
    pushActivate(piece, ctx, piece.itemId, `${piece.name}: reincarnate`, {
      reincarnate: true,
      visualState: 'ash',
    });
  };
  ctx.bus?.on?.('character_damaged', onDamaged, PRIORITY.Normal);
  // Fatigue and a few legacy simulator paths expose only this convenience
  // signal. The owner/dead guard keeps normal damage from firing twice.
  ctx.bus?.on?.('player_damaged', onDamaged, PRIORITY.Normal);
}

/** Phoenix.gd — stam, self-dmg if HP allows, strike; reincarnate once if heat > 0. */
/** @type {ScriptHandler} */
const phoenixPort = {
  handlerId: 'phoenix',
  family: 'weapon_base',
  onPrepare(piece, ctx) {
    preparePhoenix(piece, ctx);
  },
  onCooldownEffect(piece, ctx) {
    const { player, rng } = ctx;
    if (tryUseStamina(player, piece.staminaCost) === 'starve') {
      starve(piece, ctx, 'phoenix');
      return true;
    }
    const selfDam = Math.max(0, Math.round(getPName(piece.params, 'selfdam', 10)));
    if (selfDam && player.hp <= selfDam) return true;
    if (selfDam) {
      dealDamage(player, player, {
        amount: selfDam,
        canMiss: false,
        canCrit: false,
        isAttack: false,
        skipSpikes: true,
        nowT: ctx.t,
        rng,
      });
    }
    dealHit(piece, ctx, () => randInt(piece.damageMin, piece.damageMax, rng));
    // Weapon.attack() activates only after dealDamage has produced its result.
    pushActivate(piece, ctx, 'phoenix', `Weapon: ${piece.name}`);
    return true;
  },
};

/** Pumpkin.gd — food throw; on-hit 50% stun; fatigue +heat + activate. */
/** @type {ScriptHandler} */
const pumpkinPort = {
  handlerId: 'pumpkin',
  family: 'weapon_base',
  onPrepare(piece, ctx) {
    piece._pumpkinGlowing = false;
    ctx.bus?.on?.('fatigue_start', () => {
      piece._pumpkinGlowing = true;
      grantStacks(
        ctx.player,
        'heat',
        Math.max(0, Math.trunc(getPName(piece.params, 'heat', 10))),
        origin(piece),
      );
      pushActivate(piece, ctx, 'pumpkin', `${piece.name}: fatigue`);
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'pumpkin');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit || !rollItemChance(piece, ctx.rng)) return;
    grantStun(ctx.dummy, effectDuration(piece, 'dur_stun', 0.5), ctx.t, { rng: ctx.rng });
  },
};

/** RubyChonk.gd — on-hit +1 heat; if heat ≥ heatt, 30% stun. */
/** @type {ScriptHandler} */
const rubyChonkPort = {
  handlerId: 'ruby_chonk',
  family: 'weapon_base',
  onPrepare(piece, ctx) {
    const rawThreshold = Number(getPName(piece.params, 'heatt', getP1(piece.params, 12)));
    const threshold = Number.isFinite(rawThreshold) ? Math.trunc(rawThreshold) : 12;
    piece._rubyChonkHeatThreshold = threshold;
    // RubyChonk.gd calls setState(false) before it connects the heat listener;
    // a preloaded Heat stack does not activate the state until a heat change.
    piece._rubyChonkHeatReady = false;
    onBuffChanged(ctx.player, (change) => {
      if (change.stack === 'heat') piece._rubyChonkHeatReady = getStackAmount(ctx.player, 'heat') >= threshold;
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'ruby_chonk');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    grantStacks(ctx.player, 'heat', 1, origin(piece));
    if (!piece._rubyChonkHeatReady) return;
    if (!rollItemChance(piece, ctx.rng)) return;
    const baseDuration = getPName(piece.params, 'dur_stun', 0.4);
    const duration = scaleEffectDuration(
      piece,
      modifiedParamValue(piece, baseDuration, 'dur_stun'),
    );
    piece._rubyChonkHasStunned = true;
    grantStun(ctx.dummy, duration, ctx.t, { rng: ctx.rng });
  },
};

/** SquirrelArcher.gd + ForestFriend.gd — pet/food stars speed; strike + steal 1 on hit. */
/** @type {ScriptHandler} */
const squirrelArcherPort = {
  handlerId: 'squirrel_archer',
  family: 'weapon_base',
  onCombatStart(piece, ctx) {
    const n = linked(ctx, piece).filter((o) => {
      const item = ctx.itemsById.get(o.itemId);
      return itemHasType(item, 'pet') || itemHasType(item, 'food');
    }).length;
    if (n > 0) addSpeed(piece, (n * getP1(piece.params, 15)) / 100);
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'squirrel_archer', {
      onPreDealDamageEarly(res) {
        if (!res?.hit) return;
        const stolen = stealRandomBuff(ctx.dummy, ctx.player, 1, ctx.rng, origin(piece));
        pushBuffGrants(ctx.events, piece, ctx.player, ctx.t, 'squirrel_archer', stolen);
      },
    });
  },
};

/** ThornBow.gd — start spikes; spend on linked weapon hit (not own CD). */
/** @type {ScriptHandler} */
const thornBowPort = {
  handlerId: 'thorn_bow',
  family: 'weapon_base',
  onPrepare(piece, ctx) {
    piece._thornBonusN = 0;
    const per = Math.trunc(getPName(piece.params, 'bonusdam', getP2(piece.params, 9)));
    prepareBow(piece, ctx, (payload) => {
      if (!payload?.hit?.hit) return;
      forAttackEffects(piece, ctx.rng, () => {
        if ((getStackAmount(ctx.player, 'spikes') || 0) < 1) return;
        spendStacks(ctx.player, 'spikes', 1, origin(piece));
        piece._thornBonusN = (Number(piece._thornBonusN) || 0) + 1;
        addBonusDamage(piece, per);
      });
    });
  },
  onCombatStart(piece, ctx) {
    const spikes = Math.trunc(getPName(piece.params, 'spikes', getP1(piece.params, 4)));
    grantStacks(
      ctx.player,
      'spikes',
      spikes,
      origin(piece),
    );
    pushActivate(piece, ctx, 'thorn_bow', `${piece.name}: spikes`);
  },
  onCooldownEffect(piece, ctx) {
    const n = Number(piece._thornBonusN) || 0;
    const per = Math.trunc(getPName(piece.params, 'bonusdam', getP2(piece.params, 9)));
    return weaponStrike(piece, ctx, 'thorn_bow', {
      afterHit() {
        if (!n) return;
        addBonusDamage(piece, -per * n);
        piece._thornBonusN = 0;
      },
    });
  },
};

/** WoodenSword.gd — Weapon CD twin (stam → dealDamage → activate). Not bindPattern. */
/** @type {ScriptHandler} */
const woodenSwordPort = {
  handlerId: 'wooden_sword',
  family: 'weapon_base',
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'wooden_sword');
  },
};

export const AP_BASIC_PORTS = {
  phoenix: phoenixPort,
  pumpkin: pumpkinPort,
  ruby_chonk: rubyChonkPort,
  squirrel_archer: squirrelArcherPort,
  thorn_bow: thornBowPort,
  wooden_sword: woodenSwordPort,
};

/**
 * Band AP 247 — leftover MAP `basic_cd` uniques (not true Weapon-CD twins).
 */

import { grantStun, tryUseStamina } from '../actor.js';
import { grantStacks, onBuffChanged, spendStacks, stealRandomBuff } from '../buff-economy.js';
import { dealDamage } from '../damage.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getPName } from '../params.js';
import { addBonusDamage, addSpeed } from '../piece-stats.js';
import { getStackAmount } from '../stacks.js';
import { dealHit } from './handlers.js';
import { itemHasType, pushActivate } from './ports-util.js';
import { forAttackEffects, listenLinkedWeaponAttacked } from '../attack-effects.js';
import { rollItemChance, weaponStrike } from './ports-wave-c-util.js';
import { randInt } from '../rng.js';

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

/** Phoenix.gd — stam, self-dmg if HP allows, strike; reincarnate once if heat > 0. */
/** @type {ScriptHandler} */
const phoenixPort = {
  handlerId: 'phoenix',
  family: 'weapon_base',
  onPrepare(piece, ctx) {
    piece._phxUsed = false;
    // Phoenix.gd connects to its own Character during Item.prepare(), not
    // after combat-start. Listen to the source-level damage signal and keep
    // the owner filter so the same handler works on either board.
    ctx.bus?.on?.('character_damaged', (payload) => {
      if (payload?.actor !== ctx.player) return;
      if (piece._phxUsed) return;
      const p = ctx.player;
      if (p.hp > 0 && !p.dead) return;
      const heat = getStackAmount(p, 'heat') || 0;
      if (heat <= 0) return;
      piece._phxUsed = true;
      const hp = Math.max(1, Math.round(getPName(piece.params, 'reincarnate_health', 6) * heat));
      spendStacks(p, 'heat', heat, origin(piece));
      p.dead = false;
      p.hp = hp;
      pushActivate(piece, ctx, 'phoenix', `${piece.name}: reincarnate`);
    });
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
    ctx.bus?.on?.('fatigue_start', () => {
      grantStacks(
        ctx.player,
        'heat',
        Math.max(1, Math.round(getPName(piece.params, 'heat', 10))),
        origin(piece),
      );
      pushActivate(piece, ctx, 'pumpkin', `${piece.name}: fatigue`);
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'pumpkin', {
      afterHit(hit) {
        if (!hit?.hit) return;
        if (!rollItemChance(piece, ctx.rng)) return;
        grantStun(ctx.dummy, getPName(piece.params, 'dur_stun', 0.5), ctx.t, { rng: ctx.rng });
      },
    });
  },
};

/** RubyChonk.gd — on-hit +1 heat; if heat ≥ heatt, 30% stun. */
/** @type {ScriptHandler} */
const rubyChonkPort = {
  handlerId: 'ruby_chonk',
  family: 'weapon_base',
  onPrepare(piece, ctx) {
    const threshold = Math.max(1, Math.round(getPName(piece.params, 'heatt', getP1(piece.params, 12))));
    piece._rubyChonkHeatReady = getStackAmount(ctx.player, 'heat') >= threshold;
    onBuffChanged(ctx.player, (change) => {
      if (change.stack === 'heat') piece._rubyChonkHeatReady = getStackAmount(ctx.player, 'heat') >= threshold;
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'ruby_chonk', {
      afterHit(hit) {
        if (!hit?.hit) return;
        grantStacks(ctx.player, 'heat', 1, origin(piece));
        if (!piece._rubyChonkHeatReady) return;
        if (!rollItemChance(piece, ctx.rng)) return;
        grantStun(ctx.dummy, getPName(piece.params, 'dur_stun', 0.4), ctx.t, { rng: ctx.rng });
      },
    });
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
      afterHit(hit) {
        if (!hit?.hit) return;
        stealRandomBuff(ctx.dummy, ctx.player, 1, ctx.rng, origin(piece));
      },
    });
  },
};

/** ThornBow.gd — start spikes; spend on linked weapon hit (not own CD). */
/** @type {ScriptHandler} */
const thornBowPort = {
  handlerId: 'thorn_bow',
  family: 'weapon_base',
  onCombatStart(piece, ctx) {
    piece._thornBonusN = 0;
    grantStacks(
      ctx.player,
      'spikes',
      Math.max(1, Math.round(getPName(piece.params, 'spikes', getP1(piece.params, 4)))),
      origin(piece),
    );
    pushActivate(piece, ctx, 'thorn_bow', `${piece.name}: spikes`);
    const per = Math.max(1, Math.round(getPName(piece.params, 'bonusdam', getP2(piece.params, 9))));
    listenLinkedWeaponAttacked(piece, ctx, (payload) => {
      if (!payload?.hit?.hit) return;
      forAttackEffects(piece, ctx.rng, () => {
        if ((getStackAmount(ctx.player, 'spikes') || 0) < 1) return;
        spendStacks(ctx.player, 'spikes', 1, origin(piece));
        piece._thornBonusN = (Number(piece._thornBonusN) || 0) + 1;
        addBonusDamage(piece, per);
      });
    });
  },
  onCooldownEffect(piece, ctx) {
    const n = Number(piece._thornBonusN) || 0;
    const per = Math.max(1, Math.round(getPName(piece.params, 'bonusdam', getP2(piece.params, 9))));
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

/**
 * Band AK — remaining catalog potions (health/heroic already in other modules).
 */

import { healActor } from '../actor.js';
import { applyHealEfficiency } from '../actor-stats.js';
import {
  cleanseRandomDebuffs,
  DEBUFF_KEYS,
  giveRandomBuffs,
  grantStacks,
  grantTemporaryStacks,
  onBuffChanged,
} from '../buff-economy.js';
import { getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { modifiedParamValue } from '../placement-instance.js';
import { pushActivate, triggerFirstAffectedPotion } from './ports-util.js';
import { dealEffectDamage, stealLife } from './handlers.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/**
 * @param {object} piece
 * @param {import('./handlers.js').ScriptCtx} ctx
 * @param {number} t
 * @param {() => void} onDrink
 * @param {() => void} [onLinked]
 */
function drinkPotion(piece, ctx, t, onDrink, onLinked) {
  if (!piece.alive || piece.charges === 0) return;
  // Empty first so block/buff listeners from onDrink cannot re-enter.
  piece.alive = false;
  piece.charges = 0;
  onDrink();
  onLinked?.();
  ctx.bus?.emit?.('potion_emptied', { piece, t });
  const prevT = ctx.t;
  ctx.t = t;
  pushActivate(piece, ctx, piece.itemId, `${piece.name} consumed`, { consume: true });
  ctx.t = prevT;
}

/**
 * Item.healthToBlock(health, block) — spend up to `health` HP (leave 1),
 * grant ceil((spent/health)*block) Block.
 * @param {import('../actor.js').SimActor} player
 * @param {number} healthCap
 * @param {number} blockCap
 * @param {object} [opts]
 */
function healthToBlock(player, healthCap, blockCap, opts = {}) {
  const want = Math.max(0, Number(healthCap) || 0);
  const blockWant = Math.max(0, Number(blockCap) || 0);
  if (!(want > 0) || !(blockWant > 0)) return { spent: 0, block: 0 };
  const clamped = Math.min(want, Math.max(0, (Number(player.hp) || 0) - 1));
  if (!(clamped > 0)) return { spent: 0, block: 0 };
  player.hp = Math.max(1, (Number(player.hp) || 0) - clamped);
  const block = Math.max(1, Math.ceil((clamped / want) * blockWant));
  grantStacks(player, 'block', block, opts);
  return { spent: clamped, block };
}

function lockCd(piece) {
  piece._cdLocked = true;
  piece.cooldown = 999;
  piece.triggerTime = 999;
}

function hpFrac(actor) {
  return actor.maxHp > 0 ? actor.hp / actor.maxHp : 1;
}

function debuffCount(actor) {
  let n = 0;
  for (const k of DEBUFF_KEYS) n += Number(actor.stacks[k]) || 0;
  return n;
}

/** ManaPotion / StrongManaPotion — HP threshold or own mana spend → mana + maxHP. */
function manaPotionPort(handlerId) {
  const bind = (piece, ctx) => {
    if (piece._manaPotionBound) return;
    piece._manaPotionBound = true;
    lockCd(piece);
    const th = getPName(piece.params, 'p1', getP1(piece.params, 50)) / 100 - 0.0001;
    const applyEffect = (t) => {
      const mana = Math.max(
        0,
        modifiedParamValue(
          piece,
          getPName(piece.params, 'mana', getP2(piece.params, 4)),
          'mana',
        ),
      );
      const maxHp = Math.max(
        0,
        Math.round(modifiedParamValue(
          piece,
          getPName(piece.params, 'maxhealth', getP3(piece.params, 0)),
          'maxhealth',
        )),
      );
      grantStacks(ctx.player, 'mana', mana, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      if (maxHp) {
        ctx.player.maxHp += maxHp;
        ctx.player.hp += maxHp;
      }
      ctx.events.push({
        t,
        type: 'buff',
        target: 'player',
        amount: mana,
        label: `${piece.name}: +${mana} Mana`,
        meta: { category: 'buff', stack: 'mana', script: true, handler: handlerId },
      });
    };
    const drink = (t) => drinkPotion(
      piece,
      ctx,
      t,
      () => applyEffect(t),
      () => triggerFirstAffectedPotion(piece, ctx, t),
    );
    piece._potionTrigger = ({ t = ctx.t } = {}) => applyEffect(t);
    ctx.bus?.on?.('character_damaged', (payload) => {
      if (payload?.actor && payload.actor !== ctx.player) return;
      if (!piece.alive) return;
      if (hpFrac(ctx.player) < th) drink(payload?.t ?? ctx.t);
    });
    // Legacy direct callers emitted the player-only convenience signal before
    // character_damaged became the canonical source event.
    ctx.bus?.on?.('player_damaged', (payload) => {
      if (!piece.alive) return;
      if (hpFrac(ctx.player) < th) drink(payload?.t ?? ctx.t);
    });
    onBuffChanged(ctx.player, (ch) => {
      if (!piece.alive || ch.stack !== 'mana' || !(ch.amount < 0)) return;
      const origin = (ctx.pieces || []).find((candidate) =>
        ch.originKey && candidate.placementKey === ch.originKey,
      ) || (ctx.pieces || []).find((candidate) =>
        ch.originId && candidate.itemId === ch.originId &&
        (candidate.side == null || piece.side == null || candidate.side === piece.side),
      );
      if (!origin) return;
      drink(ctx.t);
    });
  };

  /** @type {ScriptHandler} */
  return {
    handlerId,
    family: 'consumable',
    deferStartActivate: true,
    // ManaPotion.gd binds both damage and mana listeners during onPrepare.
    // Keep the bind idempotent and expose the legacy onCombatStart entry point
    // for direct script callers/tests that invoke handlers without lifecycle
    // preparation. The simulator itself calls onPrepare first.
    onPrepare(piece, ctx) {
      bind(piece, ctx);
    },
    onCombatStart(piece, ctx) {
      bind(piece, ctx);
    },
  };
}

/** StrongHeroicPotion — HeroicPotion.gd inherited starvation trigger.
 *
 * The scene reuses HeroicPotion.gd directly: only p1 stamina and p2 Empower
 * are consumed by the source script. Its catalog p3 is not a Lucky grant.
 */
/** @type {ScriptHandler} */
export const strongHeroicPotionPort = {
  handlerId: 'strong_heroic_potion',
  family: 'consumable',
  deferStartActivate: true,
  onPrepare(piece, ctx) {
    bindStrongHeroicPotion(piece, ctx);
  },
  onCombatStart(piece, ctx) {
    bindStrongHeroicPotion(piece, ctx);
  },
};

function bindStrongHeroicPotion(piece, ctx) {
  if (piece._strongHeroicPotionBound) return;
  piece._strongHeroicPotionBound = true;
  lockCd(piece);
  piece._potionTrigger = ({ t = ctx.t } = {}) => {
    const stam = Math.max(0, Number(getP1(piece.params, 4)) || 0);
    const emp = Math.max(0, Number(getP2(piece.params, 1)) || 0);
    ctx.player.stamina = Math.min(
      ctx.player.maxStamina || 20,
      (ctx.player.stamina || 0) + stam,
    );
    grantStacks(ctx.player, 'empower', emp, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    ctx.events.push({
      t,
      type: 'buff',
      target: 'player',
      amount: emp,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: +${emp} Empower`,
      meta: { category: 'buff', stack: 'empower', script: true, handler: 'strong_heroic_potion' },
    });
  };
  ctx.bus?.on?.('pre_use_stamina', (payload) => {
    if (payload?.actor && payload.actor !== ctx.player) return;
    if (!piece.alive || piece.charges === 0) return;
    const amount = Number(payload?.amount) || 0;
    if ((Number(ctx.player.stamina) || 0) >= amount) return;
    const t = payload?.t ?? ctx.t;
    drinkPotion(
      piece,
      ctx,
      t,
      () => piece._potionTrigger?.({ t }),
      () => triggerFirstAffectedPotion(piece, ctx, t),
    );
  });
}

/** DivinePotion — drink when own debuff stacks >= p1; cleanse. Strong: + random buffs. */
function divinePotionPort(handlerId, extraBuffs) {
  /** @type {ScriptHandler} */
  return {
    handlerId,
    family: 'consumable',
    deferStartActivate: true,
    // StrongDemonicFlask.gd connects to both characters during onPrepare.
    onPrepare(piece, ctx) {
      lockCd(piece);
      const need = Math.round(getP1(piece.params, 3));
      const applyEffect = (t) => {
        const n = Math.round(getP2(piece.params, 2));
        if (n) cleanseRandomDebuffs(ctx.player, n, ctx.rng, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
        if (extraBuffs) {
          const b = Math.round(getP3(piece.params, 2));
          if (b) giveRandomBuffs(ctx.player, b, ctx.rng, {
            originKey: piece.placementKey,
            originId: piece.itemId,
          });
        }
        void t;
      };
      piece._potionTrigger = ({ t = ctx.t } = {}) => applyEffect(t);
      onBuffChanged(ctx.player, (ch) => {
        if (!piece.alive || !DEBUFF_KEYS.includes(/** @type {any} */ (ch.stack))) return;
        if (debuffCount(ctx.player) < need) return;
        drinkPotion(piece, ctx, ctx.t, () => {
          applyEffect(ctx.t);
          triggerFirstAffectedPotion(piece, ctx, ctx.t);
        });
      });
    },
  };
}

/** VampiricPotion — both sides below HP% → lifesteal hit + vamp. */
function vampiricPotionPort(handlerId, strong) {
  /** @type {ScriptHandler} */
  return {
    handlerId,
    family: 'consumable',
    deferStartActivate: true,
    // VampiricPotion.gd listens to both characters during onPrepare.
    onPrepare(piece, ctx) {
      lockCd(piece);
      const th = getP1(piece.params, 50) / 100;
      const applyEffect = (t) => {
        if (strong) {
          const lifesteal = modifiedParamValue(
            piece,
            getPName(piece.params, 'lifesteal', getP3(piece.params, 0)),
            'lifesteal',
          ) / 100;
          const duration = Math.max(
            0,
            modifiedParamValue(
              piece,
              getPName(piece.params, 'dur', getP4(piece.params, 0)),
              'dur',
            ),
          );
          piece._vampiricLifesteal = (Number(piece._vampiricLifesteal) || 0) + lifesteal;
          piece._vampiricLifestealUntil = t + duration;
        } else {
          const dam = Math.max(0, Number(getP3(piece.params, 0)) || 0);
          const lifesteal = modifiedParamValue(
            piece,
            getPName(piece.params, 'lifesteal', getP4(piece.params, 100)),
            'lifesteal',
          ) / 100;
          stealLife(piece, ctx, dam, lifesteal);
        }
        const vamp = Math.max(0, Number(getP2(piece.params, 0)) || 0);
        grantStacks(ctx.player, 'vampirism', vamp, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      };
      piece._potionTrigger = ({ t = ctx.t } = {}) => applyEffect(t);
      const tryDrink = (t) => {
        if (!piece.alive) return;
        if (hpFrac(ctx.player) >= th || hpFrac(ctx.dummy) >= th) return;
        drinkPotion(
          piece,
          ctx,
          t,
          () => applyEffect(t),
          () => triggerFirstAffectedPotion(piece, ctx, t),
        );
      };
      ctx.bus?.on?.('character_damaged', (p) => tryDrink(p?.t ?? ctx.t));
      if (strong) {
        ctx.bus?.on?.('item_attacked', (payload = {}) => {
          if (piece._vampiricLifestealUntil == null) return;
          const attacker = payload.piece;
          if (attacker?.side != null && piece.side != null && attacker.side === piece.side) return;
          const hit = payload.hit || {};
          if (hit.hit !== true || hit.canApplyLifesteal === false || payload.canApplyLifesteal === false) return;
          const at = Number(payload.t ?? ctx.t);
          if (at + 1e-9 >= piece._vampiricLifestealUntil) return;
          const damage = Number(hit.damage ?? hit.healthDamage) || 0;
          const healed = Math.ceil(damage * (Number(piece._vampiricLifesteal) || 0));
          if (healed <= 0) return;
          healActor(ctx.player, healed);
          const logged = Number(ctx.player._lastHeal?.loggedAmount) || healed;
          ctx.events.push({
            t: at + 0.002,
            type: 'heal',
            target: 'player',
            amount: logged,
            itemId: piece.itemId,
            placementKey: piece.placementKey,
            label: `${piece.name}: lifesteal +${logged}`,
            meta: { category: 'heal', script: true, handler: handlerId, lifesteal: true },
          });
        });
      }
    },
    onTick(piece, ctx) {
      if (!strong || piece._vampiricLifestealUntil == null) return;
      if (Number(ctx.t) + 1e-9 < piece._vampiricLifestealUntil) return;
      piece._vampiricLifestealUntil = null;
      piece._vampiricLifesteal = 0;
    },
    onCombatEnd(piece) {
      if (!strong) return;
      piece._vampiricLifestealUntil = null;
      piece._vampiricLifesteal = 0;
    },
  };
}

/** StoneSkinPotion.gd — onPrepare listen; drink when Block >= p1; healthToBlock(p2, getBlock). */
function stoneSkinPort(handlerId, strong) {
  /** @type {ScriptHandler} */
  return {
    handlerId,
    family: 'consumable',
    deferStartActivate: true,
    onPrepare(piece, ctx) {
      lockCd(piece);
      const need = Math.max(0, Math.round(getPName(piece.params, 'blockt', getP1(piece.params, 0))));
      const applyEffect = (t) => {
        const healthCap = Math.max(
          0,
          Math.round(getPName(piece.params, 'healtht', getP2(piece.params, 0))),
        );
        const catalogBlock = Number(ctx.itemsById?.get?.(piece.itemId)?.block);
        const blockCap = Number.isFinite(Number(piece.blockGrant))
          ? Number(piece.blockGrant)
          : Number.isFinite(catalogBlock)
            ? catalogBlock
            : getPName(piece.params, 'block', 0);
        healthToBlock(ctx.player, healthCap, blockCap, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
        if (strong) {
          const spikes = Math.max(0, Math.round(getPName(piece.params, 'spikes', getP3(piece.params, 0))));
          const dur = Math.max(
            0,
            modifiedParamValue(piece, getPName(piece.params, 'dur', getP4(piece.params, 0)), 'dur'),
          );
          grantTemporaryStacks(ctx.player, 'spikes', spikes, dur, t, {
            originKey: piece.placementKey,
            originId: piece.itemId,
          });
        }
      };
      piece._potionTrigger = ({ t = ctx.t } = {}) => applyEffect(t);
      const tryDrink = (t) => {
        if (!piece.alive || (Number(ctx.player.block) || 0) < need) return;
        drinkPotion(piece, ctx, t, () => {
          applyEffect(t);
          triggerFirstAffectedPotion(piece, ctx, t);
        });
      };
      piece._stoneSkinTryDrink = tryDrink;
      ctx.bus?.on?.('character_block_changed', (payload = {}) => {
        if (payload.actor && payload.actor !== ctx.player) return;
        tryDrink(ctx.t);
      });
    },
    // Direct callers from the older potion harness used this phase; keep it
    // idempotent while the production lifecycle binds in onPrepare.
    onPreCombatStart(piece, ctx) {
      if (!piece._stoneSkinTryDrink) stoneSkinPort(handlerId, strong).onPrepare(piece, ctx);
    },
  };
}

/** PestilenceFlask — opponent healed → poison them + self. */
function pestilencePort(handlerId, strong) {
  /** @type {ScriptHandler} */
  return {
    handlerId,
    family: 'consumable',
    deferStartActivate: true,
    onPrepare(piece, ctx) {
      lockCd(piece);
      const applyEffect = (t) => {
        // PestilenceFlask.gd passes the raw parameters to giveStacks; the
        // stack system performs the game's final rounding and resistance.
        const them = Number(getP1(piece.params, 2));
        const self = Number(getP2(piece.params, 1));
        grantStacks(ctx.dummy, 'poison', them, {
          originKey: piece.placementKey,
          originId: piece.itemId,
          rng: ctx.rng,
          opponent: ctx.player,
        });
        if (self) {
          grantStacks(ctx.player, 'poison', self, {
            originKey: piece.placementKey,
            originId: piece.itemId,
            rng: ctx.rng,
          });
        }
        if (strong) {
          const delay = Math.max(0, Number(getP3(piece.params, 3.5)) || 0);
          piece._pestilencePoisonAt = t + delay;
        }
      };
      piece._potionTrigger = ({ t = ctx.t } = {}) => applyEffect(t);
      ctx.bus?.on?.('actor_healed', (payload) => {
        if (!piece.alive) return;
        if (payload?.actor !== ctx.dummy) return;
        const t = payload?.t ?? ctx.t;
        drinkPotion(piece, ctx, t, () => {
          applyEffect(t);
          triggerFirstAffectedPotion(piece, ctx, t);
        });
      });
    },
    onTick(piece, ctx) {
      if (!strong || piece._pestilencePoisonAt == null) return;
      if (Number(ctx.t) + 1e-9 < piece._pestilencePoisonAt) return;
      const later = Math.max(0, Number(getP4(piece.params, 0)) || 0);
      grantStacks(ctx.dummy, 'poison', later, {
        originKey: piece.placementKey,
        originId: piece.itemId,
        rng: ctx.rng,
        opponent: ctx.player,
      });
      piece._pestilencePoisonAt = null;
    },
    onCombatEnd(piece) {
      if (strong) piece._pestilencePoisonAt = null;
    },
  };
}

/** DemonicFlask — foe HP% → damage × foe debuffs. Strong: also own HP% + unhealing. */
function demonicPort(handlerId, strong) {
  const bind = (piece, ctx) => {
    if (piece._demonicBound) return;
    piece._demonicBound = true;
    lockCd(piece);
    const foeTh = strong
      ? getPName(piece.params, 'opphpt', 50) / 100 - 0.0001
      : getP1(piece.params, 50) / 100 - 0.0001;
    const ownTh = strong ? getPName(piece.params, 'ownhpt', 50) / 100 - 0.0001 : 0;
    const applyEffect = (t) => {
      const per = Number(getPName(piece.params, 'dam', getP2(piece.params, 2))) || 0;
      const dam = Math.ceil(debuffCount(ctx.dummy) * per);
      const effectCtx = { ...ctx, t };
      if (strong) {
        const reduction = (Number(getP3(piece.params, 30)) || 0) / 100;
        const duration = modifiedParamValue(
          piece,
          Number(getPName(piece.params, 'dur', getP4(piece.params, 3))) || 0,
          'dur',
        );
        applyHealEfficiency(ctx.dummy, -reduction, effectCtx, piece);
        if (reduction > 0 && duration > 0) {
          piece._demonicHealReduction = reduction;
          piece._demonicHealReductionUntil = t + duration;
        }
        stealLife(
          piece,
          effectCtx,
          dam,
          (Number(getPName(piece.params, 'lifesteal', getP2(piece.params, 100))) || 0) / 100,
        );
      } else {
        dealEffectDamage(piece, effectCtx, dam);
      }
    };
    const drink = (t) =>
      drinkPotion(piece, ctx, t, () => {
        applyEffect(t);
        triggerFirstAffectedPotion(piece, ctx, t);
      });
    const onOpponentDamaged = (payload = {}) => {
      if (payload.actor && payload.actor !== ctx.dummy) return;
      if (!piece.alive) return;
      if (hpFrac(ctx.dummy) < foeTh) drink(payload?.t ?? ctx.t);
    };
    // DemonicFlask.gd observes opponent.character_damaged from onPrepare.
    ctx.bus?.on?.('character_damaged', onOpponentDamaged);
    if (strong) {
      const onPlayerDamaged = (payload = {}) => {
        if (payload.actor && payload.actor !== ctx.player) return;
        if (!piece.alive) return;
        if (hpFrac(ctx.player) < ownTh) drink(payload?.t ?? ctx.t);
      };
      ctx.bus?.on?.('character_damaged', onPlayerDamaged);
    }
    piece._demonicApplyEffect = applyEffect;
    piece._potionTrigger = (triggerCtx) => applyEffect(triggerCtx?.t ?? ctx.t);
  };

  /** @type {ScriptHandler} */
  return {
    handlerId,
    family: 'consumable',
    deferStartActivate: true,
    // Source connects threshold listeners during onPrepare. Keep the
    // onCombatStart alias idempotent for direct handler callers.
    onPrepare(piece, ctx) {
      bind(piece, ctx);
    },
    onCombatStart(piece, ctx) {
      bind(piece, ctx);
    },
    onPotionTrigger(piece, ctx) {
      piece._demonicApplyEffect?.(ctx.t);
    },
    onTick(piece, ctx) {
      if (!strong || piece._demonicHealReductionUntil == null) return;
      if (Number(ctx.t) + 1e-9 < piece._demonicHealReductionUntil) return;
      applyHealEfficiency(ctx.dummy, piece._demonicHealReduction, ctx, piece);
      piece._demonicHealReductionUntil = null;
      piece._demonicHealReduction = 0;
    },
  };
}

export const AK_POTION_PORTS = {
  mana_potion: manaPotionPort('mana_potion'),
  strong_mana_potion: manaPotionPort('strong_mana_potion'),
  strong_heroic_potion: strongHeroicPotionPort,
  divine_potion: divinePotionPort('divine_potion', false),
  strong_divine_potion: divinePotionPort('strong_divine_potion', true),
  vampiric_potion: vampiricPotionPort('vampiric_potion', false),
  strong_vampiric_potion: vampiricPotionPort('strong_vampiric_potion', true),
  stone_skin_potion: stoneSkinPort('stone_skin_potion', false),
  strong_stone_skin_potion: stoneSkinPort('strong_stone_skin_potion', true),
  pestilence_flask: pestilencePort('pestilence_flask', false),
  strong_pestilence_flask: pestilencePort('strong_pestilence_flask', true),
  demonic_flask: demonicPort('demonic_flask', false),
  strong_demonic_flask: demonicPort('strong_demonic_flask', true),
};

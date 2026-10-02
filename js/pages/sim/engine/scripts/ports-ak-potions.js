/**
 * Band AK — remaining catalog potions (health/heroic already in other modules).
 */

import { healActor } from '../actor.js';
import { dealDamage } from '../damage.js';
import {
  cleanseRandomDebuffs,
  DEBUFF_KEYS,
  giveRandomBuffs,
  grantStacks,
  grantTemporaryStacks,
  onBuffChanged,
} from '../buff-economy.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { pushActivate } from './ports-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/**
 * @param {object} piece
 * @param {import('./handlers.js').ScriptCtx} ctx
 * @param {number} t
 * @param {() => void} onDrink
 */
function drinkPotion(piece, ctx, t, onDrink) {
  if (!piece.alive || piece.charges === 0) return;
  // Empty first so block/buff listeners from onDrink cannot re-enter.
  piece.alive = false;
  piece.charges = 0;
  onDrink();
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
  /** @type {ScriptHandler} */
  return {
    handlerId,
    family: 'consumable',
    deferStartActivate: true,
    onCombatStart(piece, ctx) {
      lockCd(piece);
      const th = getPName(piece.params, 'p1', getP1(piece.params, 50)) / 100 - 0.0001;
      const drink = (t) =>
        drinkPotion(piece, ctx, t, () => {
          const mana = Math.max(
            1,
            Math.round(getPName(piece.params, 'mana', getP2(piece.params, 4))),
          );
          const maxHp = Math.max(
            0,
            Math.round(getPName(piece.params, 'maxhealth', getP3(piece.params, 0))),
          );
          grantStacks(ctx.player, 'mana', mana, {
            originKey: piece.placementKey,
            originId: piece.itemId,
          });
          if (maxHp) ctx.player.maxHp += maxHp;
          ctx.events.push({
            t,
            type: 'buff',
            target: 'player',
            amount: mana,
            label: `${piece.name}: +${mana} Mana`,
            meta: { category: 'buff', stack: 'mana', script: true, handler: handlerId },
          });
        });
      ctx.bus?.on?.('player_damaged', (payload) => {
        if (!piece.alive) return;
        if (hpFrac(ctx.player) < th) drink(payload?.t ?? ctx.t);
      });
      onBuffChanged(ctx.player, (ch) => {
        if (!piece.alive || ch.stack !== 'mana' || !(ch.amount < 0)) return;
        drink(ctx.t);
      });
    },
  };
}

/** StrongHeroicPotion — same starve trigger as heroic; extra p3 Lucky. */
/** @type {ScriptHandler} */
export const strongHeroicPotionPort = {
  handlerId: 'strong_heroic_potion',
  family: 'consumable',
  deferStartActivate: true,
  onCombatStart(piece, ctx) {
    lockCd(piece);
    ctx.bus?.on?.('pre_use_stamina', (payload) => {
      if (!piece.alive) return;
      const amount = Number(payload?.amount) || 0;
      if ((Number(ctx.player.stamina) || 0) + 1e-9 >= amount) return;
      const t = payload?.t ?? ctx.t;
      drinkPotion(piece, ctx, t, () => {
        const stam = Math.max(1, Math.round(getP1(piece.params, 4)));
        const emp = Math.max(1, Math.round(getP2(piece.params, 1)));
        const luck = Math.max(0, Math.round(getP3(piece.params, 1)));
        ctx.player.stamina = Math.min(
          ctx.player.maxStamina || 20,
          (ctx.player.stamina || 0) + stam,
        );
        grantStacks(ctx.player, 'empower', emp, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
        if (luck) {
          grantStacks(ctx.player, 'lucky', luck, {
            originKey: piece.placementKey,
            originId: piece.itemId,
          });
        }
      });
    });
  },
};

/** DivinePotion — drink when own debuff stacks >= p1; cleanse. Strong: + random buffs. */
function divinePotionPort(handlerId, extraBuffs) {
  /** @type {ScriptHandler} */
  return {
    handlerId,
    family: 'consumable',
    deferStartActivate: true,
    onCombatStart(piece, ctx) {
      lockCd(piece);
      const need = Math.max(1, Math.round(getP1(piece.params, 3)));
      onBuffChanged(ctx.player, (ch) => {
        if (!piece.alive || !DEBUFF_KEYS.includes(/** @type {any} */ (ch.stack))) return;
        if (debuffCount(ctx.player) < need) return;
        drinkPotion(piece, ctx, ctx.t, () => {
          const n = Math.max(1, Math.round(getP2(piece.params, 2)));
          cleanseRandomDebuffs(ctx.player, n, ctx.rng, {
            originKey: piece.placementKey,
            originId: piece.itemId,
          });
          if (extraBuffs) {
            const b = Math.max(1, Math.round(getP3(piece.params, 2)));
            giveRandomBuffs(ctx.player, b, ctx.rng, {
              originKey: piece.placementKey,
              originId: piece.itemId,
            });
          }
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
    onCombatStart(piece, ctx) {
      lockCd(piece);
      const th = getP1(piece.params, 50) / 100;
      const tryDrink = (t) => {
        if (!piece.alive) return;
        if (hpFrac(ctx.player) >= th || hpFrac(ctx.dummy) >= th) return;
        drinkPotion(piece, ctx, t, () => {
          const dam = Math.max(1, Math.round(getP3(piece.params, 8)));
          const vamp = Math.max(1, Math.round(getP2(piece.params, 2)));
          dealDamage(ctx.player, ctx.dummy, {
            amount: dam,
            canMiss: false,
            canCrit: false,
            isAttack: false,
            vampiricItem: true,
            nowT: t,
            rng: ctx.rng,
          });
          grantStacks(ctx.player, 'vampirism', vamp, {
            originKey: piece.placementKey,
            originId: piece.itemId,
          });
          if (strong) {
            const ls = getPName(piece.params, 'lifesteal', 20) / 100;
            if (ls) healActor(ctx.player, Math.ceil(dam * ls));
          }
        });
      };
      ctx.bus?.on?.('player_damaged', (p) => tryDrink(p?.t ?? ctx.t));
      ctx.bus?.on?.('piece_dealt_damage', () => tryDrink(ctx.t));
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
    onPreCombatStart(piece, ctx) {
      lockCd(piece);
      const need = Math.max(
        1,
        Math.round(getPName(piece.params, 'blockt', getP1(piece.params, 45))),
      );
      const tryDrink = (t) => {
        if (!piece.alive || (Number(ctx.player.block) || 0) < need) return;
        drinkPotion(piece, ctx, t, () => {
          const healthCap = Math.max(
            1,
            Math.round(getPName(piece.params, 'healtht', getP2(piece.params, 15))),
          );
          const blockCap = Math.max(
            1,
            Math.round(
              Number(piece.blockGrant) ||
                Number(ctx.itemsById?.get?.(piece.itemId)?.block) ||
                30,
            ),
          );
          healthToBlock(ctx.player, healthCap, blockCap, {
            originKey: piece.placementKey,
            originId: piece.itemId,
          });
          if (strong) {
            const spikes = Math.max(
              1,
              Math.round(getPName(piece.params, 'spikes', 2)),
            );
            const dur = Math.max(1, getPName(piece.params, 'dur', 4));
            grantTemporaryStacks(ctx.player, 'spikes', spikes, dur, t, {
              originKey: piece.placementKey,
              originId: piece.itemId,
            });
          }
        });
      };
      piece._stoneSkinTryDrink = tryDrink;
      onBuffChanged(ctx.player, (ch) => {
        if (ch.stack !== 'block') return;
        tryDrink(ctx.t);
      });
    },
    onCombatStart(piece, ctx) {
      // Catch block already ≥ threshold if a later start script granted it
      // without another change after our listener (or pre-existing block).
      piece._stoneSkinTryDrink?.(ctx.t);
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
    onCombatStart(piece, ctx) {
      lockCd(piece);
      ctx.bus?.on?.('actor_healed', (payload) => {
        if (!piece.alive) return;
        if (payload?.actor !== ctx.dummy) return;
        const t = payload?.t ?? ctx.t;
        drinkPotion(piece, ctx, t, () => {
          const them = Math.max(1, Math.round(getP1(piece.params, 2)));
          const self = Math.max(0, Math.round(getP2(piece.params, 1)));
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
            const later = Math.max(1, Math.round(getPName(piece.params, 'p4', getP3(piece.params, 2))));
            grantTemporaryStacks(ctx.dummy, 'poison', later, 3, t, {
              originKey: piece.placementKey,
              originId: piece.itemId,
            });
          }
        });
      });
    },
  };
}

/** DemonicFlask — foe HP% → damage × foe debuffs. Strong: also own HP% + unhealing. */
function demonicPort(handlerId, strong) {
  /** @type {ScriptHandler} */
  return {
    handlerId,
    family: 'consumable',
    deferStartActivate: true,
    onCombatStart(piece, ctx) {
      lockCd(piece);
      const foeTh = strong
        ? getPName(piece.params, 'opphpt', 50) / 100 - 0.0001
        : getP1(piece.params, 50) / 100 - 0.0001;
      const ownTh = strong ? getPName(piece.params, 'ownhpt', 50) / 100 - 0.0001 : 0;
      const drink = (t) =>
        drinkPotion(piece, ctx, t, () => {
          const per = Math.max(1, Math.round(getPName(piece.params, 'dam', getP2(piece.params, 2))));
          const dam = Math.max(1, Math.ceil(debuffCount(ctx.dummy) * per) || per);
          dealDamage(ctx.player, ctx.dummy, {
            amount: dam,
            canMiss: false,
            isAttack: false,
            vampiricItem: strong,
            nowT: t,
            rng: ctx.rng,
          });
          if (strong) {
            const unh = getP3(piece.params, 30) / 100;
            if (unh) ctx.dummy.unhealing = (Number(ctx.dummy.unhealing) || 0) + unh;
          }
        });
      ctx.bus?.on?.('piece_dealt_damage', () => {
        if (!piece.alive) return;
        if (hpFrac(ctx.dummy) < foeTh) drink(ctx.t);
      });
      if (strong) {
        ctx.bus?.on?.('player_damaged', (p) => {
          if (!piece.alive) return;
          if (hpFrac(ctx.player) < ownTh) drink(p?.t ?? ctx.t);
        });
      }
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

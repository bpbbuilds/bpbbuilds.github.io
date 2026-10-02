/**
 * Dedicated per-item GDScript ports (Band G Phase 45).
 */

import { tryUseStamina, healActor, requestedHealAmount } from '../actor.js';
import { gainStacks } from '../stacks.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { affectedTargets, getItemsInside } from '../board-graph.js';
import { randInt, rollPercent } from '../rng.js';
import { rollItemChance } from '../chance.js';
import { basicCd, doubleStrike, dealHit } from './handlers.js';
import { pushActivate } from './ports-util.js';
import { eventFoeSide, eventSideForPiece } from '../vs-board.js';
import { MECH_PORTS } from './ports-mech.js';
import { BUFF_PORTS } from './ports-buff.js';
import { LUCK_PORTS } from './ports-luck.js';
import { MANA_PORTS } from './ports-mana.js';
import { HEAT_PORTS } from './ports-heat.js';
import { AURA_PORTS } from './ports-aura.js';
import { THRESHOLD_PORTS } from './ports-threshold.js';
import { PET_PORTS } from './ports-pet.js';
import { SKILL_PORTS } from './ports-skill.js';
import { CONSUMABLE_PORTS } from './ports-consumable.js';
import { OUTLIER_PORTS } from './ports-outliers.js';
import { OUTLIER_BOARD_PORTS } from './ports-outliers-board.js';
import { WAVE_B_AURA_PORTS } from './ports-wave-b-aura.js';
import { WAVE_B_HEAL_PORTS } from './ports-wave-b-heal.js';
import { WAVE_B_PORTS } from './ports-wave-b.js';
import { WAVE_C_ONHIT_PORTS } from './ports-wave-c-onhit.js';
import { WAVE_C_SPEAR_PORTS } from './ports-wave-c-spear.js';
import { WAVE_C_MANA_PORTS } from './ports-wave-c-mana.js';
import { WAVE_C_SCALE_PORTS } from './ports-wave-c-scale.js';
import { WAVE_D_GOOBERT_PORTS } from './ports-wave-d-goobert.js';
import { WAVE_D_WEAPON_PORTS } from './ports-wave-d-weapons.js';
import { WAVE_D_UNIQUE_PORTS } from './ports-wave-d-unique.js';
import { WAVE_D_BOARD_PORTS } from './ports-wave-d-board.js';
import { AI_B_PORTS } from './ports-ai-b.js';
import { WAVE_AI_C_PORTS_A } from './ports-ai-c.js';
import { WAVE_AI_C_PORTS_B } from './ports-ai-c2.js';
import { AI_A_PORTS } from './ports-ai-a.js';
import { AI_D_PORTS } from './ports-ai-d.js';
import { AI_E_PORTS } from './ports-ai-e.js';
import { AI_F_PORTS } from './ports-ai-f.js';
import { AI_HARD_PORTS } from './ports-ai-hard.js';
import { AK_POTION_PORTS } from './ports-ak-potions.js';
import { AK_BAG_PORTS } from './ports-ak-bags.js';
import { AK_NOOP_PORTS } from './ports-ak-noop.js';
import { AL_WEAPON_PORTS } from './ports-al-weapons.js';
import { AL_STONE_PORTS } from './ports-al-stones.js';
import { AM_GOOBERT_PORTS } from './ports-am-goobert.js';
import { AM_PET_PORTS } from './ports-am-pets.js';
import { AM_EGG_PORTS } from './ports-am-eggs.js';
import { AN_ACCESSORY_PORTS } from './ports-an-accessories.js';
import { AN_GADGET_PORTS } from './ports-an-gadgets.js';
import { AN_ARMOR_PORTS } from './ports-an-armor.js';
import { AN_SOCKET_PORTS } from './ports-an-gems.js';
import { AO_SKILL_PORTS } from './ports-ao-skills.js';
import { AO_CARD_PORTS } from './ports-ao-cards.js';
import { AO_SHIELD_PORTS } from './ports-ao-shields.js';
import { AO_SPELL_PORTS } from './ports-ao-spells.js';
import { AP_LUCKY_PORTS } from './ports-ap-lucky.js';
import { AP_MANA_PORTS } from './ports-ap-mana.js';
import { AP_REGEN_PORTS } from './ports-ap-regen.js';
import { AP_HEAT_PORTS } from './ports-ap-heat.js';
import { AP_COLD_PORTS } from './ports-ap-cold.js';
import { AP_BASIC_PORTS } from './ports-ap-basic.js';
import { AP_START_PORTS } from './ports-ap-start.js';
import { AP_PERM_PORTS } from './ports-ap-perm.js';
import { AP_ONHIT_PORTS } from './ports-ap-onhit.js';
import { AP_AURA_PORTS } from './ports-ap-aura.js';
import { applyFoodPrepareSpeed, canBeEmpoweredPiece, markFoodConsumed } from './food-helpers.js';
import { addAccuracy, addBonusDamage, addSpeed } from '../piece-stats.js';
import { withStatSource } from '../stat-mods.js';
import { buffPowerOf } from '../buff-power.js';
import {
  advanceBuffThresholds,
  giveLeastBuffs,
  giveMostBuffs,
  grantStacks,
  onBuffChanged,
  useLucky,
} from '../buff-economy.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** @type {ScriptHandler} */
export const broomPort = {
  handlerId: 'broom',
  family: 'on_hit',
  onCombatStart(piece, ctx) {
    piece._broomBonus = 0;
    ctx.bus?.on?.('player_damaged', (payload) => {
      if (payload?.hit) return;
      const extra = Math.max(1, Math.round(getP1(piece.params, 2)));
      withStatSource(piece, () => addBonusDamage(piece, extra));
      piece._broomBonus = (piece._broomBonus || 0) + extra;
      ctx.events.push({
        t: payload?.t ?? ctx.t,
        type: 'buff',
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        amount: extra,
        label: `${piece.name}: +${extra} damage (enemy miss)`,
        meta: { category: 'weapon', script: true, handler: 'broom' },
      });
    });
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    if (tryUseStamina(player, piece.staminaCost) === 'starve') {
      events.push({
        t,
        type: 'stamina',
        label: `${piece.name}: out of stamina`,
        meta: { category: 'stamina', script: true, starved: true, handler: 'broom' },
      });
      return false;
    }
    pushActivate(piece, ctx, 'broom', `Weapon: ${piece.name}`);
    const raw = randInt(piece.damageMin, piece.damageMax, rng);
    const hit = dealHit(piece, ctx, raw);
    if (piece._broomBonus) {
      addBonusDamage(piece, -piece._broomBonus);
      piece._broomBonus = 0;
    }
    if (hit.hit) {
      if (rollItemChance(piece, rng, piece.chance > 0 ? piece.chance : 35)) {
        gainStacks(ctx.dummy, 'blind', 1, { rng, opponent: player });
        events.push({
          t: t + 0.008,
          type: 'debuff',
          target: eventFoeSide(piece),
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          amount: 1,
          label: `${piece.name}: +1 Blind`,
          meta: { category: 'status', script: true, handler: 'broom', stack: 'blind' },
        });
      }
    }
    return true;
  },
};

/** @type {ScriptHandler} */
export const bananaPort = {
  handlerId: 'banana',
  family: 'food',
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    // Banana.gd: heal() + giveStamina() — Item.giveStamina default amount = 1 (no p2 in catalog).
    const healAmt = Math.max(1, Math.round(getPName(piece.params, 'heal', getP1(piece.params, 4))));
    const stamAmt = Math.max(
      1,
      Math.round(getPName(piece.params, 'stamina', getP2(piece.params, 1))),
    );
    const healed = healActor(player, healAmt);
    player.stamina = Math.min(player.maxStamina, player.stamina + stamAmt);
    events.push({
      t,
      type: 'activate',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `Food: ${piece.name}`,
      meta: { category: 'consumable', script: true, handler: 'banana' },
    });
    if (healed > 0 || (player._lastHeal && !player._lastHeal.meterAttached)) {
      const logged = Number(player._lastHeal?.loggedAmount) || healed;
      if (player._lastHeal) player._lastHeal.meterAttached = true;
      events.push({
        t: t + 0.002,
        type: 'heal',
        actor: 'player',
        target: 'player',
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        amount: logged,
        label: `${piece.name}: heal +${logged}`,
        meta: { category: 'heal', script: true, handler: 'banana', playerHp: player.hp },
      });
    }
    events.push({
      t: t + 0.003,
      type: 'stamina',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      amount: stamAmt,
      label: `${piece.name}: Regenerated ${stamAmt} stamina`,
      meta: {
        category: 'stamina',
        kind: 'gained',
        script: true,
        handler: 'banana',
        stamina: player.stamina,
      },
    });
    markFoodConsumed(piece, ctx, 'banana');
    return true;
  },
};

/** @type {ScriptHandler} */
export const heroLongswordPort = {
  handlerId: 'hero_longsword',
  family: 'synergy_aura',
  onCombatStart(piece, ctx) {
    const { t, events, graph, itemsById, canAffect } = ctx;
    const bonus = Math.max(1, Math.round(getP1(piece.params, 4)));
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    let buffed = 0;
    for (const other of ctx.pieces || []) {
      if (other.placementKey === piece.placementKey) continue;
      if (!links.some((l) => l.key === other.placementKey)) continue;
      other.damageBonus = (other.damageBonus || 0) + bonus;
      buffed += 1;
      events.push({
        t: t + 0.01,
        type: 'info',
        label: `${piece.name}: +${bonus} dmg → ${other.name}`,
        meta: { category: 'adjacency', script: true, handler: 'hero_longsword' },
      });
    }
    events.push({
      t,
      type: 'buff',
      actor: 'player',
      itemId: piece.itemId,
      amount: bonus,
      label: `${piece.name}: +${bonus} dmg aura (${buffed}/${links.length} linked)`,
      meta: {
        category: 'adjacency',
        script: true,
        handler: 'hero_longsword',
        links: links.length,
        buffed,
      },
    });
  },
  onCooldownEffect: (piece, ctx) => basicCd.onCooldownEffect(piece, ctx),
};

/**
 * FalconBlade.gd — combat start: addSpeed(p1/100) on star CD links; CD: double strike.
 */
/** @type {ScriptHandler} */
export const falconBladePort = {
  handlerId: 'falcon_blade',
  family: 'synergy_aura',
  onCombatStart(piece, ctx) {
    const { t, events, graph, itemsById, canAffect } = ctx;
    const speedPct = getPName(piece.params, 'speed', getP1(piece.params, 40));
    const frac = speedPct / 100;
    if (!frac) return;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    let buffed = 0;
    for (const other of ctx.pieces || []) {
      if (other.placementKey === piece.placementKey) continue;
      if (!links.some((l) => l.key === other.placementKey)) continue;
      if (!(other.cooldown > 0) || other.cooldown >= 500) continue;
      addSpeed(other, frac);
      buffed += 1;
      events.push({
        t: t + 0.01,
        type: 'info',
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${speedPct}% speed → ${other.name}`,
        meta: {
          category: 'adjacency',
          script: true,
          handler: 'falcon_blade',
          targetKey: other.placementKey,
          speedPct,
        },
      });
    }
    // Game activate(null, false) at combat start.
    pushActivate(piece, ctx, 'falcon_blade', `Weapon: ${piece.name}`);
    events.push({
      t,
      type: 'info',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: haste aura +${speedPct}% (${buffed} items)`,
      meta: {
        category: 'adjacency',
        script: true,
        handler: 'falcon_blade',
        speedPct,
        buffed,
      },
    });
  },
  onCooldownEffect: (piece, ctx) => doubleStrike.onCooldownEffect(piece, ctx),
};

/**
 * GlovesofHaste.gd — combat start: addSpeed(p1/100) on star CD links; activate().
 */
/** @type {ScriptHandler} */
export const glovesOfHastePort = {
  handlerId: 'gloves_of_haste',
  family: 'synergy_aura',
  onCombatStart(piece, ctx) {
    const { t, events, graph, itemsById, canAffect } = ctx;
    const speedPct = getPName(piece.params, 'speed', getP1(piece.params, 20));
    const frac = speedPct / 100;
    if (!frac) return;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    for (const other of ctx.pieces || []) {
      if (other.placementKey === piece.placementKey) continue;
      if (!links.some((l) => l.key === other.placementKey)) continue;
      if (!(other.cooldown > 0) || other.cooldown >= 500) continue;
      addSpeed(other, frac);
      events.push({
        t: t + 0.01,
        type: 'info',
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${speedPct}% speed → ${other.name}`,
        meta: {
          category: 'adjacency',
          script: true,
          handler: 'gloves_of_haste',
          targetKey: other.placementKey,
          speedPct,
        },
      });
    }
    pushActivate(piece, ctx, 'gloves_of_haste', `Accessory: ${piece.name}`);
  },
};

/** @type {ScriptHandler} */
export const healingHerbsPort = {
  handlerId: 'healing_herbs',
  family: 'start_buff',
  onCombatStart(piece, ctx) {
    const { t, player, events } = ctx;
    const amount = Math.max(1, Math.round(getP1(piece.params, 4)));
    gainStacks(player, 'regeneration', amount);
    piece.alive = false;
    piece.charges = 0;
    pushActivate(piece, ctx, 'healing_herbs', `Food: ${piece.name}`);
    events.push({
      t,
      type: 'buff',
      actor: player.id,
      target: player.id,
      amount,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: +${amount} Regeneration`,
      meta: {
        category: 'hot',
        script: true,
        handler: 'healing_herbs',
        stack: 'regeneration',
      },
    });
  },
};

/**
 * Blueberries.gd + Food.gd prepare — giveMana_capped → Lucky on overflow; food-link haste.
 */
/** @type {ScriptHandler} */
export const blueberriesPort = {
  handlerId: 'blueberries',
  family: 'food',
  onCombatStart(piece, ctx) {
    applyFoodPrepareSpeed(piece, ctx);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'blueberries', `Food: ${piece.name}`);
    // Item.giveMana_capped: round(amount * buffPowers[Mana]) then fill to maximum.
    const raw = Math.max(
      0,
      Math.round(getPName(piece.params, 'mana', getP1(piece.params, 1))),
    );
    const amount = Math.max(0, Math.round(raw * buffPowerOf(piece, 'mana')));
    const maximum = Math.max(
      1,
      Math.round(getPName(piece.params, 'manat', getP2(piece.params, 10))),
    );
    const luck = Math.max(
      1,
      Math.round(getPName(piece.params, 'luck', getP3(piece.params, 1))),
    );
    const curMana = Number(player.stacks.mana) || 0;

    let manaGiven = 0;
    let overflow = amount;
    if (maximum > curMana && amount > 0) {
      manaGiven = Math.min(amount, maximum - curMana);
      overflow = amount - manaGiven;
      if (manaGiven > 0) gainStacks(player, 'mana', manaGiven);
    }

    if (manaGiven > 0) {
      events.push({
        t: t + 0.002,
        type: 'buff',
        target: 'player',
        amount: manaGiven,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${manaGiven} Mana`,
        meta: {
          category: 'buff',
          stack: 'mana',
          script: true,
          handler: 'blueberries',
          mana: player.stacks.mana,
        },
      });
    }

    if (overflow > 0) {
      grantStacks(player, 'lucky', luck, {
        originKey: piece.placementKey,
        originId: piece.itemId,
        t: t + 0.004,
      });
    }

    return true;
  },
};

/**
 * AmuletofLight.gd — on neighbor activate: chance regen; max HP on regen gain.
 */
/** @type {ScriptHandler} */
export const amuletOfLightPort = {
  handlerId: 'amulet_of_light',
  family: 'unique',
  onCombatStart(piece, ctx) {
    ctx.events.push({
      t: ctx.t,
      type: 'info',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: listening for activations`,
      meta: { category: 'system', script: true, handler: 'amulet_of_light' },
    });
  },
  onPeerActivated(listener, activated, ctx) {
    const { t, player, events, rng, itemsById } = ctx;
    const selfItem = itemsById.get(listener.itemId);
    const peerItem = itemsById.get(activated.itemId);
    if (!selfItem || !peerItem) return;

    const extras = Array.isArray(peerItem.extraTypes) ? peerItem.extraTypes : [];
    const isHoly = extras.some((x) => String(x).toLowerCase() === 'holy');
    const chance = isHoly
      ? Number(selfItem.chance2) || 30
      : Number(selfItem.chance) || 10;
    if (!rollPercent(chance, rng)) return;

    const regen = Math.max(
      1,
      Math.round(getPName(listener.params, 'regen', getP2(listener.params, 1))),
    );
    const maxHpPer = Math.max(
      0,
      Math.round(getPName(listener.params, 'maxhealth', getP1(listener.params, 3))),
    );

    const g = gainStacks(player, 'regeneration', regen);
    if (g.gained > 0 && maxHpPer > 0) {
      const hpGain = g.gained * maxHpPer;
      player.maxHp += hpGain;
      player.hp = Math.min(player.maxHp, player.hp + hpGain);
    }

    if (g.gained > 0) {
      events.push({
        t: t + 0.011,
        type: 'buff',
        target: 'player',
        amount: g.gained,
        itemId: listener.itemId,
        placementKey: listener.placementKey,
        label: `${listener.name}: +${g.gained} Regeneration (${activated.name})`,
        meta: {
          category: 'hot',
          stack: 'regeneration',
          script: true,
          handler: 'amulet_of_light',
          fromKey: activated.placementKey,
          regeneration: player.stacks.regeneration,
        },
      });
    }
  },
};

/**
 * EnchantedWeapons.gd — prepare: double attack-effect chance on hasAttackEffect links; CD giveLeastBuffs.
 */
/** @type {ScriptHandler} */
export const enchantedWeaponsPort = {
  handlerId: 'enchanted_weapons',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, events, graph, itemsById, canAffect, pieces } = ctx;
    const selfItem = itemsById.get(piece.itemId);
    const chance = Number(selfItem?.chance) || Number(piece.chance) || 25;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    let buffed = 0;
    for (const other of pieces || []) {
      if (other.placementKey === piece.placementKey) continue;
      if (!links.some((l) => l.key === other.placementKey)) continue;
      const item = itemsById.get(other.itemId);
      const hasAtk =
        other.kind === 'weapon' ||
        other.damageMax > 0 ||
        other.damageMin > 0 ||
        Boolean(item?.hasAttackEffect) ||
        (Array.isArray(other.stackHints) && other.stackHints.length > 0) ||
        Number(other.chance) > 0 ||
        Number(item?.chance) > 0;
      if (!hasAtk) continue;
      other.doubleAttackEffectChance =
        (Number(other.doubleAttackEffectChance) || 0) + chance / 100;
      buffed += 1;
      events.push({
        t: t + 0.01,
        type: 'info',
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${chance}% double attack effect → ${other.name}`,
        meta: {
          category: 'adjacency',
          script: true,
          handler: 'enchanted_weapons',
          targetKey: other.placementKey,
        },
      });
    }
    events.push({
      t,
      type: 'info',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: enchanted ${buffed} weapon(s)`,
      meta: { category: 'system', script: true, handler: 'enchanted_weapons', buffed },
    });
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    const n = Math.max(1, Math.round(getPName(piece.params, 'buffs', getP1(piece.params, 1))));
    events.push({
      t,
      type: 'activate',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `Skill: ${piece.name}`,
      meta: { category: 'consumable', script: true, handler: 'enchanted_weapons' },
    });
    const picked = giveLeastBuffs(player, n, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    let off = 0.002;
    for (const [stack, amount] of Object.entries(picked)) {
      events.push({
        t: t + off,
        type: 'buff',
        target: 'player',
        amount,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${amount} ${stack}`,
        meta: {
          category: 'buff',
          stack,
          script: true,
          handler: 'enchanted_weapons',
          [stack]: player.stacks[/** @type {any} */ (stack)],
        },
      });
      off += 0.002;
    }
    return true;
  },
};

/** FannyPack.gd — addSpeed to items inside the bag (+ Bagtacular speed if present). */
/** @type {ScriptHandler} */
export const fannyPackPort = {
  handlerId: 'fanny_pack',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, events, graph, pieces, itemsById } = ctx;
    let speedBonus = getP1(piece.params, 10) / 100;
    const bagtacular = (pieces || []).find((p) => p.itemId === 'bagtacular' && p.alive !== false);
    if (bagtacular) {
      const bagItem = itemsById?.get?.('bagtacular');
      const bagParams = bagtacular.params || bagItem?.params || {};
      speedBonus += getPName(bagParams, 'speed', getP1(bagParams, 5)) / 100;
    }
    const inside = getItemsInside(graph, piece.placementKey);
    for (const key of inside) {
      const other = (pieces || []).find((p) => p.placementKey === key);
      if (!other || other.kind === 'bag') continue;
      if (!(other.baseCooldown > 0 || (other.cooldown > 0 && other.cooldown < 500))) continue;
      addSpeed(other, speedBonus);
      events.push({
        t: t + 0.01,
        type: 'info',
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${Math.round(speedBonus * 100)}% speed → ${other.name}`,
        meta: { category: 'adjacency', script: true, handler: 'fanny_pack', targetKey: key },
      });
    }
  },
};

/** MissFortune.gd — if lucky ≥ luck, spend Lucky → giveMostBuffs; always activate. */
/** @type {ScriptHandler} */
export const missFortunePort = {
  handlerId: 'miss_fortune',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    const need = Math.max(1, Math.round(getPName(piece.params, 'luck', getP1(piece.params, 1))));
    const num = Math.max(1, Math.round(getPName(piece.params, 'buffs', getP2(piece.params, 3))));
    // Game always activates (MissFortune.gd activate() after the lucky branch).
    pushActivate(piece, ctx, 'miss_fortune', `Accessory: ${piece.name}`);
    if ((Number(player.stacks.lucky) || 0) >= need) {
      const spent = useLucky(player, need, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      if (spent.spent > 0) {
        const side = eventSideForPiece(piece);
        // useLucky does not combat-log spends — one −Lucky line with correct side.
        events.push({
          t: t + 0.002,
          type: 'buff',
          actor: side,
          target: side,
          amount: -spent.spent,
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          label: `${piece.name}: −${spent.spent} Lucky`,
          meta: { category: 'buff', stack: 'lucky', script: true, handler: 'miss_fortune' },
        });
      }
      // giveMostBuffs → grantStacks already combat-logs the buff grant (no duplicate).
      giveMostBuffs(player, num, rng, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    return true;
  },
};

/** Toad.gd — CD luck2+mana2; buff thresholds on affected origins. */
/** @type {ScriptHandler} */
export const toadPort = {
  handlerId: 'toad',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { player, graph, itemsById, canAffect } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    /** @type {Set<string>} */
    const affected = new Set(links.map((l) => l.key));
    piece._toadState = { gained: 0, used: 0, affected };
    const gainedTh = Math.max(1, Math.round(getPName(piece.params, 'gained', getP1(piece.params, 10))));
    const usedTh = Math.max(1, Math.round(getPName(piece.params, 'used', getP3(piece.params, 10))));
    const healPer = Math.max(0, Math.round(getPName(piece.params, 'heal', getP2(piece.params, 12))));
    const luckPer = Math.max(0, Math.round(getPName(piece.params, 'luck', 1)));
    const manaPer = Math.max(0, Math.round(getPName(piece.params, 'mana', 1)));

    onBuffChanged(player, (ch) => {
      if (!ch.originKey || !affected.has(ch.originKey)) return;
      const ticks = advanceBuffThresholds(piece._toadState, ch.amount, gainedTh, usedTh);
      // Game onGainThresholdReached → heal(ticks * getP_m("heal")); miniActivate is VFX only.
      if (ticks.gainTicks > 0 && healPer > 0) {
        const healAmt = ticks.gainTicks * healPer;
        const side = eventSideForPiece(piece);
        const want = requestedHealAmount(player, healAmt);
        healActor(player, healAmt);
        if (player._lastHeal) player._lastHeal.meterAttached = true;
        if (want > 0) {
          ctx.events.push({
            t: ctx.t,
            type: 'heal',
            actor: side,
            target: side,
            amount: want,
            itemId: piece.itemId,
            placementKey: piece.placementKey,
            label: `${piece.name}: heal +${want}`,
            meta: {
              category: 'heal',
              script: true,
              handler: 'toad',
              loggedAmount: want,
              meterAttached: true,
              requestedHealAmount: healAmt,
            },
          });
        }
      }
      // Game onUseThresholdReached → giveLucky + giveMana; grantStacks already combat-logs.
      if (ticks.useTicks > 0) {
        if (luckPer > 0) {
          grantStacks(player, 'lucky', ticks.useTicks * luckPer, {
            originKey: piece.placementKey,
            originId: piece.itemId,
          });
        }
        if (manaPer > 0) {
          grantStacks(player, 'mana', ticks.useTicks * manaPer, {
            originKey: piece.placementKey,
            originId: piece.itemId,
          });
        }
      }
    });
  },
  onCooldownEffect(piece, ctx) {
    const { player } = ctx;
    const luck2 = Math.max(0, Math.round(getPName(piece.params, 'luck2', 1)));
    const mana2 = Math.max(0, Math.round(getPName(piece.params, 'mana2', 1)));
    // Game doCooldownEffect → giveLucky/giveMana then activate(); one Activation only.
    pushActivate(piece, ctx, 'toad', `Pet: ${piece.name}`);
    if (luck2 > 0) {
      grantStacks(player, 'lucky', luck2, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    if (mana2 > 0) {
      grantStacks(player, 'mana', mana2, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    return true;
  },
};

/** OilLamp.gd — start Heat; CD addBonusDamage + addAccuracy on empowerable. */
/** @type {ScriptHandler} */
export const oilLampPort = {
  handlerId: 'oil_lamp',
  family: 'synergy_aura',
  onCombatStart(piece, ctx) {
    const { t, player, events } = ctx;
    const heat = Math.max(0, Math.round(getPName(piece.params, 'heat', getP1(piece.params, 2))));
    if (heat > 0) {
      grantStacks(player, 'heat', heat, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      events.push({
        t,
        type: 'buff',
        target: 'player',
        amount: heat,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${heat} Heat`,
        meta: { category: 'buff', stack: 'heat', script: true, handler: 'oil_lamp' },
      });
    }
    pushActivate(piece, ctx, 'oil_lamp', `Accessory: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    const { t, events, graph, itemsById, canAffect, pieces } = ctx;
    const dam = Math.max(0, Math.round(getPName(piece.params, 'dam', getP2(piece.params, 1))));
    const acc = Math.max(0, Math.round(getPName(piece.params, 'accuracy', getP3(piece.params, 5))));
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    pushActivate(piece, ctx, 'oil_lamp', `Accessory: ${piece.name}`);
    for (const other of pieces || []) {
      if (other.placementKey === piece.placementKey) continue;
      if (!links.some((l) => l.key === other.placementKey)) continue;
      if (!canBeEmpoweredPiece(other)) continue;
      if (dam) addBonusDamage(other, dam);
      if (acc) addAccuracy(other, acc);
      events.push({
        t: t + 0.01,
        type: 'info',
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${dam} dmg / +${acc}% acc → ${other.name}`,
        meta: {
          category: 'adjacency',
          script: true,
          handler: 'oil_lamp',
          targetKey: other.placementKey,
        },
      });
    }
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const PORT_HANDLERS = {
  broom: broomPort,
  banana: bananaPort,
  hero_longsword: heroLongswordPort,
  falcon_blade: falconBladePort,
  healing_herbs: healingHerbsPort,
  gloves_of_haste: glovesOfHastePort,
  blueberries: blueberriesPort,
  amulet_of_light: amuletOfLightPort,
  enchanted_weapons: enchantedWeaponsPort,
  fanny_pack: fannyPackPort,
  miss_fortune: missFortunePort,
  toad: toadPort,
  oil_lamp: oilLampPort,
  ...MECH_PORTS,
  ...BUFF_PORTS,
  ...LUCK_PORTS,
  ...MANA_PORTS,
  ...HEAT_PORTS,
  ...AURA_PORTS,
  ...THRESHOLD_PORTS,
  ...PET_PORTS,
  ...SKILL_PORTS,
  ...CONSUMABLE_PORTS,
  ...OUTLIER_PORTS,
  ...OUTLIER_BOARD_PORTS,
  ...WAVE_B_AURA_PORTS,
  ...WAVE_B_HEAL_PORTS,
  ...WAVE_B_PORTS,
  ...WAVE_C_ONHIT_PORTS,
  ...WAVE_C_SPEAR_PORTS,
  ...WAVE_C_MANA_PORTS,
  ...WAVE_C_SCALE_PORTS,
  ...WAVE_D_GOOBERT_PORTS,
  ...WAVE_D_WEAPON_PORTS,
  ...WAVE_D_UNIQUE_PORTS,
  ...WAVE_D_BOARD_PORTS,
  ...WAVE_AI_C_PORTS_A,
  ...WAVE_AI_C_PORTS_B,
  ...AI_B_PORTS,
  ...AI_A_PORTS,
  ...AI_E_PORTS,
  ...AI_F_PORTS,
  ...AI_D_PORTS,
  ...AI_HARD_PORTS,
  ...AK_POTION_PORTS,
  ...AK_BAG_PORTS,
  ...AK_NOOP_PORTS,
  ...AL_WEAPON_PORTS,
  ...AL_STONE_PORTS,
  ...AM_GOOBERT_PORTS,
  ...AM_PET_PORTS,
  ...AM_EGG_PORTS,
  ...AN_ACCESSORY_PORTS,
  ...AN_GADGET_PORTS,
  ...AN_ARMOR_PORTS,
  ...AO_SKILL_PORTS,
  ...AO_CARD_PORTS,
  ...AO_SHIELD_PORTS,
  ...AO_SPELL_PORTS,
  ...AP_LUCKY_PORTS,
  ...AP_MANA_PORTS,
  ...AP_REGEN_PORTS,
  ...AP_HEAT_PORTS,
  ...AP_COLD_PORTS,
  ...AP_BASIC_PORTS,
  ...AP_START_PORTS,
  ...AP_PERM_PORTS,
  ...AP_ONHIT_PORTS,
  ...AP_AURA_PORTS,
  ...AN_SOCKET_PORTS,
};

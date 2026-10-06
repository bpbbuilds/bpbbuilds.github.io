/**
 * Band AP 248 — leftover `start_*` MAP items → `.gd` ports.
 * `piggybank` stays in ports-threshold.js (HAND only).
 */

import { dealDamage } from '../damage.js';
import { dealEffectDamage } from './handlers.js';
import { grantInvuln, healActor } from '../actor.js';
import { applyHealEfficiency } from '../actor-stats.js';
import {
  BUFF_KEYS,
  giveRandomBuffs,
  grantStacks,
  inflictRandomDebuffs,
  useMana,
} from '../buff-economy.js';
import { affectedTargets, getItemsInside } from '../board-graph.js';
import { getP1, getP2, getP3, getP5, getPName } from '../params.js';
import { addBonusDamage, addBonusDamageFactor } from '../piece-stats.js';
import { gainStacks } from '../stacks.js';
import { itemHasType, pushActivate } from './ports-util.js';
import { canBeEmpoweredPiece } from './food-helpers.js';
import { rollItemChance, weaponStrike } from './ports-wave-c-util.js';
import { eventSideForPiece } from '../vs-board.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

function origin(piece) {
  return { originKey: piece.placementKey, originId: piece.itemId };
}

function linked(ctx, piece, color) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  return (ctx.pieces || []).filter((o) =>
    links.some((l) => l.key === o.placementKey && (!color || l.color === color)),
  );
}

function consumeStart(piece, ctx, handler) {
  pushActivate(piece, ctx, handler, `${piece.name}`);
  piece.alive = false;
  piece.charges = 0;
}

export function giveTempMaxHp(piece, ctx, handler, amount) {
  // Character.applyTemporaryMaxHealthGain applies the owner's accumulated
  // MaxHealthGain factor before changing temporary max health.
  const amp = Number(ctx.player._maxHealthGain) || 0;
  const gain = Math.max(0, Math.round(Number(amount) * (1 + amp)));
  if (!gain) return;
  const side = eventSideForPiece(piece);
  ctx.player.maxHp += gain;
  ctx.player.hp += gain;
  ctx.events.push({
    t: ctx.t,
    type: 'heal',
    actor: side,
    target: side,
    amount: gain,
    itemId: piece.itemId,
    placementKey: piece.placementKey,
    label: `${piece.name}: +${gain} max HP`,
    meta: {
      category: 'heal',
      script: true,
      handler,
      playerHp: ctx.player.hp,
      maxHp: ctx.player.maxHp,
    },
  });
}

/** BloodAmulet.gd — vamp + giveMaxHealth + activate. */
const bloodAmuletPort = {
  handlerId: 'blood_amulet',
  family: 'start_buff',
  onCombatStart(piece, ctx) {
    grantStacks(
      ctx.player,
      'vampirism',
      Math.max(1, Math.round(getPName(piece.params, 'vampirism', getP1(piece.params, 2)))),
      origin(piece),
    );
    giveTempMaxHp(
      piece,
      ctx,
      'blood_amulet',
      getPName(piece.params, 'maxhealth', getP2(piece.params, 20)),
    );
    pushActivate(piece, ctx, 'blood_amulet', `Accessory: ${piece.name}`);
  },
};

/** CursedHairComb.gd — vamp; heal amp; lifesteal on empowered-weapon hits. */
const cursedHairCombPort = {
  handlerId: 'cursed_hair_comb',
  family: 'start_buff',
  onPrepare(piece, ctx) {
    applyHealEfficiency(ctx.player, getP3(piece.params, 30) / 100, ctx, piece);
    const keys = new Set(
      linked(ctx, piece, 'primary')
        .filter((o) => canBeEmpoweredPiece(o))
        .map((o) => o.placementKey),
    );
    ctx.bus?.on?.('piece_dealt_damage', (payload) => {
      const src = payload?.piece;
      if (!src || !payload?.hit?.hit || !keys.has(src.placementKey)) return;
      const vampN = linked(ctx, piece, 'secondary').filter((o) =>
        itemHasType(ctx.itemsById.get(o.itemId), 'vampiric'),
      ).length;
      const pct =
        getPName(piece.params, 'lifesteal', 25) +
        vampN * getPName(piece.params, 'lifesteal_scaling', 8);
      const dmg = Number(payload.hit.damage ?? payload.hit.healthDamage) || 0;
      const got = healActor(ctx.player, Math.ceil((dmg * pct) / 100));
      if (got > 0) {
        const side = eventSideForPiece(piece);
        ctx.events.push({
          t: ctx.t + 0.002,
          type: 'heal',
          actor: side,
          target: side,
          amount: got,
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          label: `${piece.name}: +${got} HP`,
          meta: { category: 'heal', script: true, handler: 'cursed_hair_comb' },
        });
      }
    });
  },
  onCombatStart(piece, ctx) {
    grantStacks(
      ctx.player,
      'vampirism',
      Math.max(1, Math.round(getPName(piece.params, 'vampirism', getP1(piece.params, 6)))),
      origin(piece),
    );
    pushActivate(piece, ctx, 'cursed_hair_comb', `Accessory: ${piece.name}`);
  },
};

/** BurningTorch.gd — start heat; strike; on-hit chance perm bonus dam. */
const burningTorchPort = {
  handlerId: 'burning_torch',
  family: 'weapon_base',
  onCombatStart(piece, ctx) {
    grantStacks(
      ctx.player,
      'heat',
      Math.max(1, Math.round(getPName(piece.params, 'heat', getP1(piece.params, 2)))),
      origin(piece),
    );
    pushActivate(piece, ctx, 'burning_torch', `Weapon: ${piece.name}`);
  },
  onPreDealDamageEarly(piece, ctx, res) {
    if (res && !res.hit) return;
    if (!rollItemChance(piece, ctx.rng)) return;
    addBonusDamage(piece, Math.max(1, Math.round(getPName(piece.params, 'damagegain', getP2(piece.params, 1)))));
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'burning_torch');
  },
};

/** FlameBadge.gd — heat then consume (shop flame is shop-only). */
const flameBadgePort = {
  handlerId: 'flame_badge',
  family: 'start_buff',
  onCombatStart(piece, ctx) {
    grantStacks(
      ctx.player,
      'heat',
      Math.max(1, Math.round(getPName(piece.params, 'heat', getP1(piece.params, 6)))),
      origin(piece),
    );
    consumeStart(piece, ctx, 'flame_badge');
  },
};

/** RubyWhelp.gd — reflect at prepare; start heat; strike. */
const rubyWhelpPort = {
  handlerId: 'ruby_whelp',
  family: 'weapon_base',
  onCombatStart(piece, ctx) {
    ctx.player.debuffReflectStacks =
      (Number(ctx.player.debuffReflectStacks) || 0) +
      Math.max(0, Math.round(getPName(piece.params, 'reflect', getP2(piece.params, 3))));
    grantStacks(
      ctx.player,
      'heat',
      Math.max(1, Math.round(getPName(piece.params, 'heat', getP1(piece.params, 5)))),
      origin(piece),
    );
    pushActivate(piece, ctx, 'ruby_whelp', `Weapon: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'ruby_whelp');
  },
};

/** DarkLantern.gd — % HP loss (not +max HP); reincarnate + invuln; fire effect / dark debuffs. */
const darkLanternPort = {
  handlerId: 'dark_lantern',
  family: 'unique',
  onPrepare(piece, ctx) {
    piece._lanternUsed = false;
    const onDamaged = (payload = {}) => {
      if (piece._lanternUsed) return;
      const p = ctx.player;
      if (payload.actor && payload.actor !== p) return;
      if (p.hp > 0 && !p.dead) return;
      piece._lanternUsed = true;
      const hp = Math.max(1, Math.round((getP2(piece.params, 50) / 100) * p.maxHp));
      p.dead = false;
      p.hp = hp;
      grantInvuln(p, getPName(piece.params, 'dur_invu', 1.3), ctx.t, {
        bus: ctx.bus,
        sourceId: piece.itemId,
      });
      const side = p.id;
      ctx.events.push({
        t: ctx.t,
        type: 'heal',
        actor: side,
        target: side,
        amount: hp,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: reincarnate to ${hp} HP`,
        meta: { category: 'heal', script: true, handler: 'dark_lantern', reincarnate: true, playerHp: p.hp },
      });
      const fires = linked(ctx, piece, 'primary').filter((o) =>
        itemHasType(ctx.itemsById.get(o.itemId), 'fire'),
      ).length;
      const dam = Math.max(0, Math.round(Number(piece.damageMin) || 5)) * fires;
      if (dam) {
        dealEffectDamage(piece, ctx, dam);
      }
      const darks = linked(ctx, piece, 'secondary').filter((o) =>
        itemHasType(ctx.itemsById.get(o.itemId), 'dark'),
      ).length;
      const n = Math.max(0, Math.round(getPName(piece.params, 'debuffs', getP5(piece.params, 7)))) * darks;
      if (n) inflictRandomDebuffs(ctx.dummy, n, ctx.rng, origin(piece));
      pushActivate(piece, ctx, 'dark_lantern', `${piece.name}: reincarnate`);
    };
    // Source connects during onPrepare, before the opening self-health loss.
    ctx.bus?.on?.('character_damaged', onDamaged);
    // The training-dummy/fatigue paths use this legacy convenience event.
    ctx.bus?.on?.('player_damaged', onDamaged);
  },
  onCombatStart(piece, ctx) {
    const pct = getP1(piece.params, 50) / 100;
    const loss = Math.max(0, Math.round(pct * ctx.player.maxHp));
    if (loss) {
      dealDamage(ctx.player, ctx.player, {
        amount: loss,
        canMiss: false,
        canCrit: false,
        isAttack: false,
        skipSpikes: true,
        nowT: ctx.t,
        bus: ctx.bus,
        rng: ctx.rng,
      });
    }
    pushActivate(piece, ctx, 'dark_lantern', `Accessory: ${piece.name}`);
  },
};

/** JustStats.gd — % max HP after Normal/High start grants (`Priority.Low`). */
const justStatsPort = {
  handlerId: 'just_stats',
  family: 'start_buff',
  onCombatStart(piece, ctx) {
    const pct = getPName(piece.params, 'maxhealth', getP1(piece.params, 12)) / 100;
    giveTempMaxHp(piece, ctx, 'just_stats', pct * ctx.player.maxHp);
    const stam = getPName(piece.params, 'stamina', getP2(piece.params, 10)) / 100;
    ctx.player.staminaRegen = (Number(ctx.player.staminaRegen) || 1) + stam;
    pushActivate(piece, ctx, 'just_stats', `Skill: ${piece.name}`);
  },
};

/** MoreStats.gd — % max HP; damage factor on empowerable inventory. */
const moreStatsPort = {
  handlerId: 'more_stats',
  family: 'start_buff',
  onCombatStart(piece, ctx) {
    const factor = getPName(piece.params, 'dam', getP2(piece.params, 5)) / 100;
    for (const o of ctx.pieces || []) {
      if (o.alive && canBeEmpoweredPiece(o) && factor) addBonusDamageFactor(o, factor);
    }
    const pct = getPName(piece.params, 'maxhealth', getP1(piece.params, 12)) / 100;
    giveTempMaxHp(piece, ctx, 'more_stats', pct * ctx.player.maxHp);
    pushActivate(piece, ctx, 'more_stats', `Skill: ${piece.name}`);
  },
};

/** PiggyofRiches.gd — maxhealth × socketed gems; consume. */
const piggyOfRichesPort = {
  handlerId: 'piggy_of_riches',
  family: 'start_buff',
  onCombatStart(piece, ctx) {
    let gems = 0;
    for (const o of ctx.pieces || []) {
      gems += Array.isArray(o.gemIds) ? o.gemIds.length : 0;
    }
    giveTempMaxHp(
      piece,
      ctx,
      'piggy_of_riches',
      gems * getPName(piece.params, 'maxhealth', getP1(piece.params, 4)),
    );
    consumeStart(piece, ctx, 'piggy_of_riches');
  },
};

/** PuzzlebagL.gd — Item.changeHealAmp on cargo with heal/lifesteal params; giveMaxHealth. */
const puzzlebagLPort = {
  handlerId: 'puzzlebag_l',
  family: 'start_buff',
  onCombatStart(piece, ctx) {
    const amp = 1 + getPName(piece.params, 'healamp', getP1(piece.params, 20)) / 100;
    const byKey = new Map((ctx.pieces || []).map((o) => [o.placementKey, o]));
    for (const key of getItemsInside(ctx.graph, piece.placementKey)) {
      const cargo = byKey.get(key);
      if (!cargo) continue;
      const cat = ctx.itemsById.get(cargo.itemId);
      const hasHeal =
        cargo.params.heal != null ||
        cargo.params.lifesteal != null ||
        cat?.params?.heal != null ||
        cat?.params?.lifesteal != null;
      if (!hasHeal) continue;
      cargo.params = { ...cargo.params };
      if (cargo.params.heal != null || cat?.params?.heal != null) {
        cargo.params.heal = (Number(cargo.params.heal ?? cat.params.heal) || 0) * amp;
      }
      if (cargo.params.lifesteal != null || cat?.params?.lifesteal != null) {
        cargo.params.lifesteal =
          (Number(cargo.params.lifesteal ?? cat.params.lifesteal) || 0) * amp;
      }
    }
    giveTempMaxHp(
      piece,
      ctx,
      'puzzlebag_l',
      getPName(piece.params, 'maxhealth', getP2(piece.params, 7)),
    );
    ctx.events.push({
      t: ctx.t,
      type: 'activate',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `Bag: ${piece.name}`,
      meta: { category: 'system', script: true, handler: 'puzzlebag_l' },
    });
  },
};

/** EmeraldWhelp.gd — start lucky; strike; on-hit poison. */
const emeraldWhelpPort = {
  handlerId: 'emerald_whelp',
  family: 'weapon_base',
  onCombatStart(piece, ctx) {
    grantStacks(ctx.player, 'lucky', Math.max(1, Math.round(getP1(piece.params, 3))), origin(piece));
    pushActivate(piece, ctx, 'emerald_whelp', `Weapon: ${piece.name}`);
  },
  onPreDealDamageEarly(piece, ctx, res) {
    if (res && !res.hit) return;
    grantStacks(ctx.dummy, 'poison', Math.max(1, Math.round(getP2(piece.params, 3))), origin(piece));
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'emerald_whelp');
  },
};

/** LuckyClover.gd — lucky then consume. */
const luckyCloverPort = {
  handlerId: 'lucky_clover',
  family: 'start_buff',
  onCombatStart(piece, ctx) {
    grantStacks(ctx.player, 'lucky', Math.max(1, Math.round(getP1(piece.params, 1))), origin(piece));
    consumeStart(piece, ctx, 'lucky_clover');
  },
};

/** SapphireWhelp.gd — start mana; strike; on-hit spend mana → block + random buff (no mana). */
const sapphireWhelpPort = {
  handlerId: 'sapphire_whelp',
  family: 'weapon_base',
  onCombatStart(piece, ctx) {
    grantStacks(
      ctx.player,
      'mana',
      Math.max(1, Math.round(getPName(piece.params, 'mana', getP1(piece.params, 6)))),
      origin(piece),
    );
    pushActivate(piece, ctx, 'sapphire_whelp', `Weapon: ${piece.name}`);
  },
  onPreDealDamageEarly(piece, ctx, res) {
    if (res && !res.hit) return;
    const need = Math.max(1, Math.round(getPName(piece.params, 'manat', getP2(piece.params, 1))));
    const used = useMana(ctx.player, need, origin(piece));
    if (!(used.spent > 0)) return;
    const block =
      Number(piece.blockGrant) || Number(ctx.itemsById.get(piece.itemId)?.block) || 10;
    gainStacks(ctx.player, 'block', block);
    giveRandomBuffs(ctx.player, 1, ctx.rng, {
      ...origin(piece),
      availableBuffs: BUFF_KEYS.filter((k) => k !== 'mana'),
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'sapphire_whelp');
  },
};

/** WalrusTusk.gd — spikes then consume. */
const walrusTuskPort = {
  handlerId: 'walrus_tusk',
  family: 'start_buff',
  onCombatStart(piece, ctx) {
    grantStacks(ctx.player, 'spikes', Math.max(1, Math.round(getP1(piece.params, 1))), origin(piece));
    consumeStart(piece, ctx, 'walrus_tusk');
  },
};

export const AP_START_PORTS = {
  blood_amulet: bloodAmuletPort,
  cursed_hair_comb: cursedHairCombPort,
  burning_torch: burningTorchPort,
  flame_badge: flameBadgePort,
  ruby_whelp: rubyWhelpPort,
  dark_lantern: darkLanternPort,
  just_stats: justStatsPort,
  more_stats: moreStatsPort,
  piggy_of_riches: piggyOfRichesPort,
  puzzlebag_l: puzzlebagLPort,
  emerald_whelp: emeraldWhelpPort,
  lucky_clover: luckyCloverPort,
  sapphire_whelp: sapphireWhelpPort,
  walrus_tusk: walrusTuskPort,
};

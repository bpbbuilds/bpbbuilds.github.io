/**
 * Band AO — leftover skills (coverage hole + girl_power).
 */

import { healActor } from '../actor.js';
import {
  giveRandomBuffs,
  grantStacks,
  onBuffChanged,
  spendStacks,
  useMana,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getPName } from '../params.js';
import { addAccuracy, addBonusDamageFactor, addSpeed, multiplyStaminaCost } from '../piece-stats.js';
import { gainStacks, getStackAmount } from '../stacks.js';
import { itemHasType, pushActivate } from './ports-util.js';
import { canBeEmpoweredPiece } from './food-helpers.js';
import { rollPercent } from '../rng.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

function linked(ctx, piece) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  return (ctx.pieces || []).filter((o) => links.some((l) => l.key === o.placementKey));
}

function chanceOf(piece, ctx, fb = 20) {
  const item = ctx.itemsById.get(piece.itemId);
  const n = Number(item?.chance ?? piece.chance);
  return Number.isFinite(n) && n > 0 ? n : fb;
}

/** Bagtacular.gd — presence-only; bags already sniff this id. */
const bagtacularPort = {
  handlerId: 'bagtacular',
  family: 'unique',
  onCombatStart(piece, ctx) {
    pushActivate(piece, ctx, 'bagtacular', `Skill: ${piece.name}`);
  },
};

const acornAcePort = {
  handlerId: 'acorn_ace',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const fac = -getPName(piece.params, 'stamina2', 15) / 100;
    for (const o of ctx.pieces || []) {
      if (o.itemId !== 'critwood_staff') continue;
      multiplyStaminaCost(o, fac);
    }
  },
};

const arcaneIntellectPort = {
  handlerId: 'arcane_intellect',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const spd = getPName(piece.params, 'speed', 12) / 100;
    for (const o of linked(ctx, piece)) {
      if (!itemHasType(ctx.itemsById.get(o.itemId), 'magic')) continue;
      if (o.cooldown > 0 && o.cooldown < 500) addSpeed(o, spd);
    }
  },
};

const buyTheHolyLightPort = {
  handlerId: 'buy_the_holy_light',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const spd = getPName(piece.params, 'speed', 12) / 100;
    for (const o of linked(ctx, piece)) {
      const item = ctx.itemsById.get(o.itemId);
      if (!(itemHasType(item, 'holy') || o.itemId === 'oil_lamp' || o.itemId === 'djinn_lamp')) continue;
      if (o.cooldown > 0 && o.cooldown < 500) addSpeed(o, spd);
    }
  },
};

const chessMasterPort = {
  handlerId: 'chess_master',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const spd = getPName(piece.params, 'speed', 20) / 100;
    const board = (ctx.pieces || []).find((p) => p.itemId === 'chess_board');
    if (board) addSpeed(board, spd);
  },
};

const criticalPoisonPort = {
  handlerId: 'critical_poison',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._cpAcc = 0;
    const th = Math.max(1, Math.round(getPName(piece.params, 'damt', 12)));
    const poi = Math.max(1, Math.round(getPName(piece.params, 'poison', 1)));
    ctx.bus?.on?.('piece_dealt_damage', (payload) => {
      if (!payload?.hit?.hit) return;
      if (!linked(ctx, piece).some((o) => o === payload.piece)) return;
      piece._cpAcc += payload.hit.healthDamage || 0;
      const n = Math.floor(piece._cpAcc / th);
      if (n <= 0) return;
      piece._cpAcc %= th;
      grantStacks(ctx.dummy, 'poison', n * poi, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    });
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'lucky' || !ch.amount) return;
      ctx.dummy.stackResist = ctx.dummy.stackResist || {};
      ctx.dummy.critChance = (Number(ctx.dummy.critChance) || 0) + ch.amount * chanceOf(piece, ctx);
    });
  },
};

const dualWieldingPort = {
  handlerId: 'dual_wielding',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const weapons = (ctx.pieces || []).filter(
      (o) =>
        (o.kind === 'weapon' || (Number(o.damageMax) || 0) > 0) && (Number(o.staminaCost) || 0) > 0,
    );
    if (weapons.length !== 2) return;
    const spd = getPName(piece.params, 'speed', 15) / 100;
    const stam = getPName(piece.params, 'stamina', 20) / 100;
    for (const o of weapons) {
      addSpeed(o, spd);
      multiplyStaminaCost(o, -stam);
    }
  },
};

const extraBagsPort = {
  handlerId: 'extra_bags',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const empty = Math.max(0, linked(ctx, piece).length ? 0 : 1);
    const spd = getPName(piece.params, 'speed', 8) / 100 * Math.max(1, empty);
    for (const o of linked(ctx, piece)) {
      if (o.cooldown > 0 && o.cooldown < 500) addSpeed(o, spd);
    }
  },
};

const heartOfTheCardsPort = {
  handlerId: 'heart_of_the_cards',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const regen = Math.max(1, Math.round(getPName(piece.params, 'regen', 1)));
    const mana = Math.max(1, Math.round(getPName(piece.params, 'mana', 1)));
    const need = Math.max(1, Math.round(getPName(piece.params, 'pos', 3)));
    ctx.bus?.on?.('piece_dealt_damage', () => {});
    for (const o of ctx.pieces || []) {
      const script = o;
      void script;
    }
    const orig = piece;
    ctx.pieces
      ?.filter((o) => itemHasType(ctx.itemsById.get(o.itemId), 'card'))
      .forEach((card) => {
        const prev = card.onCooldownEffect;
        void prev;
      });
    onBuffChanged(ctx.player, () => {});
    orig._hotc = { regen, mana, need };
  },
  onPeerActivated(listener, activated, ctx) {
    if (!itemHasType(ctx.itemsById.get(activated.itemId), 'card')) return;
    const regen = Math.max(1, Math.round(getPName(listener.params, 'regen', 1)));
    grantStacks(ctx.player, 'regeneration', regen, {
      originKey: listener.placementKey,
      originId: listener.itemId,
    });
    const pos = Number(activated._chainPos) || 0;
    const need = Math.max(1, Math.round(getPName(listener.params, 'pos', 3)));
    if (pos + 1 >= need) {
      grantStacks(ctx.player, 'mana', Math.max(1, Math.round(getPName(listener.params, 'mana', 1))), {
        originKey: listener.placementKey,
        originId: listener.itemId,
      });
    }
    pushActivate(listener, ctx, 'heart_of_the_cards', `Skill: ${listener.name}`);
  },
};

const investmentOpportunityPort = {
  handlerId: 'investment_opportunity',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const keys = new Set(linked(ctx, piece).map((o) => o.placementKey));
    onBuffChanged(ctx.player, (ch) => {
      if (!(ch.amount < 0) || !ch.originKey || !keys.has(ch.originKey)) return;
      const hp = Math.max(1, Math.round(Math.abs(ch.amount) * getPName(piece.params, 'maxhealth', 2)));
      ctx.player.maxHp += hp;
      ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + hp);
    });
  },
};

const kingOfTheBlingPort = {
  handlerId: 'king_of_the_bling',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const ch = chanceOf(piece, ctx);
    for (const o of linked(ctx, piece)) {
      if (o.itemId !== 'magic_ring' && o.itemId !== 'superior_ring') continue;
      o.buffAmpChance = (Number(o.buffAmpChance) || 0) + ch;
    }
  },
};

const markswomanPort = {
  handlerId: 'markswoman',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const dam = getPName(piece.params, 'dam', 10) / 100;
    const spd = getPName(piece.params, 'speed', 10) / 100;
    const acc = getPName(piece.params, 'acc', 5);
    for (const o of linked(ctx, piece)) {
      const item = ctx.itemsById.get(o.itemId);
      if (!itemHasType(item, 'ranged') && o.kind !== 'weapon') continue;
      addSpeed(o, spd);
      if (canBeEmpoweredPiece(o)) {
        if (dam) addBonusDamageFactor(o, dam);
        if (acc) addAccuracy(o, acc);
      }
    }
  },
};

const piggyPinataPort = {
  handlerId: 'piggy_pinata',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const ch = chanceOf(piece, ctx);
    for (const o of linked(ctx, piece)) {
      if ((Number(o.damageMax) || 0) <= 0 && o.kind !== 'weapon') continue;
      o.critChance = (Number(o.critChance) || 0) + ch;
    }
  },
};

const spicyBananaPort = {
  handlerId: 'spicy_banana',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._stamAcc = 0;
    const heat = Math.max(1, Math.round(getPName(piece.params, 'heat', 1)));
    const need = Math.max(1, getPName(piece.params, 'stamina', 8));
    const heal = Math.max(1, Math.round(getPName(piece.params, 'heal', 4)));
    onBuffChanged(ctx.player, () => {});
    ctx.bus?.on?.('player_damaged', () => {});
    for (const o of linked(ctx, piece)) {
      if (o.itemId !== 'banana' && o.itemId !== 'mananana') continue;
    }
    piece._spicy = { heat, need, heal };
  },
  onPeerActivated(listener, activated, ctx) {
    if (activated.itemId !== 'banana' && activated.itemId !== 'mananana') return;
    if (!rollPercent(chanceOf(listener, ctx), ctx.rng)) return;
    grantStacks(ctx.player, 'heat', Math.max(1, Math.round(getPName(listener.params, 'heat', 1))), {
      originKey: listener.placementKey,
      originId: listener.itemId,
    });
    pushActivate(listener, ctx, 'spicy_banana', `Skill: ${listener.name}`);
  },
};

const stonedPort = {
  handlerId: 'stoned',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const fac = getPName(piece.params, 'blockfordam', 20) / 100;
    const dr = getPName(piece.params, 'damreduction', 15);
    ctx.bus?.on?.('piece_dealt_damage', (payload) => {
      if (!payload?.hit?.hit) return;
      const src = payload.piece;
      const item = ctx.itemsById.get(src.itemId);
      if (!itemHasType(item, 'stone') && src.itemId !== 'stone_golem') return;
      gainStacks(ctx.player, 'block', Math.max(1, Math.ceil((payload.hit.healthDamage || 0) * fac)));
    });
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'block') return;
      const has = getStackAmount(ctx.player, 'block') > 0;
      if (has && !piece._stoneDr) {
        piece._stoneDr = true;
        ctx.player.damageResistancePct = (Number(ctx.player.damageResistancePct) || 0) + dr;
      } else if (!has && piece._stoneDr) {
        piece._stoneDr = false;
        ctx.player.damageResistancePct = (Number(ctx.player.damageResistancePct) || 0) - dr;
      }
    });
  },
};

const uniquelyUniquePort = {
  handlerId: 'uniquely_unique',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const base = getPName(piece.params, 'speed', 10) / 100;
    const bonus = getPName(piece.params, 'speed2', 5) / 100;
    const n2 = linked(ctx, piece).filter((o) => {
      const r = String(ctx.itemsById.get(o.itemId)?.rarity || '').toLowerCase();
      return r === 'unique' || o.itemId === 'platin_customer_card' || o.itemId === 'customer_card';
    }).length;
    const first = linked(ctx, piece).find((o) => o.cooldown > 0 && o.cooldown < 500);
    if (first) addSpeed(first, base + n2 * bonus);
  },
};

const girlPowerPort = {
  handlerId: 'girl_power',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const n = linked(ctx, piece).length;
    addSpeed(piece, (getPName(piece.params, 'speed', 8) / 100) * Math.max(1, n));
  },
  onCooldownEffect(piece, ctx) {
    const emp = getStackAmount(ctx.player, 'empower');
    const regen = getStackAmount(ctx.player, 'regeneration');
    const a = Math.max(1, Math.round(getPName(piece.params, 'empower', 1)));
    const b = Math.max(1, Math.round(getPName(piece.params, 'regen', 1)));
    if (regen < emp) grantStacks(ctx.player, 'regeneration', b, {});
    else if (regen > emp) grantStacks(ctx.player, 'empower', a, {});
    else if (ctx.rng() < 0.5) grantStacks(ctx.player, 'regeneration', b, {});
    else grantStacks(ctx.player, 'empower', a, {});
    pushActivate(piece, ctx, 'girl_power', `Skill: ${piece.name}`);
    return true;
  },
};

const iceFlowerPort = {
  handlerId: 'ice_flower',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const need = Math.max(1, Math.round(getPName(piece.params, 'manat', 3)));
    const cold = Math.max(1, Math.round(getPName(piece.params, 'cold', 1)));
    ctx.bus?.on?.('piece_dealt_damage', (payload) => {
      if (!payload?.hit?.hit) return;
      if (!linked(ctx, piece).some((o) => o === payload.piece && o.kind === 'weapon')) return;
      if (getStackAmount(ctx.player, 'mana') < need) return;
      if (!rollPercent(chanceOf(piece, ctx), ctx.rng)) return;
      useMana(ctx.player, need, { originKey: piece.placementKey, originId: piece.itemId });
      grantStacks(ctx.dummy, 'cold', cold, { originKey: piece.placementKey, originId: piece.itemId });
    });
  },
  onPeerActivated(listener, activated, ctx) {
    const item = ctx.itemsById.get(activated.itemId);
    if (!itemHasType(item, 'shield') && !itemHasType(item, 'armor')) return;
    if (!rollPercent(chanceOf(listener, ctx, 15), ctx.rng)) return;
    grantStacks(ctx.player, 'mana', Math.max(1, Math.round(getPName(listener.params, 'mana', 1))), {});
    gainStacks(ctx.player, 'block', Math.max(1, Math.round(activated.blockGrant || 2)));
  },
};

const solarisPort = {
  handlerId: 'solaris',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const heat = Math.max(1, Math.round(getPName(piece.params, 'heat', 1)));
    ctx.bus?.on?.('afterBlock', (payload) => {
      if (payload?.piece?.itemId !== 'sun_shield') return;
      if (!rollPercent(chanceOf(piece, ctx), ctx.rng)) return;
      grantStacks(ctx.player, 'heat', heat, {});
      pushActivate(piece, ctx, 'solaris', `Skill: ${piece.name}`);
    });
  },
};

const shieldedSkillPort = {
  handlerId: 'shielded',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const ch = getPName(piece.params, 'chance', 10);
    const spd = getPName(piece.params, 'speed', 10) / 100;
    for (const o of linked(ctx, piece)) {
      const item = ctx.itemsById.get(o.itemId);
      if (itemHasType(item, 'shield')) o.chance = (Number(o.chance) || 0) + ch;
      else if (itemHasType(item, 'armor') && o.cooldown > 0) addSpeed(o, spd);
    }
  },
};

const smellyBarrierPort = {
  handlerId: 'smelly_barrier',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._blk = 0;
    const bonus = Math.max(1, Math.round(getPName(piece.params, 'blockbonus', 2)));
    const need = Math.max(1, Math.round(getPName(piece.params, 'blockt', 8)));
    const poi = Math.max(1, Math.round(getPName(piece.params, 'poison', 1)));
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'block' || !(ch.amount > 0)) return;
      piece._blk += ch.amount;
      const n = Math.floor(piece._blk / need);
      if (n <= 0) return;
      piece._blk %= need;
      grantStacks(ctx.dummy, 'poison', n * poi, {});
    });
    for (const o of linked(ctx, piece)) {
      if (o.itemId === 'garlic') o.blockGrant = (Number(o.blockGrant) || 0) + bonus;
    }
  },
};

void giveRandomBuffs;
void healActor;
void spendStacks;

/** @type {Record<string, ScriptHandler>} */
export const AO_SKILL_PORTS = {
  bagtacular: bagtacularPort,
  acorn_ace: acornAcePort,
  arcane_intellect: arcaneIntellectPort,
  buy_the_holy_light: buyTheHolyLightPort,
  chess_master: chessMasterPort,
  critical_poison: criticalPoisonPort,
  dual_wielding: dualWieldingPort,
  extra_bags: extraBagsPort,
  heart_of_the_cards: heartOfTheCardsPort,
  investment_opportunity: investmentOpportunityPort,
  king_of_the_bling: kingOfTheBlingPort,
  markswoman: markswomanPort,
  piggy_pinata: piggyPinataPort,
  spicy_banana: spicyBananaPort,
  stoned: stonedPort,
  uniquely_unique: uniquelyUniquePort,
  girl_power: girlPowerPort,
  ice_flower: iceFlowerPort,
  solaris: solarisPort,
  shielded: shieldedSkillPort,
  smelly_barrier: smellyBarrierPort,
};

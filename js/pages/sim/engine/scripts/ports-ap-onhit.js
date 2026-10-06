/**
 * Band AP 249 — leftover `weapon_onhit_*` / `double_strike` MAP items → `.gd` ports.
 */

import {
  DEBUFF_KEYS,
  grantStacks,
  onBuffChanged,
  spendStacks,
  useMana,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { healActor } from '../actor.js';
import { getP1, getP2, getP3, getP4, getP5, getPName } from '../params.js';
import { addBonusDamage } from '../piece-stats.js';
import { getStackAmount } from '../stacks.js';
import { itemHasType, pushActivate } from './ports-util.js';
import { canBeEmpoweredPiece } from './food-helpers.js';
import { dealHit } from './handlers.js';
import { prepareBow } from '../attack-effects.js';
import {
  countEmptyAffectCells,
  removeBlock,
  rollItemChance,
  weaponStrike,
} from './ports-wave-c-util.js';
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

function debuffCount(actor) {
  let n = 0;
  for (const k of DEBUFF_KEYS) n += getStackAmount(actor, /** @type {any} */ (k));
  return n;
}

/** BloodyDagger.gd — vamp stacks to cap; heal × vampiric stars. */
const bloodyDaggerPort = {
  handlerId: 'bloody_dagger',
  family: 'weapon_base',
  onPrepare(piece) {
    // BloodyDagger.gd resets this in onPrepare, before any combat-start
    // effects can trigger its first attack.
    piece._vampGiven = 0;
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'bloody_dagger');
  },
  onPreDealDamageEarly(piece, ctx, res) {
    if (res && !res.hit) return;
    const per = Math.max(1, Math.round(getPName(piece.params, 'vampirism', getP1(piece.params, 1))));
    const cap = Math.max(1, Math.round(getPName(piece.params, 'max', getP2(piece.params, 5))));
    if ((Number(piece._vampGiven) || 0) < cap) {
      grantStacks(ctx.player, 'vampirism', per, origin(piece));
      piece._vampGiven = (Number(piece._vampGiven) || 0) + per;
    }
    const n = linked(ctx, piece).filter((o) =>
      itemHasType(ctx.itemsById.get(o.itemId), 'vampiric'),
    ).length;
    if (n > 0) {
      healActor(
        ctx.player,
        n * Math.max(1, Math.round(getPName(piece.params, 'heal', getP3(piece.params, 4)))),
      );
    }
  },
};

/** BurningSword.gd — chance heat on hit; heat bank → perm on self + empowerable stars. */
const burningSwordPort = {
  handlerId: 'burning_sword',
  family: 'weapon_base',
  onPrepare(piece, ctx) {
    piece._heatBank = 0;
    const need = Math.max(1, Math.round(getPName(piece.params, 'heatt', getP2(piece.params, 7))));
    const bonus = Math.max(1, Math.round(getPName(piece.params, 'bonusdam', getP3(piece.params, 1))));
    // BurningSword.gd caches getAffectedItems() in onPrepare.  Keep the
    // empowered target set stable for the whole combat.
    piece._burningSwordTargets = linked(ctx, piece).filter((o) => canBeEmpoweredPiece(o));
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'heat' || !(ch.amount > 0)) return;
      piece._heatBank = (Number(piece._heatBank) || 0) + ch.amount;
      const procs = Math.floor((Number(piece._heatBank) || 0) / need);
      if (procs <= 0) return;
      piece._heatBank %= need;
      const amt = bonus * procs;
      // Attribute heat→damage to this sword, not the Heat grantor (Mana Orb).
      const src = {
        originKey: piece.placementKey,
        originId: piece.itemId,
        originName: piece.name,
        via: 'heat',
      };
      addBonusDamage(piece, amt, src);
      for (const o of piece._burningSwordTargets || []) addBonusDamage(o, amt, src);
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'burning_sword');
  },
  onPreDealDamageEarly(piece, ctx, res) {
    if (res && !res.hit) return;
    if (!rollItemChance(piece, ctx.rng)) return;
    grantStacks(
      ctx.player,
      'heat',
      Math.max(1, Math.round(getPName(piece.params, 'heat', getP1(piece.params, 1)))),
      origin(piece),
    );
  },
};

/** FlameWhip.gd — spend spikes: current-hit bonus + heat (not perm). */
const flameWhipPort = {
  handlerId: 'flame_whip',
  family: 'weapon_base',
  onCooldownEffect(piece, ctx) {
    const extra = Math.max(0, Number(getPName(piece.params, 'bonusdam', getP3(piece.params, 8))) || 0);
    const need = Math.max(1, Math.round(getPName(piece.params, 'spikes', getP1(piece.params, 1))));
    const heat = Math.max(1, Math.round(getPName(piece.params, 'heat', getP2(piece.params, 4))));
    return weaponStrike(piece, ctx, 'flame_whip', {
      // FlameWhip.gd mutates DamageResult after the hit roll. This must not
      // spend Spikes on an accuracy miss or alter the pre-roll amount.
      onPreDealDamageEarly(res) {
        if (!res?.hit || (getStackAmount(ctx.player, 'spikes') || 0) < need) return;
        spendStacks(ctx.player, 'spikes', need, origin(piece));
        res.damage = (Number(res.damage) || 0) + extra;
        grantStacks(ctx.player, 'heat', heat, origin(piece));
      },
    });
  },
};

/** Darksaber.gd — varying dmg per foe debuff; mana spend → blind (even on miss). */
const darksaberPort = {
  handlerId: 'darksaber',
  family: 'weapon_base',
  onPrepare(piece, ctx) {
    piece._dsDebuffs = debuffCount(ctx.dummy);
    const per = getPName(piece.params, 'damperdebuff', getP1(piece.params, 0.5));
    const apply = () => {
      const n = debuffCount(ctx.dummy);
      addBonusDamage(piece, per * (n - (Number(piece._dsDebuffs) || 0)), {
        removable: false,
      });
      piece._dsDebuffs = n;
    };
    onBuffChanged(ctx.dummy, (ch) => {
      if (DEBUFF_KEYS.includes(/** @type {any} */ (ch.stack))) apply();
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'darksaber');
  },
  onPreDealDamageEarly(piece, ctx) {
    const need = Math.max(1, Math.round(getPName(piece.params, 'mana', getP2(piece.params, 1))));
    if (!(useMana(ctx.player, need, origin(piece)).spent > 0)) return;
    grantStacks(
      ctx.dummy,
      'blind',
      Math.max(1, Math.round(getPName(piece.params, 'blind', getP3(piece.params, 1)))),
      origin(piece),
    );
  },
};

/** MoltenSpear2.gd — miss→hit if heat; blinds; fire-star block strip. */
const moltenSpear2Port = {
  handlerId: 'molten_spear2',
  family: 'weapon_base',
  onPrepare(piece, ctx) {
    const per = Math.max(0, Math.round(getPName(piece.params, 'blockremoval', getP5(piece.params, 5))));
    const fires = linked(ctx, piece).filter((o) =>
      itemHasType(ctx.itemsById.get(o.itemId), 'fire'),
    ).length;
    piece._blockStrip = per * (fires + countEmptyAffectCells(ctx, piece));
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'molten_spear2');
  },
  onPreDealDamageEarly(piece, ctx, res) {
    if (!res) return;
    if (!res.hit) {
      const need = Math.max(1, Math.round(getPName(piece.params, 'heatt', getP1(piece.params, 2))));
      if ((getStackAmount(ctx.player, 'heat') || 0) < need) return;
      const dam = Math.max(1, Math.round(getPName(piece.params, 'missdam', getP2(piece.params, 3))));
      res.damage = (Number(res.damage) || 0) + dam;
      addBonusDamage(piece, dam);
      spendStacks(ctx.player, 'heat', need, origin(piece));
      res.hit = true;
    }
    if (!res.hit) return;
    grantStacks(
      ctx.dummy,
      'blind',
      Math.max(1, Math.round(getPName(piece.params, 'blind', getP3(piece.params, 1)))),
      origin(piece),
    );
    grantStacks(
      ctx.player,
      'blind',
      Math.max(1, Math.round(getPName(piece.params, 'blind_self', getP4(piece.params, 1)))),
      origin(piece),
    );
  },
  onPreDealDamageLate(piece, ctx) {
    const strip = Number(piece._blockStrip) || 0;
    if (strip) removeBlock(ctx.dummy, strip, ctx, piece);
  },
};

/** Shovel.gd — shop dig is shop-only; combat: chance +1 blind on hit. */
const shovelPort = {
  handlerId: 'shovel',
  family: 'weapon_base',
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'shovel');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit || !rollItemChance(piece, ctx.rng)) return;
    grantStacks(ctx.dummy, 'blind', 1, origin(piece));
  },
};

/** LuckyBow.gd — start luck; extra strike same CD if the first hit crits. */
const luckyBowPort = {
  handlerId: 'lucky_bow',
  family: 'weapon_base',
  onPrepare(piece, ctx) {
    piece._luckyExtra = false;
    prepareBow(piece, ctx, (payload) => {
      if (payload?.hit?.critical) piece._luckyExtra = true;
    });
  },
  onCombatStart(piece, ctx) {
    grantStacks(
      ctx.player,
      'lucky',
      Math.max(1, Math.round(getPName(piece.params, 'luck', getP1(piece.params, 5)))),
      origin(piece),
    );
    pushActivate(piece, ctx, 'lucky_bow', `Weapon: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    if (!weaponStrike(piece, ctx, 'lucky_bow')) return false;
    if (piece._luckyExtra) {
      piece._luckyExtra = false;
      weaponStrike(piece, ctx, 'lucky_bow', { skipStamina: true, label: `Weapon: ${piece.name} (extra)` });
    }
    return true;
  },
};

/** PoisonDagger.gd — poison on hit (no chance roll). */
const poisonDaggerPort = {
  handlerId: 'poison_dagger',
  family: 'weapon_base',
  onPrepare(piece, ctx) {
    // PoisonDagger.gd inherits Dagger.prepare(): an opponent stun produces
    // one free Weapon.attack(triggerEvent), with no second stamina spend.
    ctx.bus?.on?.('actor_stunned', (payload) => {
      if (!piece.alive || payload?.actor !== ctx.dummy) return;
      dealHit(piece, ctx, () => randInt(piece.damageMin, piece.damageMax, ctx.rng));
      // Weapon.attack activates after dealDamage, preserving the source
      // damage -> activation event order for the free Dagger strike.
      pushActivate(piece, ctx, 'poison_dagger', `Weapon: ${piece.name}`);
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'poison_dagger');
  },
  onPreDealDamageEarly(piece, ctx, res) {
    if (res && !res.hit) return;
    grantStacks(ctx.dummy, 'poison', Math.max(1, Math.round(getP1(piece.params, 2))), origin(piece));
  },
};

/** PoisonShortbow.gd — chance: poison + a random other debuff (or +1 extra poison). */
const poisonShortbowPort = {
  handlerId: 'poison_shortbow',
  family: 'weapon_base',
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'poison_shortbow');
  },
  onPreDealDamageEarly(piece, ctx, res) {
    if (res && !res.hit) return;
    if (!rollItemChance(piece, ctx.rng)) return;
    const poison = Math.max(1, Math.round(getPName(piece.params, 'poison', getP1(piece.params, 2))));
    const pick = DEBUFF_KEYS[Math.floor(ctx.rng() * DEBUFF_KEYS.length)] || 'poison';
    if (pick === 'poison') {
      grantStacks(ctx.dummy, 'poison', poison + 1, origin(piece));
    } else {
      grantStacks(ctx.dummy, 'poison', poison, origin(piece));
      grantStacks(ctx.dummy, pick, 1, origin(piece));
    }
  },
};

/** SerpentStaff.gd — poison resist down; mana → perm dam; hit damage bank → poison. */
const serpentStaffPort = {
  handlerId: 'serpent_staff',
  family: 'weapon_base',
  onPrepare(piece, ctx) {
    piece._serpAcc = 0;
    piece._serpMana = false;
    const chance = Number(piece.chance) || Number(ctx.itemsById.get(piece.itemId)?.chance) || 40;
    ctx.dummy.stackResist = ctx.dummy.stackResist || {};
    ctx.dummy.stackResist.poison = (Number(ctx.dummy.stackResist.poison) || 0) - chance;
  },
  onCooldownEffect(piece, ctx) {
    piece._serpMana = false;
    return weaponStrike(piece, ctx, 'serpent_staff');
  },
  onPreDealDamageEarly(piece, ctx) {
    const need = Math.max(1, Math.round(getPName(piece.params, 'mana', getP1(piece.params, 4))));
    if (!(useMana(ctx.player, need, origin(piece)).spent > 0)) return;
    piece._serpMana = true;
    addBonusDamage(piece, Math.max(1, Math.round(getPName(piece.params, 'dam', getP2(piece.params, 2)))));
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit || !piece._serpMana) return;
    piece._serpAcc = (Number(piece._serpAcc) || 0) + (Number(hit.damage) || Number(hit.healthDamage) || 0);
    const per = Math.max(1, Math.round(getPName(piece.params, 'damforpoison', getP4(piece.params, 4))));
    const stacks = Math.floor((Number(piece._serpAcc) || 0) / per);
    if (stacks <= 0) return;
    piece._serpAcc %= per;
    grantStacks(ctx.dummy, 'poison', stacks, origin(piece));
  },
};

export const AP_ONHIT_PORTS = {
  bloody_dagger: bloodyDaggerPort,
  burning_sword: burningSwordPort,
  flame_whip: flameWhipPort,
  darksaber: darksaberPort,
  molten_spear2: moltenSpear2Port,
  shovel: shovelPort,
  lucky_bow: luckyBowPort,
  poison_dagger: poisonDaggerPort,
  poison_shortbow: poisonShortbowPort,
  serpent_staff: serpentStaffPort,
};

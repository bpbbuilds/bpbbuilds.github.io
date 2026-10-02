/**
 * Band AM — leftover pets (puppies, frog prince, eggs, misc).
 */

import {
  advanceBuffThresholds,
  cleanseRandomDebuffs,
  grantStacks,
  onBuffChanged,
  spendStacks,
  useMana,
  useRegeneration,
} from '../buff-economy.js';
import { grantInvuln, healActor } from '../actor.js';
import { affectedTargets } from '../board-graph.js';
import { getP, getP1, getP2, getP3, getP4, getP5, getPName } from '../params.js';
import { addBonusDamage, addSpeed } from '../piece-stats.js';
import { getStackAmount } from '../stacks.js';
import { dealEffectDamage, dealHit } from './handlers.js';
import { itemHasType, pushActivate } from './ports-util.js';
import { rollItemChance } from './ports-wave-c-util.js';
import { randInt, rollPercent } from '../rng.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

function linked(ctx, piece) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  return (ctx.pieces || []).filter((o) =>
    links.some((l) => l.key === o.placementKey),
  );
}

function countType(ctx, piece, type) {
  return linked(ctx, piece).filter((o) =>
    itemHasType(ctx.itemsById.get(o.itemId), type),
  ).length;
}

function petActivate(piece, ctx, handler) {
  pushActivate(piece, ctx, handler, `Pet: ${piece.name}`);
}

function pickCycle(piece) {
  if (!Array.isArray(piece._ppOpts) || !piece._ppOpts.length) piece._ppOpts = [0, 1, 2];
  const i = Math.floor((piece._ppRng || Math.random)() * piece._ppOpts.length);
  const pick = piece._ppOpts[Math.max(0, Math.min(i, piece._ppOpts.length - 1))];
  piece._ppOpts = [0, 1, 2].filter((x) => x !== pick);
  return pick;
}

/** PowerPuppy.gd — cycle lucky/regen/empower; speed × pets. */
/** @type {ScriptHandler} */
export const powerPuppyPort = {
  handlerId: 'power_puppy',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    piece._ppOpts = [0, 1, 2];
    piece._ppRng = ctx.rng;
    const n = countType(ctx, piece, 'pet');
    const sp = getPName(piece.params, 'p4', getP4(piece.params, 5)) / 100;
    if (n && sp) addSpeed(piece, n * sp);
  },
  onCooldownEffect(piece, ctx) {
    petActivate(piece, ctx, 'power_puppy');
    const pick = pickCycle(piece);
    const key = pick === 0 ? 'lucky' : pick === 1 ? 'regeneration' : 'empower';
    const amt = Math.max(
      1,
      Math.round(pick === 0 ? getP1(piece.params, 1) : pick === 1 ? getP2(piece.params, 1) : getP3(piece.params, 1)),
    );
    grantStacks(ctx.player, key, amt, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    return true;
  },
};

/** ArmoredPowerPuppy.gd — speed from pets + food. */
/** @type {ScriptHandler} */
export const armoredPowerPuppyPort = {
  handlerId: 'armored_power_puppy',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    piece._ppOpts = [0, 1, 2];
    piece._ppRng = ctx.rng;
    const pets = countType(ctx, piece, 'pet');
    const food = countType(ctx, piece, 'food');
    const petSp = getP4(piece.params, 5) / 100;
    const foodSp = getP5(piece.params, 5) / 100;
    addSpeed(piece, pets * petSp + food * foodSp);
  },
  onCooldownEffect(piece, ctx) {
    return powerPuppyPort.onCooldownEffect(piece, ctx);
  },
};

/** CouragePuppy.gd — bonus dmg × pets; no-stamina hit. */
/** @type {ScriptHandler} */
export const couragePuppyPort = {
  handlerId: 'courage_puppy',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    const pets = countType(ctx, piece, 'pet');
    const per = Math.max(0, Math.round(getP1(piece.params, 2)));
    if (pets && per) addBonusDamage(piece, per * pets);
  },
  onCooldownEffect(piece, ctx) {
    petActivate(piece, ctx, 'courage_puppy');
    const raw = randInt(
      Math.max(1, piece.damageMin || 4),
      Math.max(2, piece.damageMax || 8),
      ctx.rng,
    );
    dealHit(piece, ctx, raw);
    return true;
  },
};

/** FrogPrince.gd — Toad thresholds + first-use invuln. */
/** @type {ScriptHandler} */
export const frogPrincePort = {
  handlerId: 'frog_prince',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    const affected = new Set(links.map((l) => l.key));
    piece._frogState = 'Inactive';
    piece._toadState = { gained: 0, used: 0, affected };
    const gainedTh = Math.max(1, Math.round(getPName(piece.params, 'gained', getP1(piece.params, 10))));
    const usedTh = Math.max(1, Math.round(getPName(piece.params, 'used', getP3(piece.params, 10))));
    const healPer = Math.max(0, Math.round(getPName(piece.params, 'heal', getP2(piece.params, 12))));
    const blindN = Math.max(1, Math.round(getPName(piece.params, 'blind', 2)));
    onBuffChanged(ctx.player, (ch) => {
      if (!ch.originKey || !affected.has(ch.originKey)) return;
      const ticks = advanceBuffThresholds(piece._toadState, ch.amount, gainedTh, usedTh);
      if (ticks.gainTicks > 0) {
        spendStacks(ctx.player, 'blind', blindN * ticks.gainTicks, {});
        if (healPer) healActor(ctx.player, ticks.gainTicks * healPer);
      }
      if (ticks.useTicks > 0 && piece._frogState === 'Inactive') {
        piece._frogState = 'Active';
        const luck = Math.max(1, Math.round(getPName(piece.params, 'luck', 1)));
        const mana = Math.max(1, Math.round(getPName(piece.params, 'mana', 1)));
        grantStacks(ctx.player, 'lucky', luck, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
        grantStacks(ctx.player, 'mana', mana, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
        const dur = Math.max(0.5, getPName(piece.params, 'dur_1', 2));
        grantInvuln(ctx.player, dur, ctx.t);
      }
    });
  },
  onCooldownEffect(piece, ctx) {
    petActivate(piece, ctx, 'frog_prince');
    const luck2 = Math.max(0, Math.round(getPName(piece.params, 'luck2', 1)));
    const mana2 = Math.max(0, Math.round(getPName(piece.params, 'mana2', 1)));
    if (luck2) {
      grantStacks(ctx.player, 'lucky', luck2, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    if (mana2) {
      grantStacks(ctx.player, 'mana', mana2, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    return true;
  },
};

/** Cubert.gd — peer regen; regen bank → empower. Gap: secondary affect cells ≈ same links. */
/** @type {ScriptHandler} */
export const cubertPort = {
  handlerId: 'cubert',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    const keys = new Set(linked(ctx, piece).map((o) => o.placementKey));
    ctx.bus?.on?.('piece_activated', (payload) => {
      const src = payload?.piece;
      if (!src || !keys.has(src.placementKey)) return;
      if (rollItemChance(piece, ctx.rng)) {
        grantStacks(ctx.player, 'regeneration', Math.max(1, Math.round(getPName(piece.params, 'regen', 1))), {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      }
      const need = Math.max(1, Math.round(getPName(piece.params, 'regent', 5)));
      if ((getStackAmount(ctx.player, 'regeneration') || 0) >= need && rollPercent(Number(piece.chance2) || 50, ctx.rng)) {
        useRegeneration(ctx.player, need, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
        grantStacks(ctx.player, 'empower', Math.max(1, Math.round(getPName(piece.params, 'empower', 1))), {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      }
    });
  },
  onCooldownEffect(piece, ctx) {
    petActivate(piece, ctx, 'cubert');
    const regen = Math.max(1, Math.round(getPName(piece.params, 'regen', 1)));
    grantStacks(ctx.player, 'regeneration', regen, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const need = Math.max(1, Math.round(getPName(piece.params, 'regent', 5)));
    if ((getStackAmount(ctx.player, 'regeneration') || 0) >= need) {
      useRegeneration(ctx.player, need, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      grantStacks(ctx.player, 'empower', Math.max(1, Math.round(getPName(piece.params, 'empower', 1))), {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    return true;
  },
};

/** Snowmaster.gd */
/** @type {ScriptHandler} */
export const snowmasterPort = {
  handlerId: 'snowmaster',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    const n = countType(ctx, piece, 'ice');
    const sp = getPName(piece.params, 'speed', 8) / 100;
    if (n && sp) addSpeed(piece, n * sp);
  },
  onCooldownEffect(piece, ctx) {
    petActivate(piece, ctx, 'snowmaster');
    const need = Math.max(1, Math.round(getPName(piece.params, 'coldt', 4)));
    if ((getStackAmount(ctx.dummy, 'cold') || 0) >= need) {
      grantStacks(ctx.player, 'empower', Math.max(1, Math.round(getPName(piece.params, 'empower', 1))), {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    } else {
      grantStacks(ctx.dummy, 'cold', Math.max(1, Math.round(getPName(piece.params, 'cold', 1))), {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    cleanseRandomDebuffs(ctx.player, 1, ctx.rng, {});
    return true;
  },
};

/** Rat.gd — effect damage + chance poison/blind. */
/** @type {ScriptHandler} */
export const ratPort = {
  handlerId: 'rat',
  family: 'pet_like',
  onCooldownEffect(piece, ctx) {
    petActivate(piece, ctx, 'rat');
    const raw = Math.max(1, Number(piece.damageMin) || getP1(piece.params, 4));
    dealEffectDamage(piece, ctx, raw);
    if (rollItemChance(piece, ctx.rng)) {
      grantStacks(ctx.dummy, 'poison', Math.max(1, Math.round(getPName(piece.params, 'poison', 1))), {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    const c2 = Number(piece.chance2) || Number(ctx.itemsById.get(piece.itemId)?.chance2) || 0;
    if (c2 && rollPercent(c2, ctx.rng)) {
      grantStacks(ctx.dummy, 'blind', Math.max(1, Math.round(getPName(piece.params, 'blind', 1))), {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    return true;
  },
};

/** PoisonFrog.gd — toad-like thresholds + CD poison/mana. */
/** @type {ScriptHandler} */
export const poisonFrogPort = {
  handlerId: 'poison_frog',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    const affected = new Set(links.map((l) => l.key));
    piece._toadState = { gained: 0, used: 0, affected };
    const gainedTh = Math.max(1, Math.round(getPName(piece.params, 'gained', 8)));
    const usedTh = Math.max(1, Math.round(getPName(piece.params, 'used', 8)));
    const poison = Math.max(1, Math.round(getPName(piece.params, 'poison', 1)));
    const mana = Math.max(1, Math.round(getPName(piece.params, 'mana', 1)));
    onBuffChanged(ctx.player, (ch) => {
      if (!ch.originKey || !affected.has(ch.originKey)) return;
      const ticks = advanceBuffThresholds(piece._toadState, ch.amount, gainedTh, usedTh);
      if (ticks.gainTicks > 0) healActor(ctx.player, ticks.gainTicks * Math.max(1, getPName(piece.params, 'heal', 4)));
      if (ticks.useTicks > 0) {
        grantStacks(ctx.dummy, 'poison', ticks.useTicks * poison, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
        grantStacks(ctx.player, 'mana', ticks.useTicks * mana, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      }
    });
  },
  onCooldownEffect(piece, ctx) {
    petActivate(piece, ctx, 'poison_frog');
    grantStacks(ctx.dummy, 'poison', Math.max(1, Math.round(getPName(piece.params, 'poison2', 1))), {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    grantStacks(ctx.player, 'mana', Math.max(1, Math.round(getPName(piece.params, 'mana2', 1))), {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    return true;
  },
};

/** Snake.gd — start lucky/maxHP; CD poison. Gap: poison protection chance. */
/** @type {ScriptHandler} */
export const snakePort = {
  handlerId: 'snake',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    const n = countType(ctx, piece, 'pet');
    const luck = Math.max(0, Math.round(getPName(piece.params, 'luck', 1) * n));
    const hp = Math.max(0, Math.round(getPName(piece.params, 'maxhealth', 0) * n));
    if (luck) {
      grantStacks(ctx.player, 'lucky', luck, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    if (hp) ctx.player.maxHp += hp;
    petActivate(piece, ctx, 'snake');
  },
  onCooldownEffect(piece, ctx) {
    petActivate(piece, ctx, 'snake');
    grantStacks(ctx.dummy, 'poison', Math.max(1, Math.round(getPName(piece.params, 'poison', 1))), {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    return true;
  },
};

/** FireShelly.gd — heat then Shelly cleanse+heal. */
/** @type {ScriptHandler} */
export const fireShellyPort = {
  handlerId: 'fire_shelly',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    const n = countType(ctx, piece, 'potion');
    const sp = getPName(piece.params, 'speed', 8) / 100;
    if (n && sp) addSpeed(piece, n * sp);
  },
  onCooldownEffect(piece, ctx) {
    petActivate(piece, ctx, 'fire_shelly');
    grantStacks(ctx.player, 'heat', Math.max(1, Math.round(getPName(piece.params, 'heat', 1))), {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    cleanseRandomDebuffs(
      ctx.player,
      Math.max(1, Math.round(getPName(piece.params, 'debuffs', 1))),
      ctx.rng,
      {},
    );
    healActor(ctx.player, Math.max(1, Math.round(getPName(piece.params, 'heal', getP2(piece.params, 8)))));
    return true;
  },
};

/** FriendlyFire.gd — fire speed; heat thresholds; mana→heat CD. */
/** @type {ScriptHandler} */
export const friendlyFirePort = {
  handlerId: 'friendly_fire',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    const n = countType(ctx, piece, 'fire');
    const sp = getP3(piece.params, 8) / 100;
    if (n && sp) addSpeed(piece, n * sp);
    piece._ffMax = 0;
    const t1 = getP4(piece.params, 4);
    const t2 = getP(piece.params, 5, 8);
    const t3 = getP(piece.params, 7, 12);
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'heat') return;
      const heat = getStackAmount(ctx.player, 'heat') || 0;
      const prev = Number(piece._ffMax) || 0;
      if (heat >= t3 && prev < t3) {
        piece._ffMax = heat;
        const raw = Math.max(1, Number(piece.damageMin) || 6);
        dealEffectDamage(piece, ctx, raw);
      } else if (heat >= t2 && prev < t2) {
        piece._ffMax = heat;
        grantStacks(ctx.player, 'regeneration', Math.max(1, Math.round(getP(piece.params, 6, 1))), {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      } else if (heat >= t1 && prev < t1) {
        piece._ffMax = heat;
        grantStacks(ctx.player, 'lucky', Math.max(1, Math.round(getP5(piece.params, 1))), {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      }
    });
  },
  onCooldownEffect(piece, ctx) {
    petActivate(piece, ctx, 'friendly_fire');
    const need = Math.max(1, Math.round(getP1(piece.params, 2)));
    if ((getStackAmount(ctx.player, 'mana') || 0) >= need) {
      useMana(ctx.player, need, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      grantStacks(ctx.player, 'heat', Math.max(1, Math.round(getP2(piece.params, 1))), {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    return true;
  },
};

/** CatSpirit.gd — linked crit%; mana → lucky+empower. */
/** @type {ScriptHandler} */
export const catSpiritPort = {
  handlerId: 'cat_spirit',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    const crit = Number(ctx.itemsById.get(piece.itemId)?.chance) || Number(piece.chance) || 5;
    for (const o of linked(ctx, piece)) {
      if ((o.damageMax || 0) > 0 || o.kind === 'weapon') {
        o.critChance = (Number(o.critChance) || 0) + crit;
      }
    }
  },
  onCooldownEffect(piece, ctx) {
    petActivate(piece, ctx, 'cat_spirit');
    const need = Math.max(1, Math.round(getPName(piece.params, 'manat', 3)));
    if ((getStackAmount(ctx.player, 'mana') || 0) >= need) {
      useMana(ctx.player, need, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      grantStacks(ctx.player, 'lucky', Math.max(1, Math.round(getPName(piece.params, 'luck', 1))), {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      grantStacks(ctx.player, 'empower', Math.max(1, Math.round(getPName(piece.params, 'empower', 1))), {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    return true;
  },
};

export const AM_PET_PORTS = {
  power_puppy: powerPuppyPort,
  armored_power_puppy: armoredPowerPuppyPort,
  courage_puppy: couragePuppyPort,
  frog_prince: frogPrincePort,
  cubert: cubertPort,
  snowmaster: snowmasterPort,
  rat: ratPort,
  poison_frog: poisonFrogPort,
  snake: snakePort,
  fire_shelly: fireShellyPort,
  friendly_fire: friendlyFirePort,
  cat_spirit: catSpiritPort,
};

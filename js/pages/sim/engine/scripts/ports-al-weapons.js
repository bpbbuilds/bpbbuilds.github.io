/**
 * Band AL — leftover catalog weapons (melee/ranged strikers).
 */

import { grantStacks, grantTemporaryStacks, onBuffChanged, spendStacks, useMana, useRegeneration } from '../buff-economy.js';
import { giveBuffPower } from '../buff-power.js';
import { dealDamage } from '../damage.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { addBonusDamage, addBonusDamageFromBuffChange, addSpeed, setStaminaCost } from '../piece-stats.js';
import { getStackAmount, gainStacks } from '../stacks.js';
import { dealHit } from './handlers.js';
import { canBeEmpoweredPiece } from './food-helpers.js';
import { itemHasType } from './ports-util.js';
import { weaponStrike } from './ports-wave-c-util.js';
import { forAttackEffects, prepareBow } from '../attack-effects.js';
import { randInt } from '../rng.js';
import { rollItemChance } from '../chance.js';
import { pushActivationAudit } from '../report-weapon-audit.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

function linked(ctx, piece) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  return (ctx.pieces || []).filter((o) =>
    links.some((l) => l.key === o.placementKey),
  );
}

function chanceOf(piece, ctx, fallback = 5) {
  const item = ctx.itemsById.get(piece.itemId);
  return Number(item?.chance) || Number(piece.chance) || fallback;
}

/** Shortbow — inherit Bow/Weapon CD only. */
/** @type {ScriptHandler} */
export const shortbowPort = {
  handlerId: 'shortbow',
  family: 'weapon_base',
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'shortbow');
  },
};

/** Bow.gd — prepare and cache its first affected weapon. */
export const bowBasePort = {
  handlerId: 'bow',
  family: 'weapon_base',
  onPrepare(piece, ctx) {
    prepareBow(piece, ctx);
  },
};

/** Dagger.gd — extra attack on opponent stun (no second stamina). */
/** @type {ScriptHandler} */
export const daggerPort = {
  handlerId: 'dagger',
  family: 'weapon_base',
  onCombatStart(piece, ctx) {
    ctx.bus?.on?.('actor_stunned', (payload) => {
      if (!piece.alive || payload?.actor !== ctx.dummy) return;
      const raw = randInt(piece.damageMin, piece.damageMax, ctx.rng);
      dealHit(piece, ctx, raw);
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'dagger');
  },
};

/** BowandArrow.gd — grow bonus on linked weapon hit, cap p2. */
/** @type {ScriptHandler} */
export const bowAndArrowPort = {
  handlerId: 'bow_and_arrow',
  family: 'weapon_base',
  onPrepare(piece, ctx) {
    piece._bowBonus = 0;
    prepareBow(piece, ctx, (payload) => {
      if (!payload?.hit?.hit) return;
      const per = Math.max(1, Math.round(getP1(piece.params, 1)));
      const cap = Math.max(per, Math.round(getP2(piece.params, 20)));
      forAttackEffects(piece, ctx.rng, () => {
        if ((Number(piece._bowBonus) || 0) >= cap) return;
        const add = Math.min(per, cap - (Number(piece._bowBonus) || 0));
        piece._bowBonus = (Number(piece._bowBonus) || 0) + add;
        addBonusDamage(piece, add);
      });
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'bow_and_arrow');
  },
};

/** PoisonBow.gd — acc damage from linked hits → poison on own CD. */
/** @type {ScriptHandler} */
export const poisonBowPort = {
  handlerId: 'poison_bow',
  family: 'weapon_base',
  onPrepare(piece, ctx) {
    piece._poisonAcc = 0;
    prepareBow(piece, ctx, (payload) => {
      if (!payload?.hit?.hit) return;
      const dmg = Number(payload.hit.damage ?? payload.hit.raw) || 0;
      forAttackEffects(piece, ctx.rng, () => {
        piece._poisonAcc = (Number(piece._poisonAcc) || 0) + dmg;
      });
    });
    onBuffChanged(ctx.dummy, (ch) => {
      if (ch.stack !== 'poison' || !ch.amount) return;
      addBonusDamageFromBuffChange(piece, ch, getP2(piece.params, 0.5));
    });
  },
  onCooldownEffect(piece, ctx) {
    const per = Math.max(1, Math.round(getPName(piece.params, 'damforpoison', getP1(piece.params, 5))));
    const acc = Number(piece._poisonAcc) || 0;
    const stacks = Math.floor(acc / per);
    piece._poisonAcc = acc % per;
    if (stacks > 0) {
      gainStacks(ctx.dummy, 'poison', stacks, { rng: ctx.rng, opponent: ctx.player });
      ctx.events.push({
        t: ctx.t + 0.002,
        type: 'debuff',
        target: 'dummy',
        amount: stacks,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${stacks} Poison`,
        meta: { category: 'dot', script: true, handler: 'poison_bow' },
      });
    }
    return weaponStrike(piece, ctx, 'poison_bow');
  },
};

/** Greatsword.gd — empower threshold → stam + CD. */
/** @type {ScriptHandler} */
export const greatswordPort = {
  handlerId: 'greatsword',
  family: 'weapon_base',
  onCombatStart(piece, ctx) {
    piece._gsBaseStam = Number(piece.staminaCost) || 0;
    piece._gsBaseCd = Number(piece.baseCooldown ?? piece.cooldown) || 0;
    piece._gsBuffed = false;
    const need = Math.max(1, Math.round(getP1(piece.params, 5)));
    const apply = () => {
      const emp = getStackAmount(ctx.player, 'empower');
      const want = emp >= need;
      if (want === piece._gsBuffed) return;
      piece._gsBuffed = want;
      if (want) {
        setStaminaCost(piece, getP2(piece.params, piece._gsBaseStam));
        const cd = getP3(piece.params, piece._gsBaseCd);
        piece.baseCooldown = cd;
        piece.cooldown = cd;
      } else {
        setStaminaCost(piece, piece._gsBaseStam);
        piece.baseCooldown = piece._gsBaseCd;
        piece.cooldown = piece._gsBaseCd;
      }
    };
    apply();
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack === 'empower') apply();
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'greatsword');
  },
};

/** BustedBlade.gd — rage CD; dmg per empower. */
/** @type {ScriptHandler} */
export const bustedBladePort = {
  handlerId: 'busted_blade',
  family: 'weapon_base',
  onCombatStart(piece, ctx) {
    piece._bbBaseCd = Number(piece.baseCooldown ?? piece.cooldown) || 0;
    piece._bbEmp = 0;
    const per = getP1(piece.params, 1);
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'empower') return;
      const emp = getStackAmount(ctx.player, 'empower');
      const delta = (emp - piece._bbEmp) * per;
      // Varying dmg is this weapon's mechanic — not the buff grantor (Mana Orb).
      addBonusDamage(piece, delta, {
        originKey: piece.placementKey,
        originId: piece.itemId,
        originName: piece.name,
      });
      piece._bbEmp = emp;
    });
    ctx.bus?.on?.('battle_rage_started', () => {
      const cd = getP3(piece.params, piece._bbBaseCd);
      piece.baseCooldown = cd;
      piece.cooldown = cd;
    });
    ctx.bus?.on?.('battle_rage_ended', () => {
      piece.baseCooldown = piece._bbBaseCd;
      piece.cooldown = piece._bbBaseCd;
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'busted_blade');
  },
};

/** ForgingHammer.gd — varying damage from empower. */
/** @type {ScriptHandler} */
export const forgingHammerPort = {
  handlerId: 'forging_hammer',
  family: 'weapon_base',
  onCombatStart(piece, ctx) {
    piece._fhEmp = 0;
    const per = getP1(piece.params, 1);
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'empower') return;
      const emp = getStackAmount(ctx.player, 'empower');
      const delta = (emp - piece._fhEmp) * per;
      addBonusDamage(piece, delta, {
        originKey: piece.placementKey,
        originId: piece.itemId,
        originName: piece.name,
      });
      piece._fhEmp = emp;
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'forging_hammer');
  },
};

/** Pop.gd — speed from mana (capped). */
/** @type {ScriptHandler} */
export const popPort = {
  handlerId: 'pop',
  family: 'weapon_base',
  onCombatStart(piece, ctx) {
    piece._popSpd = 0;
    const per = getPName(piece.params, 'speed', 2) / 100;
    const cap = getPName(piece.params, 'max', 50) / 100;
    const apply = () => {
      const want = Math.min(cap, per * (getStackAmount(ctx.player, 'mana') || 0));
      addSpeed(piece, want - piece._popSpd);
      piece._popSpd = want;
    };
    apply();
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack === 'mana') apply();
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'pop');
  },
};

/** VampiricScythe.gd — +1 vamp power on linked; speed from player vamp (cap p2%). */
/** @type {ScriptHandler} */
export const vampiricScythePort = {
  handlerId: 'vampiric_scythe',
  family: 'weapon_base',
  onCombatStart(piece, ctx) {
    for (const other of linked(ctx, piece)) giveBuffPower(other, 'vampirism', 1);
    piece._vsSpd = 0;
    const per = getP1(piece.params, 1) / 100;
    const cap = getP2(piece.params, 50) / 100;
    const apply = () => {
      const want = Math.min(cap, per * (getStackAmount(ctx.player, 'vampirism') || 0));
      addSpeed(piece, want - piece._vsSpd);
      piece._vsSpd = want;
    };
    apply();
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack === 'vampirism') apply();
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'vampiric_scythe');
  },
};

/** DeathScythe.gd — +1 poison power on linked; crit% once foe poison ≥ p1. */
/** @type {ScriptHandler} */
export const deathScythePort = {
  handlerId: 'death_scythe',
  family: 'weapon_base',
  onCombatStart(piece, ctx) {
    for (const other of linked(ctx, piece)) giveBuffPower(other, 'poison', 1);
    piece._dsCrit = false;
    const th = Math.max(1, Math.round(getP1(piece.params, 8)));
    const apply = () => {
      if (piece._dsCrit) return;
      if ((getStackAmount(ctx.dummy, 'poison') || 0) < th) return;
      piece._dsCrit = true;
      piece.critChance = (Number(piece.critChance) || 0) + chanceOf(piece, ctx);
    };
    apply();
    onBuffChanged(ctx.dummy, (ch) => {
      if (ch.stack === 'poison') apply();
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'death_scythe');
  },
};

/** Lightsaber.gd — regen spend → temp blind; dmg per opponent blind. */
/** @type {ScriptHandler} */
export const lightsaberPort = {
  handlerId: 'lightsaber',
  family: 'weapon_base',
  onCombatStart(piece, ctx) {
    piece._lsBlindDmg = 0;
    const need = Math.max(1, Math.round(getPName(piece.params, 'regent', 8)));
    const blind = Math.max(1, Math.round(getPName(piece.params, 'blind', 2)));
    const dur = Math.max(1, getPName(piece.params, 'dur_blind', 4));
    const per = getPName(piece.params, 'dam_blind', 1);
    const applyBlindDmg = () => {
      const b = getStackAmount(ctx.dummy, 'blind') || 0;
      const want = b * per;
      addBonusDamage(piece, want - piece._lsBlindDmg);
      piece._lsBlindDmg = want;
    };
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'regeneration' || piece._lsLit) return;
      if ((getStackAmount(ctx.player, 'regeneration') || 0) < need) return;
      piece._lsLit = true;
      useRegeneration(ctx.player, need, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      // Gap: no blindingLight actor API — temp blind + regen spend
      grantTemporaryStacks(ctx.dummy, 'blind', blind, dur, ctx.t, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    });
    onBuffChanged(ctx.dummy, (ch) => {
      if (ch.stack === 'blind') applyBlindDmg();
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'lightsaber');
  },
};

/** Pandamonium.gd — food activate → poison. Gap: poison-crit% on foe. */
/** @type {ScriptHandler} */
export const pandamoniumPort = {
  handlerId: 'pandamonium',
  family: 'weapon_base',
  onCombatStart(piece, ctx) {
    const pois = Math.max(1, Math.round(getP1(piece.params, 1)));
    // Gap: opponent poisonCritChance not on dummy — food poison only
    ctx.bus?.on?.('piece_activated', (payload) => {
      const src = payload?.piece;
      if (!src || src === piece) return;
      if (!itemHasType(ctx.itemsById.get(src.itemId), 'food')) return;
      grantStacks(ctx.dummy, 'poison', pois, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'pandamonium');
  },
  onPeerActivated(listener, activated, ctx) {
    if (!itemHasType(ctx.itemsById.get(activated.itemId), 'food')) return;
    grantStacks(ctx.dummy, 'poison', Math.max(1, Math.round(getP1(listener.params, 1))), {
      originKey: listener.placementKey,
      originId: listener.itemId,
    });
  },
};

/** ObsidianDragon.gd — heat bank → self dmg + crit% on linked weapon. */
/** @type {ScriptHandler} */
export const obsidianDragonPort = {
  handlerId: 'obsidian_dragon',
  family: 'weapon_base',
  onCombatStart(piece, ctx) {
    piece._odHeat = 0;
    const need = Math.max(1, Math.round(getP1(piece.params, 4)));
    const bonus = Math.max(1, Math.round(getP2(piece.params, 2)));
    const target = linked(ctx, piece).find((o) => canBeEmpoweredPiece(o)) || null;
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'heat' || !(ch.amount > 0)) return;
      piece._odHeat = (Number(piece._odHeat) || 0) + ch.amount;
      const procs = Math.floor(piece._odHeat / need);
      if (procs <= 0) return;
      piece._odHeat %= need;
      addBonusDamage(piece, bonus * procs);
      if (target) target.critChance = (Number(target.critChance) || 0) + procs;
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'obsidian_dragon');
  },
};

/** Phoenix2.gd — fire-neighbor crit; Phoenix CD self-dmg + reincarnate approx. */
/** @type {ScriptHandler} */
export const phoenix2Port = {
  handlerId: 'phoenix2',
  family: 'weapon_base',
  onCombatStart(piece, ctx) {
    const fires = linked(ctx, piece).filter((o) =>
      itemHasType(ctx.itemsById.get(o.itemId), 'fire'),
    ).length;
    piece.critChance = (Number(piece.critChance) || 0) + chanceOf(piece, ctx) * fires;
    piece._phxUsed = false;
    ctx.bus?.on?.('player_damaged', () => {
      if (piece._phxUsed) return;
      const p = ctx.player;
      if (p.hp > 0 && !p.dead) return;
      const heat = getStackAmount(p, 'heat') || 0;
      if (heat <= 0) return;
      piece._phxUsed = true;
      const hp = Math.max(1, Math.round(getPName(piece.params, 'reincarnate_health', 1) * heat));
      spendStacks(p, 'heat', heat, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      p.dead = false;
      p.hp = hp;
    });
  },
  onCooldownEffect(piece, ctx) {
    const selfDam = Math.max(0, Math.round(getPName(piece.params, 'selfdam', 0)));
    if (selfDam && ctx.player.hp <= selfDam) return true;
    if (selfDam) {
      dealDamage(ctx.player, ctx.player, {
        amount: selfDam,
        canMiss: false,
        canCrit: false,
        isAttack: false,
        skipSpikes: true,
        nowT: ctx.t,
        rng: ctx.rng,
      });
    }
    return weaponStrike(piece, ctx, 'phoenix2');
  },
};

/** ArmoredCouragePuppy.gd — pet strike, no stamina; skip spikes. */
/** @type {ScriptHandler} */
export const armoredCouragePuppyPort = {
  handlerId: 'armored_courage_puppy',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    const pets = linked(ctx, piece).filter((o) =>
      itemHasType(ctx.itemsById.get(o.itemId), 'pet'),
    ).length;
    const per = Math.max(0, Math.round(getP1(piece.params, 2)));
    if (pets && per) addBonusDamage(piece, per * pets);
  },
  onCooldownEffect(piece, ctx) {
    const raw = randInt(
      Math.max(1, piece.damageMin || 4),
      Math.max(2, piece.damageMax || 8),
      ctx.rng,
    );
    // ArmoredCouragePuppy.gd removes CanTriggerItems and CanTriggerSpikes
    // from its DamageSource in _ready; keep both flags disabled here.
    dealHit(piece, ctx, raw, undefined, { skipSpikes: true, canTriggerItems: false });
    return true;
  },
};

/** Torch.gd — on hit, rollChance() → addBonusDamage(getP1()) (current hit included).
 * Canonical HAND entry is AP_PERM_PORTS.torch (later merge wins); keep in sync. */
/** @type {ScriptHandler} */
export const torchPort = {
  handlerId: 'torch',
  family: 'on_hit',
  onCooldownEffect(piece, ctx) {
    pushActivationAudit(piece, ctx);
    return weaponStrike(piece, ctx, 'torch');
  },
  onPreDealDamageEarly(piece, ctx, res) {
    if (res && !res.hit) return;
    if (!rollItemChance(piece, ctx.rng)) return;
    const grow = Math.max(1, Math.round(getP1(piece.params, 1)));
    addBonusDamage(piece, grow);
    ctx.events.push({
      t: ctx.t + 0.008,
      type: 'buff',
      amount: grow,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: +${grow} damage`,
      meta: {
        category: 'weapon',
        script: true,
        handler: 'torch',
        kind: 'damage_buff',
      },
    });
  },
};

/** MagicTorch.gd — on hit, spend mana then addBonusDamage(p2) to self + star empowerables. */
/** @type {ScriptHandler} */
export const AL_WEAPON_PORTS = {
  bow: bowBasePort,
  shortbow: shortbowPort,
  dagger: daggerPort,
  bow_and_arrow: bowAndArrowPort,
  poison_bow: poisonBowPort,
  greatsword: greatswordPort,
  busted_blade: bustedBladePort,
  forging_hammer: forgingHammerPort,
  pop: popPort,
  vampiric_scythe: vampiricScythePort,
  death_scythe: deathScythePort,
  lightsaber: lightsaberPort,
  pandamonium: pandamoniumPort,
  obsidian_dragon: obsidianDragonPort,
  phoenix2: phoenix2Port,
  armored_courage_puppy: armoredCouragePuppyPort,
  torch: torchPort,
};

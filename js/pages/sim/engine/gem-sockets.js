/**
 * Socketed gems. `Item.gd` runs gem preparation before it arms the host
 * cooldown, then runs gem combat-start effects before the host combat-start
 * hook. Inventory-only effects stay on loose gems in ports-an-gems.js.
 */

import { healActor, grantStun } from './actor.js';
import { applyHealEfficiency } from './actor-stats.js';
import { grantStacks, onBuffChanged, stealRandomBuff } from './buff-economy.js';
import { getP1, getP2, getP3, getP4, getPName, paramsFromItem } from './params.js';
import { scaleEffectDuration } from './effect-duration.js';
import { modifiedParamValue } from './placement-instance.js';
import { addSpeed, changeBonusDamageFactor } from './piece-stats.js';
import { withStatSource } from './stat-mods.js';
import { gainStacks } from './stacks.js';
import { isBattleRaging } from './battle-rage.js';
import { makeDamageSpectral } from './damage.js';
import { applyBonusChance } from './chance.js';
import { rollPercent } from './rng.js';
import { removeRandomBuffs } from './scripts/ports-wave-c-util.js';
import { giveTempMaxHp } from './scripts/ports-ap-start.js';
import { grantTimedDebuffResistance } from './timed-resistance.js';
import { eventSideForPiece } from './vs-board.js';

function familyOf(gid) {
  const id = String(gid || '');
  if (id.includes('amethyst')) return 'amethyst';
  if (id.includes('ruby')) return 'ruby';
  if (id.includes('emerald')) return 'emerald';
  if (id.includes('sapphire')) return 'sapphire';
  if (id.includes('topaz')) return 'topaz';
  if (id === 'skull') return 'skull';
  if (id === 'badger_rune') return 'badger';
  if (id === 'tiger_rune') return 'tiger';
  if (id === 'elephant_rune') return 'elephant';
  if (id === 'hawk_rune') return 'hawk';
  if (id === 'lump_of_coal') return 'coal';
  if (id === 'burning_coal') return 'burning_coal';
  if (id === 'corrupted_crystal') return 'corrupted_crystal';
  if (id === 'wisp') return 'wisp';
  return 'stat';
}

function isWeaponHost(piece) {
  return (
    piece.kind === 'weapon' ||
    (Number(piece.damageMax) || 0) > 0 ||
    (Number(piece.damageMin) || 0) > 0
  );
}

function gemChance(gem, key = 'chance', fb = 20) {
  const n = Number(gem?.[key]);
  return Number.isFinite(n) && n > 0 ? n : fb;
}

/**
 * Game Gem.getGemPower() is scoped to the socketed gem instance. A host such
 * as King Crown or King Goobert can raise that instance's power without
 * mutating the catalog gem for other boards.
 * @param {object} gem
 * @param {object} piece
 */
function gemPowerForHost(gem, piece) {
  const rawPower = Number(gem?.gemPower);
  const base = Number.isFinite(rawPower) ? rawPower : 1;
  const bonus = Number(piece?._socketGemPowerBonus);
  return Math.max(0, base + (Number.isFinite(bonus) ? bonus : 0));
}

/** Item.getChance/getChance2 for a socketed gem, including chance modifiers. */
function effectiveGemChance(gem, key, fallback, index) {
  const raw = Number(gem?.[key]);
  const base = Number.isFinite(raw) ? raw : fallback;
  return Math.max(0, Math.min(100, applyBonusChance(base, gem, index)));
}

function onHostHit(ctx, piece, fn) {
  ctx.bus?.on?.('piece_dealt_damage', (payload) => {
    if (payload?.piece !== piece || !payload?.hit?.hit) return;
    fn(payload.hit);
  });
}

/** Gem.miniActivate() is visual-only and must not count as a cooldown activation. */
function pushGemMiniActivate(ctx, piece, gem, gid) {
  ctx.events?.push?.({
    t: (Number(ctx.t) || 0) + 0.001,
    type: 'info',
    itemId: gid,
    placementKey: piece.placementKey,
    label: `${gem.name || gid}: mini activate`,
    meta: { category: 'system', script: true, handler: gid, miniActivate: true },
  });
}

/** Per-socket origin so two Wisps on one weapon stay distinct in attribution. */
function gemOriginKey(piece, slotIndex) {
  return `${piece.placementKey}:gem:${slotIndex}`;
}

/**
 * Gem.prepareWeapon — once. On-hit listeners only where .gd connects "attacked".
 */
function prepareWeapon(piece, gem, params, fam, ctx, gid, originKey) {
  if (fam === 'hawk') {
    piece.critChance =
      (Number(piece.critChance) || 0) + getPName(params, 'critchance', getP1(params, 0));
    piece.critSeverity =
      (Number(piece.critSeverity) || 2) +
      getPName(params, 'critdam', getP2(params, 0)) / 100;
    return;
  }
  if (fam === 'corrupted_crystal') {
    let applied = false;
    const threshold = getP1(params, 30) / 100 - 0.0001;
    const factor = getP2(params, 50) / 100;
    const sync = () => {
      const maxHp = Number(ctx.dummy.maxHp) || 1;
      const below = (Number(ctx.dummy.hp) || 0) / maxHp < threshold;
      if (below && !applied) {
        applied = true;
        changeBonusDamageFactor(piece, factor);
      } else if (!below && applied) {
        applied = false;
        changeBonusDamageFactor(piece, -factor);
      }
    };
    ctx.bus?.on?.('character_damaged', (payload = {}) => {
      if (payload.actor && payload.actor !== ctx.dummy) return;
      const hit =
        typeof payload.hit === 'object' ? Boolean(payload.hit?.hit) : Boolean(payload.hit);
      if (hit) sync();
    });
    return;
  }
  if (fam === 'topaz') {
    // Topaz.gd prepareWeapon — addSpeed once, not per hit. Stam regen is prepareInventory.
    withStatSource({ name: String(gem.name || gid), itemId: gid }, () => {
      addSpeed(piece, getP1(params, 10) / 100);
    });
    return;
  }
  if (fam === 'coal') {
    piece._preDeal = piece._preDeal || [];
    piece._preDeal.push(() => {
      if (!rollPercent(gemChance(gem, 'chance', 70), ctx.rng)) return 0;
      const extra = getP1(params, 0);
      ctx.events.push({
        t: (Number(ctx.t) || 0) + 0.001,
        type: 'info',
        itemId: gid,
        placementKey: piece.placementKey,
        label: `${gem.name || gid}: mini activate`,
        meta: { category: 'system', script: true, handler: gid, miniActivate: true },
      });
      return extra;
    });
    return;
  }
  if (fam === 'burning_coal') {
    piece._preDeal = piece._preDeal || [];
    piece._preDeal.push(() => {
      if (!rollPercent(gemChance(gem, 'chance', 12), ctx.rng)) return 0;
      grantStacks(ctx.player, 'heat', Math.max(1, Math.round(getP2(params, 1))), {
        originKey,
        originId: gid,
      });
      return Math.max(1, Math.round(getP1(params, 6)));
    });
    return;
  }
  if (fam === 'wisp') {
    let acc = 0;
    const need = Math.max(1, Math.round(getPName(params, 'dam', 30)));
    const spikes = Math.max(1, Math.round(getPName(params, 'spikes', 1)));
    onHostHit(ctx, piece, (hit) => {
      acc += Number(hit.damage) || Number(hit.healthDamage) || 0;
      const n = Math.floor(acc / need);
      if (n > 0) {
        acc %= need;
        grantStacks(ctx.player, 'spikes', spikes * n, {
          originKey,
          originId: gid,
        });
      }
    });
    return;
  }
  if (fam === 'sapphire') {
    // Sapphire.gd registers both hooks on the weapon: pre_deal_damage_late
    // rolls and makes the live DamageSource spectral; attacked then pays Mana
    // and Cold only when that final roll was spectral and the strike hit.
    // Keep `spectral` local to this socket exactly like the source field.
    let spectral = false;
    piece._preDealLate = piece._preDealLate || [];
    piece._preDealLate.push((damageRes) => {
      spectral = rollPercent(gemChance(gem), ctx.rng);
      if (spectral) makeDamageSpectral(damageRes);
    });
    onHostHit(ctx, piece, () => {
      if (!spectral) return;
      const rawMana = Number(getP1(params, 1));
      const mana = Number.isFinite(rawMana) ? rawMana : 0;
      grantStacks(ctx.player, 'mana', mana, {
        originKey,
        originId: gid,
      });
      const rawCold = Number(getP4(params, 1));
      const cold = Number.isFinite(rawCold) ? rawCold : 0;
      grantStacks(ctx.dummy, 'cold', cold, {
        originKey,
        originId: gid,
      });
      pushGemMiniActivate(ctx, piece, gem, gid);
    });
    return;
  }
  if (fam === 'tiger') {
    // TigerRune.gd connects pre_deal_damage_late, so its Vampirism is added
    // before the host strike resolves rather than from the post-hit bus.
    const chance = getPName(params, 'chance_vamp', gemChance(gem));
    const rawVamp = Number(getPName(params, 'vampirism', getP1(params, 1)));
    const vamp = Number.isFinite(rawVamp) ? Math.trunc(rawVamp) : 0;
    piece._preDealLate = piece._preDealLate || [];
    piece._preDealLate.push((damageRes) => {
      if (!damageRes?.hit || !rollPercent(chance, ctx.rng)) return;
      grantStacks(ctx.player, 'vampirism', vamp, {
        originKey,
        originId: gid,
      });
      ctx.events.push({
        t: (Number(ctx.t) || 0) + 0.001,
        type: 'info',
        actor: eventSideForPiece(piece),
        itemId: gid,
        placementKey: piece.placementKey,
        label: `${gem.name || gid}: mini activate`,
        meta: { category: 'system', script: true, handler: gid, miniActivate: true },
      });
    });
    return;
  }
  if (fam === 'stat') return;

  onHostHit(ctx, piece, (hit) => {
    if (fam === 'amethyst' && rollPercent(gemChance(gem), ctx.rng)) {
      const rawRemoval = Number(getPName(params, 'buffs', getP2(params, 1)));
      const removal = Number.isFinite(rawRemoval) ? Math.trunc(rawRemoval) : 0;
      removeRandomBuffs(ctx.dummy, removal, ctx.rng, {});
    } else if (fam === 'ruby') {
      // Ruby.gd uses getP_m("lifesteal_weapon") and heals ceil(damage * pct).
      const basePct = getPName(params, 'lifesteal_weapon', 10);
      const pct = modifiedParamValue(gem, basePct, 'lifesteal_weapon') / 100;
      const dmg = Number(hit.damage) || Number(hit.healthDamage) || 0;
      if (pct && dmg) healActor(ctx.player, Math.ceil(dmg * pct));
      pushGemMiniActivate(ctx, piece, gem, gid);
    } else if (fam === 'emerald' && rollPercent(gemChance(gem), ctx.rng)) {
      // Emerald.gd passes getP1() directly to inflictPoison(); Item.gd's
      // giveStacks performs buff-power scaling and rounding at the target.
      const rawPoison = Number(getPName(params, 'poison', getP1(params, 1)));
      const poison = Number.isFinite(rawPoison) ? rawPoison : 0;
      grantStacks(ctx.dummy, 'poison', poison, {
        originKey,
        originId: gid,
      });
      pushGemMiniActivate(ctx, piece, gem, gid);
    } else if (fam === 'skull' && rollPercent(gemChance(gem, 'chance2', 15), ctx.rng)) {
      stealRandomBuff(ctx.dummy, ctx.player, 1, ctx.rng, {
        originKey,
        originId: gid,
      });
    } else if (fam === 'badger') {
      // BadgerRune.gd onAttack — addSpeed every hit
      withStatSource({ name: String(gem.name || gid), itemId: gid }, () => {
        addSpeed(piece, getPName(params, 'attackspeed', 5) / 100);
      });
    } else if (fam === 'elephant' && rollPercent(gemChance(gem), ctx.rng)) {
      grantStun(
        ctx.dummy,
        Math.max(0.5, scaleEffectDuration(piece, getPName(params, 'dur_stun', 1))),
        ctx.t,
      );
    }
  });
}

/**
 * Gem.prepareArmor — once. No inventory stam / max-HP consume here.
 */
function prepareArmor(piece, gem, params, fam, ctx, gid, originKey) {
  if (fam === 'hawk') {
    const gemPower = gemPowerForHost(gem, piece);
    const chance = gemChance(gem, 'chance', 20);
    ctx.player.stackResist = ctx.player.stackResist || {};
    ctx.player.stackResist.blind =
      (Number(ctx.player.stackResist.blind) || 0) + gemPower * chance;
  } else if (fam === 'amethyst') {
    const gemPower = gemPowerForHost(gem, piece);
    const red = (gemPower * getP1(params, 8)) / 100;
    if (red) applyHealEfficiency(ctx.dummy, -red, ctx, piece);
  } else if (fam === 'ruby') {
    // Ruby.gd applies getGemPower() * getP2() to the owning character.
    const gemPower = gemPowerForHost(gem, piece);
    const amp = (gemPower * getP2(params, 8)) / 100;
    if (amp) applyHealEfficiency(ctx.player, amp, ctx, piece);
  } else if (fam === 'emerald') {
    // Gem.prepareArmor uses getGemPower() * getP2(); Gem.gd clamps the
    // multiplier at zero and starts new gems at 1.0.
    const gemPower = gemPowerForHost(gem, piece);
    const ch = gemPower * getP2(params, gemChance(gem));
    ctx.player.stackResist = ctx.player.stackResist || {};
    ctx.player.stackResist.poison = (Number(ctx.player.stackResist.poison) || 0) + ch;
  } else if (fam === 'sapphire') {
    // Sapphire.gd stores int(getP2()) once, then multiplies the raw block
    // amount by GemPower before giveBlock performs the final rounding.
    const rawNeed = Number(getP2(params, 4));
    const need = Number.isFinite(rawNeed) ? Math.trunc(rawNeed) : 0;
    const gemPower = gemPowerForHost(gem, piece);
    let bank = 0;
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'mana' || !(ch.amount > 0)) return;
      bank += ch.amount;
      if (!(need > 0)) return;
      const block = Math.floor(bank / need) * getP3(params, 1);
      bank %= need;
      if (block > 0) {
        gainStacks(ctx.player, 'block', gemPower * block);
        pushGemMiniActivate(ctx, piece, gem, gid);
      }
    });
  } else if (fam === 'topaz') {
    // Topaz.gd applies GemPower to both armor resistances. Gem.gd starts at
    // 1.0 and clamps negative powers to zero before prepareArmor runs.
    const gemPower = gemPowerForHost(gem, piece);
    const stunChance = effectiveGemChance(gem, 'chance', 20, 1);
    const critChance = effectiveGemChance(gem, 'chance2', 5, 2);
    ctx.player.stunResistance =
      (Number(ctx.player.stunResistance) || 0) + gemPower * stunChance;
    ctx.player.critResistance =
      (Number(ctx.player.critResistance) || 0) + gemPower * critChance;
  } else if (fam === 'coal') {
    const gemPower = gemPowerForHost(gem, piece);
    ctx.player.debuffResistStacks =
      (Number(ctx.player.debuffResistStacks) || 0) + Math.round(gemPower);
  } else if (fam === 'elephant') {
    // ElephantRune.gd changes debuff resistance during prepareArmor. The
    // combat-start timer only controls when that prepared resistance is
    // removed; it must not be granted twice at combat start.
    const ch = gemChance(gem, 'chance2', 0);
    if (ch > 0) {
      ctx.player.stackResist = ctx.player.stackResist || {};
      for (const stack of ['poison', 'blind', 'cold']) {
        ctx.player.stackResist[stack] = (Number(ctx.player.stackResist[stack]) || 0) + ch;
      }
    }
  } else if (fam === 'skull') {
    // Skull.gd prepareArmor applies its gem-power chance to every debuff,
    // then separately applies the same amount to crit resistance.
    const gemPower = gemPowerForHost(gem, piece);
    const rawChance = Number(gem?.chance);
    const chance = Number.isFinite(rawChance) ? rawChance : 20;
    const ch = gemPower * chance;
    ctx.player.stackResist = ctx.player.stackResist || {};
    for (const stack of ['poison', 'blind', 'cold']) {
      ctx.player.stackResist[stack] =
        (Number(ctx.player.stackResist[stack]) || 0) + ch;
    }
    ctx.player.critResistance = (Number(ctx.player.critResistance) || 0) + ch;
  } else if (fam === 'badger') {
    const dr = getPName(params, 'damreduction', 8);
    ctx.bus?.on?.('pre_take_damage', (payload) => {
      const damage = payload?.damage;
      const source = payload?.source;
      if (payload?.defender !== ctx.player || !damage?.hit) return;
      if (source?.isAttack === false || source?.canTriggerItems === false) return;
      if (!isBattleRaging(ctx.player, Number(payload?.t) || ctx.t) || !(dr > 0)) return;
      const amount = Math.max(0, Math.round(dr));
      const left = Math.max(0, (Number(damage.damage) || 0) - (Number(damage.damageReduction) || 0));
      const actual = Math.min(amount, left);
      damage.damageReduction = (Number(damage.damageReduction) || 0) + amount;
      if (actual > 0) {
        damage.reductionSources?.push?.({
          itemId: gid,
          placementKey: piece.placementKey,
          amount: actual,
        });
      }
    });
  } else if (fam === 'tiger') {
    // TigerRune.gd caches int(getP("buffs")) / int(getP("block")) and
    // multiplies each resulting Block grant by getGemPower(). New gems start
    // at 1.0 and Gem clamps negative power to zero.
    const rawNeed = Number(getPName(params, 'buffs', getP2(params, 10)));
    const need = Number.isFinite(rawNeed) ? Math.trunc(rawNeed) : 0;
    const rawPer = Number(getPName(params, 'block', getP3(params, 5)));
    const per = Number.isFinite(rawPer) ? Math.trunc(rawPer) : 0;
    const gemPower = gemPowerForHost(gem, piece);
    let bank = 0;
    piece._tigerBuffCounter = 0;
    onBuffChanged(ctx.player, (ch) => {
      if (!(ch.amount > 0) || ch.stack === 'block') return;
      bank += ch.amount;
      piece._tigerBuffCounter = bank;
      if (!(need > 0)) return;
      const relBuffs = bank / need;
      const block = relBuffs * per;
      bank %= need;
      piece._tigerBuffCounter = bank;
      if (block > 0) {
        gainStacks(ctx.player, 'block', gemPower * block, { originKey, originId: gid });
      }
    });
  } else if (fam === 'burning_coal') {
    ctx.player.stackResist = ctx.player.stackResist || {};
    ctx.player.stackResist.cold =
      (Number(ctx.player.stackResist.cold) || 0) +
      Math.round(getPName(params, 'coldresist', getP3(params, 7)));
  } else if (fam === 'corrupted_crystal') {
    const need = Math.max(1, Math.round(getP3(params, 7)));
    const blockGain = Math.max(0, Math.round(getP4(params, 6)));
    let bank = 0;
    onBuffChanged(ctx.dummy, (ch) => {
      if (!(ch.amount > 0) || !['poison', 'blind', 'cold'].includes(ch.stack)) return;
      const originKey = String(ch.originKey || '');
      const hostPrefix = `${piece.placementKey}:gem:`;
      const originPiece = (ctx.allPieces || ctx.pieces || []).find(
        (other) => other.placementKey === ch.originKey,
      );
      const ownerMatch = originPiece
        ? eventSideForPiece(originPiece) === eventSideForPiece(piece)
        : originKey.startsWith(hostPrefix) && ch.originId === gid;
      if (!ownerMatch) return;
      bank += Number(ch.amount) || 0;
      const activations = Math.floor(bank / need);
      bank %= need;
      if (activations <= 0) return;
      const amount = blockGain * activations;
      gainStacks(ctx.player, 'block', amount, {
        originKey,
        originId: gid,
      });
      ctx.events.push({
        t: ctx.t + 0.004,
        type: 'info',
        itemId: gid,
        placementKey: piece.placementKey,
        label: `${gem.name || gid}: mini activate`,
        meta: {
          category: 'system',
          script: true,
          handler: 'corrupted_crystal',
          miniActivate: true,
        },
      });
    });
  }
}

/**
 * @param {object} piece
 * @param {object} ctx
 * @param {(gem: object, params: object, family: string, gemId: string, originKey: string, weapon: boolean) => void} visit
 */
function forEachSocket(piece, ctx, visit) {
  const host = ctx.itemsById?.get?.(piece.itemId);
  if (String(host?.type || '').toLowerCase() === 'gem') return;
  const ids = piece.gemIds;
  if (!Array.isArray(ids) || !ids.length) return;
  const weapon = isWeaponHost(piece);
  for (let i = 0; i < ids.length; i += 1) {
    const gemId = ids[i];
    const gem = ctx.itemsById.get(gemId);
    if (!gem) continue;
    visit(gem, paramsFromItem(gem), familyOf(gemId), gemId, gemOriginKey(piece, i), weapon);
  }
}

/**
 * Game `Gem.onPrepare` / host `Item.preCombatStart`: establish socketed
 * listeners and stats before the host cooldown is armed.
 *
 * @param {object} piece
 * @param {object} ctx
 */
export function prepareGemSockets(piece, ctx) {
  piece._socketGemTimers = [];
  forEachSocket(piece, ctx, (gem, params, fam, gid, originKey, weapon) => {
    if (weapon) prepareWeapon(piece, gem, params, fam, ctx, gid, originKey);
    else {
      prepareArmor(piece, gem, params, fam, ctx, gid, originKey);
      if (fam === 'wisp') {
        piece._socketGemTimers.push({
          id: gid,
          kind: 'wisp_armor',
          params,
          remaining: Math.max(0.05, Number(gem.cooldown) || 12),
        });
      }
    }
  });
}

/** Wisp.gd armor mode: its own cooldown grants temporary max health once. */
export function tickGemSocketEffects(piece, ctx, delta) {
  for (const timer of piece?._socketGemTimers || []) {
    if (timer.done || timer.kind !== 'wisp_armor') continue;
    timer.remaining -= Math.max(0, Number(delta) || 0);
    if (timer.remaining > 1e-9) continue;
    timer.done = true;
    const pct = Math.max(0, getPName(timer.params, 'maxhealth', 35)) / 100;
    giveTempMaxHp(piece, ctx, 'wisp', pct * (Number(ctx.player.hp) || 0));
  }
}

/**
 * Game `Gem.combatStart`: combat-start-only socket effects occur before the
 * host item's `onCombatStart`. Coal's armor block is deliberately here rather
 * than in preparation; its source gives the Block from `combatStartArmor`.
 *
 * @param {object} piece
 * @param {object} ctx
 */
export function combatStartGemSockets(piece, ctx) {
  forEachSocket(piece, ctx, (gem, params, fam, gid, originKey, weapon) => {
    if (fam === 'elephant' && !weapon) {
      const chance = gemChance(gem, 'chance2', 0);
      const duration = Math.max(0, getPName(params, 'dur_resist', getP2(params, 4)));
      if (chance > 0 && duration > 0) {
        grantTimedDebuffResistance(
          ctx.player,
          chance,
          ctx.t + duration,
          `elephant:${gid}`,
          ['poison', 'blind', 'cold'],
          { alreadyGranted: true },
        );
      }
      return;
    }
    if (weapon || (fam !== 'coal' && fam !== 'burning_coal')) return;
    const block =
      fam === 'coal'
        ? Math.round(
            gemPowerForHost(gem, piece) *
              (Number(gem.block) || getPName(params, 'block', 8)),
          )
        : Math.max(1, Math.round(Number(gem.block) || getPName(params, 'block', 12)));
    gainStacks(ctx.player, 'block', block, { originKey, originId: gid });
  });
}

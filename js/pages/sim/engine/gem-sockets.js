/**
 * Socketed gems. `Item.gd` runs gem preparation before it arms the host
 * cooldown, then runs gem combat-start effects before the host combat-start
 * hook. Inventory-only effects stay on loose gems in ports-an-gems.js.
 */

import { healActor, grantStun } from './actor.js';
import { applyHealEfficiency } from './actor-stats.js';
import { grantStacks, onBuffChanged, stealRandomBuff } from './buff-economy.js';
import { getP1, getP2, getP3, getP4, getPName, paramsFromItem } from './params.js';
import { addSpeed } from './piece-stats.js';
import { withStatSource } from './stat-mods.js';
import { gainStacks } from './stacks.js';
import { isBattleRaging } from './battle-rage.js';
import { makeDamageSpectral } from './damage.js';
import { rollPercent } from './rng.js';
import { removeRandomBuffs } from './scripts/ports-wave-c-util.js';
import { grantTimedDebuffResistance } from './timed-resistance.js';

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
  if (id === 'lump_of_coal') return 'coal';
  if (id === 'burning_coal') return 'burning_coal';
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

function onHostHit(ctx, piece, fn) {
  ctx.bus?.on?.('piece_dealt_damage', (payload) => {
    if (payload?.piece !== piece || !payload?.hit?.hit) return;
    fn(payload.hit);
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
  if (fam === 'topaz') {
    // Topaz.gd prepareWeapon — addSpeed once, not per hit. Stam regen is prepareInventory.
    withStatSource({ name: String(gem.name || gid), itemId: gid }, () => {
      addSpeed(piece, getPName(params, 'attackspeed', getP1(params, 10)) / 100);
    });
    return;
  }
  if (fam === 'coal') {
    piece._preDeal = piece._preDeal || [];
    piece._preDeal.push(() =>
      rollPercent(gemChance(gem, 'chance', 70), ctx.rng)
        ? Math.max(1, Math.round(getP1(params, 1)))
        : 0,
    );
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
      grantStacks(ctx.player, 'mana', Math.max(1, Math.round(getP1(params, 1))), {
        originKey,
        originId: gid,
      });
      grantStacks(ctx.dummy, 'cold', Math.max(1, Math.round(getP4(params, 1))), {
        originKey,
        originId: gid,
      });
    });
    return;
  }
  if (fam === 'stat') return;

  onHostHit(ctx, piece, (hit) => {
    if (fam === 'amethyst' && rollPercent(gemChance(gem), ctx.rng)) {
      removeRandomBuffs(ctx.dummy, Math.max(1, Math.round(getP2(params, 1))), ctx.rng, {});
    } else if (fam === 'ruby') {
      const pct = getPName(params, 'lifesteal_weapon', 10) / 100;
      const dmg = Number(hit.damage) || Number(hit.healthDamage) || 0;
      if (pct && dmg) healActor(ctx.player, Math.ceil(dmg * pct));
    } else if (fam === 'emerald' && rollPercent(gemChance(gem), ctx.rng)) {
      grantStacks(ctx.dummy, 'poison', Math.max(1, Math.round(getP1(params, 1))), {
        originKey,
        originId: gid,
      });
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
    } else if (fam === 'tiger' && rollPercent(getPName(params, 'chance_vamp', gemChance(gem)), ctx.rng)) {
      grantStacks(ctx.player, 'vampirism', Math.max(1, Math.round(getPName(params, 'vampirism', 1))), {
        originKey,
        originId: gid,
      });
    } else if (fam === 'elephant' && rollPercent(gemChance(gem), ctx.rng)) {
      grantStun(ctx.dummy, Math.max(0.5, getPName(params, 'dur_stun', 1)), ctx.t);
    }
  });
}

/**
 * Gem.prepareArmor — once. No inventory stam / max-HP consume here.
 */
function prepareArmor(piece, gem, params, fam, ctx, gid, originKey) {
  if (fam === 'amethyst') {
    const red = getP1(params, 8) / 100;
    if (red) applyHealEfficiency(ctx.dummy, -red, ctx, piece);
  } else if (fam === 'ruby') {
    const amp = getP2(params, 8) / 100;
    if (amp) applyHealEfficiency(ctx.player, amp, ctx, piece);
  } else if (fam === 'emerald') {
    const ch = getP2(params, gemChance(gem));
    ctx.player.stackResist = ctx.player.stackResist || {};
    ctx.player.stackResist.poison = (Number(ctx.player.stackResist.poison) || 0) + ch;
  } else if (fam === 'sapphire') {
    const need = Math.max(1, Math.round(getP2(params, 4)));
    let bank = 0;
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack !== 'mana' || !(ch.amount > 0)) return;
      bank += ch.amount;
      const block = Math.floor(bank / need) * getP3(params, 1);
      bank %= need;
      if (block > 0) gainStacks(ctx.player, 'block', Math.max(1, Math.round(block)));
    });
  } else if (fam === 'topaz') {
    ctx.player.stunResistance = (Number(ctx.player.stunResistance) || 0) + gemChance(gem);
    ctx.player.critResistance =
      (Number(ctx.player.critResistance) || 0) + gemChance(gem, 'chance2', 5);
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
    ctx.player.stackResist = ctx.player.stackResist || {};
    const ch = gemChance(gem);
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
    const need = Math.max(1, Math.round(getPName(params, 'buffs', 4)));
    const per = Math.max(1, Math.round(getPName(params, 'block', 2)));
    let bank = 0;
    onBuffChanged(ctx.player, (ch) => {
      if (!(ch.amount > 0) || ch.stack === 'block') return;
      bank += ch.amount;
      const n = Math.floor(bank / need);
      bank %= need;
      if (n) gainStacks(ctx.player, 'block', n * per);
    });
  } else if (fam === 'burning_coal') {
    ctx.player.stackResist = ctx.player.stackResist || {};
    ctx.player.stackResist.cold =
      (Number(ctx.player.stackResist.cold) || 0) +
      Math.round(getPName(params, 'coldresist', getP3(params, 7)));
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
  forEachSocket(piece, ctx, (gem, params, fam, gid, originKey, weapon) => {
    if (weapon) prepareWeapon(piece, gem, params, fam, ctx, gid, originKey);
    else prepareArmor(piece, gem, params, fam, ctx, gid, originKey);
  });
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
        ? Math.max(1, Math.round(Number(gem.block) || getPName(params, 'block', 8)))
        : Math.max(1, Math.round(Number(gem.block) || getPName(params, 'block', 12)));
    gainStacks(ctx.player, 'block', block, { originKey, originId: gid });
  });
}

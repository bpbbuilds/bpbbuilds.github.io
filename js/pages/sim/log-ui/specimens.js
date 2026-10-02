/**
 * Every Combat Log line shape the game can print, as static specimens.
 * Wording comes straight from Sheets/CSV/Interface.csv (LOG_* keys plus the
 * rows the extract stores as <!MissingKey:n:…>); timestamps use Godot's
 * "%2.2f" + ":  " prefix from Core/CombatEvent.gd asText().
 */

/** buff / debuff stack icons — Game.typeToKeyword order */
const STACKS = {
  block: 'Block.png',
  lucky: 'Lucky.png',
  regeneration: 'Regeneration.png',
  vampirism: 'Vampirism.png',
  spikes: 'Spikes.png',
  mana: 'Mana.png',
  empower: 'Empower.png',
  heat: 'Heat.png',
  poison: 'Poison.png',
  blind: 'Blind.png',
  cold: 'Cold.png',
};

const BUFFS = ['block', 'lucky', 'regeneration', 'vampirism', 'spikes', 'mana', 'empower', 'heat'];
const DEBUFFS = ['poison', 'blind', 'cold'];

/** @param {string} root */
function makeIcon(root) {
  /** @param {keyof typeof STACKS} key */
  return (key) =>
    `<img class="sim-clog__icon" src="${root}assets/icons/status/buff/${STACKS[key]}" alt="${key}" width="18" height="18" draggable="false" />`;
}

/** @param {string} root @param {string} file */
function statIcon(root, file) {
  return `<img class="sim-clog__icon sim-clog__icon--stat" src="${root}assets/icons/sim/stats/${file}" alt="" width="18" height="18" draggable="false" />`;
}

/**
 * @param {number} t
 * @param {string} body
 * @param {{ side?: 'you' | 'opp', mods?: string, depth?: number }} [o]
 */
function line(t, body, o = {}) {
  const side = o.side === 'opp' ? 'opp' : 'you';
  const depth = o.depth || 0;
  const prefix =
    depth > 0
      ? `${'  '.repeat(depth)} &gt; `
      : `<b class="sim-clog__t">${t.toFixed(2)}:</b>  `;
  const mods = [`sim-clog__line--${side}`, o.mods || ''].filter(Boolean).join(' ');
  return `<li class="sim-clog__line ${mods}"><span class="sim-clog__msg">${prefix}${body}</span></li>`;
}

/** @param {string} label */
function group(label) {
  return `<li class="sim-log-ui__group">${label}</li>`;
}

/** Player crit is #c10200, opponent #ff9795 — the side comes from the row class */
function crit(value) {
  return `<strong class="sim-clog__crit">${value}</strong>`;
}

/**
 * @param {{ root: string }} opts
 * @returns {string} <li> markup for .sim-clog__list
 */
export function logSpecimens({ root }) {
  const R = root.endsWith('/') ? root : `${root}/`;
  const ic = makeIcon(R);
  const out = [];

  out.push(group('Damage — LOG_DealDamage / LOG_CriticalDamage / LOG_MissedAttack'));
  out.push(line(0.6, 'Dealt 12 damage (Hungry Blade).'));
  out.push(line(1.2, `Dealt ${crit('18')} critical damage (Hungry Blade).`));
  out.push(line(1.8, 'Missed an attack (Broom).'));
  out.push(line(2.0, 'Dealt 13 damage (Training Dummy).', { side: 'opp' }));
  out.push(line(2.4, `Dealt ${crit('22')} critical damage (Training Dummy).`, { side: 'opp' }));
  out.push(line(2.6, 'Missed an attack (Training Dummy).', { side: 'opp' }));

  out.push(group('Health — LoseHealth / Health / TemporaryMaxHealth / Reincarnate'));
  out.push(line(3.0, `Lost 7 health (${ic('poison')}).`));
  out.push(line(3.2, `Regenerated 3 health (${ic('vampirism')}).`));
  out.push(line(3.4, `Regenerated 2 health (${ic('regeneration')}).`));
  out.push(line(3.6, "Regenerated 4 health (Lovers' Blade)."));
  out.push(line(3.8, 'Gained 5 maximum health (Piggybank).'));
  out.push(line(4.0, 'Lost 5 maximum health (Fatigue).'));
  out.push(line(4.2, 'Reincarnated with 10 health (Phoenix).'));

  out.push(group('Stamina — LOG_Stamina / LOG_DrainStamina / LOG_OutofStamina'));
  out.push(line(4.4, 'Regenerated 1.5 stamina (Fanny Pack).'));
  out.push(line(4.6, 'Removed 2 stamina (Vampiric Cleaver).'));
  out.push(line(4.8, 'Out of stamina (Torch).'));

  out.push(group('Buff verbs — GAIN / LOSE / USE / TIMEOUT / NULLIFY / PROTECT'));
  out.push(line(5.0, `Gained 3 ${ic('block')} (Wooden Buckler).`));
  out.push(line(5.2, `Gained 2 ${ic('heat')} for 4s (Torch).`));
  out.push(line(5.4, `Removed 2 ${ic('block')} (Broom).`));
  out.push(line(5.6, `Lost 1 ${ic('mana')} (Magic Staff).`));
  out.push(line(5.8, `Used 3 ${ic('mana')} (Magic Staff).`));
  out.push(line(6.0, `2 ${ic('block')} timed out (Wooden Buckler).`));
  out.push(line(6.2, `1 ${ic('lucky')} nullified (Pocket Sand).`));
  out.push(line(6.4, `2 ${ic('block')} protected from removal (Fortress).`));

  out.push(group('Debuff verbs — INFLICT / SELF / CLEANSE / RESIST / REFLECT / PROTECT'));
  out.push(line(6.6, `Inflicted 4 ${ic('poison')} (Poisonous Mushroom).`));
  out.push(line(6.8, `Inflicted 2 ${ic('cold')} for 3s (Ice Cube).`));
  out.push(line(7.0, `Self-inflicted 1 ${ic('blind')} (Pocket Sand).`));
  out.push(line(7.2, `Self-inflicted 2 ${ic('poison')} for 5s (Poisonous Mushroom).`));
  out.push(line(7.4, `Cleansed 2 ${ic('poison')} (Cleansing Flame).`));
  out.push(line(7.6, `3 ${ic('poison')} resisted (Gaia Bloom).`));
  out.push(line(7.8, `2 reflected ${ic('poison')} resisted (Mirror).`));
  out.push(line(8.0, `2 ${ic('poison')} reflected (Mirror).`, { side: 'opp' }));
  out.push(line(8.2, `2 ${ic('cold')} reflected for 3s (Mirror).`, { side: 'opp' }));
  out.push(line(8.4, `1 ${ic('cold')} protected from cleansing (Ice Cube).`));

  out.push(group('Every buff — gained / lost'));
  let t = 9.0;
  for (const key of BUFFS) {
    out.push(line(t, `Gained 2 ${ic(key)} (Specimen).`));
    t += 0.05;
    out.push(line(t, `Lost 1 ${ic(key)} (Specimen).`));
    t += 0.05;
  }

  out.push(group('Every debuff — inflicted / cleansed'));
  for (const key of DEBUFFS) {
    out.push(line(t, `Inflicted 2 ${ic(key)} (Specimen).`, { side: 'opp' }));
    t += 0.05;
    out.push(line(t, `Cleansed 1 ${ic(key)} (Specimen).`));
    t += 0.05;
  }

  out.push(group('Other event types'));
  out.push(line(11.0, 'Torch gained +2 damage (Torch).'));
  out.push(line(11.2, 'Stunned for 1.5s (Hammer).', { side: 'opp' }));
  out.push(line(11.4, 'Stun resisted (Helmet).'));
  out.push(line(11.6, 'Entered Battle Rage for 5s (Battle Rage).'));
  out.push(line(11.8, 'Battle Rage ended.'));
  out.push(line(12.0, 'Gained invulnerability for 2s (Holy Shield).'));
  out.push(line(12.2, 'Invulnerability ended (Holy Shield).'));
  out.push(line(12.4, 'Round won.'));

  out.push(group('Activations — Hide / Minimize / Show states'));
  out.push(line(0.0, 'Hungry Blade activated.', { mods: 'sim-clog__line--activation' }));
  out.push(
    line(0.0, 'Piggybank activated.', {
      mods: 'sim-clog__line--activation is-minimized',
    }),
  );

  out.push(group('Replay + hover states'));
  out.push(line(12.6, 'Dealt 9 damage (Hungry Blade).', { mods: 'is-past' }));
  out.push(line(12.8, 'Dealt 9 damage (Hungry Blade).', { mods: 'is-active' }));
  out.push(line(13.0, 'Dealt 9 damage (Hungry Blade).', { mods: 'is-hover' }));
  out.push(line(13.2, 'Dealt 13 damage (Training Dummy).', { side: 'opp', mods: 'is-active' }));

  out.push(group('Nested children (CombatEvent depth)'));
  out.push(line(13.4, 'Dealt 6 damage (Bloodthorne).'));
  out.push(
    line(13.4, `Regenerated 3 health (${ic('vampirism')}).`, {
      mods: 'sim-clog__line--sub',
      depth: 1,
    }),
  );
  out.push(
    line(13.4, `Lost 1 health (${statIcon(R, 'Unhealing.png')}).`, {
      mods: 'sim-clog__line--sub sim-clog__line--sub2',
      depth: 2,
    }),
  );
  out.push(
    line(13.4, `Gained 1 ${ic('heat')} (Torch).`, {
      mods: 'sim-clog__line--sub',
      depth: 3,
    }),
  );

  out.push(group('No CSV template in the extract — wording unverified'));
  out.push(line(14.0, `Healing increased by ${statIcon(R, 'HealEfficiency.png')} 6% (Sponge).`));
  out.push(
    line(14.2, `Damage reduced by ${statIcon(R, 'DamageResistance.png')} 4% (Armor).`, {
      side: 'opp',
    }),
  );
  out.push(line(14.4, 'Attack speed increased by 10% (Whetstone).'));
  out.push(line(14.6, 'Cooldown advanced by 0.5s (Gearhead).'));
  out.push(line(14.8, `Critical resisted (${statIcon(R, 'CritResistance.png')}).`));

  return out.join('\n');
}

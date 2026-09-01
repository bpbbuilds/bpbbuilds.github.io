/**
 * Shared: convert Backpack Battles description templates → tooltip plain tags.
 * Used by extract-game-descr / import-game-descr.
 */

/** Common stack / resource tokens → tooltip icon tags */
const STACK_TAGS = {
  poison: 'Poison',
  vampirism: 'Vampirism',
  regen: 'Regeneration',
  regeneration: 'Regeneration',
  empower: 'Empower',
  spikes: 'Spikes',
  // Game: $bl = Block icon; $block = block number (see Item.gd insertParameters)
  bl: 'Block',
  luck: 'Luck',
  lucky: 'Luck',
  mana: 'Mana',
  heat: 'Heat',
  cold: 'Cold',
  blind: 'Blind',
  stamina: 'Stamina',
  stars: 'Star',
  star: 'Star',
  effect: 'Effect',
  melee: 'Melee',
  ranged: 'Ranged',
  magic: 'Magic',
  holy: 'Holy',
  dark: 'Dark',
  nature: 'Nature',
  food: 'Food',
  pet: 'Pet',
  weapon: 'Weapon',
  armor: 'Armor',
  bag: 'Bag',
  gem: 'Gem',
  potion: 'Potion',
  treasure: 'Treasure',
  lightning: 'Lightning',
  engineer: 'Engineer',
  musical: 'Musical',
  fire: 'Fire',
  ice: 'Ice',
  vampiric: 'Vampiric',
};

/**
 * Replace `$name[…]` with balanced brackets (handles `$t[$h[Foo]:]`).
 * @param {string} s
 * @param {RegExp} nameRe name part only, e.g. /t1?|m/ or /h/i
 * @param {(name: string, inner: string, offset: number, whole: string) => string} fn
 */
function replaceDollarBrackets(s, nameRe, fn) {
  const re = new RegExp(`\\$(${nameRe.source})\\[`, nameRe.flags.includes('i') ? 'gi' : 'g');
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(s)) !== null) {
    const start = m.index;
    const name = m[1];
    let depth = 1;
    let j = start + m[0].length;
    while (j < s.length && depth > 0) {
      const ch = s[j++];
      if (ch === '[') depth += 1;
      else if (ch === ']') depth -= 1;
    }
    if (depth !== 0) break;
    const inner = s.slice(start + m[0].length, j - 1);
    out += s.slice(last, start);
    out += fn(name, inner, start, s);
    last = j;
    re.lastIndex = j;
  }
  out += s.slice(last);
  return out;
}

/**
 * @param {string} template raw game DESCR
 * @param {object} item game-items row (params, cooldown, chance, damageMin, …)
 */
export function gameTemplateToPlain(template, item = {}) {
  let s = String(template || '');
  if (!s) return '';

  s = s.replace(/\r\n/g, '\n');
  // Game maps \~ → \n, but many DESCR strings place it mid-clause (e.g. Broom
  // "Gain \~+$p1 …"). Ability blocks are separated by a later $t[…] label instead.
  s = s.replace(/\\~/g, '');
  s = s.replace(/\\n/g, '\n');

  // $t[Label:] / $t1[…] / $m[…] → label text (+ blank line before if mid-string)
  s = replaceDollarBrackets(s, /t1?|m/, (_name, inner, offset, whole) => {
    const label = inner.trim();
    const before = String(whole).slice(0, offset).replace(/\s+$/u, '');
    if (!before) return label;
    if (/\n\n$/u.test(String(whole).slice(0, offset))) return label;
    return `\n\n${label}`;
  });

  // $h[value] → plain value (tooltip golds numbers). Must be balanced (nested rare).
  s = replaceDollarBrackets(s, /h/i, (_name, inner) => inner);

  // $c[…] mode colors — keep inner text
  s = replaceDollarBrackets(s, /c/i, (_name, inner) => inner);

  // $red[…] / $green[…] — game text color wraps (NOT icons). Park until $tokens resolve.
  s = replaceDollarBrackets(s, /red|green|blue/i, (color, inner) => {
    return `{{${color.toLowerCase()}:${inner}}}`;
  });

  const params = item.params && typeof item.params === 'object' ? item.params : {};
  const allCds = [
    item.cooldown,
    ...(Array.isArray(item.extraCooldowns) ? item.extraCooldowns : []),
  ].filter((v) => v != null && v !== '');

  const shopChance =
    item.shopChance != null
      ? item.shopChance
      : item.shop_chance != null
        ? item.shop_chance
        : null;

  const values = {
    dam: item.damageMin != null ? item.damageMin : null,
    cd: allCds[0] != null ? allCds[0] : null,
    cds: allCds[0] != null ? `${allCds[0]}s` : null,
    chance: item.chance != null ? item.chance : null,
    chance2: item.chance2 != null ? item.chance2 : null,
    shopchance: shopChance,
    stamina: item.staminaCost != null ? item.staminaCost : null,
    // Game: $block = number, $bl = <Block> icon (Util.icons["bl"])
    block: item.block != null ? item.block : null,
  };

  // Multi-cooldown: $cd1 / $cd1s … $cd5 / $cd5s (Laboratory etc.)
  for (let i = 0; i < allCds.length; i += 1) {
    const n = i + 1;
    values[`cd${n}`] = allCds[i];
    values[`cd${n}s`] = `${allCds[i]}s`;
  }

  // Named params: $p_poisont, $p_stamina, $p_durs …
  for (const [name, val] of Object.entries(params)) {
    if (/^p\d+$/i.test(name)) continue;
    values[`p_${name}`] = val;
    values[`p_${name}s`] = `${val}s`;
  }
  // Indexed $p1…$p10 / $p1s…
  // 1) Explicit pN from CSV columns (extract writes pN + named key).
  // 2) Fill holes from named params in insertion order (Critwood: mana→p1,
  //    p2 already set, dur→p3). Never reshuffle when every pN is present.
  for (let i = 1; i <= 10; i++) {
    if (params[`p${i}`] != null && params[`p${i}`] !== '') {
      values[`p${i}`] = params[`p${i}`];
    }
  }
  const namedEntries = Object.entries(params).filter(([k]) => !/^p\d+$/i.test(k));
  let ni = 0;
  for (let i = 1; i <= 10; i++) {
    if (values[`p${i}`] != null && values[`p${i}`] !== '') continue;
    if (ni >= namedEntries.length) break;
    values[`p${i}`] = namedEntries[ni][1];
    ni += 1;
  }
  for (let i = 1; i <= 10; i++) {
    if (values[`p${i}`] != null && values[`p${i}`] !== '') {
      values[`p${i}s`] = `${values[`p${i}`]}s`;
    }
  }

  // Longer keys first so $p2s before $p2, $cds before $cd, $p_stamina before $p1, etc.
  const keys = Object.keys(values)
    .filter((k) => values[k] != null && values[k] !== '')
    .sort((a, b) => b.length - a.length);

  for (const key of keys) {
    const re = new RegExp(`\\$${key}(?![A-Za-z0-9_])`, 'g');
    s = s.replace(re, String(values[key]));
  }

  // Adjacency: game Util.icons affected / affected2 / affected3 (star tiers)
  s = s.replace(/\$affected3\b/g, '<Star3>');
  s = s.replace(/\$affected2\b/g, '<Star2>');
  s = s.replace(/\$affected\b/g, '<Star>');

  // Sloth: game replaces $s[…$s] with [shake]…[/shake] — keep readable plain text
  s = s.replace(/\$s\[([^\]]*?)\$s\]/g, '$1');
  s = s.replace(/\$s\[([^\]]*)\]/g, '$1');

  // $-item type suffixes: $holy-item → <Holy> item
  s = s.replace(/\$([a-zA-Z][a-zA-Z0-9]*)-item\b/g, (_, name) => {
    const tag = STACK_TAGS[name.toLowerCase()] || capitalize(name);
    return `<${tag}> item`;
  });

  // Tooltip.gd `keywords` that are NOT in Util.icons → colored text, not <Icon>
  // (rage, fatigue, stun, …). Rarity enum wraps are also plain text.
  const TEXT_KEYWORDS = new Set([
    'rage',
    'fatigue',
    'stun',
    'reflect',
    'charge',
    'blindinglight',
    'empty',
    'common',
    'rare',
    'epic',
    'legendary',
    'godly',
    'unique',
  ]);

  // $Food[Food] / $rage[Battle Rage] / $Weapon[Weapons] → icon (+ optional display word)
  // $charge[4 charges] / $epic[Epic] → plain (colored keyword / rarity in game)
  s = replaceDollarBrackets(s, /[A-Za-z][A-Za-z0-9_]*/, (name, inner) => {
    const lower = name.toLowerCase();
    const label = String(inner).trim();
    if (TEXT_KEYWORDS.has(lower)) {
      return label || capitalize(name);
    }
    const tag = STACK_TAGS[lower] || capitalize(name);
    if (!label || label.toLowerCase() === lower || label.toLowerCase() === tag.toLowerCase()) {
      return `<${tag}>`;
    }
    return `<${tag}> ${label}`;
  });

  // Remaining $tokens → icons / words
  s = s.replace(/\$([a-zA-Z][a-zA-Z0-9_]*)\b/g, (_, name) => {
    const lower = name.toLowerCase();
    if (TEXT_KEYWORDS.has(lower)) return capitalize(name);
    if (STACK_TAGS[lower]) return `<${STACK_TAGS[lower]}>`;
    // leftover unresolved params — leave readable
    if (lower.startsWith('p_') || /^p\d+s?$/.test(lower)) return name;
    return `<${capitalize(name)}>`;
  });

  // Restore color wraps for the tooltip renderer: {red}…{/red}
  s = s.replace(/\{\{(red|green|blue):([\s\S]*?)\}\}/g, (_, color, inner) => {
    return `{${color}}${String(inner).trim()}{/${color}}`;
  });

  // "$h[1]$lightning" → "1<Lightning>" — keep a readable gap before the icon
  s = s.replace(/(\d)<([A-Za-z])/g, '$1 <$2');

  // Clean spacing / bullets
  s = s.replace(/[ \t]+\n/g, '\n');
  s = s
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n');
  s = s.replace(/\n{3,}/g, '\n\n').trim();

  return s;
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Gem tier name → shared DESCR key */
export function gemDescrKey(itemName) {
  const n = String(itemName || '');
  for (const gem of ['Ruby', 'Sapphire', 'Emerald', 'Topaz', 'Amethyst']) {
    if (n.endsWith(gem)) return gem;
  }
  return null;
}

export function normKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

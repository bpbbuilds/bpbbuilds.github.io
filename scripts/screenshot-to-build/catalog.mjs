import fs from 'fs';
import path from 'path';
import pg from 'pg';

const ROOT = process.cwd();

/** Common vision misspellings / shorthand → catalog name */
export const NAME_ALIASES = {
  chest: 'Treasure Chest',
  treasurechest: 'Treasure Chest',
  lootbox: 'Treasure Chest',
  magicshard: 'Corrupted Crystal',
  purpleshard: 'Corrupted Crystal',
  purplecrystal: 'Corrupted Crystal',
  manashard: 'Mana Crystal',
  star: 'Star of Courage',
  goldstar: 'Star of Courage',
  shield: 'Magic Mirror',
  silverplate: 'Magic Mirror',
  silvershield: 'Magic Mirror',
  gloves: 'Gloves of Haste',
  glovesofhaste: 'Gloves of Haste',
  hastengloves: 'Gloves of Haste',
  piggy: 'Piggybank',
  piggybank: 'Piggybank',
  darksaber: 'Darksaber',
  darksabre: 'Darksaber',
  lightsaber: 'Lightsaber',
  falcon: 'Falcon Blade',
  falconblade: 'Falcon Blade',
  wingedsword: 'Falcon Blade',
  wingedblade: 'Falcon Blade',
};

/**
 * @returns {Record<string, string>}
 */
export function loadEnv() {
  return Object.fromEntries(
    fs
      .readFileSync(path.join(ROOT, '.env'), 'utf8')
      .split(/\r?\n/)
      .filter((l) => l && !l.trim().startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
}

/**
 * @param {string} s
 */
export function normName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * @typedef {{ id: string, name: string, image: string, thumbPath: string | null, spritePath: string | null }} CatalogItem
 */

/**
 * @param {Record<string, string>} env
 * @returns {Promise<CatalogItem[]>}
 */
export async function loadCatalog(env) {
  const base = new URL(env.SUPABASE_DB_URL);
  if (!env.SUPABASE_DB_PASSWORD) throw new Error('missing SUPABASE_DB_PASSWORD');
  const connectionString =
    `postgresql://${encodeURIComponent(base.username)}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}` +
    `@${base.hostname}:${base.port || 5432}${base.pathname}`;
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const { rows } = await client.query(
      `select id, name, image
       from public.items
       where coalesce(image, '') <> ''
       order by name`,
    );
    /** @type {CatalogItem[]} */
    const items = [];
    for (const row of rows) {
      const image = String(row.image || '')
        .replace(/^.*\//, '')
        .trim();
      const stem = image.replace(/\.(png|webp|jpg)$/i, '');
      if (!stem) continue;
      const thumbPath = path.join(ROOT, 'assets/item-thumbs/1x', `${stem}.webp`);
      const spritePath = path.join(ROOT, 'assets/item-sprites', `${stem}.png`);
      items.push({
        id: String(row.id),
        name: String(row.name || stem),
        image: stem,
        thumbPath: fs.existsSync(thumbPath) ? thumbPath : null,
        spritePath: fs.existsSync(spritePath) ? spritePath : null,
      });
    }
    return items;
  } finally {
    await client.end();
  }
}

/**
 * @param {string} raw
 * @param {CatalogItem[]} catalog
 * @param {Map<string, CatalogItem>} byNorm
 */
export function resolveToCatalog(raw, catalog, byNorm) {
  let n = normName(raw);
  if (!n) return null;
  if (NAME_ALIASES[n]) n = normName(NAME_ALIASES[n]);
  if (byNorm.has(n)) return byNorm.get(n);

  const byId = catalog.find((c) => c.id === raw || normName(c.id) === n);
  if (byId) return byId;

  /** @type {{ item: CatalogItem, score: number }[]} */
  const hits = [];
  for (const c of catalog) {
    const cn = normName(c.name);
    if (!cn) continue;
    if (cn === n) return c;
    if (cn.startsWith(n) && n.length >= 4) {
      const rest = cn.slice(n.length);
      if (rest.length <= 2) continue;
      hits.push({ item: c, score: n.length / cn.length });
      continue;
    }
    if (n.startsWith(cn) && cn.length >= 5) {
      hits.push({ item: c, score: cn.length / n.length });
      continue;
    }
    if (cn.includes(n) && n.length >= 5) {
      hits.push({ item: c, score: (n.length / cn.length) * 0.85 });
    } else if (n.includes(cn) && cn.length >= 5) {
      hits.push({ item: c, score: (cn.length / n.length) * 0.85 });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits[0] && hits[0].score >= 0.55 ? hits[0].item : null;
}

export { ROOT };

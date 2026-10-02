/**
 * Load catalog + build layouts for synth generation.
 */
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { ROOT, loadEnv, loadCatalog } from '../screenshot-to-build/catalog.mjs';

/**
 * @param {Record<string, string>} env
 * @returns {Promise<{ id: string, name: string, image: string, type: string, spritePath: string | null, thumbPath: string | null }[]>}
 */
export async function loadCatalogWithTypes(env) {
  const base = new URL(env.SUPABASE_DB_URL);
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
      `select id, name, image, coalesce(type, '') as type
       from public.items
       where coalesce(image, '') <> ''
       order by name`,
    );
    return rows.map((row) => {
      const image = String(row.image || '')
        .replace(/^.*\//, '')
        .replace(/\.(png|webp|jpg)$/i, '');
      const spritePath = path.join(ROOT, 'assets/item-sprites', `${image}.png`);
      const thumbPath = path.join(ROOT, 'assets/item-thumbs/1x', `${image}.webp`);
      return {
        id: String(row.id),
        name: String(row.name || image),
        image,
        type: String(row.type || ''),
        spritePath: fs.existsSync(spritePath) ? spritePath : null,
        thumbPath: fs.existsSync(thumbPath) ? thumbPath : null,
      };
    });
  } finally {
    await client.end();
  }
}

/**
 * @param {Record<string, string>} env
 * @returns {Promise<{ buildId: number, slug: string, placements: { id: string, x: number, y: number, r: number }[] }[]>}
 */
export async function loadBuildLayouts(env) {
  const base = new URL(env.SUPABASE_DB_URL);
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
      `select b.id as build_id, b.slug,
              p.item_id, p.x, p.y, coalesce(p.r, 0) as r
       from public.builds b
       join public.build_placements p on p.build_id = b.id
       order by b.id, p.id`,
    );
    /** @type {Map<number, { buildId: number, slug: string, placements: { id: string, x: number, y: number, r: number }[] }>} */
    const byBuild = new Map();
    for (const row of rows) {
      const bid = Number(row.build_id);
      if (!byBuild.has(bid)) {
        byBuild.set(bid, {
          buildId: bid,
          slug: String(row.slug || bid),
          placements: [],
        });
      }
      byBuild.get(bid).placements.push({
        id: String(row.item_id),
        x: Math.round(Number(row.x) || 0),
        y: Math.round(Number(row.y) || 0),
        r: ((Math.round(Number(row.r) || 0) % 4) + 4) % 4,
      });
    }
    return [...byBuild.values()].filter((b) => b.placements.length > 0);
  } finally {
    await client.end();
  }
}

export { loadEnv, ROOT };

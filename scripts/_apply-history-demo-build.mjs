/**
 * Seed infinite-combo-machine from assets/data/history-demo-run.json
 * (decoded from the player's Steam history.db).
 *
 * Run: node scripts/_apply-history-demo-build.mjs
 */
import fs from 'fs';
import pg from 'pg';

const env = Object.fromEntries(
  fs
    .readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const base = new URL(env.SUPABASE_DB_URL);
const connectionString =
  `postgresql://${encodeURIComponent(base.username)}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}` +
  `@${base.hostname}:${base.port || 5432}${base.pathname}`;

const demo = JSON.parse(fs.readFileSync('assets/data/history-demo-run.json', 'utf8'));
const final = demo.rounds[demo.rounds.length - 1];
const SLUG = 'infinite-combo-machine';

function priorityFor(type) {
  if (type === 'Bag') return null;
  if (
    type === 'Pet' ||
    type === 'Skill' ||
    String(type).includes('Weapon') ||
    type === 'Spell'
  ) {
    return 'needed';
  }
  if (type === 'Accessory' || type === 'Armor' || type === 'Food') return 'nice';
  return 'optional';
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  const { rows: builds } = await client.query(
    `select id from public.builds where slug = $1`,
    [SLUG],
  );
  if (!builds.length) throw new Error(`build ${SLUG} not found`);
  const buildId = builds[0].id;

  const ids = [
    ...new Set(
      final.placements
        .flatMap((p) => [p.id, ...(Array.isArray(p.gems) ? p.gems : [])])
        .filter(Boolean),
    ),
  ];
  const { rows: items } = await client.query(
    `select id, type, gid from public.items where id = any($1)`,
    [ids],
  );
  const byId = new Map(items.map((r) => [r.id, r]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) console.warn('missing items (skipped):', missing.join(', '));

  // Route skills by gid
  const skillGids = [demo.skill1Gid, demo.skill2Gid].filter((g) => g != null);
  const { rows: skillRows } = await client.query(
    `select id, gid from public.items where gid = any($1)`,
    [skillGids],
  );
  const skillByGid = new Map(skillRows.map((r) => [r.gid, r.id]));

  await client.query(
    `update public.builds set
       title = $2,
       hero_class = $3,
       blurb = $4,
       notes = $5,
       gold_count = $6,
       rank = $7,
       route_r3_item_id = $8,
       route_r10_item_id = $9,
       updated_at = now()
     where id = $1`,
    [
      buildId,
      `History ${demo.heroClass} — run ${demo.runId}`,
      demo.heroClass,
      'Real board imported from history.db (most recent run).',
      demo.notes || `Imported from history.db run ${demo.runId}.`,
      demo.goldCount,
      demo.rank,
      skillByGid.get(demo.skill1Gid) || null,
      skillByGid.get(demo.skill2Gid) || null,
    ],
  );

  await client.query(`delete from public.build_placements where build_id = $1`, [buildId]);

  let n = 0;
  for (const p of final.placements) {
    const item = byId.get(p.id);
    if (!item) continue;
    const gems = Array.isArray(p.gems) ? p.gems : [];
    await client.query(
      `insert into public.build_placements (build_id, item_id, gid, x, y, r, gems, priority)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [
        buildId,
        p.id,
        p.gid ?? item.gid,
        p.x,
        p.y,
        p.r ?? 0,
        JSON.stringify(gems),
        priorityFor(item.type),
      ],
    );
    n += 1;
  }

  console.log(`seeded ${SLUG}: ${n} placements, gold=${demo.goldCount}, rank=${demo.rank}`);
  console.log(`skills R3=${skillByGid.get(demo.skill1Gid)} R10=${skillByGid.get(demo.skill2Gid)}`);
} finally {
  await client.end();
}

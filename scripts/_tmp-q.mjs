import fs from "node:fs"; import path from "node:path"; import pg from "pg";
const env={}; for(const l of fs.readFileSync(".env","utf8").split(/\r?\n/)){const m=/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l); if(m) env[m[1]]=m[2].trim().replace(/^["']|["']$/g,"");}
const base=new URL(env.SUPABASE_DB_URL);
const c=new pg.Client({connectionString:`postgresql://${encodeURIComponent(base.username)}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@${base.hostname}:${base.port||5432}${base.pathname}`, ssl:{rejectUnauthorized:false}});
await c.connect();
const ids=["magic_ring","superior_ring","shortbow","wooden_sword","hungry_blade"];
const {rows}=await c.query("select id, name, effect, params, extra_types, tags, release_state, game_version from public.items where id = any($1)",[ids]);
for(const r of rows) console.log("=== "+r.id+" ("+r.name+")\n"+JSON.stringify(r.effect)+"\n  release="+r.release_state+" ver="+r.game_version+" extra="+JSON.stringify(r.extra_types)+" tags="+JSON.stringify(r.tags));
const {rows:rs}=await c.query("select release_state, count(*) from public.items group by 1 order by 2 desc");
console.log("release states:", JSON.stringify(rs));
await c.end();

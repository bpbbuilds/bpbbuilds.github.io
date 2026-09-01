/**
 * Thorough audit of every item description + tooltip icon resolution.
 *
 * Checks:
 *  - converter / param / ability-break bugs
 *  - keyword-as-icon (Rage/Fatigue/…) — game colored text, no file
 *  - rarity-as-icon (Common/Epic should be text)
 *  - unknown / fake icon tags
 *  - missing local assets for LOCAL_TOOLTIP_ICONS
 *  - CDN/local resolve for every <Tag> used in effects
 *  - render simulation: %%ICO token leaks after gold-number pass
 *  - glued digit+icon (1<Lightning>), adjacent-and-adjacent
 *  - live DB effect vs cache (when .env present)
 *
 *   node scripts/audit-item-descriptions.mjs
 *
 * Writes scripts/_cache/descr-audit-report.json
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { gameTemplateToPlain, normKey } from './lib/game-descr.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(__dirname, '_cache');
const OUT = path.join(CACHE, 'descr-audit-report.json');
const CDN = 'https://awerc.github.io/bpb-cdn';

/** Failed param leftovers that became fake icons */
const FAKE_ICON_TAGS = new Set([
  'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10',
  'P1s', 'P2s', 'P3s', 'P4s', 'P5s',
  'Shopchance', 'ShopChance', 'Cds', 'Cd', 'Dam',
  'Red', 'Green', 'Blue',
  'Affected', 'Affected2', 'Affected3',
  'S', // Sloth $s leftover
]);

/**
 * Game Util.icons keys (PascalCase as tooltip tags).
 * These are the only tags that should render as images in effect text.
 */
const GAME_ICON_TAGS = new Set([
  'Gold', 'Spikes', 'Vampirism', 'Poison', 'Regeneration', 'Block', 'Luck',
  'Blind', 'Mana', 'Heat', 'Cold', 'Empower', 'Melee', 'Ranged', 'Effect',
  'Dark', 'Holy', 'Nature', 'Vampiric', 'Fire', 'Ice', 'Magic', 'Treasure',
  'Musical', 'Lightning', 'Engineer',
  // Site adjacency / stacks sometimes used
  'Star', 'Star2', 'Star3', 'Stamina',
]);

/** Tooltip.gd keywords that are NOT in Util.icons → plain/colored text */
const TEXT_ONLY_KEYWORDS = new Set([
  'Rage', 'Fatigue', 'Stun', 'Reflect', 'Charge', 'Empty',
]);

const RARITY_TEXT_TAGS = new Set([
  'Common', 'Rare', 'Epic', 'Legendary', 'Godly', 'Unique',
]);

/** Mirrors tooltip.js ICON_ALIAS + LOCAL_TOOLTIP_ICONS + LOCAL_ICONS */
const ICON_ALIAS = {
  Bl: 'Block',
  bl: 'Block',
  Regen: 'Regeneration',
  Lucky: 'Luck',
  Shopchance: 'Luck',
  ShopChance: 'Luck',
  Food: 'Nature',
};

const LOCAL_TOOLTIP_ICONS = new Set([
  'Damage', 'Cooldown', 'Stamina', 'Accuracy', 'CritChance', 'Block', 'Effect',
  'Melee', 'Ranged', 'Magic', 'Holy', 'Dark', 'Nature', 'Fire', 'Ice',
  'Vampiric', 'Treasure', 'Musical', 'Gold', 'Lightning', 'Engineer',
  'Star', 'Star2', 'Star3',
]);

const LOCAL_ICON_PATHS = {
  Stamina: 'assets/tooltips/icons/Stamina.png',
  Block: 'assets/icons/tooltip/Block.png',
  Gold: 'assets/tooltips/icons/Gold.png',
};

/** Tags we allow that are not game icons (wording / type nouns → often no sprite) */
const SOFT_WORD_TAGS = new Set([
  'Food', 'Pet', 'Weapon', 'Armor', 'Bag', 'Gem', 'Potion',
]);

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(CACHE, name), 'utf8'));
}

function loadEnv() {
  const p = path.join(ROOT, '.env');
  if (!fs.existsSync(p)) return null;
  return Object.fromEntries(
    fs
      .readFileSync(p, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l && !l.trim().startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
}

function fileExists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function resolveIconPath(tag) {
  const aliased = ICON_ALIAS[tag] || tag;
  if (LOCAL_TOOLTIP_ICONS.has(aliased) || aliased === 'Gold') {
    const rel =
      LOCAL_ICON_PATHS[aliased] || `assets/tooltips/icons/${aliased}.png`;
    return { kind: 'local', aliased, rel, ok: fileExists(rel) };
  }
  if (LOCAL_ICON_PATHS[aliased] || LOCAL_ICON_PATHS[tag]) {
    const rel = LOCAL_ICON_PATHS[aliased] || LOCAL_ICON_PATHS[tag];
    return { kind: 'local', aliased, rel, ok: fileExists(rel) };
  }
  // Status icons in repo (CDN fallback target often mirrors these)
  const statusRel = `assets/icons/status/Icon_${aliased === 'Luck' ? 'Lucky' : aliased}.png`;
  if (fileExists(statusRel)) {
    return { kind: 'local-status', aliased, rel: statusRel, ok: true };
  }
  return { kind: 'cdn', aliased, rel: `${CDN}/icons/${aliased}.webp`, ok: null };
}

/** Mirror tooltip.js gold-number + icon park/restore (catch token leaks). */
function simulateFormatEffect(raw) {
  let text = String(raw || '');
  const icons = [];
  text = text.replace(/<([A-Za-z][A-Za-z0-9]*)>/g, (_, name) => {
    if (/^(red|green|blue)$/i.test(name)) return '';
    const token = `%%ICO${icons.length}%%`;
    icons.push(name);
    return token;
  });
  text = text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  text = text.replace(/%%ICO\d+%%|(?<![A-Za-z])(\+?\d+(?:\.\d+)?%?)/g, (match, num) => {
    if (match.startsWith('%%ICO')) return match;
    return `<n>${num}</n>`;
  });
  const beforeRestore = text;
  text = text.replace(/%%ICO(\d+)%%/g, (_, i) => {
    const name = icons[Number(i)];
    return name ? `<img:${name}>` : 'MISSING';
  });
  const leaked = [...beforeRestore.matchAll(/%%ICO[^%]*%%/g)].map((m) => m[0]);
  const stillLeaked = [...text.matchAll(/%%ICO[^%]*%%/g)].map((m) => m[0]);
  return {
    iconCount: icons.length,
    leakedTokens: [...new Set([...leaked.filter((t) => !/^%%ICO\d+%%$/.test(t)), ...stillLeaked])],
    missingSlots: (text.match(/MISSING/g) || []).length,
  };
}

function extractTags(text) {
  return [...String(text || '').matchAll(/<([A-Za-z][A-Za-z0-9]*)>/g)].map((m) => m[1]);
}

function issuesForEffect(effect, item, template, assetCache) {
  const issues = [];
  const text = String(effect || '');
  if (!text.trim() || text === '-' || text === '—' || text === '–') {
    issues.push({ code: 'empty_effect', detail: 'effect is empty' });
    return issues;
  }

  const dollars = [...text.matchAll(/\$[A-Za-z][A-Za-z0-9_]*/g)].map((m) => m[0]);
  if (dollars.length) {
    issues.push({ code: 'unresolved_dollar', detail: [...new Set(dollars)].join(', ') });
  }

  if (/\bp_\w+\b/.test(text) || /(?<![<\w])p\d+s?\b/.test(text)) {
    const hits = [
      ...text.matchAll(/\bp_\w+\b/g),
      ...text.matchAll(/(?<![<\w])p\d+s?\b/g),
    ].map((m) => m[0]);
    issues.push({ code: 'bare_param', detail: [...new Set(hits)].join(', ') });
  }

  const tags = extractTags(text);

  const fake = tags.filter((t) => FAKE_ICON_TAGS.has(t));
  if (fake.length) {
    issues.push({ code: 'fake_icon_tag', detail: [...new Set(fake)].join(', ') });
  }

  const textAsIcon = tags.filter((t) => TEXT_ONLY_KEYWORDS.has(t));
  if (textAsIcon.length) {
    issues.push({
      code: 'keyword_as_icon',
      detail: [...new Set(textAsIcon)].join(', '),
    });
  }

  const rarityAsIcon = tags.filter((t) => RARITY_TEXT_TAGS.has(t));
  if (rarityAsIcon.length) {
    issues.push({
      code: 'rarity_as_icon',
      detail: [...new Set(rarityAsIcon)].join(', ') + ' (should be plain/colored text)',
    });
  }

  const unknown = [];
  const missingAsset = [];
  for (const t of [...new Set(tags)]) {
    if (FAKE_ICON_TAGS.has(t) || TEXT_ONLY_KEYWORDS.has(t) || RARITY_TEXT_TAGS.has(t)) continue;
    if (/^(Red|Green|Blue)$/i.test(t)) continue;

    const aliased = ICON_ALIAS[t] || t;
    const isGameIcon = GAME_ICON_TAGS.has(aliased) || GAME_ICON_TAGS.has(t);
    const isSoft = SOFT_WORD_TAGS.has(t);

    if (!isGameIcon && !isSoft && !LOCAL_TOOLTIP_ICONS.has(aliased)) {
      unknown.push(t);
    }

    // Resolve asset for anything that will be rendered as <img>
    if (isSoft && !ICON_ALIAS[t] && !GAME_ICON_TAGS.has(t)) {
      // Soft words without alias still become <img> in tooltip.js → broken
      missingAsset.push(`${t} (word-tag, no sprite)`);
      continue;
    }

    const resolved = resolveIconPath(t);
    if (resolved.kind === 'local' || resolved.kind === 'local-status') {
      if (!resolved.ok) missingAsset.push(`${t} → missing ${resolved.rel}`);
    } else if (resolved.kind === 'cdn') {
      const cdnOk = assetCache.get(resolved.aliased);
      if (cdnOk === false) missingAsset.push(`${t} → CDN 404 ${resolved.aliased}.webp`);
      else if (cdnOk == null && !isGameIcon && !isSoft) {
        // unknown + unprobed
        missingAsset.push(`${t} → unprobed ${resolved.aliased}`);
      }
    }
  }
  if (unknown.length) {
    issues.push({ code: 'unknown_icon_tag', detail: [...new Set(unknown)].join(', ') });
  }
  if (missingAsset.length) {
    issues.push({ code: 'missing_icon_asset', detail: [...new Set(missingAsset)].join(', ') });
  }

  // Render simulation
  const sim = simulateFormatEffect(text);
  if (sim.leakedTokens.length || sim.missingSlots) {
    issues.push({
      code: 'ico_token_leak',
      detail: `icons=${sim.iconCount} leaked=${sim.leakedTokens.join('|') || 'none'} missing=${sim.missingSlots}`,
    });
  }
  if (sim.iconCount > 26) {
    // informational — should still pass with numeric tokens
    issues.push({
      code: 'high_icon_count',
      detail: `${sim.iconCount} inline icons (regression risk for token park)`,
      severity: 'info',
    });
  }

  // Glued number/icon: "1<Lightning>"
  if (/\d<[A-Za-z]/.test(text) || />[A-Za-z]/.test(text.replace(/<\/?[a-z]+>/gi, ''))) {
    const glued = [...text.matchAll(/\d(<[A-Za-z][A-Za-z0-9]*>)/g)].map((m) => m[0]);
    if (glued.length) {
      issues.push({ code: 'glued_digit_icon', detail: [...new Set(glued)].join(', ') });
    }
  }

  if (/\badjacent and adjacent\b/i.test(text)) {
    issues.push({
      code: 'ambiguous_adjacent',
      detail: 'both adjacency tiers flattened to "adjacent"',
    });
  }

  if (/\$affected|<(?:Affected)[23]?>/i.test(text)) {
    issues.push({ code: 'unresolved_affected', detail: 'leftover affected token' });
  }

  if (template) {
    const tCount = (String(template).match(/\$t1?\[/g) || []).length;
    const breaks = (text.match(/\n\n/g) || []).length;
    if (tCount >= 2 && breaks < tCount - 1) {
      issues.push({
        code: 'missing_ability_breaks',
        detail: `template $t×${tCount} but effect \\n\\n×${breaks}`,
      });
    }
  }

  const params = item.params && typeof item.params === 'object' ? item.params : {};
  if (params.cd != null && params.cd !== '') {
    const m = text.match(/cooldown to (\d+(?:\.\d+)?)s\b/i);
    if (m && String(m[1]) !== String(params.cd)) {
      issues.push({
        code: 'stale_cd_in_effect',
        detail: `effect has ${m[1]}s but params.cd=${params.cd}`,
      });
    }
  }
  if (params.stamina != null && params.stamina !== '') {
    const m = text.match(/stamina usage to (\d+(?:\.\d+)?)\b/i);
    if (m && String(m[1]) !== String(params.stamina)) {
      issues.push({
        code: 'stale_stamina_in_effect',
        detail: `effect has ${m[1]} but params.stamina=${params.stamina}`,
      });
    }
  }

  if (template) {
    const pRefs = [...String(template).matchAll(/\$p(\d+)(s)?\b/g)];
    const seen = new Set();
    for (const m of pRefs) {
      const n = m[1];
      if (seen.has(n)) continue;
      seen.add(n);
      const has =
        params[`p${n}`] != null ||
        Object.keys(params).filter((k) => !/^p\d+$/i.test(k))[Number(n) - 1] != null;
      if (!has) {
        issues.push({
          code: 'missing_indexed_param',
          detail: `template uses $p${n}${m[2] || ''} but params lack p${n}`,
        });
      }
    }

    // shopchance in template but item.shopChance null
    if (/\$shopchance\b/i.test(template) && (item.shopChance == null || item.shopChance === '')) {
      issues.push({
        code: 'missing_shopchance',
        detail: 'template uses $shopchance but item.shopChance is null',
      });
    }
  }

  if (/\b\d+\s+\d+\s+reached:/i.test(text) || /to\s+<Block>\s+\d+/i.test(text)) {
    issues.push({ code: 'possible_swapped_block', detail: 'looks like $bl/$block swap' });
  }

  if (/%%ICO/i.test(text)) {
    issues.push({ code: 'raw_ico_in_effect', detail: 'effect text contains %%ICO tokens' });
  }

  return issues;
}

async function probeCdn(tags) {
  const cache = new Map();
  const unique = [...new Set(tags.map((t) => ICON_ALIAS[t] || t))];
  const concurrency = 12;
  let i = 0;

  async function worker() {
    while (i < unique.length) {
      const tag = unique[i++];
      const url = `${CDN}/icons/${tag}.webp`;
      try {
        const res = await fetch(url, { method: 'HEAD' });
        cache.set(tag, res.ok);
      } catch {
        cache.set(tag, false);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return cache;
}

async function loadDbEffects() {
  const env = loadEnv();
  if (!env?.SUPABASE_DB_URL || !env?.SUPABASE_DB_PASSWORD) return null;
  const base = new URL(env.SUPABASE_DB_URL);
  const client = new pg.Client({
    connectionString:
      `postgresql://${encodeURIComponent(base.username)}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}` +
      `@${base.hostname}:${base.port || 5432}${base.pathname}`,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const { rows } = await client.query('select id, name, gid, effect from public.items');
    return rows;
  } finally {
    await client.end();
  }
}

function auditLocalTooltipIcons() {
  const missing = [];
  for (const name of LOCAL_TOOLTIP_ICONS) {
    const rel = LOCAL_ICON_PATHS[name] || `assets/tooltips/icons/${name}.png`;
    if (!fileExists(rel)) missing.push(rel);
  }
  return missing;
}

async function main() {
  const itemsFile = loadJson('game-items.json');
  const items = itemsFile.items || itemsFile;
  const byId = new Map(items.map((i) => [i.id, i]));
  const byNorm = new Map();
  for (const i of items) {
    byNorm.set(normKey(i.name), i);
    if (i.displayName) byNorm.set(normKey(i.displayName), i);
    if (i.internalName) byNorm.set(normKey(i.internalName), i);
  }

  const descrFile = loadJson('game-descr.json');
  const descrRows = descrFile.items || descrFile;

  // Collect all tags from fresh converts for CDN probe
  const allTags = new Set();
  const freshById = new Map();
  for (const row of descrRows) {
    const item =
      byId.get(row.id) ||
      byNorm.get(normKey(row.name)) ||
      byNorm.get(normKey(row.descrKey));
    let fresh = row.effect || '';
    if (row.template && item) fresh = gameTemplateToPlain(row.template, item);
    else if (row.template) fresh = gameTemplateToPlain(row.template, { params: {} });
    freshById.set(row.id, fresh);
    for (const t of extractTags(fresh || row.effect || '')) allTags.add(t);
  }

  console.log('Probing CDN for', allTags.size, 'unique tags…');
  const assetCache = await probeCdn([...allTags, ...GAME_ICON_TAGS, ...LOCAL_TOOLTIP_ICONS]);

  const localIconGaps = auditLocalTooltipIcons();

  let dbRows = null;
  try {
    console.log('Loading live DB effects…');
    dbRows = await loadDbEffects();
    console.log('DB rows:', dbRows?.length ?? 0);
  } catch (e) {
    console.warn('DB skip:', e.message);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      descrRows: descrRows.length,
      withTemplate: 0,
      withEffect: 0,
      staleVsReconvert: 0,
      withIssues: 0,
      withInfoOnly: 0,
      dbCompared: 0,
      dbDiverged: 0,
    },
    byCode: {},
    localTooltipIconsMissing: localIconGaps,
    cdnProbe: Object.fromEntries(
      [...assetCache.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    ),
    items: [],
    dbOnlyIssues: [],
  };

  for (const row of descrRows) {
    const item =
      byId.get(row.id) ||
      byNorm.get(normKey(row.name)) ||
      byNorm.get(normKey(row.descrKey));
    const template = row.template || null;
    if (template) report.totals.withTemplate += 1;

    const fresh = freshById.get(row.id) || '';
    if (fresh) report.totals.withEffect += 1;

    const cached = row.effect || '';
    const stale = Boolean(template && cached && cached.trim() !== fresh.trim());
    if (stale) report.totals.staleVsReconvert += 1;

    const issues = issuesForEffect(fresh || cached, item || { params: {} }, template, assetCache);
    if (stale) {
      issues.push({
        code: 'cache_stale',
        detail: 'game-descr.json effect ≠ reconvert with current converter+params',
      });
    }
    if (!template && !cached) {
      issues.push({ code: 'no_template_no_effect', detail: 'no DESCR template and no effect' });
    }

    if (!issues.length) continue;

    const hard = issues.filter((i) => i.severity !== 'info');
    const infoOnly = hard.length === 0;
    if (infoOnly) report.totals.withInfoOnly += 1;
    else report.totals.withIssues += 1;

    for (const iss of issues) {
      report.byCode[iss.code] = (report.byCode[iss.code] || 0) + 1;
    }
    report.items.push({
      id: row.id || item?.id || null,
      name: item?.displayName || item?.name || row.name,
      gid: row.gid ?? item?.gid ?? null,
      issues,
      effectPreview: String(fresh || cached).slice(0, 220),
      templatePreview: template ? String(template).slice(0, 160) : null,
      params: item?.params || null,
      shopChance: item?.shopChance ?? null,
    });
  }

  // Live DB: effects that diverge from fresh convert, or have icon bugs the cache doesn't
  if (dbRows) {
    const dbById = new Map(dbRows.map((r) => [r.id, r]));
    for (const row of descrRows) {
      const db = dbById.get(row.id);
      if (!db) continue;
      report.totals.dbCompared += 1;
      const fresh = freshById.get(row.id) || '';
      const dbEffect = String(db.effect || '').trim();
      const placeholder = !dbEffect || dbEffect === '-' || dbEffect === '—' || dbEffect === '–';

      if (fresh && dbEffect && dbEffect !== fresh) {
        report.totals.dbDiverged += 1;
        const dbIssues = issuesForEffect(dbEffect, byId.get(row.id) || { params: {} }, row.template, assetCache);
        report.dbOnlyIssues.push({
          id: row.id,
          name: db.name,
          code: 'db_diverges_from_game_descr',
          detail: `dbLen=${dbEffect.length} freshLen=${fresh.length}`,
          dbIssues: dbIssues.filter((i) => i.severity !== 'info'),
          dbPreview: dbEffect.slice(0, 180),
          freshPreview: fresh.slice(0, 180),
        });
      } else if (!fresh && !placeholder) {
        // Wiki/cargo leftover while game has no DESCR
        const dbIssues = issuesForEffect(dbEffect, byId.get(row.id) || { params: {} }, null, assetCache);
        report.dbOnlyIssues.push({
          id: row.id,
          name: db.name,
          code: 'db_effect_no_game_template',
          detail: 'DB has effect text but game DESCR is empty',
          dbIssues: dbIssues.filter((i) => i.severity !== 'info'),
          dbPreview: dbEffect.slice(0, 220),
        });
      }
    }
  }

  const descrIds = new Set(descrRows.map((r) => r.id));
  const missingDescr = items.filter((i) => !descrIds.has(i.id));
  report.totals.itemsMissingDescrRow = missingDescr.length;
  report.missingDescrSample = missingDescr.slice(0, 30).map((i) => ({
    id: i.id,
    name: i.displayName || i.name,
  }));

  // Global CDN miss summary for tags actually used
  const usedTags = [...allTags].sort();
  report.iconResolveSummary = usedTags.map((t) => {
    const r = resolveIconPath(t);
    const cdn = assetCache.get(ICON_ALIAS[t] || t);
    return {
      tag: t,
      aliased: ICON_ALIAS[t] || t,
      kind: r.kind,
      ok: r.kind.startsWith('local') ? r.ok : cdn,
    };
  });

  report.items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  report.dbOnlyIssues.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log('Wrote', OUT);
  console.log(JSON.stringify(report.totals, null, 2));
  console.log('byCode', report.byCode);
  console.log('hard issue items', report.totals.withIssues);
  console.log('info-only items', report.totals.withInfoOnly);
  console.log('dbOnlyIssues', report.dbOnlyIssues.length);
  console.log('localTooltipIconsMissing', localIconGaps);
  const brokenIcons = report.iconResolveSummary.filter((x) => x.ok === false);
  console.log('broken icon tags', brokenIcons.map((x) => x.tag).join(', ') || '(none)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

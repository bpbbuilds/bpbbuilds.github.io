/**
 * Tooltip parity audit — game layers beyond DESCR conversion.
 *
 *   node scripts/audit-tooltip-parity.mjs
 *
 * Checks:
 *  - TYPE_* glossary / footer labels vs tooltip.js
 *  - getDescription overrides vs catalog extras
 *  - Frame Y_BORDER / inset-b vs tooltip.css
 *  - Keyword glossary coverage vs Tooltip.gd
 *
 * Writes scripts/_cache/tooltip-parity-report.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(__dirname, '_cache');
const OUT = path.join(CACHE, 'tooltip-parity-report.json');
const GAME = path.join(ROOT, 'tools', 'game-extract-full');
const TOOLTIP_JS = path.join(ROOT, 'js', 'shared', 'tooltip.js');
const TOOLTIP_CSS = path.join(ROOT, 'js', 'shared', 'tooltip.css');

/** Expected TYPE_* English (from Keywords.csv / Full.csv MissingKey payloads). */
const EXPECTED_TYPE_LABELS = {
  Card: 'Playing Card',
  Gem: 'Gemstone',
  // ItemData already uses these display strings for some:
  'Chess Piece': 'Chess Piece',
};

const EXPECTED_TYPE_DESCRIPTIONS = {
  Card: 'On reveal: Starts revealing the $affected Playing card. Revealing this card takes {cd}s.',
  Gem: 'Can be placed in backpack or in gemstone sockets.',
  Potion:
    'After being consumed also applies the effect of the $affected $h[Potion] above without consuming it.',
};

/** Catalog extras the site should show (static library state). */
const EXPECTED_CATALOG_EXTRAS = [
  {
    ids: ['gold_cube', 'plastic_cube', 'chrome_cube', 'bismuth_cube'],
    key: 'Cube_HINT',
    match: /another cube|cooldown advance is/i,
  },
  {
    ids: ['cat_spirit', 'owl_spirit', 'badger_spirit'],
    key: 'Spirit Companion_DESCR',
    match: /only have.*Spirit Companion/i,
  },
  {
    ids: ['mr_struggles'],
    key: 'Mr Struggles_Plushies',
    match: /Plushies are offered/i,
  },
  {
    ids: ['just_stats'],
    key: 'TOOLTIP_Always Offered',
    match: /Always offered in round/i,
  },
  {
    ids: ['more_stats'],
    key: 'TOOLTIP_Always Offered',
    match: /Always offered in round/i,
  },
  {
    ids: ['unidentified_skill'],
    key: 'TOOLTIP_Always Offered2',
    match: /Always offered in rounds/i,
  },
];

/** Game Tooltip.gd keywords → site KEYWORDS display names */
const GAME_KEYWORDS = [
  'spikes', 'vampirism', 'poison', 'regen', 'bl', 'lucky',
  'stun', 'blind', 'blindingLight', 'reflect', 'mana', 'heat',
  'cold', 'empower', 'rage', 'empty', 'affected', 'fatigue',
  'treasure', 'charge',
];

const KEYWORD_SITE_MAP = {
  spikes: 'Spikes',
  vampirism: 'Vampirism',
  poison: 'Poison',
  regen: 'Regeneration',
  bl: 'Block',
  lucky: 'Luck',
  blind: 'Blind',
  mana: 'Mana',
  heat: 'Heat',
  cold: 'Cold',
  empower: 'Empower',
  // Text-only in game (no icon glossary row on site is OK if not in KEYWORDS)
  stun: null,
  blindingLight: null,
  reflect: null,
  rage: null,
  empty: null,
  affected: null,
  fatigue: null,
  treasure: null,
  charge: null,
};

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function loadJson(name) {
  return JSON.parse(read(path.join(CACHE, name)));
}

function extractJsObjectKeys(src, constName) {
  const re = new RegExp(`const ${constName} = \\{([\\s\\S]*?)\\n  \\};`);
  const m = src.match(re);
  if (!m) return {};
  const out = {};
  for (const hit of m[1].matchAll(/^\s*([A-Za-z][A-Za-z0-9 ]*|\"[^\"]+\"|'[^']+')\s*:/gm)) {
    let k = hit[1].trim();
    if (k.startsWith('"') || k.startsWith("'")) k = k.slice(1, -1);
    out[k] = true;
  }
  // Also capture string values for descriptions
  const vals = {};
  for (const hit of m[1].matchAll(/^\s*([A-Za-z][A-Za-z0-9 ]*)\s*:\s*"([^"]*)"/gm)) {
    vals[hit[1]] = hit[2];
  }
  return { keys: out, vals };
}

function extractCssInsets(css) {
  const frames = {};
  // Match single or comma-grouped `.bpb-tooltip[data-frame="…"]` rule blocks
  const blockRe =
    /((?:\.bpb-tooltip(?:\[data-frame="[^"]+"\])?(?:\s*,\s*)?)+)\s*\{([^}]+)\}/g;
  let m;
  while ((m = blockRe.exec(css)) !== null) {
    const selector = m[1];
    const body = m[2];
    const get = (prop) => {
      const hit = body.match(new RegExp(`--${prop}:\\s*(-?\\d+)`));
      return hit ? Number(hit[1]) : null;
    };
    const props = {
      inset_t: get('inset-t'),
      inset_b: get('inset-b'),
      patch_b: get('patch-b'),
      patch_t: get('patch-t'),
    };
    const names = [...selector.matchAll(/data-frame="([^"]+)"/g)].map((x) => x[1]);
    const sparse = Object.fromEntries(
      Object.entries(props).filter(([, v]) => v != null),
    );
    if (!names.length) {
      frames.default = { ...(frames.default || {}), ...sparse };
      continue;
    }
    for (const name of names) {
      frames[name] = { ...(frames[name] || {}), ...sparse };
    }
  }
  return frames;
}

function parseTooltipTscn(filePath) {
  const text = read(filePath);
  const yBorder = Number((text.match(/Y_BORDER = (\d+)/) || [])[1] || 120);
  const patchB = Number((text.match(/patch_margin_bottom = (\d+)/) || [])[1] || 0);
  const patchT = Number((text.match(/patch_margin_top = (\d+)/) || [])[1] || 0);
  // First VBoxContainer margin_top after node
  const vbox = text.match(
    /\[node name="VBoxContainer"[^\]]*\][\s\S]*?margin_top = ([\d.]+)/,
  );
  const insetT = vbox ? Number(vbox[1]) : null;
  return {
    file: path.basename(filePath),
    yBorder,
    patch_b: patchB,
    patch_t: patchT,
    inset_t: insetT,
    inset_b: insetT != null ? yBorder - insetT : null,
  };
}

function findGetDescriptionOverrides() {
  const itemsDir = path.join(GAME, 'Items');
  const hits = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (/^(Animations|Materials|Particles|Sprites|Tiles|Masks)$/i.test(ent.name)) {
          continue;
        }
        walk(full);
      } else if (ent.name.endsWith('.gd')) {
        const text = read(full);
        if (!/func getDescription\s*\(/.test(text)) continue;
        // Skip base Item.gd definition that just wraps descriptor
        if (ent.name === 'Item.gd' && !/TOOLTIP_Requires/.test(text)) continue;
        const appends = [];
        if (/CARD_HINT|getCardDescription|CARD_COUNT|CARD_DUPLICATES|Joker_COUNTER/.test(text)) {
          appends.push('card-chain-hints');
        }
        if (/Cube_HINT/.test(text)) appends.push('Cube_HINT');
        if (/Spirit Companion_DESCR/.test(text)) appends.push('Spirit Companion_DESCR');
        if (/Mr Struggles_Plushies/.test(text)) appends.push('Mr Struggles_Plushies');
        if (/TOOLTIP_Always Offered2/.test(text)) appends.push('TOOLTIP_Always Offered2');
        else if (/TOOLTIP_Always Offered/.test(text)) appends.push('TOOLTIP_Always Offered');
        if (/HINT_Chess/.test(text)) appends.push('HINT_Chess');
        if (/Magic Ring_/.test(text)) appends.push('MagicRing-rebuild');
        if (/TOOLTIP_Requires/.test(text)) appends.push('TOOLTIP_Requires');
        if (/\$n_/.test(text)) appends.push('placement-counters');
        if (/getModeDescription|mode/.test(text) && /getDescription/.test(text)) {
          appends.push('mode-colors');
        }
        hits.push({
          file: path.relative(GAME, full).replace(/\\/g, '/'),
          appends: appends.length ? appends : ['custom'],
        });
      }
    }
  }
  walk(itemsDir);
  return hits;
}

function main() {
  const tooltipJs = read(TOOLTIP_JS);
  const tooltipCss = read(TOOLTIP_CSS);
  const typeLabels = extractJsObjectKeys(tooltipJs, 'TYPE_LABELS');
  const typeDescrs = extractJsObjectKeys(tooltipJs, 'TYPE_DESCRIPTIONS');
  const keywords = extractJsObjectKeys(tooltipJs, 'KEYWORDS');
  const cssFrames = extractCssInsets(tooltipCss);

  const issues = [];
  const report = {
    generatedAt: new Date().toISOString(),
    totals: { issues: 0 },
    byCode: {},
    issues: [],
    frames: {},
    overrides: [],
    notes: [],
  };

  function add(code, detail, extra = {}) {
    issues.push({ code, detail, ...extra });
  }

  // --- TYPE labels ---
  for (const [type, label] of Object.entries(EXPECTED_TYPE_LABELS)) {
    if (!typeLabels.keys[type] && type !== 'Chess Piece') {
      // Chess Piece may already be the type string in DB — only flag Card/Gem
    }
    if (['Card', 'Gem'].includes(type) && !typeLabels.keys[type]) {
      add('missing_type_label', `TYPE_LABELS missing ${type} → ${label}`);
    } else if (typeLabels.vals[type] && typeLabels.vals[type] !== label) {
      add(
        'wrong_type_label',
        `TYPE_LABELS.${type}="${typeLabels.vals[type]}" expected "${label}"`,
      );
    }
  }

  // --- TYPE descriptions ---
  for (const [type, descr] of Object.entries(EXPECTED_TYPE_DESCRIPTIONS)) {
    if (!typeDescrs.keys[type]) {
      add('missing_type_descr', `TYPE_DESCRIPTIONS missing ${type}`, {
        expected: descr.slice(0, 100),
      });
    }
  }

  // --- Keywords ---
  for (const kw of GAME_KEYWORDS) {
    const site = KEYWORD_SITE_MAP[kw];
    if (site == null) {
      // text-only / adjacency / no stack glossary on site — informational
      report.notes.push({
        code: 'keyword_no_site_glossary',
        detail: `${kw} is game keyword but site has no KEYWORDS glossary row (often intentional)`,
      });
      continue;
    }
    if (!keywords.keys[site]) {
      add('missing_keyword_glossary', `KEYWORDS missing ${site} (game $${kw})`);
    }
  }

  // --- Frames ---
  const tscnMap = {
    Common: 'CommonTooltip.tscn',
    Rare: 'RareTooltip.tscn',
    Epic: 'EpicTooltip.tscn',
    Legendary: 'LegendaryTooltip.tscn',
    Godly: 'GodlyTooltip.tscn',
    Unique: 'UniqueTooltip.tscn',
    Skill: 'SkillTooltip.tscn',
  };
  for (const [frame, file] of Object.entries(tscnMap)) {
    const full = path.join(GAME, 'Interface', 'Tooltips', file);
    if (!fs.existsSync(full)) {
      add('missing_tscn', file);
      continue;
    }
    const parsed = parseTooltipTscn(full);
    report.frames[frame] = parsed;
    const css = cssFrames[frame] || {};
    if (css.inset_b == null) {
      add('missing_css_inset_b', `${frame} has no --inset-b in tooltip.css`);
    } else if (parsed.inset_b != null && Math.abs(css.inset_b - parsed.inset_b) > 1) {
      add(
        'frame_inset_mismatch',
        `${frame}: css inset-b=${css.inset_b} game Y_BORDER-inset_t=${parsed.inset_b}`,
      );
    }
    if (css.inset_t != null && parsed.inset_t != null && Math.abs(css.inset_t - parsed.inset_t) > 1) {
      add(
        'frame_inset_t_mismatch',
        `${frame}: css inset-t=${css.inset_t} game=${parsed.inset_t}`,
      );
    }
  }

  // --- getDescription overrides inventory ---
  report.overrides = findGetDescriptionOverrides();

  // --- Catalog extras vs game-descr / simulated site handling ---
  const descrFile = loadJson('game-descr.json');
  const itemsFile = loadJson('game-items.json');
  const items = itemsFile.items || itemsFile;
  const byId = new Map(items.map((i) => [i.id, i]));
  const descrById = new Map((descrFile.items || descrFile).map((r) => [r.id, r]));

  // Detect if tooltip.js has catalogExtra / EXTRA helpers
  const hasCatalogExtras =
    /catalogExtra|CUBE_IDS|Plushies are offered|Always offered in round|Spirit Companion/i.test(
      tooltipJs,
    );

  for (const spec of EXPECTED_CATALOG_EXTRAS) {
    for (const id of spec.ids) {
      const item = byId.get(id);
      const row = descrById.get(id);
      if (!item) {
        add('missing_item', id);
        continue;
      }
      const effect = String(row?.effect || '');
      const inEffect = spec.match.test(effect);
      if (!inEffect && !hasCatalogExtras) {
        add('missing_catalog_extra', `${id} missing ${spec.key} (not in effect, no site catalogExtra)`, {
          id,
          key: spec.key,
        });
      } else if (!inEffect && hasCatalogExtras) {
        // Site claims to inject — still flag if injection patterns missing for this key
        const keyHint =
          spec.key === 'Cube_HINT'
            ? /CUBE_IDS|another cube/i.test(tooltipJs)
            : spec.key.includes('Spirit')
              ? /Spirit Companion|cat_spirit/i.test(tooltipJs)
              : spec.key.includes('Plushies')
                ? /mr_struggles|Plushies/i.test(tooltipJs)
                : spec.key.includes('Always')
                  ? /just_stats|Always offered/i.test(tooltipJs)
                  : true;
        if (!keyHint) {
          add('missing_catalog_extra', `${id} missing ${spec.key} injection in tooltip.js`, {
            id,
            key: spec.key,
          });
        }
      }
    }
  }

  // Requires
  for (const item of items) {
    if (!item.requires) continue;
    const row = descrById.get(item.id);
    const effect = String(row?.effect || '');
    const hasReq =
      /Requires:/i.test(effect) || /TOOLTIP_Requires|item\.requires|catalogExtra/i.test(tooltipJs);
    if (!hasReq) {
      add('missing_requires_line', `${item.id} requires ${item.requires} but no Requires line`, {
        id: item.id,
        requires: item.requires,
      });
    }
  }

  // Potion type present?
  const potionCount = items.filter((i) => i.type === 'Potion').length;
  if (potionCount && !typeDescrs.keys.Potion) {
    // already added via EXPECTED_TYPE_DESCRIPTIONS
  }

  report.issues = issues;
  report.totals.issues = issues.length;
  for (const iss of issues) {
    report.byCode[iss.code] = (report.byCode[iss.code] || 0) + 1;
  }
  report.totals.overrides = report.overrides.length;
  report.totals.notes = report.notes.length;
  report.hasCatalogExtrasHelper = hasCatalogExtras;

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log('Wrote', OUT);
  console.log(JSON.stringify(report.totals, null, 2));
  console.log('byCode', report.byCode);
  if (issues.length) {
    console.log('\nIssues:');
    for (const iss of issues.slice(0, 40)) {
      console.log('-', iss.code + ':', iss.detail);
    }
    if (issues.length > 40) console.log(`… +${issues.length - 40} more`);
  }
}

main();

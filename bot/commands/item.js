/** /item — show a catalog item, its tooltip, and public builds using it. */
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { loadEnv } from '../env.js';
import { renderItemSpritePng, renderItemTooltipPng } from '../item-tooltip.js';

const SITE = 'https://bpbbuilds.com';
const GOLD = 0xeac914;
const ITEM_FIELDS = 'id,gid,name,rarity,type,class,extra_types,tags,cost,effect,image,accuracy,cooldown,stamina_cost,damage_min,damage_max';
const AUTOCOMPLETE_FIELDS = 'id,name';
const AUTOCOMPLETE_LIMIT = 1000;
const AUTOCOMPLETE_RESPONSE_DEADLINE_MS = 2200;

/** @type {{ id: string, name: string }[] | null} */
let autocompleteRowsCache = null;
/** @type {Promise<{ id: string, name: string }[] | null> | null} */
let autocompleteRowsPending = null;

export const itemCommand = {
  name: 'item',
  description: 'Show an item tooltip, stats, and builds using it.',
  options: [{
    name: 'item',
    description: 'Item name or ID.',
    type: 3,
    required: true,
    autocomplete: true,
  }],
};

/** @param {Record<string, any>} row */
export function mapItem(row) {
  return {
    ...row,
    className: row.class,
    extraTypes: row.extra_types,
    staminaCost: row.stamina_cost,
    damageMin: row.damage_min,
    damageMax: row.damage_max,
  };
}

function config() {
  const env = loadEnv();
  return {
    base: String(env.SUPABASE_PROJECT_URL || '').replace(/\/$/, ''),
    key: String(env.SUPABASE_SERVICE_ROLE_KEY || ''),
  };
}

async function rest(cfg, query, init = {}) {
  if (!cfg.base || !cfg.key) return null;
  try {
    const response = await fetch(`${cfg.base}/rest/v1/${query}`, {
      ...init,
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        ...(init.headers || {}),
      },
    });
    if (!response.ok) return null;
    return response;
  } catch {
    return null;
  }
}

function encoded(value) {
  return encodeURIComponent(String(value || '').trim());
}

async function searchRows(cfg, query) {
  const needle = String(query || '').trim();
  const catalog = await warmItemAutocomplete(cfg);
  if (catalog) {
    const folded = needle.toLocaleLowerCase();
    return catalog
      .filter((row) => !folded || row.id.toLocaleLowerCase().includes(folded) || row.name.toLocaleLowerCase().includes(folded))
      .slice(0, 25);
  }
  const pattern = `*${needle.replace(/[(),]/g, ' ')}*`;
  const response = await rest(
    cfg,
    `items?select=${AUTOCOMPLETE_FIELDS}&or=(id.ilike.${encoded(pattern)},name.ilike.${encoded(pattern)})&order=name.asc&limit=25`,
    { signal: AbortSignal.timeout(1800) },
  );
  if (!response) return [];
  try {
    const rows = await response.json();
    return Array.isArray(rows)
      ? rows
        .map((row) => ({ id: String(row.id || '').trim(), name: String(row.name || row.id || '').trim() }))
        .filter((row) => row.id && row.name)
      : [];
  } catch {
    return [];
  }
}

/**
 * Warm the item-name catalog once so Discord autocomplete does not wait on a
 * Supabase request for every keystroke. The optional config is only used by
 * focused runtime tests; production callers use the loaded environment.
 * @param {{ base?: string, key?: string }} [cfg]
 * @returns {Promise<{ id: string, name: string }[] | null>}
 */
export async function warmItemAutocomplete(cfg = config()) {
  if (autocompleteRowsCache !== null) return autocompleteRowsCache;
  if (autocompleteRowsPending) return autocompleteRowsPending;
  const request = (async () => {
    const response = await rest(
      cfg,
      `items?select=${AUTOCOMPLETE_FIELDS}&order=name.asc&limit=${AUTOCOMPLETE_LIMIT}`,
      { signal: AbortSignal.timeout(1800) },
    );
    if (!response) return null;
    try {
      const rows = await response.json();
      if (!Array.isArray(rows)) return null;
      return rows
        .map((row) => ({ id: String(row.id || '').trim(), name: String(row.name || row.id || '').trim() }))
        .filter((row) => row.id && row.name)
        .slice(0, AUTOCOMPLETE_LIMIT);
    } catch {
      return null;
    }
  })();
  autocompleteRowsPending = request;
  try {
    const rows = await request;
    if (rows) autocompleteRowsCache = rows;
    return rows;
  } finally {
    if (autocompleteRowsPending === request) autocompleteRowsPending = null;
  }
}

/** @param {string} query */
export async function loadItem(query) {
  const cfg = config();
  const needle = String(query || '').trim();
  if (!needle) return null;
  const exact = await rest(cfg, `items?select=${ITEM_FIELDS}&id=eq.${encoded(needle)}&limit=1`);
  const exactRows = exact ? await exact.json() : [];
  if (exactRows?.[0]) return mapItem(exactRows[0]);
  const matches = await searchRows(cfg, needle);
  if (!matches[0]) return null;
  const full = await rest(cfg, `items?select=${ITEM_FIELDS}&id=eq.${encoded(matches[0].id)}&limit=1`);
  const rows = full ? await full.json() : [];
  return rows?.[0] ? mapItem(rows[0]) : null;
}

export function buildsForItemUrl(itemId) {
  const url = new URL('/builds/', SITE);
  url.searchParams.set('q', `[[${String(itemId)}]]`);
  return url.toString();
}

/** @param {string} itemId */
export async function countPublicBuilds(cfg, itemId) {
  // Count distinct public builds, rather than placements: a build can place
  // the same item more than once. Paginate so the count remains correct past
  // PostgREST's default response limit.
  const buildIds = new Set();
  for (let offset = 0; offset < 100000; offset += 1000) {
    const placements = await rest(
      cfg,
      `build_placements?select=build_id,build:builds!inner(is_public)&item_id=eq.${encoded(itemId)}&build.is_public=eq.true&order=build_id&limit=1000&offset=${offset}`,
    );
    if (!placements) break;
    const rows = await placements.json();
    for (const row of rows) if (row?.build_id) buildIds.add(row.build_id);
    if (rows.length < 1000) break;
  }
  return buildIds.size;
}

function values(item) {
  const tags = [item?.extraTypes, item?.tags].flatMap((value) => Array.isArray(value) ? value : [value])
    .map((value) => String(value || '').trim()).filter(Boolean);
  return [...new Set(tags)].join(', ') || '—';
}

function effect(item) {
  const raw = String(item?.effect || item?.description || '').trim();
  return raw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').slice(0, 1024) || 'No effect text recorded.';
}

/** @param {Record<string, any>} item */
export function itemEmbed(item, buildCount) {
  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(String(item.name || item.id))
    .setURL(buildsForItemUrl(item.id))
    .setDescription(effect(item))
    .setThumbnail('attachment://item.png')
    .setImage('attachment://item-tooltip.png')
    .addFields(
      { name: 'Damage', value: `${item.damageMin ?? '—'}${item.damageMax != null ? `–${item.damageMax}` : ''}`, inline: true },
      { name: 'Stamina', value: String(item.staminaCost ?? '—'), inline: true },
      { name: 'Accuracy', value: String(item.accuracy ?? '—'), inline: true },
      { name: 'Cooldown', value: String(item.cooldown ?? '—'), inline: true },
      { name: 'Cost', value: String(item.cost ?? '—'), inline: true },
      { name: 'Rarity', value: String(item.rarity || '—'), inline: true },
      { name: 'Class', value: String(item.className || '—'), inline: true },
      { name: 'Category', value: String(item.type || '—'), inline: true },
      { name: 'Effects', value: values(item), inline: true },
      { name: 'Builds using this item', value: `[${buildCount} public builds](${buildsForItemUrl(item.id)})`, inline: false },
    )
    .setFooter({ text: `Item ID: ${item.id}` });
}

export async function handleItem(interaction) {
  await interaction.deferReply();
  const query = interaction.options.getString('item', true);
  const item = await loadItem(query);
  if (!item) {
    await interaction.editReply({ content: `I couldn't find an item named **${query.slice(0, 80)}**.` });
    return;
  }
  const cfg = config();
  const [buildCount, icon, tooltip] = await Promise.all([
    countPublicBuilds(cfg, item.id),
    renderItemSpritePng(item),
    renderItemTooltipPng(item),
  ]);
  await interaction.editReply({
    embeds: [itemEmbed(item, buildCount)],
    files: [
      new AttachmentBuilder(icon, { name: 'item.png' }),
      new AttachmentBuilder(tooltip, { name: 'item-tooltip.png' }),
    ],
  });
}

export async function handleItemAutocomplete(interaction) {
  const query = interaction.options.getString('item') || '';
  // Discord invalidates an autocomplete interaction after roughly three
  // seconds. The startup warm and its network fallback are deliberately
  // allowed to continue in the background, but never hold the acknowledgement
  // past a bounded deadline. A late catalog warm benefits the next keystroke.
  const rows = await Promise.race([
    searchRows(config(), query),
    new Promise((resolve) => {
      const timer = setTimeout(() => resolve([]), AUTOCOMPLETE_RESPONSE_DEADLINE_MS);
      timer.unref?.();
    }),
  ]);
  await interaction.respond(rows.slice(0, 25).map((row) => ({ name: row.name.slice(0, 100), value: row.id })));
}

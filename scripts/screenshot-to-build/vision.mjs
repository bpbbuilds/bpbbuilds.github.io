import fs from 'fs';
import path from 'path';
import { ROOT } from './catalog.mjs';

/**
 * @param {string} content
 */
export function extractJson(content) {
  const raw = String(content || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Rough USD cost from token usage (OpenAI list prices, Sep 2026).
 * @param {string} model
 * @param {{ prompt_tokens?: number, completion_tokens?: number, prompt_tokens_details?: { cached_tokens?: number } } | null} usage
 */
export function estimateUsd(model, usage) {
  if (!usage) return null;
  const m = String(model || '').toLowerCase();
  /** @type {{ in: number, out: number, cached: number }} */
  let rates;
  if (m.includes('gpt-4.1-mini') || m.includes('gpt-4o-mini')) {
    rates = { in: 0.4, out: 1.6, cached: 0.1 };
  } else if (m.includes('gpt-4.1')) {
    rates = { in: 2.0, out: 8.0, cached: 0.5 };
  } else if (m.includes('gpt-4o')) {
    rates = { in: 2.5, out: 10.0, cached: 1.25 };
  } else {
    rates = { in: 2.0, out: 8.0, cached: 0.5 };
  }
  const cached = Number(usage.prompt_tokens_details?.cached_tokens || 0);
  const prompt = Number(usage.prompt_tokens || 0);
  const completion = Number(usage.completion_tokens || 0);
  const uncachedIn = Math.max(0, prompt - cached);
  const usd =
    (uncachedIn * rates.in) / 1e6 + (cached * rates.cached) / 1e6 + (completion * rates.out) / 1e6;
  return {
    usd: Number(usd.toFixed(6)),
    ratesPer1M: rates,
    prompt_tokens: prompt,
    completion_tokens: completion,
    cached_tokens: cached,
  };
}

/**
 * @param {{ usd?: number } | null | undefined} a
 * @param {{ usd?: number } | null | undefined} b
 */
export function sumCost(a, b) {
  const ua = a?.usd != null ? Number(a.usd) : 0;
  const ub = b?.usd != null ? Number(b.usd) : 0;
  if (!a && !b) return null;
  return {
    usd: Number((ua + ub).toFixed(6)),
    prompt_tokens: Number(a?.prompt_tokens || 0) + Number(b?.prompt_tokens || 0),
    completion_tokens: Number(a?.completion_tokens || 0) + Number(b?.completion_tokens || 0),
  };
}

/**
 * @param {string[]} catalogNames
 * @param {boolean} multiCue
 */
function buildItemSchema(catalogNames, multiCue) {
  const props = {
    name: { type: 'string', enum: catalogNames },
    confidence: { type: 'number' },
    rotation: { type: 'integer', enum: [0, 90, 180, 270] },
    notes: { type: 'string' },
  };
  /** @type {string[]} */
  const required = ['name', 'confidence', 'rotation', 'notes'];
  if (multiCue) {
    props.cellCol = { type: 'integer' };
    props.cellRow = { type: 'integer' };
    props.sizeW = { type: 'integer' };
    props.sizeH = { type: 'integer' };
    required.push('cellCol', 'cellRow', 'sizeW', 'sizeH');
  }
  return {
    type: 'json_schema',
    json_schema: {
      name: multiCue ? 'backpack_items_multicue' : 'backpack_item_pick',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: multiCue ? ['items'] : ['name', 'confidence', 'rotation', 'notes'],
        properties: multiCue
          ? {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required,
                  properties: props,
                },
              },
            }
          : props,
      },
    },
  };
}

const PASS1_PROMPT = `Identify every Backpack Battles item visible in this backpack screenshot.

Return JSON: { "items": [ { "name", "confidence", "rotation", "cellCol", "cellRow", "sizeW", "sizeH", "notes" } ] }

Hard rules:
- Every "name" MUST be an exact catalog item name from the allowed enum (no invented names).
- List EVERY visible instance as its own entry (3 Flames = 3 objects).
- sizeW/sizeH = backpack BODY footprint in cells (not sprite pixels). Example: Flame is 1x1; Corrupted Armor body is 2x3 — never claim armor as 1x1.
- cellCol/cellRow = approximate top-left cell of that footprint on the visible bag (0-based).
- rotation is 0, 90, 180, or 270.
- Do NOT invent Gloves of Haste, Magic Ring, Magic Mirror, or Spectral Dagger unless visually certain.
- Gold circular icons are often Bunch of Coins — not rings or gloves.
- Purple energy saber is usually Darksaber (tall 1x4); do not default to Hungry Blade (1x3). Lightsaber is the bright variant.
- Winged gold sword with feathered hilt / green center gem = Falcon Blade (body 1x3, wings stick out). Do NOT call it Hero Longsword, Wooden Sword, or Burning Blade.
- Large dark red/black torso ≈ Corrupted Armor or Vampiric Armor.
- Fire birds ≈ Phoenix. Pink pigs ≈ Piggybank. Grey oblong rocks ≈ Stone or Whetstone.
- Ignore bag borders, stitches, empty cells.`;

/**
 * @param {{ id: string, name: string }[]} catalog
 * @param {string} dataUrl
 * @param {Record<string, string>} env
 */
export async function visionIdentify(catalog, dataUrl, env) {
  const provider = String(env.STB_PROVIDER || (env.OPENAI_API_KEY ? 'openai' : 'openrouter'))
    .trim()
    .toLowerCase();
  const TIMEOUT_MS = Number(env.OR_TIMEOUT_MS || 150000);
  const MAX_TOKENS = Number(env.OR_MAX_TOKENS || 4000);

  const catalogNames = [...new Set(catalog.map((c) => c.name).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );

  /** @type {string} */
  let url;
  /** @type {Record<string, string>} */
  let headers;
  /** @type {Record<string, unknown>} */
  let body;
  /** @type {string} */
  let MODEL;
  /** @type {string} */
  let responseMode = 'json_object';

  if (provider === 'openai') {
    const key = env.OPENAI_API_KEY;
    if (!key) throw new Error('missing OPENAI_API_KEY');
    MODEL = env.OPENAI_MODEL || 'gpt-4.1';
    url = 'https://api.openai.com/v1/chat/completions';
    headers = {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    };
    body = {
      model: MODEL,
      temperature: 0.1,
      max_tokens: MAX_TOKENS,
      response_format: buildItemSchema(catalogNames, true),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PASS1_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        },
      ],
    };
    responseMode = 'json_schema_enum';
  } else {
    const key = env.OPENROUTER_API_KEY;
    if (!key) throw new Error('missing OPENROUTER_API_KEY');
    MODEL = env.OR_MODEL || 'dots-studio/dots-3-note-preview:free';
    url = 'https://openrouter.ai/api/v1/chat/completions';
    headers = {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://smojobuilds.local',
      'X-Title': 'BPB screenshot-to-build',
    };
    body = {
      model: MODEL,
      temperature: 0.1,
      max_tokens: MAX_TOKENS,
      reasoning: { effort: 'low' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PASS1_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    };
  }

  console.error(`vision: ${provider}/${MODEL} (${responseMode}, ${catalogNames.length} names)…`);
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      signal: ac.signal,
      headers,
      body: JSON.stringify(body),
    });
  } finally {
    clearTimeout(timer);
  }
  const ms = Date.now() - t0;
  let json = await res.json();

  if (provider === 'openai' && (!res.ok || json?.error) && responseMode === 'json_schema_enum') {
    console.error(
      `schema rejected (${res.status}): ${json?.error?.message || 'unknown'}; retry json_object…`,
    );
    const nameBlock = catalogNames.join('\n');
    const fallbackBody = {
      model: MODEL,
      temperature: 0.1,
      max_tokens: MAX_TOKENS,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `${PASS1_PROMPT}\n\nAllowed catalog names (pick EXACTLY from this list):\n${nameBlock}`,
            },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        },
      ],
    };
    const ac2 = new AbortController();
    const timer2 = setTimeout(() => ac2.abort(), TIMEOUT_MS);
    try {
      res = await fetch(url, {
        method: 'POST',
        signal: ac2.signal,
        headers,
        body: JSON.stringify(fallbackBody),
      });
    } finally {
      clearTimeout(timer2);
    }
    json = await res.json();
    responseMode = 'json_object_namelist';
  }

  const cost = estimateUsd(json?.model || MODEL, json?.usage || null);
  try {
    fs.writeFileSync(
      path.join(ROOT, 'scripts/_stb-vision-debug.json'),
      JSON.stringify(
        {
          provider,
          responseMode,
          catalogNameCount: catalogNames.length,
          status: res.status,
          ms,
          model: json?.model || MODEL,
          error: json?.error,
          usage: json?.usage,
          cost,
          message: json?.choices?.[0]?.message,
        },
        null,
        2,
      ),
    );
  } catch {
    /* ignore */
  }

  const msg = json?.choices?.[0]?.message || {};
  const content = msg.content || null;
  const reasoning = msg.reasoning || msg.reasoning_content || null;
  return {
    ok: res.ok,
    status: res.status,
    ms,
    model: json?.model || MODEL,
    provider,
    responseMode,
    catalogNameCount: catalogNames.length,
    error: json?.error || null,
    usage: json?.usage || null,
    cost,
    rawContent: content,
    parsed: extractJson(content) || extractJson(reasoning),
  };
}

/**
 * Pass-2: pick one name from a shortlist given a crop.
 * @param {string[]} shortlist
 * @param {string} cropDataUrl
 * @param {Record<string, string>} env
 */
export async function visionShortlistPick(shortlist, cropDataUrl, env) {
  const key = env.OPENAI_API_KEY;
  if (!key) throw new Error('missing OPENAI_API_KEY for shortlist re-ask');
  if (!shortlist.length) {
    return { ok: false, error: 'empty shortlist', cost: null, pick: null };
  }

  const MODEL = env.OPENAI_MODEL_SHORTLIST || 'gpt-4.1-mini';
  const TIMEOUT_MS = Number(env.OR_TIMEOUT_MS || 60000);
  const prompt = `This crop shows ONE Backpack Battles item from a backpack screenshot.
Pick the best matching catalog name from the allowed enum only.
Return JSON with name, confidence, rotation, notes.
If unsure between lookalikes, pick the closest visual match and lower confidence.`;

  const body = {
    model: MODEL,
    temperature: 0.1,
    max_tokens: 400,
    response_format: buildItemSchema(shortlist, false),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: cropDataUrl, detail: 'high' } },
        ],
      },
    ],
  };

  console.error(`  shortlist re-ask (${MODEL}): ${shortlist.join(' | ')}`);
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  let res;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: ac.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } finally {
    clearTimeout(timer);
  }
  const ms = Date.now() - t0;
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content || null;
  const parsed = extractJson(content);
  const cost = estimateUsd(json?.model || MODEL, json?.usage || null);
  return {
    ok: res.ok && !json?.error,
    status: res.status,
    ms,
    model: json?.model || MODEL,
    error: json?.error || null,
    usage: json?.usage || null,
    cost,
    pick: parsed?.name ? String(parsed.name) : null,
    confidence: parsed?.confidence ?? null,
    rotation: parsed?.rotation ?? null,
    raw: parsed,
  };
}

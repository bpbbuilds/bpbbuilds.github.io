/**
 * Screenshot → board (Premium).
 * POST JSON: { imageDataUrl: "data:image/..." }
 * Authorization: Bearer <user JWT>
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, OPENAI_API_KEY
 * Optional: OPENAI_MODEL (default gpt-4.1)
 *
 * Image is processed in-memory only — never written to Storage/DB.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { cors, json } from '../_shared/http.ts';
import { isEntitledPremium } from '../_shared/stripe.ts';

const MAX_DECODED_BYTES = 4 * 1024 * 1024;

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

const NAME_ALIASES: Record<string, string> = {
  darksaber: 'Darksaber',
  darksabre: 'Darksaber',
  lightsaber: 'Lightsaber',
  falcon: 'Falcon Blade',
  falconblade: 'Falcon Blade',
  wingedsword: 'Falcon Blade',
  wingedblade: 'Falcon Blade',
};

function normName(s: string) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function buildItemSchema(catalogNames: string[]) {
  const props = {
    name: { type: 'string', enum: catalogNames },
    confidence: { type: 'number' },
    rotation: { type: 'integer', enum: [0, 90, 180, 270] },
    notes: { type: 'string' },
    cellCol: { type: 'integer' },
    cellRow: { type: 'integer' },
    sizeW: { type: 'integer' },
    sizeH: { type: 'integer' },
  };
  const required = [
    'name',
    'confidence',
    'rotation',
    'notes',
    'cellCol',
    'cellRow',
    'sizeW',
    'sizeH',
  ];
  return {
    type: 'json_schema',
    json_schema: {
      name: 'backpack_items_multicue',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required,
              properties: props,
            },
          },
        },
      },
    },
  };
}

function extractJson(content: string) {
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

function validateDataUrl(raw: unknown): { ok: true; dataUrl: string } | { ok: false; error: string } {
  const dataUrl = String(raw || '').trim();
  if (!dataUrl.startsWith('data:image/')) {
    return { ok: false, error: 'Expected a data:image/… URL' };
  }
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return { ok: false, error: 'Invalid image data URL' };
  const meta = dataUrl.slice(0, comma).toLowerCase();
  if (!meta.includes(';base64')) {
    return { ok: false, error: 'Image must be base64-encoded' };
  }
  const b64 = dataUrl.slice(comma + 1);
  // Rough decoded size: 3/4 of base64 length
  const decodedApprox = Math.floor((b64.length * 3) / 4);
  if (decodedApprox > MAX_DECODED_BYTES) {
    return { ok: false, error: 'Image too large (max 4MB)' };
  }
  if (decodedApprox < 64) {
    return { ok: false, error: 'Image too small' };
  }
  return { ok: true, dataUrl };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // Default-off launch gate; this runs before auth, catalog work, or any model request.
  if ((Deno.env.get('SCREENSHOT_IMPORT_ENABLED') || '').trim().toLowerCase() !== 'true') {
    return json({ error: 'Screenshot import is paused for launch' }, 404);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';
  const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1';

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: 'Server misconfigured' }, 500);
  }
  if (!openaiKey) {
    return json({ error: 'Vision not configured' }, 503);
  }

  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) {
    return json({ error: 'Sign in required' }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: 'Invalid session' }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('id, plan, premium_until, is_owner')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profErr || !profile) {
    return json({ error: 'Profile not found' }, 404);
  }
  if (!profile.is_owner && !isEntitledPremium(profile)) {
    return json({ error: 'Premium required', code: 'premium_required' }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const checked = validateDataUrl(body.imageDataUrl);
  if (!checked.ok) {
    return json({ error: checked.error }, 400);
  }
  const dataUrl = checked.dataUrl;

  const { data: rows, error: itemsErr } = await supabase
    .from('items')
    .select('id, name')
    .not('image', 'is', null)
    .neq('image', '');

  if (itemsErr || !rows?.length) {
    return json({ error: 'Catalog unavailable' }, 503);
  }

  /** @type {Map<string, { id: string, name: string }>} */
  const byNorm = new Map();
  /** @type {Map<string, { id: string, name: string }>} */
  const byExactName = new Map();
  const catalogNames: string[] = [];
  for (const row of rows) {
    const id = String(row.id || '').trim();
    const name = String(row.name || '').trim();
    if (!id || !name) continue;
    const entry = { id, name };
    byExactName.set(name, entry);
    byNorm.set(normName(name), entry);
    catalogNames.push(name);
  }
  catalogNames.sort((a, b) => a.localeCompare(b));
  const uniqueNames = [...new Set(catalogNames)];

  async function callOpenAi(useSchema: boolean) {
    const messages = useSchema
      ? [
          {
            role: 'user',
            content: [
              { type: 'text', text: PASS1_PROMPT },
              { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
            ],
          },
        ]
      : [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `${PASS1_PROMPT}\n\nAllowed catalog names (pick EXACTLY from this list):\n${uniqueNames.join('\n')}`,
              },
              { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
            ],
          },
        ];

    const payload: Record<string, unknown> = {
      model,
      temperature: 0.1,
      max_tokens: 4000,
      response_format: useSchema
        ? buildItemSchema(uniqueNames)
        : { type: 'json_object' },
      messages,
    };

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return { res, data };
  }

  let { res: oaRes, data: oaJson } = await callOpenAi(true);
  if (!oaRes.ok || oaJson?.error) {
    const retry = await callOpenAi(false);
    oaRes = retry.res;
    oaJson = retry.data;
  }

  if (!oaRes.ok || oaJson?.error) {
    const msg =
      typeof oaJson?.error?.message === 'string'
        ? oaJson.error.message
        : 'Vision request failed';
    return json({ error: msg }, 502);
  }

  const content = String(oaJson?.choices?.[0]?.message?.content || '');
  const parsed = extractJson(content);
  const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];

  type OutItem = {
    id: string;
    name: string;
    x: number;
    y: number;
    r: number;
    sizeW?: number;
    sizeH?: number;
    confidence?: number;
  };
  const items: OutItem[] = [];

  for (const p of rawItems) {
    const visionName = String(p?.name || '').trim();
    if (!visionName) continue;
    let n = normName(visionName);
    if (NAME_ALIASES[n]) n = normName(NAME_ALIASES[n]);
    const resolved = byExactName.get(visionName) || byNorm.get(n);
    if (!resolved) continue;

    const rotDeg = Number(p?.rotation) || 0;
    const r = (((Math.round(rotDeg / 90) % 4) + 4) % 4);
    const x = Math.max(0, Math.round(Number(p?.cellCol) || 0));
    const y = Math.max(0, Math.round(Number(p?.cellRow) || 0));
    const sizeW = Math.max(1, Math.round(Number(p?.sizeW) || 1));
    const sizeH = Math.max(1, Math.round(Number(p?.sizeH) || 1));
    const confidence = Number(p?.confidence);
    /** @type {OutItem} */
    const out: OutItem = {
      id: resolved.id,
      name: resolved.name,
      x,
      y,
      r,
      sizeW,
      sizeH,
    };
    if (Number.isFinite(confidence)) out.confidence = confidence;
    items.push(out);
  }

  return json({
    ok: true,
    itemCount: items.length,
    model: oaJson?.model || model,
    items,
  });
});

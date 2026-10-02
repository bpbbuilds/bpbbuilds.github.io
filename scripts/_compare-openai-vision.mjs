/**
 * Compare OpenAI vision models on one backpack screenshot (vision-only).
 * Usage: node scripts/_compare-openai-vision.mjs [path-to.png]
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(ROOT, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const key = env.OPENAI_API_KEY;
if (!key) {
  console.error('missing OPENAI_API_KEY');
  process.exit(1);
}

const imgPath =
  process.argv[2] ||
  path.join(
    process.env.USERPROFILE || '',
    '.cursor/projects/d-SMOJO-Online-Buisness-BPBWebsite/assets/c__Users_Justin_AppData_Roaming_Cursor_User_workspaceStorage_fcafc5aecf3daf29cd692b4a8d718545_images_image-79a5afb4-8c4c-4e66-925c-c0497c4ed2de.png',
  );

const dataUrl = `data:image/png;base64,${fs.readFileSync(imgPath).toString('base64')}`;

const PROMPT = `You are identifying items in a Backpack Battles backpack screenshot.

Return ONLY valid JSON:
{
  "items": [
    { "name": "Official English item name", "confidence": 0.0, "rotation": 0, "notes": "grid position / size" }
  ]
}

Hard rules:
- List EVERY visible item instance as its own entry (3 Flames = 3 separate objects).
- Use official Backpack Battles English names when sure. If unsure, still guess but lower confidence.
- Do NOT invent items from common stereotypes. Especially do NOT default to:
  Gloves of Haste, Magic Ring, Magic Mirror, Spectral Dagger, Cold Mirror
  unless you are visually certain that exact item is present.
- Gold circular icons are often Gold (currency item) or other coin-like items — not rings/gloves.
- Purple smoky blades have several lookalikes (Hungry Blade, Bloodthorne, Manathirst, Spectral Dagger, etc.) — look carefully before naming.
- Large red/black torso piece is often Corrupted Armor (or similar armor), not a mirror.
- Winged gold sword is Falcon Blade.
- Orange fire birds are Phoenix.
- Pink pig banks are Piggybank.
- Grey oblong rocks are Stone (or Whetstone if that is the catalog name).
- Ignore pure UI chrome (bag borders, stitches, empty cells).
- Count duplicates carefully; notes saying "two instances" still require two JSON entries.`;

const MODELS = ['gpt-4.1', 'gpt-4o'];

async function runModel(model) {
  const t0 = Date.now();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        },
      ],
    }),
  });
  const ms = Date.now() - t0;
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content || '';
  let parsed = null;
  try {
    parsed = JSON.parse(content);
  } catch {
    const a = content.indexOf('{');
    const b = content.lastIndexOf('}');
    if (a >= 0 && b > a) {
      try {
        parsed = JSON.parse(content.slice(a, b + 1));
      } catch {
        /* ignore */
      }
    }
  }
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  /** @type {Record<string, number>} */
  const counts = {};
  for (const it of items) {
    const n = String(it?.name || '?').trim();
    counts[n] = (counts[n] || 0) + 1;
  }
  return {
    model: json?.model || model,
    ok: res.ok,
    status: res.status,
    ms,
    error: json?.error || null,
    usage: json?.usage || null,
    itemCount: items.length,
    counts,
    items,
  };
}

// Known-wrong labels from user on this specific shot (score as false positives)
const FORBIDDEN = new Set([
  'spectral dagger',
  'magic mirror',
  'cold mirror',
  'gloves of haste',
  'magic ring',
]);

// Likely correct family from earlier free pass + user corrections (loose)
const EXPECTED_HINTS = [
  'flame',
  'mana orb',
  'piggybank',
  'treasure chest',
  'chest',
  'dark lantern',
  'falcon blade',
  'oil lamp',
  'corrupted armor',
  'phoenix',
  'stone',
  'whetstone',
  'lucky clover',
  'star',
  'corrupted crystal',
  'gold',
];

function score(result) {
  const names = (result.items || []).map((i) => String(i.name || '').toLowerCase());
  const forbiddenHits = names.filter((n) => [...FORBIDDEN].some((f) => n.includes(f)));
  const hintHits = names.filter((n) => EXPECTED_HINTS.some((h) => n.includes(h)));
  return {
    forbiddenFalsePositives: forbiddenHits.length,
    forbiddenNames: [...new Set(forbiddenHits)],
    expectedFamilyHits: hintHits.length,
    total: names.length,
  };
}

const out = [];
for (const m of MODELS) {
  process.stderr.write(`running ${m}…\n`);
  const r = await runModel(m);
  out.push({ ...r, score: score(r) });
}

const report = {
  shot: path.basename(imgPath),
  results: out.map((r) => ({
    model: r.model,
    ok: r.ok,
    ms: r.ms,
    usage: r.usage,
    itemCount: r.itemCount,
    counts: r.counts,
    score: r.score,
    items: r.items,
  })),
};

fs.writeFileSync(path.join(ROOT, 'scripts/_openai-vision-compare.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

/**
 * One-off OpenRouter free-router vision smoke test (screenshot → item list).
 * Run: node scripts/_test-openrouter-vision.mjs [path-to-png]
 * Does not print the API key.
 */
import fs from 'fs';
import path from 'path';

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

const key = env.OPENROUTER_API_KEY;
if (!key) {
  console.error('missing OPENROUTER_API_KEY in .env');
  process.exit(1);
}

const imgPath =
  process.argv[2] ||
  path.join(
    process.env.USERPROFILE || '',
    '.cursor/projects/d-SMOJO-Online-Buisness-BPBWebsite/assets/c__Users_Justin_AppData_Roaming_Cursor_User_workspaceStorage_fcafc5aecf3daf29cd692b4a8d718545_images_image-34b4c99c-bd6f-414a-9cc7-ac5fe89da3ce.png',
  );

if (!fs.existsSync(imgPath)) {
  console.error('image not found:', imgPath);
  process.exit(1);
}

const b64 = fs.readFileSync(imgPath).toString('base64');
const dataUrl = `data:image/png;base64,${b64}`;

const prompt = `You are identifying items in a Backpack Battles backpack screenshot.
Return ONLY valid JSON (no markdown, no thinking, no explanation) with this shape:
{
  "bagHint": "short description of bag shape",
  "items": [
    { "name": "Exact or best-guess Backpack Battles item name", "confidence": 0.0, "notes": "position/rotation/size" }
  ]
}
List every distinct item you see (including duplicates as separate entries). Prefer official English item names when sure (e.g. Piggybank, Phoenix, Mana Orb, Flame, Dark Lantern, Oil Lamp, Chest, Stone, Spectral Dagger, Falcon Blade, Corrupted Armor, Lucky Clover). If unsure, guess and lower confidence.`;

const MODEL = process.env.OR_MODEL || 'dots-studio/dots-3-note-preview:free';
const TIMEOUT_MS = Number(process.env.OR_TIMEOUT_MS || 120000);
const MAX_TOKENS = Number(process.env.OR_MAX_TOKENS || 6000);

const body = {
  model: MODEL,
  temperature: 0.1,
  max_tokens: MAX_TOKENS,
  reasoning: { effort: 'low' },
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    },
  ],
};

console.error(
  `calling ${MODEL} (${Math.round(b64.length / 1024)} KB base64, timeout ${TIMEOUT_MS}ms, max_tokens ${MAX_TOKENS})…`,
);

const t0 = Date.now();
const ac = new AbortController();
const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
let res;
try {
  res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: ac.signal,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://smojobuilds.local',
      'X-Title': 'BPB screenshot vision test',
    },
    body: JSON.stringify(body),
  });
} catch (err) {
  clearTimeout(timer);
  console.log(
    JSON.stringify(
      {
        ok: false,
        status: 0,
        ms: Date.now() - t0,
        model: MODEL,
        error: { message: err instanceof Error ? err.message : String(err) },
        content: null,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
clearTimeout(timer);
const ms = Date.now() - t0;
const text = await res.text();
/** @type {any} */
let json = null;
try {
  json = JSON.parse(text);
} catch {
  /* ignore */
}

const out = {
  ok: res.ok,
  status: res.status,
  ms,
  model: json?.model ?? MODEL,
  id: json?.id ?? null,
  usage: json?.usage ?? null,
  error: json?.error ?? (!res.ok ? text.slice(0, 800) : null),
  content: json?.choices?.[0]?.message?.content ?? null,
  reasoning:
    json?.choices?.[0]?.message?.reasoning ??
    json?.choices?.[0]?.message?.reasoning_content ??
    null,
  messageKeys: json?.choices?.[0]?.message
    ? Object.keys(json.choices[0].message)
    : [],
};

console.log(JSON.stringify(out, null, 2));
if (out.content) {
  console.error('\n--- content ---\n' + String(out.content).slice(0, 4000));
} else if (out.reasoning) {
  console.error('\n--- reasoning ---\n' + String(out.reasoning).slice(0, 4000));
}

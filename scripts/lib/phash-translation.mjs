/**
 * Godot 3 PHashTranslation reader (text resource from GDRE --bin-to-txt).
 * Hash + smaz match core/compressed_translation.cpp / thirdparty/misc/smaz.c
 */

const SMAZ_RCB = [
  ' ', 'the', 'e', 't', 'a', 'of', 'o', 'and', 'i', 'n', 's', 'e ', 'r', ' th',
  ' t', 'in', 'he', 'th', 'h', 'he ', 'to', '\r\n', 'l', 's ', 'd', ' a', 'an',
  'er', 'c', ' o', 'd ', 'on', ' of', 're', 'of ', 't ', ', ', 'is', 'u', 'at',
  ' ', 'n ', 'or', 'which', 'f', 'm', 'as', 'it', 'that', '\n', 'was', 'en',
  ' ', ' w', 'es', ' an', ' i', '\r', 'f ', 'g', 'p', 'nd', ' s', 'nd ', 'ed ',
  'w', 'ed', 'http://', 'for', 'te', 'ing', 'y ', 'The', ' c', 'ti', 'r ', 'his',
  'st', ' in', 'ar', 'nt', ',', ' to', 'y', 'ng', ' h', 'with', 'le', 'al', 'to ',
  'b', 'ou', 'be', 'were', ' b', 'se', 'o ', 'ent', 'ha', 'ng ', 'their', '"',
  'hi', 'from', ' f', 'in ', 'de', 'ion', 'me', 'v', '.', 've', 'all', 're ',
  'ri', 'ro', 'is ', 'co', 'f t', 'are', 'ea', '. ', 'her', ' m', 'er ', ' p',
  'es ', 'by', 'they', 'di', 'ra', 'ic', 'not', 's, ', 'd t', 'at ', 'ce', 'la',
  'h ', 'ne', 'as ', 'tio', 'on ', 'n t', 'io', 'we', ' a ', 'om', ', a', 's o',
  'ur', 'li', 'll', 'ch', 'had', 'this', 'e t', 'g ', 'e\r\n', ' wh', 'ere',
  ' co', 'e o', 'a ', 'us', ' d', 'ss', '\n\r\n', '\r\n\r', '="', ' be', ' e',
  's a', 'ma', 'one', 't t', 'or ', 'but', 'el', 'so', 'l ', 'e s', 's,', 'no',
  'ter', ' wa', 'iv', 'ho', 'e a', ' r', 'hat', 's t', 'ns', 'ch ', 'wh', 'tr',
  'ut', '/', 'have', 'ly ', 'ta', ' ha', ' on', 'tha', '-', ' l', 'ati', 'en ',
  'pe', ' re', 'there', 'ass', 'si', ' fo', 'wa', 'ec', 'our', 'who', 'its', 'z',
  'fo', 'rs', '>', 'ot', 'un', '<', 'im', 'th ', 'nc', 'ate', '><', 'ver', 'ad',
  ' we', 'ly', 'ee', ' n', 'id', ' cl', 'ac', 'il', '</', 'rt', ' wi', 'div',
  'e, ', ' it', 'whi', ' ma', 'ge', 'x', 'e c', 'men', '.com',
];

function u32(n) {
  return n >>> 0;
}

/** Godot PHashTranslation::hash */
export function phash(d, strBytes) {
  let h = u32(d);
  if (h === 0) h = 0x1000193;
  for (let i = 0; i < strBytes.length; i++) {
    h = u32(Math.imul(h, 0x1000193) ^ strBytes[i]);
  }
  return h;
}

export function smazDecompress(data) {
  const out = [];
  let i = 0;
  while (i < data.length) {
    const c = data[i];
    if (c === 254) {
      out.push(data[i + 1]);
      i += 2;
    } else if (c === 255) {
      const len = data[i + 1] + 1;
      for (let j = 0; j < len; j++) out.push(data[i + 2 + j]);
      i += 2 + len;
    } else {
      const s = SMAZ_RCB[c] || '';
      for (let j = 0; j < s.length; j++) out.push(s.charCodeAt(j) & 0xff);
      i += 1;
    }
  }
  return Buffer.from(out);
}

function parsePoolIntArray(text, name) {
  const m = text.match(new RegExp(`${name} = PoolIntArray\\(([\\s\\S]*?)\\)`));
  if (!m) throw new Error(`missing ${name}`);
  return m[1]
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => u32(Number(x)));
}

function parsePoolByteArray(text) {
  const m = text.match(/strings = PoolByteArray\(([\s\S]*)\)\s*$/);
  if (!m) throw new Error('missing strings');
  return Buffer.from(
    m[1]
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => Number(x) & 0xff),
  );
}

/**
 * @param {string} text GDRE text export of PHashTranslation
 */
export function loadPHashTranslation(text) {
  const hashTable = parsePoolIntArray(text, 'hash_table');
  const bucketTable = parsePoolIntArray(text, 'bucket_table');
  const strings = parsePoolByteArray(text);
  return { hashTable, bucketTable, strings };
}

/**
 * @returns {string|null}
 */
export function getMessage(table, key) {
  if (!table || key == null || key === '') return null;
  const keyb = Buffer.from(String(key), 'utf8');
  const { hashTable: ht, bucketTable: bt, strings } = table;
  const h0 = phash(0, keyb);
  const p = ht[h0 % ht.length];
  if (p === 0xffffffff) return null;

  const size = bt[p];
  const func = bt[p + 1];
  const h1 = phash(func, keyb);

  for (let i = 0; i < size; i++) {
    const base = p + 2 + i * 4;
    if (bt[base] !== h1) continue;
    const offset = bt[base + 1];
    const comp = bt[base + 2];
    const uncomp = bt[base + 3];
    const blob = strings.subarray(offset, offset + comp);
    let raw;
    if (comp === uncomp) {
      raw = blob[blob.length - 1] === 0 ? blob.subarray(0, blob.length - 1) : blob;
    } else {
      raw = smazDecompress(blob);
      if (raw[raw.length - 1] === 0) raw = raw.subarray(0, raw.length - 1);
    }
    return raw.toString('utf8');
  }
  return null;
}

/**
 * Lookup across multiple translation tables (first hit wins).
 * @returns {string|null}
 */
export function getMessageAny(tables, key) {
  for (const t of tables) {
    const msg = getMessage(t, key);
    if (msg != null && msg !== '') return msg;
  }
  return null;
}

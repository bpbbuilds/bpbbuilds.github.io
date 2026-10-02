/**
 * Inline item mentions in build notes: stored as [[item_id]], shown as chips.
 */

export const MENTION_RE = /\[\[([a-z0-9_]+)\]\]/gi;

/**
 * @param {string} s
 */
export function normalizeItemKey(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * @param {import('../pages/create/draft-io.js').DraftPlacement[] | null | undefined} placements
 * @returns {Set<string>}
 */
export function boardMentionIds(placements) {
  const ids = new Set();
  for (const p of placements || []) {
    if (p?.id) ids.add(String(p.id));
    for (const g of p?.gems || []) {
      if (g) ids.add(String(g));
    }
  }
  return ids;
}

/**
 * @param {string} query
 * @param {object[]} items
 * @param {{ allowedIds?: Set<string> | null, limit?: number }} [opts]
 * @returns {object[]}
 */
export function matchMentionItems(query, items, opts = {}) {
  const q = normalizeItemKey(query);
  if (!q) return [];
  const limit = opts.limit ?? 5;
  const allowed = opts.allowedIds || null;
  /** @type {{ item: object, score: number }[]} */
  const hits = [];
  for (const item of items) {
    if (!item?.id) continue;
    if (allowed && !allowed.has(String(item.id))) continue;
    const name = normalizeItemKey(item.name || '');
    const idKey = normalizeItemKey(String(item.id).replace(/_/g, ' '));
    let score = 0;
    if (name === q || idKey === q) score = 100;
    else if (name.startsWith(q) || idKey.startsWith(q)) score = 80;
    else if (name.includes(q) || idKey.includes(q)) score = 45;
    else continue;
    hits.push({ item, score });
  }
  hits.sort(
    (a, b) =>
      b.score - a.score ||
      String(a.item.name || '').localeCompare(String(b.item.name || '')),
  );
  return hits.slice(0, limit).map((h) => h.item);
}

/**
 * @param {object} item
 * @param {string} src
 * @returns {HTMLImageElement}
 */
export function mentionChipEl(item, src) {
  const img = document.createElement('img');
  img.className = 'bpb-mention';
  img.dataset.itemId = item.id;
  img.src = src;
  img.alt = item.name || item.id;
  img.title = item.name || item.id;
  img.width = 28;
  img.height = 28;
  img.draggable = false;
  img.contentEditable = 'false';
  return img;
}

/**
 * @param {string} s
 */
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Static HTML for published notes (build page).
 * @param {string} text
 * @param {Map<string, object>} itemsById
 * @param {(item: object) => string} getSpriteUrl
 */
export function notesToHtml(text, itemsById, getSpriteUrl) {
  const raw = String(text || '');
  if (!raw) return '';
  const parts = [];
  let last = 0;
  const re = new RegExp(MENTION_RE.source, 'gi');
  let m = re.exec(raw);
  while (m) {
    if (m.index > last) parts.push(escapeHtml(raw.slice(last, m.index)));
    const id = m[1];
    const item = itemsById.get(id);
    const src = item ? getSpriteUrl(item) : '';
    const name = item?.name || id;
    if (item && src) {
      parts.push(
        `<img class="bpb-mention" data-item-id="${escapeHtml(id)}" src="${escapeHtml(src)}" alt="${escapeHtml(name)}" title="${escapeHtml(name)}" width="28" height="28" draggable="false" />`,
      );
    } else {
      parts.push(escapeHtml(m[0]));
    }
    last = m.index + m[0].length;
    m = re.exec(raw);
  }
  if (last < raw.length) parts.push(escapeHtml(raw.slice(last)));
  return parts.join('');
}

/**
 * @param {HTMLElement} root
 */
export function serializeMentions(root) {
  let out = '';

  /**
   * @param {Node} node
   */
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent || '';
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.matches?.('img.bpb-mention')) {
      const id = String(node.dataset.itemId || '').trim();
      if (id) out += `[[${id}]]`;
      return;
    }
    if (node.tagName === 'BR') {
      out += '\n';
      return;
    }
    const block =
      node !== root &&
      /^(DIV|P|LI|H[1-6])$/.test(node.tagName) &&
      out.length &&
      !out.endsWith('\n');
    if (block) out += '\n';
    for (const child of node.childNodes) walk(child);
  }

  walk(root);
  return out.replace(/\u200b/g, '').replace(/\n{3,}/g, '\n\n');
}

/**
 * @param {HTMLElement} root
 * @param {string} text
 * @param {Map<string, object>} itemsById
 * @param {(item: object) => string} getSpriteUrl
 */
export function hydrateMentions(root, text, itemsById, getSpriteUrl) {
  root.replaceChildren();
  const raw = String(text || '');
  if (!raw) return;
  const re = new RegExp(MENTION_RE.source, 'gi');
  let last = 0;
  let m = re.exec(raw);
  /**
   * @param {string} chunk
   */
  function appendText(chunk) {
    const bits = chunk.split('\n');
    bits.forEach((bit, i) => {
      if (bit) root.appendChild(document.createTextNode(bit));
      if (i < bits.length - 1) root.appendChild(document.createElement('br'));
    });
  }
  while (m) {
    if (m.index > last) appendText(raw.slice(last, m.index));
    const item = itemsById.get(m[1]);
    const src = item ? getSpriteUrl(item) : '';
    if (item && src) root.appendChild(mentionChipEl(item, src));
    else appendText(m[0]);
    last = m.index + m[0].length;
    m = re.exec(raw);
  }
  if (last < raw.length) appendText(raw.slice(last));
}

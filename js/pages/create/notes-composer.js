/**
 * Contenteditable “Why it works” composer — chips, [name] insert, drag-drop.
 */

import {
  hydrateMentions,
  matchMentionItems,
  mentionChipEl,
  normalizeItemKey,
  serializeMentions,
} from '../../shared/item-mentions.js';

const ZWSP = '\u200b';

/**
 * @param {HTMLElement} el
 * @returns {boolean}
 */
function caretIn(el) {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return false;
  const node = sel.anchorNode;
  return Boolean(node && el.contains(node));
}

/**
 * @param {HTMLElement} el
 */
function textBeforeCaret(el) {
  const sel = window.getSelection();
  if (!sel?.rangeCount || !caretIn(el)) return '';
  const range = sel.getRangeAt(0);
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().replace(/\u200b/g, '');
}

/**
 * @param {HTMLElement} el
 * @param {number} clientX
 * @param {number} clientY
 */
function caretFromPoint(el, clientX, clientY) {
  const doc = document;
  /** @type {Range | null} */
  let range = null;
  if (typeof doc.caretRangeFromPoint === 'function') {
    range = doc.caretRangeFromPoint(clientX, clientY);
  } else {
    const pos = /** @type {any} */ (doc).caretPositionFromPoint?.(clientX, clientY);
    if (pos) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
    }
  }
  if (!range || !el.contains(range.startContainer)) return false;
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  return true;
}

/**
 * @param {HTMLElement} el
 * @param {{
 *   state?: ReturnType<import('./editor-state.js').createEditorState>,
 *   items: object[],
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   getAllowedIds: () => Set<string> | null,
 *   onChange?: (notes: string) => void,
 *   maxLength?: number,
 * }} opts
 */
export function mountNotesComposer(el, opts) {
  const { state = null, items, itemsById, getSpriteUrl, getAllowedIds } = opts;
  const maxLength = opts.maxLength ?? 4000;

  const suggest = document.createElement('ul');
  suggest.className = 'cr-mention-suggest';
  suggest.hidden = true;
  suggest.setAttribute('role', 'listbox');
  document.body.appendChild(suggest);

  /** @type {object[]} */
  let suggestions = [];
  let suggestIndex = 0;
  let suggestQuery = '';

  function hideSuggest() {
    suggest.hidden = true;
    suggestions = [];
    suggestQuery = '';
  }

  function commitNotes() {
    let next = serializeMentions(el);
    if (next.length > maxLength) next = next.slice(0, maxLength);
    el.classList.toggle('has-content', Boolean(next.trim()));
    if (opts.onChange) {
      opts.onChange(next);
      return;
    }
    if (state && state.getDraft().notes !== next) state.patchMeta({ notes: next });
  }

  /**
   * @param {object} item
   * @param {{ eatBracket?: boolean }} [opt]
   */
  function insertChip(item, opt = {}) {
    const src = getSpriteUrl(item);
    if (!src) return false;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return false;
    if (!caretIn(el)) {
      const end = document.createRange();
      end.selectNodeContents(el);
      end.collapse(false);
      sel.removeAllRanges();
      sel.addRange(end);
    }
    const range = sel.getRangeAt(0);
    if (opt.eatBracket) {
      const pre = textBeforeCaret(el);
      const m = pre.match(/\[([^\[\]]*)$/);
      if (m) {
        const eat = m[0].length;
        let remain = eat;
        let node = range.startContainer;
        let offset = range.startOffset;
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || '';
          const cut = Math.min(remain, offset);
          node.textContent = text.slice(0, offset - cut) + text.slice(offset);
          offset -= cut;
          remain -= cut;
          range.setStart(node, offset);
          range.collapse(true);
        }
        if (remain > 0) return false;
      }
    }
    range.deleteContents();
    const chip = mentionChipEl(item, src);
    range.insertNode(chip);
    const after = document.createTextNode(ZWSP);
    chip.after(after);
    range.setStart(after, 1);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    hideSuggest();
    commitNotes();
    return true;
  }

  function paintSuggest() {
    suggest.replaceChildren();
    if (!suggestions.length) {
      hideSuggest();
      return;
    }
    suggestions.forEach((item, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `cr-mention-suggest__item${i === suggestIndex ? ' is-on' : ''}`;
      const src = getSpriteUrl(item);
      btn.innerHTML = `${
        src
          ? `<img class="cr-mention-suggest__img" src="${src.replace(/"/g, '&quot;')}" alt="" width="22" height="22" />`
          : ''
      }<span>${String(item.name || item.id)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')}</span>`;
      btn.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        insertChip(item, { eatBracket: true });
      });
      li.appendChild(btn);
      suggest.appendChild(li);
    });
    const rect = (() => {
      const sel = window.getSelection();
      if (!sel?.rangeCount) return el.getBoundingClientRect();
      const r = sel.getRangeAt(0).getBoundingClientRect();
      if (r.width || r.height) return r;
      return el.getBoundingClientRect();
    })();
    suggest.hidden = false;
    suggest.style.left = `${Math.round(rect.left)}px`;
    suggest.style.top = `${Math.round(rect.bottom + 4)}px`;
  }

  function refreshSuggest() {
    if (!caretIn(el)) {
      hideSuggest();
      return;
    }
    const pre = textBeforeCaret(el);
    const open = pre.match(/\[([^\[\]]*)$/);
    if (!open || pre.includes(']', pre.length - open[0].length)) {
      hideSuggest();
      return;
    }
    const q = open[1];
    const allowed = getAllowedIds();
    if (!q) {
      if (!allowed?.size) {
        hideSuggest();
        return;
      }
      const seen = new Set();
      suggestions = [];
      for (const item of items) {
        const id = String(item?.id || '');
        if (!id || seen.has(id) || !allowed.has(id)) continue;
        seen.add(id);
        suggestions.push(item);
      }
      suggestions.sort((a, b) =>
        String(a.name || a.id).localeCompare(String(b.name || b.id)),
      );
      suggestions = suggestions.slice(0, 12);
    } else {
      suggestions = matchMentionItems(q, items, {
        allowedIds: allowed,
        limit: 8,
      });
    }
    suggestQuery = q;
    suggestIndex = 0;
    paintSuggest();
  }

  function tryCloseBracket() {
    const pre = textBeforeCaret(el);
    const closed = pre.match(/\[([^\[\]]+)\]$/);
    if (!closed) return;
    const hits = matchMentionItems(closed[1], items, {
      allowedIds: getAllowedIds(),
      limit: 3,
    });
    const best = hits[0];
    if (!best) return;
    const q = closed[1];
    const exact =
      hits.length === 1 ||
      normalizeItemKey(best.name) === normalizeItemKey(q) ||
      normalizeItemKey(String(best.id).replace(/_/g, ' ')) ===
        normalizeItemKey(q);
    if (!exact && hits.length !== 1) return;
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;
    const text = node.textContent || '';
    const eat = closed[0].length;
    if (range.startOffset < eat) return;
    node.textContent =
      text.slice(0, range.startOffset - eat) + text.slice(range.startOffset);
    range.setStart(node, range.startOffset - eat);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    insertChip(best);
  }

  /** @param {Event} e */
  function onInput() {
    tryCloseBracket();
    refreshSuggest();
    commitNotes();
  }

  /** @param {KeyboardEvent} e */
  function onKeyDown(e) {
    if (suggest.hidden || !suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      suggestIndex = (suggestIndex + 1) % suggestions.length;
      paintSuggest();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      suggestIndex = (suggestIndex - 1 + suggestions.length) % suggestions.length;
      paintSuggest();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertChip(suggestions[suggestIndex], { eatBracket: true });
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      hideSuggest();
    }
  }

  /** @param {ClipboardEvent} e */
  function onPaste(e) {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') || '';
    document.execCommand('insertText', false, text);
  }

  /** @param {DragEvent} e */
  function onNativeDrag(e) {
    e.preventDefault();
  }

  function onBlur() {
    window.setTimeout(() => hideSuggest(), 120);
    if (!serializeMentions(el).trim()) {
      el.replaceChildren();
      el.classList.remove('has-content');
    }
  }

  el.addEventListener('input', onInput);
  el.addEventListener('keydown', onKeyDown);
  el.addEventListener('paste', onPaste);
  el.addEventListener('dragover', onNativeDrag);
  el.addEventListener('drop', onNativeDrag);
  el.addEventListener('blur', onBlur);

  return {
    el,
    /**
     * @param {string} text
     */
    setNotes(text) {
      const cur = serializeMentions(el);
      if (cur === String(text || '')) return;
      if (caretIn(el)) return;
      hydrateMentions(el, text, itemsById, getSpriteUrl);
      el.classList.toggle('has-content', Boolean(String(text || '').trim()));
    },
    /**
     * @param {string} itemId
     * @param {{ clientX?: number, clientY?: number }} [at]
     */
    insertItem(itemId, at = {}) {
      const allowed = getAllowedIds();
      if (allowed && !allowed.has(String(itemId))) return false;
      const item = itemsById.get(itemId);
      if (!item) return false;
      el.focus();
      if (at.clientX != null && at.clientY != null) {
        caretFromPoint(el, at.clientX, at.clientY);
      }
      return insertChip(item);
    },
    /**
     * @param {number} clientX
     * @param {number} clientY
     */
    isOver(clientX, clientY) {
      const r = el.getBoundingClientRect();
      return (
        clientX >= r.left &&
        clientX <= r.right &&
        clientY >= r.top &&
        clientY <= r.bottom
      );
    },
    destroy() {
      hideSuggest();
      suggest.remove();
      el.removeEventListener('input', onInput);
      el.removeEventListener('keydown', onKeyDown);
      el.removeEventListener('paste', onPaste);
      el.removeEventListener('dragover', onNativeDrag);
      el.removeEventListener('drop', onNativeDrag);
      el.removeEventListener('blur', onBlur);
    },
  };
}

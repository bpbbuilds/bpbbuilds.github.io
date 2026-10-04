/**
 * Builds filter search field — free text, @user, [Item] chips with suggest.
 */

import {
  matchMentionItems,
  mentionChipEl,
  serializeMentions,
} from './item-mentions.js';
import { faceHtml, hydrateFaces } from './blob-face.js';
import {
  matchSearchUsers,
  parseBuildSearchQuery,
  resolveBuildSearchItems,
} from './build-search.js';

const ZWSP = '\u200b';

/**
 * @param {HTMLElement} el
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
 * Mount chip search inside a host that already has `[data-build-search]`.
 * @param {HTMLElement} host — shade / field wrapper containing `[data-build-search]`
 * @param {{
 *   items: object[],
 *   getSpriteUrl: (item: object) => string,
 *   users?: { name: string, avatar_url?: string | null, equipped_avatar?: string | null }[],
 *   root?: string,
 *   initialQuery?: string,
 *   placeholder?: string,
 *   debounceMs?: number,
 *   onChange: (q: string, parsed: import('./build-search.js').ParsedBuildSearch) => void,
 * }} opts
 */
export function mountBuildSearchInput(host, opts) {
  let el = host.querySelector('[data-build-search]');
  if (!(el instanceof HTMLElement)) {
    el = document.createElement('div');
    el.className = 'bpb-build-search cr-input';
    el.setAttribute('data-build-search', '');
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('role', 'searchbox');
    el.setAttribute('aria-label', 'Search builds');
    el.setAttribute(
      'data-placeholder',
      opts.placeholder || 'Title, @user, [Item]…',
    );
    host.appendChild(el);
  }

  el.contentEditable = 'true';
  el.classList.add('bpb-build-search');
  if (!el.getAttribute('data-placeholder')) {
    el.setAttribute(
      'data-placeholder',
      opts.placeholder || 'Title, @user, [Item]…',
    );
  }

  /** @type {object[]} */
  let items = Array.isArray(opts.items) ? opts.items : [];
  /** @type {{ name: string, avatar_url?: string | null, equipped_avatar?: string | null }[]} */
  let users = Array.isArray(opts.users) ? opts.users : [];
  const getSpriteUrl = opts.getSpriteUrl;
  const root = opts.root || '';
  const debounceMs = opts.debounceMs ?? 220;

  const suggest = document.createElement('ul');
  suggest.className = 'cr-mention-suggest bpb-build-search__suggest';
  suggest.hidden = true;
  suggest.setAttribute('role', 'listbox');
  document.body.appendChild(suggest);

  /** @type {object[]} */
  let suggestions = [];
  /** @type {'item' | 'user' | null} */
  let suggestKind = null;
  let suggestIndex = 0;
  let timer = 0;

  function hideSuggest() {
    suggest.hidden = true;
    suggestions = [];
    suggestKind = null;
  }

  function syncEmpty() {
    const q = serializeMentions(el).trim();
    el.classList.toggle('has-content', Boolean(q));
  }

  function emit() {
    const q = serializeMentions(el);
    syncEmpty();
    const parsed = resolveBuildSearchItems(parseBuildSearchQuery(q), items);
    opts.onChange(q, parsed);
  }

  function scheduleEmit() {
    window.clearTimeout(timer);
    timer = window.setTimeout(emit, debounceMs);
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
    const after = document.createTextNode(ZWSP + ' ');
    chip.after(after);
    range.setStart(after, after.length);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    hideSuggest();
    emit();
    return true;
  }

  /**
   * @param {number} eat
   */
  function cutBeforeCaret(eat) {
    const sel = window.getSelection();
    if (!sel?.rangeCount || eat < 1) return false;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    const offset = range.startOffset;
    if (node.nodeType !== Node.TEXT_NODE || offset < eat) return false;
    const text = node.textContent || '';
    node.textContent = text.slice(0, offset - eat) + text.slice(offset);
    range.setStart(node, offset - eat);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  }

  /**
   * @param {{ name: string, avatar_url?: string | null, equipped_avatar?: string | null }} user
   */
  function userFaceHtml(user, className) {
    const face = faceHtml(
      {
        avatar_url: user.avatar_url || null,
        equipped_avatar: user.equipped_avatar || null,
      },
      root,
      { size: 22, className, alt: '' },
    );
    if (face) return face;
    const parts = String(user.name || '').split(/\s+/).filter(Boolean);
    const letters =
      parts.length >= 2
        ? `${parts[0][0]}${parts[1][0]}`
        : String(user.name || '?').slice(0, 2);
    return `<span class="cr-mention-suggest__initials" aria-hidden="true">${letters
      .toUpperCase()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')}</span>`;
  }

  /**
   * @param {{ name: string, avatar_url?: string | null, equipped_avatar?: string | null }} user
   */
  function insertUser(user) {
    const name = String(user?.name || '').replace(/[{}]/g, '').trim();
    if (!name) return false;
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
    const pre = textBeforeCaret(el);
    const typed = pre.match(/@([^\s@[\]{}]*)$/);
    if (!typed || !cutBeforeCaret(typed[0].length)) return false;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const chip = document.createElement('span');
    chip.className = 'bpb-user-mention';
    chip.contentEditable = 'false';
    chip.dataset.userName = name;
    chip.innerHTML = userFaceHtml(user, 'bpb-user-mention__face');
    const label = document.createElement('span');
    label.className = 'bpb-user-mention__name';
    label.textContent = name;
    chip.appendChild(label);
    range.insertNode(chip);
    const after = document.createTextNode(ZWSP + ' ');
    chip.after(after);
    range.setStart(after, after.length);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    hideSuggest();
    void hydrateFaces(el, root);
    emit();
    return true;
  }

  function paintSuggest() {
    suggest.replaceChildren();
    if (!suggestions.length) {
      hideSuggest();
      return;
    }
    suggestions.forEach((entry, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `cr-mention-suggest__item${i === suggestIndex ? ' is-on' : ''}`;
      if (suggestKind === 'user') {
        btn.innerHTML = `${userFaceHtml(entry, 'cr-mention-suggest__face')}<span class="cr-mention-suggest__name"></span>`;
        const nameEl = btn.querySelector('.cr-mention-suggest__name');
        if (nameEl) nameEl.textContent = String(entry.name || '');
        btn.addEventListener('mousedown', (ev) => {
          ev.preventDefault();
          insertUser(entry);
        });
      } else {
        const src = getSpriteUrl(entry);
        btn.innerHTML = `${
          src
            ? `<img class="cr-mention-suggest__img" src="${src.replace(/"/g, '&quot;')}" alt="" width="22" height="22" />`
            : ''
        }<span>${String(entry.name || entry.id)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')}</span>`;
        btn.addEventListener('mousedown', (ev) => {
          ev.preventDefault();
          insertChip(entry, { eatBracket: true });
        });
      }
      li.appendChild(btn);
      suggest.appendChild(li);
    });
    if (suggestKind === 'user') void hydrateFaces(suggest, root);
    suggest.hidden = false;
    const rect = el.getBoundingClientRect();
    suggest.style.left = `${Math.round(rect.left)}px`;
    suggest.style.top = `${Math.round(rect.bottom + 4)}px`;
    suggest.style.minWidth = `${Math.round(rect.width)}px`;
  }

  function updateSuggest() {
    const pre = textBeforeCaret(el);
    const open = pre.match(/\[([^\[\]]*)$/);
    if (!open) {
      hideSuggest();
      return;
    }
    const q = open[1];
    suggestKind = 'item';
    suggestions = matchMentionItems(q, items, { limit: 8 });
    suggestIndex = 0;
    paintSuggest();
    return;
  }

  function updateUserSuggest() {
    const pre = textBeforeCaret(el);
    const open = pre.match(/(?:^|\s)@([^\s@[\]{}]*)$/);
    if (!open || !users.length) {
      hideSuggest();
      return;
    }
    suggestKind = 'user';
    suggestions = matchSearchUsers(open[1], users, 8);
    suggestIndex = 0;
    paintSuggest();
  }

  function tryCloseBracket() {
    const pre = textBeforeCaret(el);
    const closed = pre.match(/\[([^\[\]]+)\]$/);
    if (!closed) return false;
    const hits = matchMentionItems(closed[1], items, { limit: 1 });
    const best = hits[0];
    if (!best) return false;
    const eat = closed[0].length;
    const sel = window.getSelection();
    if (!sel?.rangeCount) return false;
    const range = sel.getRangeAt(0);
    let node = range.startContainer;
    let offset = range.startOffset;
    let remain = eat;
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      const cut = Math.min(remain, offset);
      node.textContent = text.slice(0, offset - cut) + text.slice(offset);
      offset -= cut;
      remain -= cut;
      range.setStart(node, offset);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    if (remain > 0) return false;
    return insertChip(best);
  }

  el.addEventListener('input', () => {
    syncEmpty();
    if (!tryCloseBracket()) {
      const pre = textBeforeCaret(el);
      if (/\[([^\[\]]*)$/.test(pre)) updateSuggest();
      else updateUserSuggest();
    }
    scheduleEmit();
  });

  el.addEventListener('keydown', (e) => {
    if (!suggest.hidden && suggestions.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        suggestIndex = (suggestIndex + 1) % suggestions.length;
        paintSuggest();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        suggestIndex = (suggestIndex - 1 + suggestions.length) % suggestions.length;
        paintSuggest();
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (suggestKind === 'user') insertUser(suggestions[suggestIndex]);
        else insertChip(suggestions[suggestIndex], { eatBracket: true });
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        hideSuggest();
        return;
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      emit();
    }
  });

  el.addEventListener('blur', () => {
    window.setTimeout(hideSuggest, 150);
  });

  el.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') || '';
    document.execCommand('insertText', false, text);
  });

  if (opts.initialQuery) {
    // Plain initial — no hydrate of [[id]] without itemsById; set text only.
    el.textContent = String(opts.initialQuery).replace(/\[\[([a-z0-9_]+)\]\]/gi, '[$1]');
    syncEmpty();
  } else {
    syncEmpty();
  }

  return {
    getQuery: () => serializeMentions(el),
    getParsed: () =>
      resolveBuildSearchItems(parseBuildSearchQuery(serializeMentions(el)), items),
    setItems(next) {
      items = Array.isArray(next) ? next : [];
    },
    setUsers(next) {
      users = Array.isArray(next) ? next : [];
    },
    setQuery(q) {
      el.textContent = String(q || '');
      syncEmpty();
      emit();
    },
    clear() {
      el.replaceChildren();
      syncEmpty();
      emit();
    },
    destroy() {
      window.clearTimeout(timer);
      hideSuggest();
      suggest.remove();
    },
  };
}

/**
 * Markup for a Patch3 search shade (host for mountBuildSearchInput).
 * @param {string} [placeholder]
 * @param {string | false} [hint] default @user hint; false hides it
 */
export function buildSearchFieldHtml(placeholder = 'Title, @user, [Item]…', hint) {
  const ph = String(placeholder)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
  const hintText =
    hint === undefined
      ? '@user · [Item] with icon · free text for title / items / author'
      : hint;
  const hintHtml = hintText
    ? `<p class="cr-hint bpb-build-search__hint">${String(hintText)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')}</p>`
    : '';
  return `
    <div class="il-filter__shade cr-field-shade bpb-build-search-shade">
      <label class="cr-field">
        <span class="cr-label cr-label--sm">Search</span>
        <div
          class="bpb-build-search cr-input"
          data-build-search
          contenteditable="true"
          role="searchbox"
          aria-label="Search builds"
          data-placeholder="${ph}"
          spellcheck="false"
        ></div>
      </label>
      ${hintHtml}
    </div>`;
}

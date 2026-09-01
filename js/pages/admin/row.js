/**
 * Shared admin row helpers — card with board thumb + View build.
 */

/**
 * @param {object} b
 * @param {string} root
 */
export function buildHref(b, root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const slug = String(b.slug || '');
  return `${base}builds/view/?slug=${encodeURIComponent(slug)}`;
}

/**
 * @param {object} b
 */
export function flagBadges(b) {
  const bits = [];
  if (b.is_op) bits.push('<span class="admin-flag admin-flag--op">OP</span>');
  if (b.op_requested && !b.is_op) {
    bits.push('<span class="admin-flag admin-flag--pending">OP requested</span>');
  }
  if (b.is_featured) bits.push('<span class="admin-flag admin-flag--featured">Featured</span>');
  if (!b.is_public) bits.push('<span class="admin-flag admin-flag--hidden">Hidden</span>');
  const authTag = b.build_tag === 'theorycraft' ? 'theory' : b.build_tag;
  if (authTag === 'feasible') bits.push('<span class="admin-flag">Feasible</span>');
  if (authTag === 'theory') bits.push('<span class="admin-flag">Theory</span>');
  if (authTag === 'real') bits.push('<span class="admin-flag">Real</span>');
  return bits.join('');
}

/**
 * @param {object} b
 * @param {string} root
 * @param {string[]} actionKeys
 */
export function buildCardHtml(b, root, actionKeys) {
  const href = buildHref(b, root);
  const when = formatWhen(b.created_at);
  const slug = String(b.slug || '');
  const actions = actionKeys
    .map((key) => {
      const label = ACTION_LABELS[key] || key;
      const kind = ACTION_KINDS[key] || '';
      return `<button type="button" class="admin-btn ${kind}" data-admin-action="${escapeAttr(key)}" data-slug="${escapeAttr(slug)}">${escapeHtml(label)}</button>`;
    })
    .join('');

  return `
    <article class="admin-card" data-slug="${escapeAttr(slug)}">
      <a
        class="admin-card__board"
        href="${escapeAttr(href)}"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open ${escapeAttr(b.title || slug)}"
      >
        <span
          class="admin-card__board-host builds-post__board"
          data-feed-board="${escapeAttr(slug)}"
          aria-hidden="true"
        ></span>
      </a>
      <div class="admin-card__body">
        <div class="admin-card__text">
          <h3 class="admin-card__title">
            <a class="admin-card__link" href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(b.title || slug)}</a>
          </h3>
          <p class="admin-card__meta">${escapeHtml(b.author_name || '—')} · ${escapeHtml(b.hero_class || '—')}${when ? ` · ${escapeHtml(when)}` : ''}</p>
          <div class="admin-card__flags">${flagBadges(b)}</div>
        </div>
        <div class="admin-card__actions">
          <a class="admin-btn admin-btn--view" href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">View build</a>
          ${actions}
        </div>
      </div>
    </article>
  `;
}

/** @deprecated use buildCardHtml */
export function buildRowHtml(b, root, actionKeys) {
  return buildCardHtml(b, root, actionKeys);
}

const ACTION_LABELS = {
  approve_op: 'Approve OP',
  deny_op: 'Deny OP',
  set_featured: 'Feature',
  unset_featured: 'Unfeature',
  hide: 'Hide',
  restore: 'Restore',
};

const ACTION_KINDS = {
  approve_op: 'admin-btn--ok',
  deny_op: 'admin-btn--warn',
  set_featured: 'admin-btn--accent',
  unset_featured: '',
  hide: 'admin-btn--warn',
  restore: 'admin-btn--ok',
};

/**
 * @param {object} b
 * @param {'pending' | 'all' | 'featured' | 'hidden'} mode
 * @returns {string[]}
 */
export function actionsForBuild(b, mode) {
  /** @type {string[]} */
  const keys = [];
  if (b.op_requested && !b.is_op) {
    keys.push('approve_op', 'deny_op');
  }
  if (b.is_featured) keys.push('unset_featured');
  else keys.push('set_featured');
  if (b.is_public) keys.push('hide');
  else keys.push('restore');
  if (mode === 'pending') {
    return keys.filter(
      (k) => k === 'approve_op' || k === 'deny_op' || k === 'set_featured' || k === 'hide',
    );
  }
  return keys;
}

function formatWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

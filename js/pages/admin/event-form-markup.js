/**
 * Event form fields — one layout for new and edit.
 */

import { PLACE_LABELS, scheduleError, slugEventId, statusFromSchedule } from './event-form-model.js';
import { discordRoleField, readPlaceDiscordRole } from './discord-roles.js';

/** @typedef {import('./event-form-model.js').EventFormValues} EventFormValues */
/** @typedef {import('./event-form-model.js').EventFormPlace} EventFormPlace */

/**
 * @param {string} s
 */
function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
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

/** Gold diamond divider, same idea as the rewards plate rule. */
export function diamondRule() {
  return `<div class="admin-event-form__rule" aria-hidden="true"><span class="admin-event-form__rule-line"></span><svg class="admin-event-form__rule-diamond" viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path fill="currentColor" d="M5 0.8 L9.2 5 L5 9.2 L0.8 5 Z"/></svg><span class="admin-event-form__rule-line"></span></div>`;
}

/**
 * @param {string} value
 * @param {string} assetBase
 */
function previewSrc(value, assetBase) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (/^(blob:|data:|https?:)/i.test(v)) return v;
  const base = assetBase.endsWith('/') ? assetBase : `${assetBase}/`;
  return `${base}${v.replace(/^\//, '')}`;
}

/**
 * Banner / title icon — click opens the file picker, and the zone accepts a drop.
 * @param {string} id
 * @param {string} name
 * @param {string} label
 * @param {string} value
 * @param {string} assetBase
 * @param {{ span?: boolean, wide?: boolean }} [opts]
 */
export function imageDropField(id, name, label, value, assetBase, opts = {}) {
  const src = previewSrc(value, assetBase);
  const span = opts.span ? ' admin-event-form__span' : '';
  const wide = opts.wide ? ' admin-event-form__drop--wide' : '';
  const hint = src ? value.split('/').pop() || value : 'Drop an image, or click to browse';
  return `<div class="il-filter__shade cr-field-shade${span}">
    <p class="cr-label" id="${id}-label">${escapeHtml(label)}</p>
    <div class="admin-event-form__drop${wide}" data-event-drop tabindex="0" role="button" aria-labelledby="${id}-label">
      <img class="admin-event-form__drop-preview" alt="" ${src ? `src="${escapeAttr(src)}"` : 'hidden'} draggable="false" />
      <p class="admin-event-form__drop-hint">${escapeHtml(hint)}</p>
      <input id="${id}-file" class="admin-event-form__drop-file" type="file" accept="image/png,image/webp,image/jpeg,image/gif" tabindex="-1" />
    </div>
    <input id="${id}" type="hidden" name="${name}" value="${escapeAttr(value)}" />
  </div>`;
}

/**
 * @param {ParentNode} root
 * @returns {() => void}
 */
export function bindImageDrops(root) {
  /** @type {string[]} */
  const urls = [];
  root.querySelectorAll('[data-event-drop]').forEach((zone) => {
    if (!(zone instanceof HTMLElement)) return;
    const fileInput = zone.querySelector('input[type="file"]');
    const hidden = zone.parentElement?.querySelector('input[type="hidden"]');
    const preview = zone.querySelector('img');
    const hint = zone.querySelector('.admin-event-form__drop-hint');
    if (!(fileInput instanceof HTMLInputElement) || !(hidden instanceof HTMLInputElement)) return;
    if (!(preview instanceof HTMLImageElement) || !(hint instanceof HTMLElement)) return;

    const apply = async (file) => {
      if (!file) return;
      if (!String(file.type || '').startsWith('image/')) {
        setEventFormStatus('Use a PNG, WebP, JPEG, or GIF.', true);
        return;
      }
      if (file.size > 5 * 1024 * 1024) return setEventFormStatus('Event images must be 5 MB or smaller.', true);
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read image.'));
        reader.readAsDataURL(file);
      });
      const url = URL.createObjectURL(file);
      urls.push(url);
      preview.src = url;
      preview.hidden = false;
      hint.textContent = file.name;
      hidden.value = data;
      zone.classList.add('has-image');
      setEventFormStatus('', false);
    };

    zone.addEventListener('click', () => fileInput.click());
    zone.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      fileInput.click();
    });
    fileInput.addEventListener('click', (e) => e.stopPropagation());
    fileInput.addEventListener('change', () => apply(fileInput.files?.[0]).catch((err) => setEventFormStatus(err.message, true)));
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('is-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('is-over');
      apply(e.dataTransfer?.files?.[0]).catch((err) => setEventFormStatus(err.message, true));
    });
    if (preview.getAttribute('src')) zone.classList.add('has-image');
  });
  return () => {
    for (const url of urls) URL.revokeObjectURL(url);
  };
}
export function textField(id, name, label, value, opts = {}) {
  const span = opts.span ? ' admin-event-form__span' : '';
  const hint = opts.hint ? `<p class="cr-hint">${escapeHtml(opts.hint)}</p>` : '';
  return `<div class="il-filter__shade cr-field-shade${span}">
    <label class="cr-label" for="${id}">${escapeHtml(label)}</label>
    <input id="${id}" class="cr-input" name="${name}" type="${opts.type || 'text'}" value="${escapeAttr(value)}"
      ${opts.required ? 'required' : ''} ${opts.min ? `min="${opts.min}"` : ''}
      ${opts.placeholder ? `placeholder="${escapeAttr(opts.placeholder)}"` : ''}
      ${opts.data || ''} autocomplete="off" />
    ${hint}
  </div>`;
}

/**
 * @param {string} slug
 * @param {boolean} editing
 */
export function slugField(slug, editing) {
  const editBtn = editing
    ? ''
    : `<button type="button" class="cr-btn-quiet admin-event-form__slug-edit" data-event-slug-edit>Edit slug</button>`;
  return `<div class="il-filter__shade cr-field-shade">
    <div class="admin-event-form__slug-row">
      <label class="cr-label" for="ev-slug">Slug</label>
      ${editBtn}
    </div>
    <input id="ev-slug" class="cr-input" name="slug" type="text" required readonly
      maxlength="48" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value="${escapeAttr(slug)}"
      title="lowercase letters, numbers, hyphens" data-event-slug autocomplete="off" />
    <p class="cr-hint">${editing ? 'Slug stays put so existing links keep working.' : 'Auto from the title. Edit slug only if you must override.'}</p>
  </div>`;
}

/**
 * @param {string} id
 * @param {string} name
 * @param {string} label
 * @param {readonly { id: string, label: string }[]} options
 * @param {string} value
 * @param {boolean} [span]
 */
export function selectField(id, name, label, options, value, span = false) {
  const opts = options
    .map(
      (o) =>
        `<option value="${escapeAttr(o.id)}"${o.id === value ? ' selected' : ''}>${escapeHtml(o.label)}</option>`,
    )
    .join('');
  return `<div class="il-filter__shade cr-field-shade${span ? ' admin-event-form__span' : ''}">
    <label class="cr-label" for="${id}">${escapeHtml(label)}</label>
    <select id="${id}" class="cr-input" name="${name}">${opts}</select>
  </div>`;
}

/**
 * @param {string} id
 * @param {string} name
 * @param {string} label
 * @param {string} value
 */
export function dateField(id, name, label, value) {
  return `<div class="il-filter__shade cr-field-shade">
    <label class="cr-label" for="${id}">${escapeHtml(label)}</label>
    <input id="${id}" class="cr-input" name="${name}" type="datetime-local" value="${escapeAttr(value)}" />
  </div>`;
}

/**
 * @param {string} id
 * @param {string} name
 * @param {string} label
 * @param {string} value
 * @param {string} placeholder
 */
export function areaField(id, name, label, value, placeholder) {
  return `<div class="il-filter__shade cr-field-shade admin-event-form__span">
    <label class="cr-label" for="${id}">${escapeHtml(label)}</label>
    <textarea id="${id}" class="cr-input cr-textarea" name="${name}" rows="3" maxlength="500"
      placeholder="${escapeAttr(placeholder)}">${escapeHtml(value)}</textarea>
  </div>`;
}

/**
 * @param {string} id
 * @param {string} name
 * @param {string} label
 * @param {boolean} on
 */
export function checkField(id, name, label, on) {
  return `<div class="il-filter__shade cr-field-shade admin-event-form__span">
    <label class="admin-event-form__check" for="${id}">
      <input id="${id}" type="checkbox" name="${name}" ${on ? 'checked' : ''} />
      <span>${escapeHtml(label)}</span>
    </label>
  </div>`;
}

/**
 * @param {EventFormValues} values
 */
export function modesField(values) {
  return `<div class="il-filter__shade cr-field-shade admin-event-form__span">
    <p class="cr-label" id="ev-modes-label">Allowed modes</p>
    <div class="admin-event-form__checks" role="group" aria-labelledby="ev-modes-label">
      <label class="admin-event-form__check">
        <input type="checkbox" name="modeRanked" ${values.modeRanked ? 'checked' : ''} />
        <span>Ranked</span>
      </label>
      <label class="admin-event-form__check">
        <input type="checkbox" name="modeUnranked" ${values.modeUnranked ? 'checked' : ''} />
        <span>Unranked</span>
      </label>
    </div>
    <p class="cr-hint">Customs do not count. DPS Stone allows ranked and unranked.</p>
  </div>`;
}

/**
 * @param {string} label
 * @param {number} index
 * @param {EventFormPlace} place
 * @param {string} [assetBase]
 */
export function placeHtml(label, index, place, assetBase = '../') {
  const base = assetBase.endsWith('/') ? assetBase : `${assetBase}/`;
  const trophy = `${base}assets/icons/history/Trophy.png`;
  const cell = (key, fieldLabel, value, placeholder) => `
    <div>
      <label class="admin-event-form__key" for="ev-${index}-${key}">${fieldLabel}</label>
      <input id="ev-${index}-${key}" class="cr-input" name="place-${index}-${key}" type="${key === 'gold' ? 'number' : 'text'}"
        ${key === 'gold' ? 'min="0"' : ''} value="${escapeAttr(value)}" placeholder="${escapeAttr(placeholder)}" />
    </div>`;
  const rule = index > 0 ? diamondRule() : '';
  return `${rule}<section class="admin-event-form__place">
    <div class="admin-event-form__place-head">
      <img class="admin-event-form__trophy" src="${escapeAttr(trophy)}" alt="" width="28" height="28" draggable="false" />
      <h3 class="admin-event-form__place-name">${escapeHtml(`${label} place`)}</h3>
    </div>
    <div class="admin-event-form__place-grid">
      ${cell('gold', 'Gold', place.gold, '500')}
      ${discordRoleField(index, place)}
      ${cell('giftCard', 'Gift card', place.giftCard, '$10 GC')}
      ${cell('cosmeticId', 'Cosmetic id', place.cosmeticId, 'premium_crown')}
    </div>
  </section>`;
}

/**
 * @param {string} message
 * @param {boolean} isError
 */
export function setEventFormStatus(message, isError) {
  const el = document.querySelector('[data-event-form-status]');
  if (!(el instanceof HTMLElement)) return;
  el.hidden = !message;
  el.textContent = message;
  el.classList.toggle('is-error', isError);
}

/**
 * @param {HTMLFormElement} form
 */
export function readSchedule(form) {
  const text = (name) => {
    const el = form.elements.namedItem(name);
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
      return el.value.trim();
    }
    return '';
  };
  const on = (name) => {
    const el = form.elements.namedItem(name);
    return el instanceof HTMLInputElement && el.checked;
  };
  const entriesEnabled = on('entriesEnabled');
  const votingEnabled = on('votingEnabled');
  return {
    startsAt: text('startsAt'),
    endsAt: text('endsAt'),
    entriesEnabled,
    entriesOpenAt: entriesEnabled ? text('entriesOpenAt') : '',
    entriesCloseAt: entriesEnabled ? text('entriesCloseAt') : '',
    votingEnabled,
    votingStartsAt: votingEnabled ? text('votingStartsAt') : '',
    votingEndsAt: votingEnabled ? text('votingEndsAt') : '',
  };
}

/**
 * @param {HTMLFormElement} form
 * @returns {{ ok: true, values: EventFormValues } | { ok: false, error: string }}
 */
export function readEventForm(form) {
  const text = (name) => {
    const el = form.elements.namedItem(name);
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
      return el.value.trim();
    }
    return '';
  };
  const on = (name) => {
    const el = form.elements.namedItem(name);
    return el instanceof HTMLInputElement && el.checked;
  };
  const title = text('title');
  const slug = text('slug') || slugEventId(title);
  if (!title) return { ok: false, error: 'Add a title.' };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { ok: false, error: 'Slug uses lowercase letters, numbers, and hyphens.' };
  }
  if (on('entriesEnabled')) {
    if (!on('modeRanked') && !on('modeUnranked')) {
      return { ok: false, error: 'Pick ranked, unranked, or both.' };
    }
    if (!(Math.round(Number(text('judgeWindowSec'))) >= 1)) {
      return { ok: false, error: 'Judge window is at least 1 second.' };
    }
    if (!(Math.round(Number(text('maxEntriesPerUser'))) >= 1)) {
      return { ok: false, error: 'Max entries is at least 1.' };
    }
  }
  const discord = text('discordHref');
  if (discord && !/^https:\/\//i.test(discord)) {
    return { ok: false, error: 'Discord link starts with https://.' };
  }
  const schedule = readSchedule(form);
  const scheduleProblem = scheduleError(schedule);
  if (scheduleProblem) return { ok: false, error: scheduleProblem };
  const type = text('type');
  const leaderboardEnabled = on('leaderboardEnabled');
  const board = text('leaderboardVisibility');
  return {
    ok: true,
    values: {
      slug,
      title,
      type: type === 'craft' || type === 'showcase' ? type : 'dps-stone',
      status: statusFromSchedule(schedule),
      featured: on('featured'),
      tag: text('tag'),
      blurb: text('blurb'),
      image: text('image'),
      titleIcon: text('titleIcon'),
      discordHref: discord,
      startsAt: schedule.startsAt,
      endsAt: schedule.endsAt,
      entriesEnabled: schedule.entriesEnabled,
      entriesOpenAt: schedule.entriesOpenAt,
      entriesCloseAt: schedule.entriesCloseAt,
      votingEnabled: schedule.votingEnabled,
      votingStartsAt: schedule.votingStartsAt,
      votingEndsAt: schedule.votingEndsAt,
      judgeWindowSec: Math.round(Number(text('judgeWindowSec'))) || 0,
      minGameVersion: text('minGameVersion'),
      requiredItemIds: text('requiredItemIds'),
      modeRanked: on('modeRanked'),
      modeUnranked: on('modeUnranked'),
      maxEntriesPerUser: Math.round(Number(text('maxEntriesPerUser'))) || 0,
      showSimDpsOnEntry: on('showSimDpsOnEntry'),
      leaderboardEnabled,
      leaderboardVisibility: leaderboardEnabled
        ? board === 'hidden' || board === 'live'
          ? board
          : 'after_close'
        : 'off',
      prize: text('prize'),
      places: PLACE_LABELS.map((_, i) => {
        const role = readPlaceDiscordRole(form, i);
        return {
          gold: text(`place-${i}-gold`),
          discordRoleId: role.discordRoleId,
          discordTitle: role.discordTitle,
          giftCard: text(`place-${i}-giftCard`),
          cosmeticId: text(`place-${i}-cosmeticId`),
        };
      }),
    },
  };
}

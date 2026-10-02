/**
 * Shared admin event dialog — new and edit open the same form.
 */

import {
  blankEventForm,
  BOARDS,
  cloneEventForm,
  emptyPlace,
  PLACE_LABELS,
  scheduleError,
  slugEventId,
  statusFromSchedule,
  statusLabel,
  TYPES,
} from './event-form-model.js';
import {
  areaField,
  bindImageDrops,
  checkField,
  dateField,
  diamondRule,
  imageDropField,
  modesField,
  placeHtml,
  readEventForm,
  readSchedule,
  selectField,
  setEventFormStatus,
  slugField,
  textField,
} from './event-form-markup.js';
import { bindDiscordRolePickers } from './discord-roles.js';
import { fillLatestGameVersion } from './event-form-version.js';

const TITLE_ID = 'admin-event-form-title';

const STEPS = Object.freeze([
  { title: 'Event' },
  { title: 'Schedule' },
  { title: 'Entry' },
  { title: 'Prizes' },
]);

/** @typedef {import('./event-form-model.js').EventFormValues} EventFormValues */

/** @type {ReturnType<typeof createEventForm> | null} */
let singleton = null;

/**
 * @param {{
 *   mode: 'new' | 'edit',
 *   values?: EventFormValues,
 *   root?: string,
 *   onSubmit: (values: EventFormValues) => void | Promise<void>,
 * }} opts
 */
export function openEventForm(opts) {
  if (!singleton) singleton = createEventForm();
  singleton.open(opts);
}

function createEventForm() {
  const root = document.createElement('div');
  root.className = 'cr-modal admin-event-form';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', TITLE_ID);
  root.hidden = true;
  document.body.appendChild(root);
  root.addEventListener('dragover', (e) => e.preventDefault());
  root.addEventListener('drop', (e) => e.preventDefault());

  /** @type {HTMLElement | null} */
  let lastFocus = null;
  /** @type {'new' | 'edit'} */
  let mode = 'new';
  /** @type {((values: EventFormValues) => void | Promise<void>) | null} */
  let onSubmitCb = null;
  let slugLocked = true;
  let step = 0;
  let assetBase = '../';
  /** @type {() => void} */
  let revokeDrops = () => {};

  /**
   * @param {'new' | 'edit'} nextMode
   * @param {EventFormValues} values
   */
  function paint(nextMode, values) {
    const editing = nextMode === 'edit';
    const submitLabel = editing ? 'Save event' : 'Create event';
    const places = PLACE_LABELS.map((label, i) =>
      placeHtml(label, i, values.places[i] || emptyPlace(), assetBase),
    ).join('');
    revokeDrops();
    root.innerHTML = `
      <div class="cr-modal__backdrop" data-event-form-close tabindex="-1"></div>
      <div class="cr-modal__panel cr-modal__panel--form bpb-panel--rewards admin-event-form__panel" role="document">
        <header class="admin-event-form__head">
          <button type="button" class="admin-event-form__back" data-event-form-back hidden aria-label="Back"></button>
          <div class="admin-event-form__head-copy">
            <h2 class="admin-event-form__title" id="${TITLE_ID}" data-event-step-title>Event</h2>
            <p class="admin-event-form__progress" data-event-step-progress>1 of ${STEPS.length}</p>
          </div>
        </header>
        ${diamondRule()}
        <form class="admin-event-form__form" data-event-form>
          <div class="admin-event-form__scroll">
            <div class="admin-event-form__step admin-event-form__grid" data-event-step="0">
              ${textField('ev-title', 'title', 'Title', values.title, { required: true, placeholder: 'DPS Stone', data: 'data-event-title' })}
              ${slugField(values.slug, editing)}
              ${selectField('ev-type', 'type', 'Type', TYPES, values.type)}
              ${textField('ev-tag', 'tag', 'Tag', values.tag, { placeholder: 'Highest DPS', span: true })}
              ${areaField('ev-blurb', 'blurb', 'Blurb', values.blurb, 'Highest DPS on a stone board from a real run.')}
              ${imageDropField('ev-image', 'image', 'Banner', values.image, assetBase, { span: true, wide: true })}
              ${imageDropField('ev-icon', 'titleIcon', 'Title icon', values.titleIcon, assetBase, { span: true })}
              ${textField('ev-discord', 'discordHref', 'Discord link', values.discordHref, { placeholder: 'https://discord.gg/…' })}
              ${checkField('ev-featured', 'featured', 'Featured on /events/', values.featured)}
            </div>
            <div class="admin-event-form__step admin-event-form__grid" data-event-step="1" hidden>
              <div class="admin-event-form__stage admin-event-form__span">
                <span class="admin-event-form__key">Status</span>
                <p class="admin-event-form__stage-value" data-event-stage-value>${statusLabel(statusFromSchedule(values))}</p>
              </div>
              ${dateField('ev-start', 'startsAt', 'Event starts', values.startsAt)}
              ${dateField('ev-end', 'endsAt', 'Event ends', values.endsAt)}
              ${checkField('ev-entries-on', 'entriesEnabled', 'Accept entries', values.entriesEnabled)}
              <div class="admin-event-form__optional admin-event-form__span admin-event-form__grid" data-event-entries ${values.entriesEnabled ? '' : 'hidden'}>
                ${dateField('ev-entries-open', 'entriesOpenAt', 'Entries open', values.entriesOpenAt)}
                ${dateField('ev-entries', 'entriesCloseAt', 'Entries close', values.entriesCloseAt)}
              </div>
              ${checkField('ev-voting-on', 'votingEnabled', 'Voting', values.votingEnabled)}
              <div class="admin-event-form__optional admin-event-form__span admin-event-form__grid" data-event-voting ${values.votingEnabled ? '' : 'hidden'}>
                ${dateField('ev-vote-open', 'votingStartsAt', 'Voting opens', values.votingStartsAt)}
                ${dateField('ev-vote', 'votingEndsAt', 'Voting ends', values.votingEndsAt)}
              </div>
            </div>
            <div class="admin-event-form__step admin-event-form__grid" data-event-step="2" hidden>
              ${textField('ev-window', 'judgeWindowSec', 'Judge window (seconds)', String(values.judgeWindowSec), { type: 'number', min: '1', required: true })}
              ${textField('ev-version', 'minGameVersion', 'Min game version', values.minGameVersion)}
              ${textField('ev-items', 'requiredItemIds', 'Required items', values.requiredItemIds, { placeholder: 'stone', span: true, hint: 'Item ids, comma separated. DPS Stone uses stone.' })}
              ${modesField(values)}
              ${textField('ev-cap', 'maxEntriesPerUser', 'Max entries per user', String(values.maxEntriesPerUser), { type: 'number', min: '1', required: true })}
              ${checkField('ev-board-on', 'leaderboardEnabled', 'Leaderboard', values.leaderboardEnabled)}
              <div class="admin-event-form__optional admin-event-form__span" data-event-leaderboard ${values.leaderboardEnabled ? '' : 'hidden'}>
                ${selectField('ev-board', 'leaderboardVisibility', 'Visibility', BOARDS, values.leaderboardVisibility, true)}
              </div>
              ${checkField('ev-simdps', 'showSimDpsOnEntry', 'Show sim DPS on the entry', values.showSimDpsOnEntry)}
            </div>
            <div class="admin-event-form__step" data-event-step="3" hidden>
              ${textField('ev-prize', 'prize', 'Trophy name', values.prize, { placeholder: 'Event Trophy', span: true })}
              <div class="admin-event-form__places">${places}</div>
            </div>
          </div>
          <p class="admin-event-form__status cr-hint" data-event-form-status hidden></p>
          <div class="admin-event-form__actions">
            <button type="button" class="cr-btn-quiet" data-event-form-close>Cancel</button>
            <button type="button" class="cr-submit is-ready" data-event-form-next>Next</button>
            <button type="submit" class="cr-submit is-ready" data-event-form-save hidden>${submitLabel}</button>
          </div>
        </form>
      </div>`;
    bind(values);
    revokeDrops = bindImageDrops(root);
    showStep(0);
  }

  /**
   * @param {EventFormValues} values
   */
  function bind(values) {
    const form = root.querySelector('[data-event-form]');
    if (!(form instanceof HTMLFormElement)) return;
    const titleInput = form.querySelector('[data-event-title]');
    const slugInput = form.querySelector('[data-event-slug]');
    const slugEdit = form.querySelector('[data-event-slug-edit]');
    slugLocked = mode === 'new' && !values.slug;

    const syncSlug = () => {
      if (mode === 'edit' || !slugLocked) return;
      if (!(titleInput instanceof HTMLInputElement) || !(slugInput instanceof HTMLInputElement)) return;
      slugInput.value = slugEventId(titleInput.value);
    };
    titleInput?.addEventListener('input', syncSlug);

    slugEdit?.addEventListener('click', () => {
      if (!(slugInput instanceof HTMLInputElement)) return;
      slugLocked = false;
      slugInput.readOnly = false;
      slugInput.focus();
      if (slugEdit instanceof HTMLButtonElement) slugEdit.hidden = true;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (step < STEPS.length - 1) {
        goNext();
        return;
      }
      const parsed = readEventForm(form);
      if (!parsed.ok) {
        setEventFormStatus(parsed.error, true);
        return;
      }
      setEventFormStatus('', false);
      try {
        if (onSubmitCb) await onSubmitCb(parsed.values);
        close();
      } catch (err) {
        setEventFormStatus(err instanceof Error ? err.message : 'Could not save this event.', true);
      }
    });

    form.querySelector('[data-event-form-next]')?.addEventListener('click', () => goNext());
    root.querySelector('[data-event-form-back]')?.addEventListener('click', () => {
      const prev = neighbor(step, -1);
      if (prev !== step) showStep(prev);
    });
    form.querySelector('#ev-entries-on')?.addEventListener('change', () => {
      syncOptional();
      syncStage();
    });
    form.querySelector('#ev-voting-on')?.addEventListener('change', () => {
      syncOptional();
      syncStage();
    });
    form.querySelector('#ev-board-on')?.addEventListener('change', syncOptional);
    form.querySelector('[data-event-step="1"]')?.addEventListener('input', syncStage);
    form.querySelector('[data-event-step="1"]')?.addEventListener('change', syncStage);
    syncOptional();
    syncStage();
    fillLatestGameVersion(form);
    bindDiscordRolePickers(root);
  }

  function checked(name) {
    const form = root.querySelector('[data-event-form]');
    if (!(form instanceof HTMLFormElement)) return false;
    const el = form.elements.namedItem(name);
    return el instanceof HTMLInputElement && el.checked;
  }

  /** Steps the walk includes. Entry is skipped when entries are off. */
  function visibleSteps() {
    const steps = [0, 1];
    if (checked('entriesEnabled')) steps.push(2);
    steps.push(3);
    return steps;
  }

  /**
   * @param {number} index
   * @param {number} dir
   */
  function neighbor(index, dir) {
    const steps = visibleSteps();
    const at = steps.indexOf(index);
    if (at < 0) return steps[0];
    return steps[at + dir] ?? index;
  }

  function syncStage() {
    const form = root.querySelector('[data-event-form]');
    const label = root.querySelector('[data-event-stage-value]');
    if (!(form instanceof HTMLFormElement) || !(label instanceof HTMLElement)) return;
    label.textContent = statusLabel(statusFromSchedule(readSchedule(form)));
  }

  function syncOptional() {
    const entries = root.querySelector('[data-event-entries]');
    const voting = root.querySelector('[data-event-voting]');
    const board = root.querySelector('[data-event-leaderboard]');
    if (entries instanceof HTMLElement) entries.hidden = !checked('entriesEnabled');
    if (voting instanceof HTMLElement) voting.hidden = !checked('votingEnabled');
    if (board instanceof HTMLElement) board.hidden = !checked('leaderboardEnabled');
  }

  function goNext() {
    const form = root.querySelector('[data-event-form]');
    if (!(form instanceof HTMLFormElement)) return;
    const err = stepError(form, step);
    if (err) {
      setEventFormStatus(err, true);
      return;
    }
    if (step < STEPS.length - 1) showStep(neighbor(step, 1));
  }

  /**
   * @param {number} index
   */
  function showStep(index) {
    step = index;
    root.querySelectorAll('[data-event-step]').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      el.hidden = Number(el.getAttribute('data-event-step')) !== index;
    });
    const titleEl = root.querySelector('[data-event-step-title]');
    const progressEl = root.querySelector('[data-event-step-progress]');
    const back = root.querySelector('[data-event-form-back]');
    const next = root.querySelector('[data-event-form-next]');
    const save = root.querySelector('[data-event-form-save]');
    const steps = visibleSteps();
    const pos = Math.max(0, steps.indexOf(index));
    if (titleEl) titleEl.textContent = STEPS[index]?.title || 'Event';
    if (progressEl) progressEl.textContent = `${pos + 1} of ${steps.length}`;
    if (back instanceof HTMLButtonElement) back.hidden = pos === 0;
    const last = index === steps[steps.length - 1];
    if (next instanceof HTMLButtonElement) next.hidden = last;
    if (save instanceof HTMLButtonElement) save.hidden = !last;
    setEventFormStatus('', false);
    const scroll = root.querySelector('.admin-event-form__scroll');
    if (scroll instanceof HTMLElement) scroll.scrollTop = 0;
    const current = root.querySelector(`[data-event-step="${index}"]`);
    const focus = current?.querySelector('input, select, textarea');
    if (focus instanceof HTMLElement) focus.focus();
  }

  /**
   * @param {HTMLFormElement} form
   * @param {number} index
   * @returns {string}
   */
  function stepError(form, index) {
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
    if (index === 0) {
      const title = text('title');
      const slug = text('slug') || slugEventId(title);
      if (!title) return 'Add a title.';
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return 'Slug uses lowercase letters, numbers, and hyphens.';
      }
      return '';
    }
    if (index === 1) return scheduleError(readSchedule(form));
    if (index === 2 && on('entriesEnabled')) {
      if (!on('modeRanked') && !on('modeUnranked')) return 'Pick ranked, unranked, or both.';
      if (!(Math.round(Number(text('judgeWindowSec'))) >= 1)) {
        return 'Judge window is at least 1 second.';
      }
      if (!(Math.round(Number(text('maxEntriesPerUser'))) >= 1)) {
        return 'Max entries is at least 1.';
      }
    }
    return '';
  }

  function close() {
    root.hidden = true;
    document.removeEventListener('keydown', onKey);
    lastFocus?.focus?.();
  }

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  root.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest('[data-event-form-close]')) close();
  });

  return {
    /**
     * @param {{
     *   mode: 'new' | 'edit',
     *   values?: EventFormValues,
     *   onSubmit: (values: EventFormValues) => void | Promise<void>,
     * }} opts
     */
    open(opts) {
      mode = opts.mode === 'edit' ? 'edit' : 'new';
      onSubmitCb = opts.onSubmit;
      assetBase = opts.root && String(opts.root).trim() ? String(opts.root) : '../';
      const values = opts.values ? cloneEventForm(opts.values) : blankEventForm();
      paint(mode, values);
      lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      root.hidden = false;
      document.addEventListener('keydown', onKey);
      const titleInput = root.querySelector('[data-event-title]');
      if (titleInput instanceof HTMLInputElement) titleInput.focus();
    },
  };
}

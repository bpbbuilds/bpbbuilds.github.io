/**
 * Enter-wizard markup helpers (keep enter-wizard.js under the line budget).
 */

import { faceHtml, parseFaceLoadout } from '../../shared/blob-face.js';
import { startingBagIdForLoadout } from '../../shared/starting-bags.js';
import { entryCardsHtml } from './event-my-entries.js';
import { modeFromRating } from './event-entry-gates.js';
import { formatDps } from './enter-sim-dps.js';
import { tiersHtml } from './enter-wizard-tiers.js';

/**
 * @typedef {{
 *   root: string,
 *   event: import('./catalog-data.js').CatalogEvent,
 *   rules: import('./event-entry-config.js').EventEntryRules,
 *   step: string,
 *   historyDbDir: string,
 *   dbHandle: { db: any, runs: any[], close: () => void } | null,
 *   summaries: import('../create/history-db.js').HistoryRunSummary[],
 *   selectedRun: import('../create/history-db.js').HistoryDecodedRun | null,
 *   roundIndex: number,
 *   myEntries: { id: number, slug: string, title: string }[],
 *   title: string,
 *   notes: string,
 *   claimedDps: string,
 *   youtubeUrl: string,
 *   simDps: number | null,
 *   catalog: { itemsById: Map<string, object>, getSpriteUrl: (item: object) => string } | null,
 *   gateState: () => { ok: boolean, errors: string[], mode: string, missingItems: string[] },
 *   signedIn: boolean,
 *   authReady: boolean,
 *   entrant: { display_name?: string | null, avatar_url?: string | null, equipped_avatar?: string | null } | null,
 * }} EnterWizardView
 */

/**
 * @param {string} s
 */
export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** @type {{ id: string, label: string }[]} */
export const ENTER_STEPS = [
  { id: 'account', label: 'Sign in' },
  { id: 'upload', label: 'Upload' },
  { id: 'details', label: 'Entry' },
];

/**
 * @param {import('./enter-wizard-paint.js').EnterWizardView} v
 * @param {{ statusMsg: string, submitting: boolean }} ui
 */
export function panelShellHtml(v, ui) {
  const showingHistory = (v.step === 'upload' && v.dbHandle) || v.step === 'pick';
  const steps = v.signedIn
    ? ENTER_STEPS.filter((s) => s.id !== 'account')
    : ENTER_STEPS;
  const isDetails = v.step === 'details';
  const body = showingHistory
    ? `<div class="event-enter__history" data-enter-history></div>`
    : !v.authReady
      ? `<p class="event-enter__muted event-enter__muted--center">Checking sign-in…</p>`
      : isDetails
        ? buildFormHtml(v)
        : flowBodyHtml(v);
  const stepIdx = Math.max(0, steps.findIndex((s) => s.id === v.step));
  const stepLabel = v.authReady ? steps[stepIdx]?.label || '' : '';
  const atStart = stepIdx <= 0 && !showingHistory;
  const atEntry = v.step === 'details';
  const dots = steps.map((s, i) => {
    const on = i === stepIdx;
    const done = i < stepIdx;
    return `<li class="event-enter__dot${on ? ' is-active' : ''}${done ? ' is-done' : ''}" aria-current="${on ? 'step' : 'false'}">
      <span class="event-enter__dot-mark" aria-hidden="true"></span>
      <span class="visually-hidden">${escapeHtml(s.label)}</span>
    </li>`;
  }).join('');

  return `
    <div class="event-enter__panel bpb-panel--rewards${showingHistory ? ' event-enter__panel--history' : ` cr-modal__panel cr-modal__panel--form${isDetails ? ' event-enter__panel--details' : ' event-enter__panel--flow'}`}" data-enter-panel>
      <header class="event-enter__head">
        <h2 class="event-enter__title">
          <span class="event-enter__title-line" aria-hidden="true"></span>
          <span class="event-enter__title-text">${escapeHtml(v.event.title)} event entry</span>
          <span class="event-enter__title-line" aria-hidden="true"></span>
        </h2>
        <button type="button" class="event-enter__close" data-enter-close aria-label="Close">×</button>
      </header>
      <div class="event-enter__body${showingHistory ? ' event-enter__body--history' : ''}" data-enter-body>${body}</div>
      ${ui.statusMsg ? `<p class="event-enter__status" role="status">${escapeHtml(ui.statusMsg)}</p>` : ''}
      <nav class="event-enter__pager" aria-label="Wizard steps">
        <button type="button" class="event-enter__arrow event-enter__arrow--back" data-enter-back aria-label="Back" ${atStart ? 'disabled' : ''}></button>
        <div class="event-enter__pager-mid">
          <p class="event-enter__pager-label">${escapeHtml(stepLabel)}</p>
          <ol class="event-enter__dots">${dots}</ol>
        </div>
        ${
          !v.authReady || v.step === 'account'
            ? ''
            : atEntry
              ? `<button type="button" class="event-enter__arrow event-enter__arrow--submit" data-enter-submit aria-label="Submit entry" ${ui.submitting ? 'disabled' : ''}></button>`
              : `<button type="button" class="event-enter__arrow event-enter__arrow--next" data-enter-next aria-label="Next"></button>`
        }
      </nav>
    </div>`;
}

/**
 * @param {import('./enter-wizard.js').EnterWizardView} v
 */
export function flowBodyHtml(v) {
  const { rules, step, myEntries, summaries } = v;
  const used = myEntries.length;
  const max = rules.maxEntriesPerUser;
  const atCap = used >= max;

  if (step === 'account') {
    return `
      <h3 class="event-enter__h">Sign in</h3>
      <p class="cr-hint">To enter events, sign in with Discord first.</p>
      <button type="button" class="cr-submit is-ready" data-enter-discord>Sign in with Discord</button>`;
  }

  if (step === 'upload') {
    return `
      <div class="event-enter__section-head">
        <div class="event-enter__entries-label">
          <h3 class="event-enter__h">Your entries</h3>
          <span class="event-enter__info">
            <button type="button" class="cr-submit-info" data-enter-entries-info aria-label="Entries can’t be removed" aria-expanded="false" aria-describedby="event-enter-perm">i</button>
            <p class="event-enter__info-pop" id="event-enter-perm" role="tooltip">Submitted entries are permanent site builds. They can’t be removed.</p>
          </span>
        </div>
        <p class="event-enter__count">${used}/${max}</p>
      </div>
      ${
        myEntries.length
          ? entryCardsHtml(myEntries, v.root, 'event-enter__entries')
          : `<p class="event-enter__muted event-enter__muted--center">No entries yet.</p>`
      }
      ${atCap ? `<p class="event-enter__warn">You’re at the entry cap — you can’t submit another board.</p>` : ''}
      <h3 class="event-enter__h">Upload history.db</h3>
      <p class="cr-hint">Choose your history.db. Your runs open in this step.</p>
      <button type="button" class="event-enter__history-btn" data-enter-pick-file>
        <span class="event-enter__history-label">history.db</span>
        <code class="event-enter__history-path">${escapeHtml(v.historyDbDir)}</code>
      </button>
      <button type="button" class="cr-btn-quiet" data-enter-copy-path>Copy path</button>
      ${v.dbHandle ? `<p class="event-enter__ok">${summaries.length} run(s) loaded.</p>` : ''}`;
  }

  return '';
}

/**
 * Signed-in blob (equipped cosmetics) plus username for the details step.
 * Always the website blob, even when the public face is Discord.
 * @param {import('./enter-wizard.js').EnterWizardView} v
 */
function entrantHtml(v) {
  const entrant = v.entrant;
  if (!entrant) return '';
  const name = String(entrant.display_name || '').trim() || 'You';
  const parsed = parseFaceLoadout(entrant.equipped_avatar);
  const equipped = JSON.stringify({
    v: 1,
    base: 'blob',
    slots: parsed?.slots || {},
  });
  const face = faceHtml(
    { equipped_avatar: equipped },
    v.root,
    { className: 'event-enter__player-face', alt: name },
  );
  return `<div class="event-enter__player">
    <div class="event-enter__player-stage">
      <p class="event-enter__player-name">${escapeHtml(name)}</p>
      <div class="event-enter__player-zoom">${face}</div>
    </div>
  </div>`;
}

/**
 * Dedicated build-form step (separate from the upload wizard).
 * @param {import('./enter-wizard.js').EnterWizardView} v
 */
export function buildFormHtml(v) {
  const gate = v.gateState();
  const mode = v.selectedRun ? modeFromRating(v.selectedRun.rating) : null;
  const bagId =
    v.selectedRun?.heroClass != null
      ? startingBagIdForLoadout(v.selectedRun.heroClass, v.selectedRun.loadout)
      : null;
  const bagItem = bagId && v.catalog ? v.catalog.itemsById.get(bagId) : null;

  return `
    <h3 class="event-enter__h">Build details</h3>
    <p class="cr-hint">Name the entry. Class, bag, and tags come from your history run.</p>
    <div class="event-enter__build">
      <div class="event-enter__bag-col">
        ${entrantHtml(v)}
        <div class="event-enter__bag" data-enter-bag></div>
      </div>
      <div class="event-enter__build-fields">
        <div class="il-filter__shade cr-field-shade">
          <label class="cr-label" for="event-enter-title">Build title</label>
          <input id="event-enter-title" class="cr-input" type="text" maxlength="80"
            placeholder="Name this entry" value="${escapeHtml(v.title)}" data-enter-title />
        </div>
        <div class="il-filter__shade cr-field-shade">
          <div class="cr-field">
            <span class="cr-label" id="event-enter-notes-label">Build description <span class="cr-hint">(optional)</span></span>
            <div
              id="event-enter-notes"
              class="cr-input cr-textarea cr-textarea--notes cr-notes"
              data-enter-notes
              contenteditable="true"
              role="textbox"
              aria-multiline="true"
              aria-labelledby="event-enter-notes-label"
              spellcheck="true"
              data-placeholder="Drag an item from your board, or type [name]"
            ></div>
            <p class="cr-hint">Only items on this build can be inserted.</p>
          </div>
        </div>
        <dl class="event-enter__facts il-filter__shade">
          <div><dt>Class</dt><dd>${escapeHtml(v.selectedRun?.heroClass || '—')}</dd></div>
          <div><dt>Mode</dt><dd>${escapeHtml(mode || '—')}</dd></div>
          <div><dt>Rank</dt><dd>${escapeHtml(v.selectedRun?.rank || '—')}</dd></div>
          <div><dt>Version</dt><dd>${escapeHtml(v.selectedRun?.version || '—')}</dd></div>
          <div><dt>Starting bag</dt><dd>${escapeHtml(bagItem?.name || bagId || '—')}</dd></div>
          <div><dt>Tags</dt><dd>History · ${escapeHtml(mode || 'run')} · ${escapeHtml(v.event.tag || v.event.title)}</dd></div>
          ${
            v.rules.showSimDpsOnEntry
              ? `<div><dt>Sim DPS (${v.rules.judgeWindowSec}s)</dt><dd>${
                  v.simDps == null ? '—' : escapeHtml(formatDps(v.simDps))
                }</dd></div>`
              : ''
          }
        </dl>
      </div>
      <div class="event-enter__build-side">
        ${tiersHtml()}
        <ul class="event-enter__gates" aria-label="Entry checks">
          ${
            gate.errors.length
              ? gate.errors.map((e) => `<li class="is-bad">${escapeHtml(e)}</li>`).join('')
              : v.selectedRun
                ? `<li class="is-ok">Board passes event gates</li>`
                : `<li>Waiting for a run…</li>`
          }
        </ul>
        <div class="il-filter__shade cr-field-shade">
          <label class="cr-label" for="event-enter-claimed">Claimed in-game DPS <span class="cr-hint">(optional)</span></label>
          <input id="event-enter-claimed" class="cr-input" type="text" inputmode="decimal"
            placeholder="e.g. 420" value="${escapeHtml(v.claimedDps)}" data-enter-claimed />
        </div>
        <div class="il-filter__shade cr-field-shade">
          <label class="cr-label" for="event-enter-yt">Clip / YouTube URL <span class="cr-hint">(optional)</span></label>
          <input id="event-enter-yt" class="cr-input" type="url"
            placeholder="https://…" value="${escapeHtml(v.youtubeUrl)}" data-enter-yt />
        </div>
        <p class="event-enter__warn">Once submitted, this entry stays on your profile and <strong>cannot be removed</strong>.</p>
      </div>
    </div>`;
}

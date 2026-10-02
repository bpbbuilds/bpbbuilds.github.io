/**
 * Sim “Report issue” form — rewards-plate dialog.
 * Session facts are frozen on open; only the description is editable.
 */

import { getSession } from '../../../shared/auth.js';
import { config } from '../../../shared/config.js';

const DESC_MAX = 4000;
const TITLE_ID = 'sim-report-title';

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
 * @param {string} s
 */
function escapeAttr(s) {
  return escapeHtml(s);
}

/**
 * @typedef {{
 *   seed: string,
 *   userLabel: string,
 *   youTitle: string,
 *   youSlug: string | null,
 *   youRound: number | null,
 *   foeMode: string,
 *   foeLabel: string,
 *   permalink: string,
 *   coveragePct: number | null,
 *   youHeroClass: string | null,
 * }} SimReportSnapshot
 */

/**
 * @param {{
 *   assetRoot?: string,
 *   getSnapshot: () => SimReportSnapshot,
 * }} opts
 */
export function mountSimReportUi(opts) {
  const modal = document.createElement('div');
  modal.className = 'cr-modal sim-report';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', TITLE_ID);
  modal.hidden = true;
  modal.innerHTML = `
    <div class="sim-report__backdrop" data-report-close tabindex="-1"></div>
    <div class="sim-report__panel bpb-panel--rewards" role="document">
      <header class="sim-report__head">
        <h2 class="sim-report__title" id="${TITLE_ID}">
          <span class="sim-report__title-line" aria-hidden="true"></span>
          <span class="sim-report__title-text">Report issue</span>
          <span class="sim-report__title-line" aria-hidden="true"></span>
        </h2>
        <button type="button" class="sim-report__close" data-report-close aria-label="Close">×</button>
      </header>
      <form class="sim-report__form" data-report-form>
        <p class="sim-report__hint">Tell us what looked off vs the game. This fight is attached automatically.</p>
        <label class="sim-report__field">
          <span class="sim-report__label">What went wrong</span>
          <textarea
            class="sim-report__input sim-report__textarea"
            name="description"
            data-report-desc
            maxlength="${DESC_MAX}"
            rows="5"
            placeholder="Which items, when in the fight, what the game did instead…"
          ></textarea>
        </label>
        <h3 class="sim-report__label">This fight</h3>
        <dl class="sim-report__facts" data-report-facts></dl>
        <p class="sim-report__hint sim-report__status" data-report-status hidden role="status"></p>
        <div class="sim-report__actions">
          <button type="submit" class="sim-report__btn" data-report-send>Send</button>
          <button type="button" class="sim-report__btn sim-report__btn--quiet" data-report-close>Cancel</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  const form = modal.querySelector('[data-report-form]');
  const factsEl = modal.querySelector('[data-report-facts]');
  const descEl = modal.querySelector('[data-report-desc]');
  const statusEl = modal.querySelector('[data-report-status]');
  const sendBtn = modal.querySelector('[data-report-send]');

  /** @type {SimReportSnapshot | null} */
  let frozen = null;
  /** @type {HTMLElement | null} */
  let lastFocus = null;
  let sending = false;

  /**
   * @param {string} label
   * @param {string} value
   */
  function factRow(label, value) {
    return `
      <div class="sim-report__fact">
        <dt>${escapeHtml(label)}</dt>
        <dd>${escapeHtml(value)}</dd>
      </div>
    `;
  }

  /**
   * @param {SimReportSnapshot} snap
   */
  function paintFacts(snap) {
    if (!(factsEl instanceof HTMLElement)) return;
    const board =
      snap.youRound != null
        ? `${snap.youTitle} · round ${snap.youRound}`
        : snap.youTitle;
    const coverage =
      snap.coveragePct != null ? `${snap.coveragePct}%` : '—';
    factsEl.innerHTML = [
      factRow('You', board || '—'),
      factRow('Opponent', snap.foeLabel || '—'),
      factRow('Seed', snap.seed || '—'),
      factRow('Coverage', coverage),
    ].join('');
  }

  /**
   * @param {string} msg
   * @param {'ok' | 'err'} kind
   */
  function setStatus(msg, kind) {
    if (!(statusEl instanceof HTMLElement)) return;
    statusEl.hidden = !msg;
    statusEl.textContent = msg;
    statusEl.classList.toggle('is-err', kind === 'err');
  }

  function open() {
    frozen = opts.getSnapshot();
    paintFacts(frozen);
    if (descEl instanceof HTMLTextAreaElement) descEl.value = '';
    setStatus('', 'ok');
    lastFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modal.hidden = false;
    document.body.classList.add('cr-modal-open');
    if (descEl instanceof HTMLTextAreaElement) descEl.focus();
  }

  function close() {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('cr-modal-open');
    lastFocus?.focus?.();
    lastFocus = null;
  }

  async function submit() {
    if (sending) return;
    const description =
      descEl instanceof HTMLTextAreaElement ? descEl.value.trim() : '';
    if (!description) {
      setStatus('Write a short description of the issue.', 'err');
      descEl?.focus?.();
      return;
    }
    const url = String(config.reportSimUrl || '').trim();
    if (!url || url.includes('YOUR_')) {
      setStatus('Reporting is not configured on this host yet.', 'err');
      return;
    }
    const snap = frozen || opts.getSnapshot();
    sending = true;
    if (sendBtn instanceof HTMLButtonElement) sendBtn.disabled = true;
    setStatus('Sending…', 'ok');
    try {
      const session = await getSession().catch(() => null);
      /** @type {Record<string, string>} */
      const headers = {
        'Content-Type': 'application/json',
        apikey: String(config.supabasePublishableKey || ''),
      };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          description,
          reporterLabel: snap.userLabel,
          seed: snap.seed,
          youTitle: snap.youTitle,
          youSlug: snap.youSlug,
          youRound: snap.youRound,
          foeMode: snap.foeMode,
          foeLabel: snap.foeLabel,
          permalink: snap.permalink,
          coveragePct: snap.coveragePct,
          session: {
            youSlug: snap.youSlug,
            foeMode: snap.foeMode,
            youHeroClass: snap.youHeroClass,
          },
        }),
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        /* ignore */
      }
      if (!res.ok) {
        throw new Error(
          (data && (data.error || data.message)) || `Could not send (${res.status})`,
        );
      }
      setStatus('Thanks — we got your report.', 'ok');
      window.setTimeout(() => close(), 900);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not send report.', 'err');
    } finally {
      sending = false;
      if (sendBtn instanceof HTMLButtonElement) sendBtn.disabled = false;
    }
  }

  /** @param {MouseEvent} e */
  function onClick(e) {
    const t = e.target;
    if (t instanceof Element && t.closest('[data-report-close]')) {
      e.preventDefault();
      close();
    }
  }

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (e.key === 'Escape' && !modal.hidden) {
      e.preventDefault();
      close();
    }
  }

  modal.addEventListener('click', onClick);
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    void submit();
  });
  document.addEventListener('keydown', onKey);

  const reportBtn = document.querySelector('.sim-report-btn');
  const artEl = reportBtn?.querySelector('.sim-report-btn__art');
  if (artEl instanceof HTMLImageElement && reportBtn instanceof HTMLElement) {
    reportBtn.addEventListener('pointerenter', () => {
      artEl.src = artEl.dataset.artHover || artEl.src;
    });
    reportBtn.addEventListener('pointerleave', () => {
      artEl.src = artEl.dataset.artNormal || artEl.src;
    });
  }

  return {
    open,
    close,
    destroy() {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('cr-modal-open');
      modal.remove();
    },
  };
}

/**
 * @param {string} root
 */
export function simReportBtnHtml(root = '../') {
  const base = root.endsWith('/') ? root : `${root}/`;
  const icon = `${base}assets/icons/sim/ReportIssue.png`;
  const iconHover = `${base}assets/icons/sim/ReportIssue_hovered.png`;
  return `
    <button
      type="button"
      class="sim-report-btn"
      data-sim-report-open
      title="Report issue"
      aria-label="Report issue"
    >
      <img
        class="sim-report-btn__art"
        src="${escapeAttr(icon)}"
        alt=""
        width="109"
        height="113"
        draggable="false"
        data-art-normal="${escapeAttr(icon)}"
        data-art-hover="${escapeAttr(iconHover)}"
      />
    </button>
  `;
}

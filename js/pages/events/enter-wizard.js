/**
 * Event enter wizard — history.db flow, then a separate Build details step.
 */

import { getSession, getProfile, signInWithDiscord } from '../../shared/auth.js';
import { hydrateFaces } from '../../shared/blob-face.js';
import { mountPlacedGrid } from '../../shared/backpack-grid/index.js';
import { loadCreateCatalog } from '../create/load-catalog.js';
import { getCachedCanAffect, warmBoardLiveCanAffect } from '../create/board-live-stats.js';
import { BOARD_COLS, BOARD_ROWS } from '../create/collision.js';
import { eventBuildEntriesOpen } from './event-builds-privacy.js';
import { entryRulesForEvent } from './event-entry-config.js';
import { validateEventBoard } from './event-entry-gates.js';
import { computeEventSimDps } from './enter-sim-dps.js';
import { submitEventEntry } from './enter-wizard-submit.js';
import { loadMyEventEntries, mountEntryBoards } from './event-my-entries.js';
import { panelShellHtml } from './enter-wizard-paint.js';
import {
  clearEnterWizardSession,
  readEnterWizardMeta,
  writeEnterWizardMeta,
} from './enter-wizard-persist.js';
import { hydrateEnterWizardFromSession } from './enter-wizard-hydrate.js';
import { advanceEnterWizard } from './enter-wizard-nav.js';
import { bindEnterWizardUi } from './enter-wizard-bind.js';
import { attachEnterHistory } from './enter-wizard-history.js';
import { mountEnterBuildNotes } from './enter-wizard-notes.js';
import { mountEnterTiers } from './enter-wizard-tiers.js';
import {
  applyEnterWizardRound,
  bindEnterWizardFileInput,
  selectEnterWizardRun,
} from './enter-wizard-runs.js';

const HISTORY_DB_DIR = '%APPDATA%\\Godot\\app_userdata\\Backpack Battles';

/** @typedef {import('./catalog-data.js').CatalogEvent} CatalogEvent */
/** @typedef {'account' | 'upload' | 'details'} WizardStep */
/** @type {WizardStep[]} */
const STEP_ORDER = ['account', 'upload', 'details'];

/** @type {WeakMap<object, true>} */
const openByEvent = new WeakMap();

/**
 * Re-open wizard after refresh if a session was in progress.
 * @param {CatalogEvent} event
 * @param {{ root: string }} opts
 */
export async function resumeEnterWizardIfNeeded(event, opts) {
  const meta = readEnterWizardMeta(event.slug);
  if (!meta?.open) return null;
  if (document.querySelector(`[data-event-enter="${event.slug}"]`)) return null;
  return openEnterWizard(event, { ...opts, restore: meta });
}

/** @typedef {import('./enter-wizard-paint.js').EnterWizardView} EnterWizardView */

/**
 * @param {CatalogEvent} event
 * @param {{
 *   root: string,
 *   returnFocusEl?: HTMLElement | null,
 *   restore?: import('./enter-wizard-persist.js').EnterWizardMeta | null,
 * }} opts
 */
export async function openEnterWizard(event, opts) {
  if (!eventBuildEntriesOpen(event)) {
    return { destroy() {} };
  }
  if (openByEvent.has(event) || document.querySelector(`[data-event-enter="${event.slug}"]`)) {
    return { destroy() {} };
  }
  openByEvent.set(event, true);

  const root = opts.root.endsWith('/') ? opts.root : `${opts.root}/`;
  const rules = entryRulesForEvent(event);
  const returnFocus =
    opts.returnFocusEl instanceof HTMLElement
      ? opts.returnFocusEl
      : document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  const restore = opts.restore || null;

  const rawStep = restore?.step === 'pick' ? 'upload' : restore?.step;
  const restoredStep = rawStep === 'proof' || rawStep === 'review' ? 'details' : rawStep;
  /** @type {WizardStep} */
  let step =
    restoredStep && STEP_ORDER.includes(/** @type {WizardStep} */ (restoredStep))
      ? /** @type {WizardStep} */ (restoredStep)
      : 'account';
  /** @type {import('../create/history-db.js').HistoryRunSummary[]} */
  let summaries = [];
  /** @type {{ db: any, runs: any[], close: () => void } | null} */
  let dbHandle = null;
  /** @type {import('../create/history-db.js').HistoryDecodedRun | null} */
  let selectedRun = null;
  let roundIndex = Number(restore?.roundIndex) || 0;
  /** @type {{ id: string, x: number, y: number, r: number, key: string, gems?: string[] }[]} */
  let placements = [];
  /** @type {{ id: number, slug: string, title: string }[]} */
  let myEntries = [];
  let title = String(restore?.title || '');
  let notes = String(restore?.notes || '');
  let claimedDps = String(restore?.claimedDps || '');
  let youtubeUrl = String(restore?.youtubeUrl || '');
  let statusMsg = '';
  let submitting = false;
  let fileName = String(restore?.fileName || '');
  /** @type {number | null} */
  let simDps = null;
  let authReady = false;
  let signedIn = false;
  /** @type {import('./enter-wizard-paint.js').EnterWizardView['entrant']} */
  let entrant = null;
  /** @type {{ destroy?: () => void, setPlacements?: Function } | null} */
  let grid = null;
  /** @type {() => void} */
  let unmountEntries = () => {};
  let entryMountGen = 0;
  /** @type {{ destroy: () => void } | null} */
  let historyPicker = null;
  /** @type {ReturnType<typeof mountEnterBuildNotes> | null} */
  let notesUi = null;
  /** @type {ReturnType<typeof mountEnterTiers> | null} */
  let tiersUi = null;
  /** @type {{ itemsById: Map<string, object>, getSpriteUrl: (item: object) => string } | null} */
  let catalog = null;

  const overlay = document.createElement('div');
  overlay.className = 'event-enter cr-modal';
  overlay.setAttribute('data-event-enter', event.slug);
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', `${event.title} event entry`);
  document.body.classList.add('cr-modal-open');
  document.body.appendChild(overlay);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.db,application/octet-stream';
  fileInput.hidden = true;
  overlay.appendChild(fileInput);

  function persist() {
    writeEnterWizardMeta(event.slug, {
      open: true,
      step,
      title,
      notes,
      claimedDps,
      youtubeUrl,
      selectedRunId: selectedRun?.runId ?? null,
      roundIndex,
      fileName,
    });
  }

  function leaveHistoryPicker() {
    try {
      dbHandle?.close?.();
    } catch {
      /* ignore */
    }
    dbHandle = null;
    summaries = [];
    selectedRun = null;
    placements = [];
    step = 'upload';
    statusMsg = '';
    paint();
  }

  function onKey(e) {
    if (e.key !== 'Escape') return;
    if (step === 'upload' && dbHandle) {
      const openMenu = overlay.querySelector('.create-history__dd-menu:not([hidden])');
      if (openMenu) return;
      leaveHistoryPicker();
      return;
    }
    destroy(true);
  }
  window.addEventListener('keydown', onKey);

  /** @param {boolean} [clearSession] */
  function destroy(clearSession = true) {
    window.removeEventListener('keydown', onKey);
    try {
      historyPicker?.destroy();
    } catch {
      /* ignore */
    }
    historyPicker = null;
    try {
      notesUi?.destroy();
    } catch {
      /* ignore */
    }
    notesUi = null;
    try {
      tiersUi?.destroy();
    } catch {
      /* ignore */
    }
    tiersUi = null;
    try {
      grid?.destroy?.();
    } catch {
      /* ignore */
    }
    grid = null;
    unmountEntries();
    unmountEntries = () => {};
    entryMountGen += 1;
    try {
      dbHandle?.close?.();
    } catch {
      /* ignore */
    }
    dbHandle = null;
    overlay.remove();
    document.body.classList.remove('cr-modal-open');
    openByEvent.delete(event);
    if (clearSession) void clearEnterWizardSession(event.slug);
    returnFocus?.focus?.();
  }

  function gateState() {
    if (!selectedRun || !placements.length) {
      return {
        ok: false,
        errors: ['Pick a qualifying run first.'],
        mode: /** @type {'ranked'|'unranked'} */ ('unranked'),
        missingItems: rules.requiredItemIds.slice(),
      };
    }
    return validateEventBoard({
      rating: selectedRun.rating,
      version: selectedRun.version,
      placements,
      rules,
    });
  }

  /** @returns {EnterWizardView} */
  function view() {
    return {
      root,
      event,
      rules,
      step,
      historyDbDir: HISTORY_DB_DIR,
      dbHandle,
      summaries,
      selectedRun,
      roundIndex,
      myEntries,
      title,
      notes,
      claimedDps,
      youtubeUrl,
      simDps,
      catalog,
      gateState,
      signedIn,
      authReady,
      entrant,
    };
  }

  async function refreshSimDps() {
    simDps = null;
    if (!rules.showSimDpsOnEntry || !catalog || !placements.length || !gateState().ok) return;
    try {
      await warmBoardLiveCanAffect();
      simDps = computeEventSimDps({
        placements,
        itemsById: catalog.itemsById,
        durationSec: rules.judgeWindowSec,
        canAffect: getCachedCanAffect(),
      }).dps;
    } catch (err) {
      console.warn('[event-enter] sim dps failed', err);
      simDps = null;
    }
  }

  function paintBag() {
    const host = overlay.querySelector('[data-enter-bag]');
    if (!(host instanceof HTMLElement) || !catalog) return;
    grid?.destroy?.();
    grid = null;
    if (!placements.length) {
      host.innerHTML = `<p class="event-enter__bag-empty">Board preview appears when you pick a run.</p>`;
      return;
    }
    host.innerHTML = '';
    grid = mountPlacedGrid(host, {
      placements,
      itemsById: catalog.itemsById,
      cols: BOARD_COLS,
      rows: BOARD_ROWS,
      getSpriteUrl: catalog.getSpriteUrl,
      fillWidth: false,
      fitHost: true,
      exactBoard: true,
      reserveScrollGap: false,
      cellPx: 36,
    });
  }

  const roundCtx = {
    getSelectedRun: () => selectedRun,
    getRoundIndex: () => roundIndex,
    setRoundIndex: (n) => {
      roundIndex = n;
    },
    setPlacements: (p) => {
      placements = p;
    },
    catalog: () => catalog,
  };
  const applyRound = () => applyEnterWizardRound(roundCtx);
  const selectRun = (runId) =>
    selectEnterWizardRun(
      {
        dbHandle: () => dbHandle,
        catalog: () => catalog,
        summaries: () => summaries,
        setStatus: (s) => {
          statusMsg = s;
        },
        paint,
        setSelectedRun: (r) => {
          selectedRun = r;
        },
        setRoundIndex: (n) => {
          roundIndex = n;
        },
        setPlacements: (p) => {
          placements = p;
        },
        applyRound,
        refreshSimDps,
        root,
      },
      runId,
    );

  function paint() {
    historyPicker?.destroy();
    historyPicker = null;
    notesUi?.destroy();
    notesUi = null;
    tiersUi?.destroy();
    tiersUi = null;
    unmountEntries();
    unmountEntries = () => {};
    const mountGen = ++entryMountGen;
    const isDetails = step === 'details';
    overlay.innerHTML = panelShellHtml(view(), { statusMsg, submitting });
    overlay.appendChild(fileInput);
    if (isDetails) {
      paintBag();
      void hydrateFaces(overlay, root);
      if (catalog) {
        tiersUi = mountEnterTiers({
          overlay,
          itemsById: catalog.itemsById,
          getSpriteUrl: catalog.getSpriteUrl,
          getPlacements: () => placements,
        });
        notesUi = mountEnterBuildNotes({
          overlay,
          itemsById: catalog.itemsById,
          getSpriteUrl: catalog.getSpriteUrl,
          getPlacements: () => placements,
          getNotes: () => notes,
          onChange(next) {
            notes = next;
            persist();
          },
          tierAt: tiersUi.tierAt,
          setTierHover: tiersUi.setHover,
          onTierDrop(key, itemId, priority) {
            const item = catalog.itemsById.get(itemId);
            if (!item || String(item.type || '') === 'Bag') return false;
            const row = placements.find((p) => String(p.key) === String(key));
            if (!row) return false;
            row.priority = priority;
            tiersUi?.refresh();
            return true;
          },
        });
      }
    }
    if (step === 'upload' && dbHandle) {
      historyPicker = attachEnterHistory(overlay, {
        root,
        dbHandle,
        catalog,
        initialRunId: selectedRun?.runId ?? null,
        initialRoundIndex: roundIndex,
        onBack() {
          leaveHistoryPicker();
        },
        async onLoad(payload) {
          selectedRun = payload.run;
          roundIndex = Math.max(0, (payload.run.rounds?.length || 1) - 1);
          applyRound();
          const gate = gateState();
          if (!gate.ok) return gate.errors[0] || 'Fix board gates first.';
          statusMsg = '';
          step = 'details';
          await refreshSimDps();
          paint();
          return '';
        },
      });
    }
    bindEnterWizardUi({
      overlay,
      fileInput,
      historyDbDir: HISTORY_DB_DIR,
      stepOrder: signedIn
        ? STEP_ORDER.filter((id) => id !== 'account')
        : STEP_ORDER,
      getStep: () => step,
      setStep: (s) => {
        step = /** @type {WizardStep} */ (s);
      },
      setStatus: (s) => {
        statusMsg = s;
      },
      paint,
      destroy,
      goNext,
      doSubmit,
      selectRun,
      setRoundIndex: (n) => {
        roundIndex = n;
      },
      applyRound,
      refreshSimDps,
      setTitle: (s) => {
        title = s;
      },
      setNotes: (s) => {
        notes = s;
      },
      setClaimedDps: (s) => {
        claimedDps = s;
      },
      setYoutubeUrl: (s) => {
        youtubeUrl = s;
      },
      persist,
      pickerOpen: (step === 'upload' && !!dbHandle) || step === 'pick',
      leaveHistory: leaveHistoryPicker,
      requestLoad: () => historyPicker?.requestLoad?.() ?? false,
    });
    if (step === 'upload' && myEntries.length) {
      const gen = mountGen;
      void mountEntryBoards(overlay, myEntries, root, 22).then((off) => {
        if (gen !== entryMountGen || !overlay.isConnected) {
          off();
          return;
        }
        unmountEntries = off;
      });
    }
    persist();
  }

  async function goNext() {
    await advanceEnterWizard({
      getStep: () => step,
      setStep: (s) => {
        step = /** @type {WizardStep} */ (s);
      },
      setStatus: (s) => {
        statusMsg = s;
      },
      paint,
      getSession,
      signInWithDiscord,
      myEntriesLen: () => myEntries.length,
      maxEntries: rules.maxEntriesPerUser,
      hasDb: () => Boolean(dbHandle),
      gateState,
      titleTrim: () => title.trim(),
      refreshSimDps,
    });
  }

  bindEnterWizardFileInput({
    eventSlug: event.slug,
    root,
    fileInput,
    closeDb: () => {
      try {
        dbHandle?.close?.();
      } catch {
        /* ignore */
      }
    },
    setDbHandle: (h) => {
      dbHandle = h;
    },
    setSummaries: (s) => {
      summaries = s;
    },
    setSelectedRun: (r) => {
      selectedRun = r;
    },
    setPlacements: (p) => {
      placements = p;
    },
    setFileName: (n) => {
      fileName = n;
    },
    setStep: (s) => {
      step = /** @type {WizardStep} */ (s);
    },
    setStatus: (s) => {
      statusMsg = s;
    },
    paint,
  });

  async function doSubmit() {
    if (submitting || !catalog || !selectedRun) return;
    if (!eventBuildEntriesOpen(event)) {
      statusMsg = 'Entries are closed for this event.';
      paint();
      return;
    }
    const gate = gateState();
    if (!gate.ok) {
      statusMsg = gate.errors[0] || 'Gates failed.';
      paint();
      return;
    }
    const t = title.trim();
    if (!t) {
      statusMsg = 'Give your entry a title.';
      paint();
      return;
    }
    if (myEntries.length >= rules.maxEntriesPerUser) {
      statusMsg = 'Entry cap reached.';
      paint();
      return;
    }

    submitting = true;
    statusMsg = 'Submitting…';
    paint();

    try {
      const result = await submitEventEntry({
        root,
        eventSlug: event.slug,
        title: t,
        notes,
        claimedDps,
        youtubeUrl,
        simDps,
        judgeWindowSec: rules.judgeWindowSec,
        showSimDpsOnEntry: rules.showSimDpsOnEntry,
        selectedRun,
        placements,
        catalog,
      });

      myEntries.push({ id: result.id, slug: result.slug, title: t });
      submitting = false;
      statusMsg = `Submitted — ${result.slug}`;
      await clearEnterWizardSession(event.slug);
      paint();
      window.setTimeout(() => {
        destroy(false);
        const base = root.endsWith('/') ? root : `${root}/`;
        location.assign(
          `${base}events/?e=${encodeURIComponent(event.slug)}&tab=builds`,
        );
      }, 500);
    } catch (err) {
      submitting = false;
      statusMsg = err instanceof Error ? err.message : 'Submit failed.';
      paint();
    }
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) destroy(true);
  });

  persist();
  paint();

  try {
    await warmBoardLiveCanAffect();
    catalog = await loadCreateCatalog(root);
    const session = await getSession();
    signedIn = Boolean(session?.access_token);
    authReady = true;
    if (session?.access_token) {
      const profile = await getProfile().catch(() => null);
      entrant = profile
        ? {
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            equipped_avatar: profile.equipped_avatar,
          }
        : null;
      if (profile?.id) {
        myEntries = await loadMyEventEntries(event.slug);
      }
    }
    if (restore) {
      await hydrateEnterWizardFromSession({
        eventSlug: event.slug,
        root,
        restore,
        getStep: () => step,
        setStep: (s) => {
          step = /** @type {WizardStep} */ (s);
        },
        setDbHandle: (h) => {
          dbHandle = h;
        },
        setSummaries: (s) => {
          summaries = s;
        },
        setFileName: (n) => {
          fileName = n;
        },
        selectRun,
        setRoundIndex: (n) => {
          roundIndex = n;
        },
        applyRound,
        refreshSimDps,
      });
    }
    if (!signedIn) step = 'account';
    else if (step === 'account') step = 'upload';
    statusMsg = '';
    paint();
  } catch (err) {
    statusMsg = err instanceof Error ? err.message : 'Could not load catalog.';
    paint();
  }

  return { destroy };
}

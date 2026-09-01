/**
 * Create page — local build editor (/create/).
 * Board on the left; catalog + Filter|Build rail on the right.
 */

import { getSession, onAuthChange } from '../../shared/auth.js';
import { skelBar, skelBlock } from '../../shared/skeleton.js';
import { createTooltipHover } from '../../shared/tooltip-hover.js';
import { initItemsCatalog } from '../items/catalog.js';
import { initWheelToGrid } from '../items/wheel-to-grid.js';
import { createEditorState } from './editor-state.js';
import { mountBoardEditor } from './board-editor.js';
import { wrapFiltersWithTabs } from './rail-tabs.js';
import { mountMetaPane } from './meta-pane.js';
import { validateCreateDraft } from './submit-validate.js';
import { createSubmitInfoModal } from './submit-info-modal.js';
import { clearDraft, saveDraft } from './draft-io.js';
import {
  buildViewHref,
  clearPendingSubmit,
  hasPendingSubmit,
  publishDraft,
} from './publish.js';
import { applyRemixFromUrl } from './remix.js';

/** Fallback if create/index.html shell is missing (keeps board 9/7 reserve). */
function ensureCreateShell(main) {
  if (main.querySelector('[data-create-board]') && main.querySelector('[data-create-catalog]')) {
    return;
  }
  main.innerHTML = `
    <div class="create-layout">
      <section class="create-col create-col--board" aria-label="Board editor" data-create-board>
        ${skelBar({ width: '50%', height: '1.25rem', radius: '0.25rem' })}
        ${skelBlock({ className: 'create-skel-board', radius: '0.35rem' })}
      </section>
      <section class="create-col create-col--catalog items-main" aria-label="Item catalog" data-create-catalog></section>
    </div>
  `;
}

function rootPrefix() {
  const raw = document.body?.dataset?.root ?? '../';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/**
 * Wait briefly for OAuth session after redirect.
 * @param {number} [ms]
 */
async function waitForSession(ms = 5000) {
  const existing = await getSession();
  if (existing?.access_token) return existing;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsub();
      resolve(null);
    }, ms);
    const unsub = onAuthChange((_event, session) => {
      if (session?.access_token) {
        clearTimeout(timer);
        unsub();
        resolve(session);
      }
    });
  });
}

/**
 * @param {{
 *   state: ReturnType<typeof createEditorState>,
 *   itemsById: Map<string, object> | null,
 *   rail: ReturnType<typeof wrapFiltersWithTabs> | null,
 *   submitInfo: ReturnType<typeof createSubmitInfoModal>,
 *   root: string,
 * }} opts
 */
async function resumePendingSubmit(opts) {
  if (!hasPendingSubmit()) return;
  const session = await waitForSession();
  if (!session?.access_token) return;

  clearPendingSubmit();
  const draft = opts.state.getDraft();
  saveDraft(draft);
  const result = validateCreateDraft(draft, {
    itemsById: opts.itemsById || undefined,
  });
  if (!result.ok) {
    opts.rail?.setSubmitReady?.(false);
    opts.submitInfo.open(result);
    return;
  }

  opts.rail?.setSubmitBusy?.(true);
  try {
    const { slug } = await publishDraft(draft);
    clearDraft();
    location.href = buildViewHref(slug, opts.root);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err || '');
    if (/returning after login/i.test(msg)) return;
    console.error(err);
    window.alert(msg || 'Could not finish submit after sign-in.');
    opts.rail?.setSubmitBusy?.(false);
  }
}

export async function initCreatePage() {
  const main = document.getElementById('main');
  if (!main) return;

  // HTML ships layout + board skel; do not wipe before catalog/board mount (CLS).
  ensureCreateShell(main);

  const catalogHost = main.querySelector('[data-create-catalog]');
  const boardHost = main.querySelector('[data-create-board]');
  if (!(catalogHost instanceof HTMLElement) || !(boardHost instanceof HTMLElement)) {
    return;
  }

  const state = createEditorState();
  const root = rootPrefix();

  /** @type {ReturnType<typeof mountBoardEditor> | null} */
  let board = null;
  /** @type {ReturnType<typeof mountMetaPane> | null} */
  let meta = null;
  /** @type {ReturnType<typeof wrapFiltersWithTabs> | null} */
  let rail = null;
  const submitInfo = createSubmitInfoModal();

  /** @type {Map<string, object> | null} */
  let itemsById = null;

  function refreshSubmitReady() {
    const draft = state.getDraft();
    const result = validateCreateDraft(draft, {
      itemsById: itemsById || undefined,
    });
    rail?.setSubmitReady?.(result.ok);
    rail?.setSubmitForOp?.(!!draft.is_op);
  }

  try {
    const catalog = await initItemsCatalog(catalogHost, {
      enableSpotlight: false,
      cols: 10,
      fillWidth: true,
      onItemPointerDown(itemId, e) {
        if (board?.isDragging?.()) return;
        if (meta?.tryAssignSkill?.(itemId)) return;
        board?.beginCatalogDrag(itemId, e);
      },
    });

    if (!catalog) {
      boardHost.innerHTML = `<p class="create-status">Catalog failed to load.</p>`;
      submitInfo.destroy();
      return;
    }

    itemsById = catalog.itemsById;

    const remixResult = await applyRemixFromUrl(state);
    if (remixResult.error) {
      window.alert(remixResult.error);
    }

    const filtersEl = catalogHost.querySelector('.items-filters');
    if (filtersEl instanceof HTMLElement) {
      rail = wrapFiltersWithTabs(filtersEl, {
        onSubmitInfo() {
          submitInfo.open(
            validateCreateDraft(state.getDraft(), {
              itemsById: itemsById || undefined,
            }),
          );
        },
        async onSubmit() {
          const draft = state.getDraft();
          saveDraft(draft);
          const result = validateCreateDraft(draft, {
            itemsById: itemsById || undefined,
          });
          if (!result.ok) {
            rail?.setSubmitReady?.(false);
            submitInfo.open(result);
            return;
          }
          rail?.setSubmitBusy?.(true);
          try {
            const { slug } = await publishDraft(draft);
            clearDraft();
            location.href = buildViewHref(slug, root);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err || '');
            if (/returning after login/i.test(msg)) {
              // OAuth redirect in progress — keep draft; don't alert
              return;
            }
            console.error(err);
            window.alert(
              msg || 'Could not submit this build. Check config / network.',
            );
            rail?.setSubmitBusy?.(false);
            refreshSubmitReady();
          }
        },
      });
      if (rail) {
        meta = mountMetaPane(rail.buildHost, {
          state,
          itemsById: catalog.itemsById,
          items: catalog.allItems || [],
          getSpriteUrl: catalog.getSpriteUrl,
          root,
        });
      }
    }

    state.subscribe(refreshSubmitReady);
    refreshSubmitReady();

    // Rail and bag scroll independently — no wheel chaining between them
    initWheelToGrid({
      hostSelector: '[data-create-catalog]',
      filtersSelector: '[data-create-catalog] .items-filters',
      gridSelector: '[data-create-catalog] .items-bag__stage .bpb-bg',
      chainWheelToGrid: false,
    });

    board = mountBoardEditor(boardHost, {
      state,
      itemsById: catalog.itemsById,
      getSpriteUrl: catalog.getSpriteUrl,
      root,
    });
    if (meta) board.setMetaDrop?.(meta);

    const tip = createTooltipHover();
    tip.bind(boardHost, {
      selector:
        '.bpb-bg__item[data-item-id]:not(.bpb-bg__item--parked):not(.is-layer-dim)',
      getItem: (el) => {
        if (!(el instanceof HTMLElement) || el.classList.contains('is-layer-dim')) {
          return null;
        }
        return catalog.itemsById.get(el.dataset.itemId);
      },
      place: 'overFilters',
      filtersSelector: '[data-create-catalog]',
      filtersScope: boardHost.closest('.create-layout') || document,
    });

    // After Discord OAuth from Submit: finish publish → build view
    await resumePendingSubmit({
      state,
      itemsById,
      rail,
      submitInfo,
      root,
    });
  } catch (err) {
    console.error(err);
    rail?.destroy?.();
    meta?.destroy?.();
    submitInfo.destroy();
    main.innerHTML = `<p class="create-status">Could not load the creator. Check Supabase / network.</p>`;
  }
}

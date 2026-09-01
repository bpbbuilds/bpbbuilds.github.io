/**
 * Solo combat sandbox page — /sim/
 */

import { mountPlacedGrid } from '../../shared/backpack-grid/index.js';
import { createTooltipHover } from '../../shared/tooltip-hover.js';
import { skelBar, skelBlock, skelRegion } from '../../shared/skeleton.js';
import { loadCanAffectData } from '../../shared/backpack-grid/can-affect.js';
import { loadSimBoard, loadSimBoardForSlug } from './board-load.js';
import { runSim, seedFromQuery } from './engine/index.js';
import { downloadSimRun, buildSimDebugReport, copySimReportJson } from './engine/log-export.js';
import { loadSimCoverage } from './engine/scripts/registry.js';
import { mountSimScrubber } from './sim-scrubber.js';
import { mountSimCombatResults } from './sim-combat-results.js';
import { mountSimSettingsPanel } from './sim-settings-panel.js';
import { readSimAdvancedView, simTooltipRenderOptions } from './sim-view-prefs.js';
import { createSimFx } from './sim-fx.js';
import { actorHudHtml, bindActorHud } from './sim-hud.js';
import {
  buildPermalinkQuery,
  patchSimQuery,
  readSimQuery,
} from './sim-permalink.js';
import { mergeLiveItemStats, pieceSnapAt } from './sim-live-item.js';
import { tagOpponentPlacements } from './engine/vs-board.js';
import { simBagStageHtml, mountSimRoundPicker } from './sim-round-picker.js';
import { classIconPath } from '../../shared/class-icons.js';
import { paintSimStatus, resolveSimBoardStatus } from './sim-status.js';
import {
  getPremiumEntitlement,
  savePremiumIntent,
  SIM_HARD_GATE_INTENT,
} from '../../shared/premium-gate.js';
import {
  applySimPremiumLock,
  openSimPremiumGate,
  SIM_PREMIUM_REASON,
} from './sim-premium-gate.js';

const BOARD_COLS = 9;
const BOARD_ROWS = 7;
const CELL_PX = 77;

function rootPrefix() {
  const raw = document.body?.dataset?.root ?? '../';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/**
 * @param {HTMLElement} boardEl
 * @param {{ id: string, x: number, y: number, key: string }[]} placements
 */
function stampPlacementKeys(boardEl, placements) {
  const items = boardEl.querySelectorAll(
    '.bpb-bg__item:not(.bpb-bg__item--parked)',
  );
  for (const el of items) {
    if (!(el instanceof HTMLElement)) continue;
    const id = el.getAttribute('data-item-id');
    const left = parseFloat(el.style.left);
    const top = parseFloat(el.style.top);
    const hit = placements.find(
      (p) => p.id === id && Number(p.x) === left && Number(p.y) === top,
    );
    if (hit) el.dataset.placementKey = hit.key;
    else delete el.dataset.placementKey;
  }
}

/**
 * @param {HTMLElement} main
 */
function paintLoading(main) {
  main.innerHTML = skelRegion(
    `
    <div class="sim-shell sim-shell--field">
      <div class="sim-field" data-sim-layout>
        <div class="sim-field__stage-band" aria-hidden="true"></div>
        <section class="sim-region sim-region--controls sim-field__scrub">
          ${skelBlock({ className: 'sim-skel-scrub', height: '5.5rem', radius: '0.35rem' })}
        </section>
        <section class="sim-region sim-region--stage sim-field__bag sim-field__bag--you">
          ${skelBar({ width: '55%', height: '1.1rem' })}
          ${skelBlock({ className: 'sim-skel-board', height: '18rem', radius: '0.35rem' })}
        </section>
        <section class="sim-region sim-region--log sim-field__mid">
          ${skelBlock({ height: '7rem', width: '8rem', radius: '0.35rem' })}
        </section>
        <section class="sim-region sim-region--stage sim-field__bag sim-field__bag--opp">
          ${skelBar({ width: '55%', height: '1.1rem' })}
          ${skelBlock({ className: 'sim-skel-board', height: '18rem', radius: '0.35rem' })}
        </section>
        <section class="sim-region sim-region--hud sim-field__hud">
          ${skelBlock({ height: '10rem', radius: '0.35rem' })}
        </section>
      </div>
      <aside class="sim-region sim-region--lab sim-field__tools">
        ${skelBar({ width: '40%', height: '0.85rem' })}
      </aside>
    </div>
  `,
    { label: 'Loading sim board' },
  );
  main.setAttribute('aria-busy', 'true');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {string} root
 * @param {string | null | undefined} heroClass
 */
function bagClassIconHtml(root, heroClass) {
  const name = String(heroClass || '').trim();
  if (!name) return '';
  const src = classIconPath(root, name);
  if (!src) return '';
  return `<img class="sim-bag-class-icon" src="${escapeHtml(src)}" alt="${escapeHtml(name)}" title="${escapeHtml(name)}" width="40" height="40" draggable="false" />`;
}

/**
 * @param {import('./sim-events.js').SimRun} run
 */
function bannerHtml(run) {
  const total = Number(run.coverage?.total) || 0;
  const scripted = Number(run.coverage?.scripted) || 0;
  const hasPct = total > 0;
  const pct = hasPct ? Math.round((scripted / total) * 100) : 0;
  const tip = hasPct
    ? `${scripted} of ${total} items on this board have dedicated combat scripts. Not a guarantee the fight matches ranked Backpack Battles.`
    : 'Predictive sandbox with seeded RNG — not a ranked Combat Log replay.';
  return `
    <span class="sim-fidelity__label" title="${escapeHtml(tip)}">Script coverage</span>
    <span class="sim-fidelity__pct" title="${escapeHtml(tip)}">${hasPct ? `${pct}%` : '—'}</span>
    <span class="sim-fidelity__hint">this board · predictive sandbox, not ranked replay</span>
  `;
}

export async function initSimPage() {
  const main = document.getElementById('main');
  if (!(main instanceof HTMLElement)) return;
  const root = rootPrefix();

  paintLoading(main);

  try {
    const query0 = readSimQuery();
    const [board, canAffect, , oppBoard] = await Promise.all([
      loadSimBoard(),
      loadCanAffectData(root).catch(() => null),
      loadSimCoverage(root).catch(() => null),
      query0.oppSlug
        ? loadSimBoardForSlug(query0.oppSlug, query0.oppRound).catch(() => ({
            source: 'empty',
            title: 'Opponent not found',
            authorName: null,
            heroClass: null,
            slug: query0.oppSlug,
            round: query0.oppRound,
            placements: [],
            itemsById: new Map(),
            getSpriteUrl: () => '',
            error: `Could not load opponent build “${query0.oppSlug}”.`,
          }))
        : Promise.resolve(null),
    ]);

    const boardStatus = resolveSimBoardStatus(board);
    if (boardStatus) {
      paintSimStatus(main, root, boardStatus);
      return;
    }

  const query = readSimQuery();
  const mode = 'engine';
  const seed = seedFromQuery() ?? 0xb0bd2026;
  let startT = query.t;
  let startSpeed = query.speed;
  const dummyBlock = query.dummyBlock || 0;
  let oppPlacements =
    oppBoard?.placements?.length && !oppBoard.error
      ? tagOpponentPlacements(oppBoard.placements)
      : [];
  let currentOppRound = query.oppRound ?? oppBoard?.round ?? null;
  const publishedYouPlacements = (board.publishedPlacements || board.placements).map(
    (p) => ({ ...p, gems: p.gems ? [...p.gems] : undefined }),
  );
  const publishedOppPlacements = oppBoard
    ? (oppBoard.publishedPlacements || oppBoard.placements).map((p) => ({
        ...p,
        gems: p.gems ? [...p.gems] : undefined,
      }))
    : [];
  if (oppBoard?.itemsById) {
    for (const [id, item] of oppBoard.itemsById) {
      if (!board.itemsById.has(id)) board.itemsById.set(id, item);
    }
  }
  let permalinkTimer = 0;

  const youClassIcon = bagClassIconHtml(root, board.heroClass);
  const oppClassIcon = bagClassIconHtml(root, oppBoard?.heroClass);
  const permalinkQs = () =>
    buildPermalinkQuery({
      slug: board.slug,
      round: board.round,
      seed,
      mode,
      t: startT ?? undefined,
      speed: startSpeed ?? undefined,
      dummyBlock,
      oppSlug: oppBoard?.slug || query.oppSlug,
      oppRound: currentOppRound,
    });

  function reportMeta() {
    const qs = permalinkQs();
    let permalink = `?${qs}`;
    try {
      permalink = `${location.pathname}?${qs}`;
    } catch {
      /* ignore */
    }
    return {
      title: board.title,
      slug: board.slug,
      round: board.round,
      seed,
      permalink,
      placements: board.placements,
      itemsById: board.itemsById,
      opponentTitle: oppBoard?.title || null,
      opponentSlug: oppBoard?.slug || query.oppSlug || null,
      opponentRound: currentOppRound,
      opponentPlacements: oppPlacements.length ? oppPlacements : undefined,
    };
  }

  const vsBoard = oppPlacements.length > 0;
  const oppLoadFailed = Boolean(query.oppSlug && !oppPlacements.length);
  const youTitle = board.title || 'Your build';
  const oppTitle = vsBoard
    ? oppBoard.title || oppBoard.slug || 'Opponent'
    : 'Training dummy';
  const youBannerName =
    String(board.authorName || '').trim() || youTitle;
  const oppBannerName = vsBoard
    ? String(oppBoard?.authorName || '').trim() || oppTitle
    : 'Training Dummy';
  let advancedView = readSimAdvancedView();

  main.innerHTML = `
    <div class="sim-shell sim-shell--field${advancedView ? ' sim-shell--advanced' : ''}">
      <div class="sim-field" data-sim-layout>
        <div class="sim-field__stage-band" aria-hidden="true"></div>
        <section
          class="sim-region sim-region--controls sim-field__scrub"
          aria-labelledby="sim-region-controls"
        >
          <h2 id="sim-region-controls" class="sim-region__label">Run controls</h2>
          <div data-sim-scrub></div>
          <p class="sim-fidelity" role="note" data-sim-banner></p>
        </section>
        <section
          class="sim-region sim-region--stage sim-field__bag sim-field__bag--you"
          aria-labelledby="sim-region-you-board"
        >
          <h2 id="sim-region-you-board" class="sim-region__label">Your board</h2>
          <div class="sim-bag-wrap">
            <div class="sim-bag-head">
              <h3 class="sim-bag-title">${escapeHtml(youTitle)}</h3>
              ${youClassIcon}
            </div>
            ${simBagStageHtml(board)}
          </div>
        </section>
        <section
          class="sim-region sim-region--log sim-field__mid"
          aria-labelledby="sim-region-log"
        >
          <h2 id="sim-region-log" class="sim-region__label">Combat log and damage meters</h2>
          <div class="sim-field__logbook" data-sim-combat-results></div>
        </section>
        ${
          vsBoard
            ? `<section
          class="sim-region sim-region--stage sim-field__bag sim-field__bag--opp"
          aria-labelledby="sim-region-opp-board"
        >
          <h2 id="sim-region-opp-board" class="sim-region__label">Opponent board</h2>
          <div class="sim-bag-wrap sim-bag-wrap--opp">
            <div class="sim-bag-head">
              <h3 class="sim-bag-title">${escapeHtml(oppTitle)}</h3>
              ${oppClassIcon}
            </div>
            ${simBagStageHtml(oppBoard)}
          </div>
        </section>`
            : `<div class="sim-field__bag sim-field__bag--opp sim-field__bag--empty" aria-hidden="true"></div>`
        }
        <section
          class="sim-region sim-region--hud sim-field__hud"
          aria-labelledby="sim-region-hud"
        >
          <h2 id="sim-region-hud" class="sim-region__label">Combat HUD</h2>
          <div class="sim-hud-row">
            <span class="sim-hud-vs" aria-hidden="true">⚔</span>
            ${actorHudHtml('player', escapeHtml(youBannerName), 'player', root, board.heroClass)}
            ${actorHudHtml(
              'dummy',
              escapeHtml(oppBannerName),
              'opponent',
              root,
              oppBoard?.heroClass,
            )}
          </div>
        </section>
      </div>
      <aside
        class="sim-region sim-region--lab sim-field__tools"
        aria-labelledby="sim-region-lab"
      >
        <h2 id="sim-region-lab" class="sim-region__label">Run details</h2>
        <p class="sim-meta sim-meta--tools">
          Seed <code data-sim-seed>${seed}</code>
          · <a data-sim-permalink href="?${permalinkQs()}">Permalink</a>
          · <button type="button" class="sim-link-btn" data-sim-copy>Copy link</button>
          · <button type="button" class="sim-link-btn" data-sim-copy-report>Copy report</button>
          · <button type="button" class="sim-link-btn" data-sim-download-report>Download report</button>
        </p>
        ${
          oppLoadFailed
            ? `<p class="sim-meta sim-meta--warn" role="status">Opponent build could not be loaded — using training dummy.</p>`
            : ''
        }
      </aside>
      <div class="sim-settings-dock" data-sim-settings-dock></div>
    </div>
  `;

  const bagHost = main.querySelector('.sim-field__bag--you [data-sim-bag-slot]');
  const youStage = main.querySelector('.sim-field__bag--you .sim-bag-stage');
  const scrubHost = main.querySelector('[data-sim-scrub]');
  const resultsHost = main.querySelector('[data-sim-combat-results]');
  const bannerEl = main.querySelector('[data-sim-banner]');
  const permalinkEl = main.querySelector('[data-sim-permalink]');
  const copyBtn = main.querySelector('[data-sim-copy]');
  const copyReportBtn = main.querySelector('[data-sim-copy-report]');
  const downloadReportBtn = main.querySelector('[data-sim-download-report]');
  const playerHudEl = main.querySelector('[data-hud="player"]');
  const dummyHudEl = main.querySelector('[data-hud="dummy"]');

  if (
    !(bagHost instanceof HTMLElement) ||
    !(scrubHost instanceof HTMLElement) ||
    !(playerHudEl instanceof HTMLElement) ||
    !(dummyHudEl instanceof HTMLElement)
  ) {
    paintSimStatus(main, root, {
      kind: 'error',
      message: 'Sim layout failed to mount.',
    });
    return;
  }

  const playerHud = bindActorHud(playerHudEl, root);
  const dummyHud = bindActorHud(dummyHudEl, root);

  const grid = mountPlacedGrid(bagHost, {
    cols: BOARD_COLS,
    rows: BOARD_ROWS,
    exactBoard: true,
    fillWidth: true,
    cellPx: CELL_PX,
    itemsById: board.itemsById,
    getSpriteUrl: board.getSpriteUrl,
    placements: board.placements,
    appear: true,
  });
  stampPlacementKeys(grid.el, board.placements);

  const oppBagHost = main.querySelector('.sim-field__bag--opp [data-sim-bag-slot]');
  const oppStage = main.querySelector('.sim-field__bag--opp .sim-bag-stage');
  const oppGrid =
    oppBagHost instanceof HTMLElement && oppPlacements.length
      ? mountPlacedGrid(oppBagHost, {
          cols: BOARD_COLS,
          rows: BOARD_ROWS,
          exactBoard: true,
          fillWidth: true,
          cellPx: CELL_PX,
          itemsById: board.itemsById,
          getSpriteUrl: oppBoard.getSpriteUrl || board.getSpriteUrl,
          placements: oppPlacements,
          appear: true,
        })
      : null;
  if (oppGrid) stampPlacementKeys(oppGrid.el, oppPlacements);

  const fieldEl = main.querySelector('.sim-field');
  const bagsHost =
    fieldEl instanceof HTMLElement ? fieldEl : main.querySelector('.sim-bags');

  const tip = createTooltipHover({
    pinOnAlt: true,
    getRenderOptions: (anchor) => {
      const onOppBoard =
        anchor instanceof Element && !!anchor.closest('.sim-field__bag--opp');
      return {
        ...simTooltipRenderOptions(advancedView),
        sidecarLeft: onOppBoard,
        assetRoot: rootPrefix(),
        getCatalogItem: (id) => board.itemsById.get(id),
        getSpriteUrlForId: (id) => {
          const row = board.itemsById.get(id);
          return row ? board.getSpriteUrl(row) : '';
        },
      };
    },
  });

  /**
   * Catalog item merged with combat piece stats at the current scrubber time.
   * @param {Element} el
   */
  function getLiveTipItem(el) {
    const id = el instanceof HTMLElement ? el.dataset.itemId : '';
    const base = id ? board.itemsById.get(id) : null;
    if (!base) return null;
    const keyEl =
      el instanceof HTMLElement
        ? el.closest('.bpb-bg__item[data-placement-key], .bpb-bg__mark--gem[data-placement-key]') ||
          el.closest('[data-placement-key]') ||
          el
        : null;
    const key =
      keyEl instanceof HTMLElement ? keyEl.dataset.placementKey || '' : '';
    const t = scrubber?.getTime?.() ?? 0;
    const live = pieceSnapAt(currentRun?.pieceSnapshots, t, key);
    return mergeLiveItemStats(base, live, t);
  }

  tip.bind(bagsHost instanceof HTMLElement ? bagsHost : bagHost, {
    selector:
      '.bpb-bg__mark--gem[data-item-id], .bpb-bg__item[data-item-id]:not(.bpb-bg__item--parked)',
    getItem: getLiveTipItem,
    place: 'center',
  });

  /** @type {ReturnType<typeof createSimFx> | null} */
  let fx = null;
  /** @type {ReturnType<typeof mountSimScrubber> | null} */
  let scrubber = null;
  /** @type {ReturnType<typeof mountSimCombatResults> | null} */
  let combatResults = null;
  /** @type {import('./sim-events.js').SimRun | null} */
  let currentRun = null;

  function syncPermalinkAnchor() {
    if (!(permalinkEl instanceof HTMLAnchorElement)) return;
    permalinkEl.href = `?${permalinkQs()}`;
  }

  function scheduleQuerySync(t, speed) {
    window.clearTimeout(permalinkTimer);
    permalinkTimer = window.setTimeout(() => {
      startT = t;
      startSpeed = speed;
      patchSimQuery({
        slug: board.slug,
        round: board.round,
        seed,
        mode,
        t,
        speed,
        dummyBlock,
        oppSlug: oppBoard?.slug || query.oppSlug,
        oppRound: currentOppRound,
      });
      syncPermalinkAnchor();
    }, 220);
  }

  /**
   * Re-run engine + remount scrubber, FX, and combat log for the current boards.
   */
  function mountRun() {
    scrubber?.destroy();
    combatResults?.destroy();
    fx?.destroy();

    try {
      const run = runSim({
        mode,
        placements: board.placements,
        itemsById: board.itemsById,
        seed,
        canAffect,
        dummyBlock,
        opponentPlacements: oppPlacements,
        round: board.round,
        opponentRound: currentOppRound,
        playerMaxHp: board.playerMaxHp,
        playerMaxStamina: board.playerMaxStamina,
        opponentMaxHp: oppBoard?.playerMaxHp,
        opponentMaxStamina: oppBoard?.playerMaxStamina,
      });
      currentRun = run;

      if (bannerEl) bannerEl.innerHTML = bannerHtml(run);

      fx = createSimFx({
        boardEl: bagsHost instanceof HTMLElement ? bagsHost : grid.el,
        playerHud,
        dummyHud,
        run,
        assetRoot: root,
      });

      const initialT =
        startT != null && Number.isFinite(Number(startT)) ? Number(startT) : undefined;
      scrubber = mountSimScrubber(scrubHost, {
        run,
        assetRoot: root,
        initialT,
        initialSpeed: startSpeed ?? undefined,
        autoplay: true,
        onSeek(t) {
          fx?.seek(t);
          combatResults?.setTime(t);
          if (!tip._refreshAt || performance.now() - tip._refreshAt > 80) {
            tip._refreshAt = performance.now();
            tip.refresh?.(getLiveTipItem);
          }
        },
        onEvent(ev) {
          fx?.flashEvent(ev);
          if (
            ev.type === 'buff' ||
            ev.type === 'debuff' ||
            ev.type === 'activate'
          ) {
            tip.refresh?.(getLiveTipItem);
          }
        },
        onTime(t) {
          scheduleQuerySync(t, scrubber?.getSpeed?.() ?? 1);
        },
        onSpeed(speed) {
          startSpeed = speed;
          scheduleQuerySync(startT ?? 0, speed);
        },
        onPlayingChange(playing) {
          combatResults?.setPlaying(playing);
        },
      });

      if (resultsHost instanceof HTMLElement) {
        combatResults = mountSimCombatResults(resultsHost, {
          run,
          itemsById: board.itemsById,
          assetRoot: root,
          onSeek(t) {
            if (scrubber?.isPlaying?.()) return;
            scrubber?.seek(t, { fireEvents: false });
          },
          onHighlight(placementKey) {
            fx?.highlightPlacement(placementKey);
          },
          onPlay: () => scrubber?.play(),
          onPause: () => scrubber?.pause(),
          getPlaying: () => scrubber?.isPlaying?.() ?? false,
        });
        combatResults.setTime(scrubber?.getTime?.() ?? 0);
        combatResults.setPlaying(scrubber?.isPlaying?.() ?? false);
      }

      patchSimQuery({
        slug: board.slug,
        round: board.round,
        seed,
        mode,
        speed: startSpeed,
        dummyBlock,
        oppSlug: oppBoard?.slug || query.oppSlug,
        oppRound: currentOppRound,
      });
      syncPermalinkAnchor();
    } catch (err) {
      console.error('[sim] mountRun failed', err);
      currentRun = null;
      if (bannerEl) {
        bannerEl.innerHTML =
          '<span class="sim-status sim-status--error" role="alert">Could not run this fight. Try a different board or seed.</span>';
      }
    }
  }

  /**
   * @param {{ round: number, placements: object[] } | null} frame
   * @param {{ published?: boolean }} meta
   */
  function applyYouRound(frame, meta) {
    const published = Boolean(meta?.published);
    if (published && board.round == null) return;
    if (!published && frame && board.round === frame.round) return;

    if (published) {
      board.placements = publishedYouPlacements;
      board.round = null;
      board.playerMaxHp = null;
      board.playerMaxStamina = null;
    } else if (frame) {
      board.placements = frame.placements;
      board.round = frame.round;
      board.playerMaxHp = frame.playerMaxHp ?? null;
      board.playerMaxStamina = frame.playerMaxStamina ?? null;
    } else return;

    grid.update(board.placements, board.itemsById, { appear: true });
    stampPlacementKeys(grid.el, board.placements);
    startT = 0;
    mountRun();
    patchSimQuery({ round: board.round, t: null });
  }

  /**
   * @param {{ round: number, placements: object[] } | null} frame
   * @param {{ published?: boolean }} meta
   */
  function applyOppRound(frame, meta) {
    if (!oppBoard || !oppGrid) return;
    const published = Boolean(meta?.published);
    if (published && oppBoard.round == null && currentOppRound == null) return;
    if (!published && frame && oppBoard.round === frame.round) return;

    if (published) {
      oppBoard.placements = publishedOppPlacements;
      oppBoard.round = null;
      oppBoard.playerMaxHp = null;
      oppBoard.playerMaxStamina = null;
      currentOppRound = null;
    } else if (frame) {
      oppBoard.placements = frame.placements;
      oppBoard.round = frame.round;
      oppBoard.playerMaxHp = frame.playerMaxHp ?? null;
      oppBoard.playerMaxStamina = frame.playerMaxStamina ?? null;
      currentOppRound = frame.round;
    } else return;

    oppPlacements = tagOpponentPlacements(oppBoard.placements);
    oppGrid.update(oppPlacements, board.itemsById, { appear: true });
    stampPlacementKeys(oppGrid.el, oppPlacements);
    startT = 0;
    mountRun();
    patchSimQuery({ oppRound: currentOppRound, t: null });
  }

  /** @type {ReturnType<typeof mountSimRoundPicker> | null} */
  let youRoundPicker = null;
  /** @type {ReturnType<typeof mountSimRoundPicker> | null} */
  let oppRoundPicker = null;

  const settingsDock = main.querySelector('[data-sim-settings-dock]');
  const shellEl = main.querySelector('.sim-shell');
  const settingsPanel =
    settingsDock instanceof HTMLElement
      ? mountSimSettingsPanel(settingsDock, {
          assetRoot: root,
          shell: shellEl instanceof HTMLElement ? shellEl : null,
          onAdvancedChange: (on) => {
            advancedView = on;
            tip.refresh?.(getLiveTipItem);
          },
        })
      : null;

  const { signedIn, entitled } = await getPremiumEntitlement();

  if (!entitled) {
    applySimPremiumLock(main, { signedIn });
    savePremiumIntent({
      key: SIM_HARD_GATE_INTENT,
      reason: SIM_PREMIUM_REASON,
    });
    await openSimPremiumGate({ signedIn });
    window.addEventListener(
      'pagehide',
      () => {
        window.clearTimeout(permalinkTimer);
        settingsPanel?.destroy();
        tip?.destroy?.();
        grid.destroy();
        oppGrid?.destroy();
      },
      { once: true },
    );
    main.removeAttribute('aria-busy');
    return;
  }

  mountRun();

  if (youStage instanceof HTMLElement && bagHost instanceof HTMLElement) {
    youRoundPicker = mountSimRoundPicker(youStage, {
      board,
      root,
      bagHost,
      onBoardChange: applyYouRound,
    });
  }

  if (vsBoard && oppStage instanceof HTMLElement && oppBagHost instanceof HTMLElement) {
    oppRoundPicker = mountSimRoundPicker(oppStage, {
      board: oppBoard,
      root,
      bagHost: oppBagHost,
      onBoardChange: applyOppRound,
    });
  }

  window.addEventListener(
    'pagehide',
    () => {
      window.clearTimeout(permalinkTimer);
      scrubber?.destroy();
      combatResults?.destroy();
      settingsPanel?.destroy();
      fx?.destroy();
      youRoundPicker?.destroy?.();
      oppRoundPicker?.destroy?.();
      tip?.destroy?.();
      grid.destroy();
      oppGrid?.destroy();
    },
    { once: true },
  );

  copyBtn?.addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}?${permalinkQs()}`;
    try {
      await navigator.clipboard.writeText(url);
      if (copyBtn instanceof HTMLElement) {
        copyBtn.textContent = 'Copied';
        window.setTimeout(() => {
          copyBtn.textContent = 'Copy link';
        }, 1400);
      }
    } catch {
      /* ignore */
    }
  });

  copyReportBtn?.addEventListener('click', async () => {
    if (!currentRun) return;
    try {
      await copySimReportJson(buildSimDebugReport(currentRun, reportMeta()));
      if (copyReportBtn instanceof HTMLElement) {
        copyReportBtn.textContent = 'Copied';
        window.setTimeout(() => {
          copyReportBtn.textContent = 'Copy report';
        }, 1400);
      }
    } catch {
      /* ignore */
    }
  });

  downloadReportBtn?.addEventListener('click', () => {
    if (!currentRun) return;
    downloadSimRun(currentRun, reportMeta());
  });

    main.removeAttribute('aria-busy');
  } catch (err) {
    console.error('[sim] init failed', err);
    paintSimStatus(main, root, {
      kind: 'error',
      message:
        'Something went wrong loading the sim. Refresh the page or try a different build.',
    });
  }
}

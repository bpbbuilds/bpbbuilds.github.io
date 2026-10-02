/**
 * Solo combat sandbox page — /sim/
 */

import { mountPlacedGrid } from '../../shared/backpack-grid/index.js';
import { createTooltipHover } from '../../shared/tooltip-hover.js';
import { loadCanAffectData } from '../../shared/backpack-grid/can-affect.js';
import {
  attachSimBootStage,
  paintSimLoading,
  revealSimBoot,
  waitForSimAssets,
} from './shell/sim-boot.js';
import { loadSimBoard, loadSimBoardForSlug } from './shell/board-load.js';
import { runSim, seedFromQuery } from './engine/index.js';
import { downloadSimRun, buildSimDebugReport, copySimReportJson } from './engine/log-export.js';
import { loadSimCoverage } from './engine/scripts/registry.js';
import { mountSimScrubber } from './controls/sim-scrubber.js';
import { mountSimCombatResults } from './log/sim-combat-results.js';
import { mountSimSettingsPanel } from './controls/sim-settings-panel.js';
import { mountSimReportUi, simReportBtnHtml } from './report/sim-report.js';
import {
  readSimAdvancedView,
  readSimCombatLabels,
  readSimIconEnlarge,
  simTooltipRenderOptions,
} from './shell/sim-view-prefs.js';
import { createSimFx } from './fx/sim-fx.js';
import { actorHudHtml, bindActorHud } from './hud/sim-hud.js';
import {
  buildPermalinkQuery,
  patchSimQuery,
  readSimQuery,
} from './shell/sim-permalink.js';
import { mergeLiveItemStats, pieceSnapAt } from './shell/sim-live-item.js';
import { computePlacementCounters } from '../create/board-live-stats.js';
import { tagOpponentPlacements } from './engine/vs-board.js';
import { simBagStageHtml, mountSimRoundPicker } from './controls/sim-round-picker.js';
import {
  buildMirrorOppBoard,
  foeModeFromQuery,
} from './foe/sim-foe-mode.js';
import {
  readDummySettings,
  saveDummyPreset,
  mountSimDummySettings,
} from './foe/sim-dummy-settings.js';
import {
  simOppBannerName,
  simOppBodyHtml,
  simOppColumnHtml,
  simOppTitle,
  setOppColumnBody,
  syncOppColumnHead,
} from './foe/sim-opp-column.js';
import {
  blobAvatarPath,
  foeAvatarStackHtml,
  resolveFoeAvatar,
  resolveYouAvatar,
  saveYouAvatarMode,
  setAvatarSrc,
  youAvatarStackHtml,
  readYouAvatarMode,
} from './hud/sim-avatars.js';
import { mountYouPersonRail, youSideRailHtml } from './foe/sim-side-rails.js';
import { mountFoeOpponentRail } from './foe/sim-foe-rail.js';
import { openSimBuildBrowser } from './foe/sim-build-browser.js';
import { bakeBlobFaceUrl } from '../../shared/blob-face.js';
import { resolveIdentityMode } from '../../shared/profile-avatar.js';
import { classIconPath } from '../../shared/class-icons.js';
import { paintSimStatus, resolveSimBoardStatus } from './shell/sim-status.js';
import {
  getPremiumEntitlement,
  savePremiumIntent,
  SIM_HARD_GATE_INTENT,
} from '../../shared/premium-gate.js';
import {
  applySimPremiumLock,
  openSimPremiumGate,
  SIM_PREMIUM_REASON,
} from './controls/sim-premium-gate.js';

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
    <button type="button" class="sim-fidelity__report" data-sim-report-open>
      <span class="sim-fidelity__bang" aria-hidden="true">!</span>Report issue
    </button>
  `;
}

export async function initSimPage() {
  const main = document.getElementById('main');
  if (!(main instanceof HTMLElement)) return;
  const root = rootPrefix();

  paintSimLoading(main, root);

  try {
    const query0 = readSimQuery();
    const foeMode0 = foeModeFromQuery(query0);
    const loadOppSlug =
      foeMode0 === 'build' && query0.oppSlug ? query0.oppSlug : null;
    const [board, canAffect, , oppBoardLoaded, premium] = await Promise.all([
      loadSimBoard(),
      loadCanAffectData(root).catch(() => null),
      loadSimCoverage(root).catch(() => null),
      loadOppSlug
        ? loadSimBoardForSlug(loadOppSlug, query0.oppRound).catch(() => ({
            source: 'empty',
            title: 'Opponent not found',
            authorName: null,
            heroClass: null,
            slug: loadOppSlug,
            round: query0.oppRound,
            placements: [],
            itemsById: new Map(),
            getSpriteUrl: () => '',
            error: `Could not load opponent build “${loadOppSlug}”.`,
          }))
        : Promise.resolve(null),
      getPremiumEntitlement().catch(() => ({
        signedIn: false,
        entitled: false,
        profile: null,
      })),
    ]);
    const signedIn = Boolean(premium?.signedIn);
    const entitled = Boolean(premium?.entitled);

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
  let dummySettings = readDummySettings(query);
  let foeMode = foeModeFromQuery(query);

  /** @type {any} */
  let oppBoard =
    foeMode === 'mirror'
      ? buildMirrorOppBoard(board)
      : foeMode === 'build'
        ? oppBoardLoaded
        : null;

  if (foeMode === 'build' && (!oppBoard?.placements?.length || oppBoard.error)) {
    foeMode = 'dummy';
    oppBoard = null;
  }

  let oppPlacements =
    oppBoard?.placements?.length && !oppBoard.error
      ? tagOpponentPlacements(oppBoard.placements)
      : [];
  let currentOppRound =
    foeMode === 'mirror'
      ? board.round ?? null
      : query.oppRound ?? oppBoard?.round ?? null;
  const publishedYouPlacements = (board.publishedPlacements || board.placements).map(
    (p) => ({ ...p, gems: p.gems ? [...p.gems] : undefined }),
  );
  /** @type {object[]} */
  let publishedOppPlacements = oppBoard
    ? (oppBoard.publishedPlacements || oppBoard.placements).map((p) => ({
        ...p,
        gems: p.gems ? [...p.gems] : undefined,
      }))
    : [];
  if (oppBoard?.itemsById && foeMode !== 'mirror') {
    for (const [id, item] of oppBoard.itemsById) {
      if (!board.itemsById.has(id)) board.itemsById.set(id, item);
    }
  }
  let permalinkTimer = 0;

  const youClassIcon = bagClassIconHtml(root, board.heroClass);
  const permalinkFoe = () => foeMode;
  const permalinkOppSlug = () =>
    foeMode === 'build' ? oppBoard?.slug || query.oppSlug || null : null;
  const permalinkQs = () =>
    buildPermalinkQuery({
      slug: board.slug,
      round: board.round,
      seed,
      mode,
      t: startT ?? undefined,
      speed: startSpeed ?? undefined,
      dummyBlock: dummySettings.block,
      dummyHp: dummySettings.maxHp,
      dummyAtk: dummySettings.attacks ? null : false,
      dummyDmg: dummySettings.damage,
      dummyCd: dummySettings.interval,
      foe: permalinkFoe(),
      oppSlug: permalinkOppSlug(),
      oppRound: foeMode === 'build' ? currentOppRound : null,
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
      opponentSlug: foeMode === 'build' ? oppBoard?.slug || query.oppSlug || null : null,
      opponentRound: currentOppRound,
      opponentPlacements: oppPlacements.length ? oppPlacements : undefined,
    };
  }

  function sessionFoeLabel() {
    if (foeMode === 'mirror') return 'Mirror (your board)';
    if (foeMode === 'build') {
      const title = String(oppBoard?.title || query.oppSlug || 'Public build').trim();
      const slug = String(oppBoard?.slug || query.oppSlug || '').trim();
      const roundBit =
        currentOppRound != null ? ` · round ${currentOppRound}` : '';
      return slug ? `${title} (${slug})${roundBit}` : `${title}${roundBit}`;
    }
    return 'Training dummy';
  }

  function reportIssueSnapshot() {
    const total = Number(currentRun?.coverage?.total) || 0;
    const scripted = Number(currentRun?.coverage?.scripted) || 0;
    const coveragePct = total > 0 ? Math.round((scripted / total) * 100) : null;
    const youName = String(premium?.profile?.display_name || '').trim();
    let permalink = `?${permalinkQs()}`;
    try {
      permalink = `${location.pathname}?${permalinkQs()}`;
    } catch {
      /* ignore */
    }
    return {
      seed: String(seed ?? ''),
      userLabel: signedIn ? youName || 'Signed in' : 'Guest',
      youTitle: String(board.title || youTitle || 'Your build'),
      youSlug: board.slug || null,
      youRound: board.round ?? null,
      foeMode,
      foeLabel: sessionFoeLabel(),
      permalink,
      coveragePct,
      youHeroClass: board.heroClass || null,
    };
  }

  const youTitle = board.title || 'Your build';
  const youBannerName =
    String(board.authorName || '').trim() || youTitle;
  let advancedView = readSimAdvancedView();
  /** @type {import('./hud/sim-avatars.js').AvatarPickMode} */
  let youAvatarMode = readYouAvatarMode();
  /** Discord pfp — Profile pick only. */
  const discordAvatarUrl =
    String(premium?.profile?.avatar_url || '').trim() || null;
  const profileIsBlob = resolveIdentityMode(premium?.profile) === 'blob';
  /** Blob (+ equipped cosmetics) — Blob pick / stage. */
  let blobAvatarUrl = blobAvatarPath(root);
  if (profileIsBlob) {
    blobAvatarUrl =
      (await bakeBlobFaceUrl(premium?.profile, root, 256)) || blobAvatarUrl;
  }
  /** Equipped public look (for foe mirror). */
  const equippedAvatarUrl = profileIsBlob
    ? blobAvatarUrl
    : discordAvatarUrl;
  if (youAvatarMode === 'profile' && !discordAvatarUrl) {
    youAvatarMode = 'class';
  }
  const oppLoadFailed = Boolean(
    foeModeFromQuery(query) === 'build' &&
      query.oppSlug &&
      !oppPlacements.length,
  );

  const bootStage = attachSimBootStage(main);
  const liveRoot = () => (bootStage.isConnected ? bootStage : main);
  bootStage.innerHTML = `
    <div class="sim-shell sim-shell--field${advancedView ? ' sim-shell--advanced' : ''}">
      <div class="sim-field" data-sim-layout>
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
          ${youAvatarStackHtml(
            resolveYouAvatar(root, board, {
              mode: youAvatarMode,
              profileAvatarUrl: discordAvatarUrl,
              blobAvatarUrl,
            }),
          )}
          ${youSideRailHtml(root)}
        </section>
        <section
          class="sim-region sim-region--log sim-field__mid"
          aria-labelledby="sim-region-log"
        >
          <h2 id="sim-region-log" class="sim-region__label">Combat log and damage meters</h2>
          <div class="sim-field__logbook" data-sim-combat-results></div>
        </section>
        ${simOppColumnHtml({
          title: simOppTitle(foeMode, oppBoard),
          classIconHtml: bagClassIconHtml(root, oppBoard?.heroClass),
          bodyHtml: simOppBodyHtml(foeMode, oppBoard, root),
          root,
        })}
        <section
          class="sim-region sim-region--hud sim-field__hud"
          aria-labelledby="sim-region-hud"
        >
          <h2 id="sim-region-hud" class="sim-region__label">Combat HUD</h2>
          <div class="sim-hud-row">
            ${actorHudHtml('player', escapeHtml(youBannerName), 'player', root, board.heroClass)}
            ${actorHudHtml(
              'dummy',
              escapeHtml(simOppBannerName(foeMode, oppBoard)),
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
        </p>
        ${
          oppLoadFailed
            ? `<p class="sim-meta sim-meta--warn" role="status" data-sim-opp-warn>Opponent build could not be loaded — using training dummy.</p>`
            : `<p class="sim-meta sim-meta--warn" role="status" data-sim-opp-warn hidden></p>`
        }
      </aside>
      <div class="sim-chrome-dock">
        ${simReportBtnHtml(root)}
        <div class="sim-settings-dock" data-sim-settings-dock></div>
      </div>
    </div>
  `;

  const bagHost = liveRoot().querySelector('.sim-field__bag--you [data-sim-bag-slot]');
  const youStage = liveRoot().querySelector('.sim-field__bag--you .sim-bag-stage');
  const scrubHost = liveRoot().querySelector('[data-sim-scrub]');
  const resultsHost = liveRoot().querySelector('[data-sim-combat-results]');
  const bannerEl = liveRoot().querySelector('[data-sim-banner]');
  const playerHudEl = liveRoot().querySelector('[data-hud="player"]');
  const dummyHudEl = liveRoot().querySelector('[data-hud="dummy"]');

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

  const iconEnlarge0 = readSimIconEnlarge();
  let combatLabelsOn = readSimCombatLabels();
  const playerHud = bindActorHud(playerHudEl, root, { iconEnlarge: iconEnlarge0 });
  const dummyHud = bindActorHud(dummyHudEl, root, { iconEnlarge: iconEnlarge0 });

  const grid = mountPlacedGrid(bagHost, {
    cols: BOARD_COLS,
    rows: BOARD_ROWS,
    exactBoard: true,
    fillWidth: true,
    cellPx: CELL_PX,
    itemsById: board.itemsById,
    getSpriteUrl: board.getSpriteUrl,
    placements: board.placements,
    appear: false,
  });
  stampPlacementKeys(grid.el, board.placements);

  const oppColumn = liveRoot().querySelector('[data-sim-opp-column]');
  /** @type {HTMLElement | null} */
  let oppBagHost =
    liveRoot().querySelector('.sim-field__bag--opp [data-sim-bag-slot]') instanceof
    HTMLElement
      ? /** @type {HTMLElement} */ (
          liveRoot().querySelector('.sim-field__bag--opp [data-sim-bag-slot]')
        )
      : null;
  /** @type {HTMLElement | null} */
  let oppStage =
    liveRoot().querySelector('.sim-field__bag--opp .sim-bag-stage') instanceof HTMLElement
      ? /** @type {HTMLElement} */ (
          liveRoot().querySelector('.sim-field__bag--opp .sim-bag-stage')
        )
      : null;
  /** @type {ReturnType<typeof mountPlacedGrid> | null} */
  let oppGrid =
    oppBagHost instanceof HTMLElement && oppPlacements.length
      ? mountPlacedGrid(oppBagHost, {
          cols: BOARD_COLS,
          rows: BOARD_ROWS,
          exactBoard: true,
          fillWidth: true,
          cellPx: CELL_PX,
          itemsById: board.itemsById,
          getSpriteUrl: oppBoard?.getSpriteUrl || board.getSpriteUrl,
          placements: oppPlacements,
          appear: false,
        })
      : null;
  if (oppGrid) stampPlacementKeys(oppGrid.el, oppPlacements);

  const fieldEl = liveRoot().querySelector('.sim-field');
  const bagsHost =
    fieldEl instanceof HTMLElement ? fieldEl : liveRoot().querySelector('.sim-bags');

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
   * Also injects board adjacency counters (Prismatic Orb `$n_magic` etc.).
   * @param {Element} el
   */
  function getLiveTipItem(el) {
    if (el instanceof HTMLElement && el.closest('[data-sim-build-browser]')) {
      return null;
    }
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
    const placements = board.placements || [];
    let resolveKey = key;
    if (!resolveKey && id) {
      const sameId = placements.filter((p) => p.id === id);
      if (sameId.length === 1 && sameId[0].key) {
        resolveKey = String(sameId[0].key);
      }
    }
    const placementCounters =
      resolveKey && canAffect
        ? computePlacementCounters(
            base,
            placements,
            board.itemsById,
            canAffect,
            resolveKey,
          )
        : null;
    return mergeLiveItemStats(base, live, t, { placementCounters });
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
    const a = liveRoot().querySelector('[data-settings-permalink]');
    if (a instanceof HTMLAnchorElement) a.href = `?${permalinkQs()}`;
  }

  function dummyQueryPatch() {
    return {
      dummyBlock: dummySettings.block,
      dummyHp: dummySettings.maxHp,
      dummyAtk: dummySettings.attacks ? null : false,
      dummyDmg: dummySettings.damage,
      dummyCd: dummySettings.interval,
    };
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
        ...dummyQueryPatch(),
        foe: permalinkFoe(),
        oppSlug: permalinkOppSlug(),
        oppRound: foeMode === 'build' ? currentOppRound : null,
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
        dummyBlock: foeMode === 'dummy' ? dummySettings.block : 0,
        dummyMaxHp: foeMode === 'dummy' ? dummySettings.maxHp : null,
        dummyAttacks: foeMode === 'dummy' ? dummySettings.attacks : false,
        dummyAttackDamage: foeMode === 'dummy' ? dummySettings.damage : null,
        dummyAttackCd: foeMode === 'dummy' ? dummySettings.interval : null,
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
        labelsEnabled: combatLabelsOn,
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
        onScrubEvents(evs) {
          fx?.scrubEvents(evs);
        },
        onTime(t) {
          scheduleQuerySync(t, scrubber?.getSpeed?.() ?? 1);
        },
        onSpeed(speed) {
          startSpeed = speed;
          fx?.setRate(speed);
          scheduleQuerySync(startT ?? 0, speed);
        },
        onPlayingChange(playing) {
          combatResults?.setPlaying(playing);
        },
      });
      fx.setRate(scrubber?.getSpeed?.() ?? 1);

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
        ...dummyQueryPatch(),
        foe: permalinkFoe(),
        oppSlug: permalinkOppSlug(),
        oppRound: foeMode === 'build' ? currentOppRound : null,
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
    if (foeMode === 'mirror' && oppBoard && oppGrid) {
      oppBoard.placements = board.placements.map((p) => ({
        ...p,
        gems: p.gems ? [...p.gems] : undefined,
      }));
      oppBoard.round = board.round;
      oppBoard.playerMaxHp = board.playerMaxHp;
      oppBoard.playerMaxStamina = board.playerMaxStamina;
      currentOppRound = board.round;
      oppPlacements = tagOpponentPlacements(oppBoard.placements);
      oppGrid.update(oppPlacements, board.itemsById, { appear: true });
      stampPlacementKeys(oppGrid.el, oppPlacements);
    }
    startT = 0;
    mountRun();
    patchSimQuery({ round: board.round, t: null });
    syncStageAvatars();
  }

  /**
   * @param {{ round: number, placements: object[] } | null} frame
   * @param {{ published?: boolean }} meta
   */
  function applyOppRound(frame, meta) {
    if (!oppBoard || !oppGrid || foeMode === 'dummy') return;
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
    syncStageAvatars();
  }

  /** @type {ReturnType<typeof mountSimRoundPicker> | null} */
  let youRoundPicker = null;
  /** @type {ReturnType<typeof mountSimRoundPicker> | null} */
  let oppRoundPicker = null;
  /** @type {ReturnType<typeof mountFoeOpponentRail> | null} */
  let foeOpponentRailUi = null;
  /** @type {ReturnType<typeof mountSimDummySettings> | null} */
  let dummySettingsUi = null;
  /** @type {ReturnType<typeof mountYouPersonRail> | null} */
  let youPersonRailUi = null;

  function syncStageAvatars() {
    const youSlot = liveRoot().querySelector('[data-sim-avatar="you"]');
    const foeSlot = liveRoot().querySelector('[data-sim-avatar="foe"]');
    const effectiveYouMode =
      youAvatarMode === 'blob'
        ? 'blob'
        : youAvatarMode === 'profile' && discordAvatarUrl
          ? 'profile'
          : 'class';
    setAvatarSrc(
      youSlot instanceof HTMLElement ? youSlot : null,
      resolveYouAvatar(root, board, {
        mode: effectiveYouMode,
        profileAvatarUrl: discordAvatarUrl,
        blobAvatarUrl,
      }),
    );
    setAvatarSrc(
      foeSlot instanceof HTMLElement ? foeSlot : null,
      resolveFoeAvatar(root, foeMode, oppBoard, board, {
        profileAvatarUrl: equippedAvatarUrl,
        profileIsBlob,
      }),
    );
    youPersonRailUi?.update?.({
      mode: effectiveYouMode,
      classSrc: classIconPath(root, board.heroClass) || classIconPath(root, 'adventurer') || '',
      profileUrl: discordAvatarUrl,
      blobUrl: blobAvatarUrl,
      root,
    });
  }

  function paintFoeAvatarHost() {
    const host = liveRoot().querySelector('[data-sim-foe-avatar-host]');
    if (!(host instanceof HTMLElement)) return;
    host.innerHTML = foeAvatarStackHtml(
      resolveFoeAvatar(root, foeMode, oppBoard, board, {
        profileAvatarUrl: equippedAvatarUrl,
        profileIsBlob,
      }),
    );
  }

  function updateOppHudChrome() {
    const name = simOppBannerName(foeMode, oppBoard);
    dummyHudEl.setAttribute('aria-label', name);
    const nameEl = dummyHudEl.querySelector('.sim-hud__name');
    if (nameEl) nameEl.textContent = name;
    syncStageAvatars();
  }

  function remountOppRoundPicker() {
    oppRoundPicker?.destroy?.();
    oppRoundPicker = null;
    oppStage =
      liveRoot().querySelector('.sim-field__bag--opp .sim-bag-stage') instanceof
      HTMLElement
        ? /** @type {HTMLElement} */ (
            liveRoot().querySelector('.sim-field__bag--opp .sim-bag-stage')
          )
        : null;
    oppBagHost =
      liveRoot().querySelector('.sim-field__bag--opp [data-sim-bag-slot]') instanceof
      HTMLElement
        ? /** @type {HTMLElement} */ (
            liveRoot().querySelector('.sim-field__bag--opp [data-sim-bag-slot]')
          )
        : null;
    if (
      foeMode !== 'dummy' &&
      oppBoard &&
      oppStage instanceof HTMLElement &&
      oppBagHost instanceof HTMLElement
    ) {
      oppRoundPicker = mountSimRoundPicker(oppStage, {
        board: oppBoard,
        root,
        bagHost: oppBagHost,
        onBoardChange: applyOppRound,
      });
    }
  }

  /**
   * @param {{ appear?: boolean }} [opts]
   */
  function remountOppGrid(opts = {}) {
    const appear = opts.appear === true;
    oppGrid?.destroy?.();
    oppGrid = null;
    oppBagHost =
      liveRoot().querySelector('.sim-field__bag--opp [data-sim-bag-slot]') instanceof
      HTMLElement
        ? /** @type {HTMLElement} */ (
            liveRoot().querySelector('.sim-field__bag--opp [data-sim-bag-slot]')
          )
        : null;
    if (oppBagHost instanceof HTMLElement && oppPlacements.length) {
      oppGrid = mountPlacedGrid(oppBagHost, {
        cols: BOARD_COLS,
        rows: BOARD_ROWS,
        exactBoard: true,
        fillWidth: true,
        cellPx: CELL_PX,
        itemsById: board.itemsById,
        getSpriteUrl: oppBoard?.getSpriteUrl || board.getSpriteUrl,
        placements: oppPlacements,
        appear,
      });
      stampPlacementKeys(oppGrid.el, oppPlacements);
    }
  }

  function remountDummySettingsUi() {
    dummySettingsUi?.destroy?.();
    dummySettingsUi = null;
    const dummyHost = liveRoot().querySelector('[data-sim-dummy-settings]');
    if (foeMode === 'dummy' && dummyHost instanceof HTMLElement) {
      dummyHost.hidden = false;
      dummySettingsUi = mountSimDummySettings(dummyHost, {
        settings: dummySettings,
        onApply: (next) => {
          dummySettings = next;
          saveDummyPreset(next);
          startT = 0;
          patchSimQuery({
            ...dummyQueryPatch(),
            t: null,
          });
          syncPermalinkAnchor();
          mountRun();
        },
      });
    } else if (dummyHost instanceof HTMLElement) {
      dummyHost.hidden = true;
      dummyHost.innerHTML = '';
    }
  }

  /** Opp column chrome + bag grid (sim still deferred). */
  function paintOppColumnShell() {
    if (!(oppColumn instanceof HTMLElement)) return;
    syncOppColumnHead(oppColumn, {
      title: simOppTitle(foeMode, oppBoard),
      classIconHtml: bagClassIconHtml(root, oppBoard?.heroClass),
    });
    setOppColumnBody(oppColumn, simOppBodyHtml(foeMode, oppBoard, root));
    remountOppGrid({ appear: false });
    remountOppRoundPicker();
    remountDummySettingsUi();
    paintFoeAvatarHost();
    updateOppHudChrome();
  }

  /** @type {number} */
  let foeApplyGen = 0;

  /**
   * After foe chrome + bag paint, yield a frame then re-sim.
   * Bumps generation so rapid Dummy↔Mirror clicks cancel stale work.
   */
  function scheduleFoeHeavyWork() {
    const gen = ++foeApplyGen;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (gen !== foeApplyGen) return;
        mountRun();
      });
    });
  }

  /**
   * Switch Dummy / Mirror / Public build without a full page reload.
   * @param {{ mode: import('./foe/sim-foe-mode.js').SimFoeMode, oppSlug: string | null, oppRound: number | null }} next
   * @returns {Promise<boolean>}
   */
  async function applyFoeChange(next) {
    if (next.mode === 'dummy') {
      foeMode = 'dummy';
      oppBoard = null;
      oppPlacements = [];
      currentOppRound = null;
      publishedOppPlacements = [];
    } else if (next.mode === 'mirror') {
      foeMode = 'mirror';
      oppBoard = buildMirrorOppBoard(board);
      oppPlacements = tagOpponentPlacements(oppBoard.placements);
      currentOppRound = board.round ?? null;
      publishedOppPlacements = (board.publishedPlacements || board.placements).map(
        (p) => ({ ...p, gems: p.gems ? [...p.gems] : undefined }),
      );
    } else {
      const slug = String(next.oppSlug || '').trim();
      if (!slug) {
        window.alert('Choose a public build.');
        return false;
      }
      const loaded = await loadSimBoardForSlug(slug, next.oppRound).catch(() => ({
        source: 'empty',
        title: 'Opponent not found',
        authorName: null,
        heroClass: null,
        slug,
        round: next.oppRound,
        placements: [],
        itemsById: new Map(),
        getSpriteUrl: () => '',
        error: `Could not load opponent build “${slug}”.`,
      }));
      if (!loaded?.placements?.length || loaded.error) {
        window.alert(
          loaded?.error || `Could not load opponent build “${slug}”.`,
        );
        return false;
      }
      foeMode = 'build';
      oppBoard = loaded;
      for (const [id, item] of oppBoard.itemsById || []) {
        if (!board.itemsById.has(id)) board.itemsById.set(id, item);
      }
      oppPlacements = tagOpponentPlacements(oppBoard.placements);
      currentOppRound = next.oppRound ?? oppBoard.round ?? null;
      publishedOppPlacements = (
        oppBoard.publishedPlacements || oppBoard.placements
      ).map((p) => ({
        ...p,
        gems: p.gems ? [...p.gems] : undefined,
      }));
    }

    const warnEl = liveRoot().querySelector('[data-sim-opp-warn]');
    if (warnEl instanceof HTMLElement) {
      warnEl.hidden = true;
      warnEl.textContent = '';
    }

    startT = 0;
    paintOppColumnShell();
    foeOpponentRailUi?.update?.({
      mode: foeMode,
      oppSlug: foeMode === 'build' ? oppBoard?.slug || next.oppSlug : null,
      oppRound: foeMode === 'build' ? currentOppRound : null,
    });
    patchSimQuery({
      foe: foeMode,
      oppSlug: foeMode === 'build' ? oppBoard?.slug || next.oppSlug : null,
      oppRound: foeMode === 'build' ? currentOppRound : null,
      t: null,
    });
    syncPermalinkAnchor();
    scheduleFoeHeavyWork();
    return true;
  }

  /** @type {{ close: () => void } | null} */
  let buildBrowserUi = null;

  function openPublicBuildBrowser() {
    const field = liveRoot().querySelector('.sim-field');
    if (!(field instanceof HTMLElement)) return;
    buildBrowserUi?.close?.();
    buildBrowserUi = openSimBuildBrowser(field, {
      root,
      onSelect: async (slug) => {
        await applyFoeChange({
          mode: 'build',
          oppSlug: slug,
          oppRound: null,
        });
      },
      onClose: () => {
        buildBrowserUi = null;
      },
    });
  }

  const foeColumn = liveRoot().querySelector('.sim-field__bag--opp');
  if (foeColumn instanceof HTMLElement) {
    foeOpponentRailUi = mountFoeOpponentRail(foeColumn, {
      mode: foeMode,
      oppSlug: query.oppSlug || oppBoard?.slug || null,
      oppRound: foeMode === 'build' ? currentOppRound : null,
      onApply: (next) => applyFoeChange(next),
      onRequestPublicBuild: openPublicBuildBrowser,
    });
  }

  remountDummySettingsUi();

  const settingsDock = liveRoot().querySelector('[data-sim-settings-dock]');
  const shellEl = liveRoot().querySelector('.sim-shell');
  const settingsPanel =
    settingsDock instanceof HTMLElement
      ? mountSimSettingsPanel(settingsDock, {
          assetRoot: root,
          shell: shellEl instanceof HTMLElement ? shellEl : null,
          onAdvancedChange: (on) => {
            advancedView = on;
            tip.refresh?.(getLiveTipItem);
          },
          onIconEnlargeChange: (on) => {
            playerHud.setIconEnlarge?.(on);
            dummyHud.setIconEnlarge?.(on);
          },
          onCombatLabelsChange: (on) => {
            combatLabelsOn = on;
            fx?.setLabelsEnabled?.(on);
          },
          onSoundsMutedChange: (on) => {
            fx?.setSoundsMuted?.(on);
          },
          getPermalinkHref: () => `?${permalinkQs()}`,
          onCopyLink: async () => {
            const url = `${location.origin}${location.pathname}?${permalinkQs()}`;
            await navigator.clipboard.writeText(url);
          },
          onCopyReport: async () => {
            if (!currentRun) throw new Error('no run');
            await copySimReportJson(buildSimDebugReport(currentRun, reportMeta()));
          },
          onDownloadReport: () => {
            if (!currentRun) return;
            downloadSimRun(currentRun, reportMeta());
          },
        })
      : null;

  const reportUi = mountSimReportUi({
    getSnapshot: reportIssueSnapshot,
  });
  main.addEventListener('click', (ev) => {
    const t = ev.target;
    if (!(t instanceof Element) || !t.closest('[data-sim-report-open]')) return;
    ev.preventDefault();
    reportUi.open();
  });

  const youAvatarColumn = liveRoot().querySelector('.sim-field__bag--you');
  if (youAvatarColumn instanceof HTMLElement) {
    youPersonRailUi = mountYouPersonRail(youAvatarColumn, {
      mode: youAvatarMode,
      classSrc: classIconPath(root, board.heroClass) || classIconPath(root, 'adventurer') || '',
      profileUrl: discordAvatarUrl,
      blobUrl: blobAvatarUrl,
      root,
      onChange: (mode) => {
        youAvatarMode = mode;
        saveYouAvatarMode(mode);
        syncStageAvatars();
      },
    });
  }

  paintFoeAvatarHost();
  syncStageAvatars();

  if (!entitled) {
    applySimPremiumLock(liveRoot(), { signedIn });
    savePremiumIntent({
      key: SIM_HARD_GATE_INTENT,
      reason: SIM_PREMIUM_REASON,
    });
    await waitForSimAssets(bootStage);
    revealSimBoot(main, bootStage);
    await openSimPremiumGate({ signedIn });
    window.addEventListener(
      'pagehide',
      () => {
        window.clearTimeout(permalinkTimer);
        settingsPanel?.destroy();
        foeOpponentRailUi?.destroy?.();
        dummySettingsUi?.destroy?.();
        youPersonRailUi?.destroy?.();
        tip?.destroy?.();
        grid.destroy();
        oppGrid?.destroy();
      },
      { once: true },
    );
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

  remountOppRoundPicker();

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
      foeOpponentRailUi?.destroy?.();
      dummySettingsUi?.destroy?.();
      youPersonRailUi?.destroy?.();
      tip?.destroy?.();
      grid.destroy();
      oppGrid?.destroy();
    },
    { once: true },
  );

    await waitForSimAssets(bootStage);
    revealSimBoot(main, bootStage);
  } catch (err) {
    console.error('[sim] init failed', err);
    paintSimStatus(main, root, {
      kind: 'error',
      message:
        'Something went wrong loading the sim. Refresh the page or try a different build.',
    });
  }
}

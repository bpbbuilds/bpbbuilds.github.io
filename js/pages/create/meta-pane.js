/**
 * Create Build tab — title, notes, tags, rank, skills, essentials.
 * Chrome matches Item Library filters (OptionsFont + Patch3 shade).
 */

import { skillItems } from './load-catalog.js';
import { HERO_CLASSES } from '../items/filter-logic.js';
import {
  isLegalStartingBag,
  startingBagIdsForClass,
} from '../../shared/starting-bags.js';
import { createOpInfoModal } from './op-info-modal.js';
import { sumBoardGold } from './draft-gold.js';
import { createMetaDrops } from './meta-drops.js';
import { tryAutoPlaceStartingBag } from './starting-bag-place.js';

const RANKS = [
  { id: 'bronze', label: 'Bronze', file: 'League_Bronze.png' },
  { id: 'silver', label: 'Silver', file: 'League_Silver.png' },
  { id: 'gold', label: 'Gold', file: 'League_Gold.png' },
  { id: 'platinum', label: 'Platinum', file: 'League_Platinum.png' },
  { id: 'diamond', label: 'Diamond', file: 'League_Diamond.png' },
  { id: 'master', label: 'Master', file: 'League_Master.png' },
  { id: 'grandmaster', label: 'Grandmaster', file: 'League_Grandmaster.png' },
  { id: 'grandma', label: 'Grandma', file: 'League_Grandma.png' },
];

/**
 * @param {HTMLElement} host
 * @param {{
 *   state: ReturnType<import('./editor-state.js').createEditorState>,
 *   itemsById: Map<string, object>,
 *   items: object[],
 *   getSpriteUrl: (item: object) => string,
 *   root: string,
 * }} opts
 */
export function mountMetaPane(host, opts) {
  const { state, itemsById, getSpriteUrl } = opts;
  const root = opts.root.endsWith('/') ? opts.root : `${opts.root}/`;
  const opInfo = createOpInfoModal();

  const classBtns = HERO_CLASSES.map(
    (c) => `
    <button
      type="button"
      class="il-filter__icon-btn"
      data-hero-class="${escapeAttr(c)}"
      title="${escapeAttr(c)}"
      role="radio"
      aria-checked="false"
    >
      <img src="${escapeAttr(root)}assets/icons/classes/${escapeAttr(c)}Icon.png" alt="" draggable="false" />
    </button>`,
  ).join('');

  const rankBtns = RANKS.map(
    (r) => `
    <button
      type="button"
      class="il-filter__icon-btn"
      data-rank="${escapeAttr(r.id)}"
      title="${escapeAttr(r.label)}"
      role="radio"
      aria-checked="false"
    >
      <img
        src="${escapeAttr(root)}assets/icons/leagues/${escapeAttr(r.file)}"
        alt=""
        draggable="false"
      />
    </button>`,
  ).join('');

  host.innerHTML = `
    <div class="create-meta">
      <div class="il-filter__shade cr-field-shade">
        <label class="cr-field">
          <span class="cr-label">Title</span>
          <input type="text" class="cr-input" data-field="title" maxlength="80" autocomplete="off" placeholder="Build name…" />
        </label>
      </div>

      <div class="il-filter__shade cr-field-shade">
        <label class="cr-field">
          <span class="cr-label">Why it works</span>
          <textarea
            class="cr-input cr-textarea cr-textarea--notes"
            data-field="notes"
            maxlength="4000"
            rows="5"
            placeholder="Synergies, route tips, what makes the board tick…"
          ></textarea>
        </label>
      </div>

      <section class="cr-class" aria-label="Class">
        <h3 class="cr-label cr-label--block">Class</h3>
        <p class="cr-hint">Required. Pick the hero class.</p>
        <div class="il-filter__shade il-filter__classes" role="radiogroup" aria-label="Hero class">
          ${classBtns}
        </div>
      </section>

      <section class="cr-starting-bag" aria-label="Starting bag">
        <h3 class="cr-label cr-label--block">Starting bag</h3>
        <p class="cr-hint">Required loadout pick. You can sell it off the board.</p>
        <div
          class="il-filter__shade il-filter__classes cr-starting-bag__row"
          role="radiogroup"
          aria-label="Starting bag"
          data-starting-bag-row
        ></div>
      </section>

      <section class="cr-tags il-filter__shade" aria-label="Build tags">
        <h3 class="cr-label cr-label--block">Tags</h3>
        <p class="cr-hint">Required. Theory / Feasible / Real (Real needs attached history). Request OP asks for admin review — the public badge is not instant. Request OP can’t pair with Theory.</p>
        <div class="cr-tags__list" role="group" aria-label="Tags">
          <button type="button" class="cr-tag" data-tag="theory" aria-pressed="false">Theory</button>
          <button type="button" class="cr-tag" data-tag="feasible" aria-pressed="false">Feasible</button>
          <button type="button" class="cr-tag" data-tag="real" aria-pressed="false" disabled title="Load a run from History to mark Real">Real</button>
          <span class="cr-tag-with-info">
            <button type="button" class="cr-tag cr-tag--op" data-tag="op" aria-pressed="false">Request OP</button>
            <button
              type="button"
              class="cr-tag-info"
              data-op-info
              aria-label="What does Request OP mean?"
              title="What does Request OP mean?"
            >i</button>
          </span>
        </div>
      </section>

      <div class="il-filter__shade cr-field-shade">
        <label class="cr-field">
          <span class="cr-label">YouTube video</span>
          <input
            type="url"
            class="cr-input"
            data-field="youtube_url"
            autocomplete="off"
            placeholder="https://www.youtube.com/watch?v=…"
            inputmode="url"
          />
        </label>
        <p class="cr-hint">Optional. Showcase or run footage — welcome on OP builds.</p>
      </div>

      <div
        class="build-info__tier build-info__shade build-info__stat build-info__stat--gold cr-gold-stat"
        aria-label="Gold"
      >
        <h4 class="build-info__tier-label build-info__ui-text">Gold</h4>
        <p class="build-info__stat-value">
          <span class="build-info__gold">
            <span class="build-info__gold-num build-info__ui-text" data-gold-value>0</span>
            <img
              class="build-info__gold-icon"
              src="${escapeAttr(root)}assets/tooltips/icons/Gold.png"
              alt=""
              width="28"
              height="28"
              aria-hidden="true"
            />
          </span>
        </p>
      </div>

      <section class="cr-rank" aria-label="Rank">
        <h3 class="cr-label cr-label--block">Rank</h3>
        <p class="cr-hint">Required. League this build was aimed at.</p>
        <div class="il-filter__shade il-filter__classes cr-rank__row" role="radiogroup" aria-label="League rank">
          ${rankBtns}
        </div>
      </section>

      <section class="cr-route il-filter__shade" aria-label="Round skills">
        <h3 class="cr-label cr-label--block">Round skills</h3>
        <p class="cr-hint">Required. Drag a skill from the catalog into each slot (or click slot, then a skill).</p>
        <div class="cr-field-row">
          <div class="cr-ess__tier">
            <span class="cr-label cr-label--sm">Round 3</span>
            <button type="button" class="cr-ess__drop cr-ess__drop--skill" data-route="r3" aria-label="Round 3 skill slot">
              <span class="cr-ess__drop-ph">Drop skill</span>
            </button>
          </div>
          <div class="cr-ess__tier">
            <span class="cr-label cr-label--sm">Round 10</span>
            <button type="button" class="cr-ess__drop cr-ess__drop--skill" data-route="r10" aria-label="Round 10 skill slot">
              <span class="cr-ess__drop-ph">Drop skill</span>
            </button>
          </div>
        </div>
      </section>

      <section class="build-info__section build-info__ess" aria-label="Essentials">
        <p class="cr-hint">Drag a board item onto a tier (item must be on the board first).</p>
        <div class="build-info__ess-grid">
          <button type="button" class="build-info__tier build-info__shade" data-priority="needed" data-tier-box="needed" aria-label="Needs">
            <h4 class="build-info__tier-label build-info__ui-text">Needs</h4>
            <p class="build-info__empty" data-tier-empty="needed">—</p>
            <ul class="build-info__list" data-tier-list="needed" hidden></ul>
          </button>
          <button type="button" class="build-info__tier build-info__shade" data-priority="nice" data-tier-box="nice" aria-label="Wants">
            <h4 class="build-info__tier-label build-info__ui-text">Wants</h4>
            <p class="build-info__empty" data-tier-empty="nice">—</p>
            <ul class="build-info__list" data-tier-list="nice" hidden></ul>
          </button>
          <button type="button" class="build-info__tier build-info__shade build-info__tier--wide" data-priority="optional" data-tier-box="optional" aria-label="Good to have">
            <h4 class="build-info__tier-label build-info__ui-text">Good to have</h4>
            <p class="build-info__empty" data-tier-empty="optional">—</p>
            <ul class="build-info__list" data-tier-list="optional" hidden></ul>
          </button>
        </div>
      </section>
    </div>
  `;

  const titleInput = host.querySelector('[data-field="title"]');
  const notesInput = host.querySelector('[data-field="notes"]');
  const youtubeInput = host.querySelector('[data-field="youtube_url"]');
  const goldValueEl = host.querySelector('[data-gold-value]');
  const startingBagRow = host.querySelector('[data-starting-bag-row]');
  const drops = createMetaDrops({ host, state, itemsById, getSpriteUrl });
  /** @type {string} */
  let paintedStartingHero = '';

  function syncGoldFromBoard() {
    const d = state.getDraft();
    const next = sumBoardGold(d.placements, itemsById);
    if (d.gold_count !== next) {
      state.patchMeta({ gold_count: next });
    }
  }

  function paintStartingBagButtons(hero) {
    if (!(startingBagRow instanceof HTMLElement)) return;
    const ids = startingBagIdsForClass(hero);
    if (paintedStartingHero === hero && startingBagRow.childElementCount === ids.length) {
      return;
    }
    paintedStartingHero = hero;
    startingBagRow.replaceChildren();
    if (!ids.length) {
      const empty = document.createElement('p');
      empty.className = 'cr-hint';
      empty.textContent = 'Pick a class to choose a starting bag.';
      startingBagRow.append(empty);
      return;
    }
    for (const id of ids) {
      const item = itemsById.get(id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'il-filter__icon-btn cr-starting-bag__btn';
      btn.dataset.startingBag = id;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      const name = String(item?.name || id);
      btn.title = name;
      btn.setAttribute('aria-label', name);
      const img = document.createElement('img');
      img.alt = '';
      img.draggable = false;
      img.src = item ? getSpriteUrl(item) : '';
      btn.append(img);
      startingBagRow.append(btn);
    }
  }

  function syncForm() {
    const d = state.getDraft();
    if (titleInput instanceof HTMLInputElement && titleInput.value !== d.title) {
      titleInput.value = d.title;
    }
    if (notesInput instanceof HTMLTextAreaElement && notesInput.value !== d.notes) {
      notesInput.value = d.notes || '';
    }
    const yt = d.youtube_url || '';
    if (youtubeInput instanceof HTMLInputElement && youtubeInput.value !== yt) {
      youtubeInput.value = yt;
    }
    if (goldValueEl instanceof HTMLElement) {
      goldValueEl.textContent = String(d.gold_count ?? 0);
    }

    host.querySelectorAll('[data-hero-class]').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const on = el.dataset.heroClass === d.hero_class;
      el.classList.toggle('is-on', on);
      el.setAttribute('aria-checked', on ? 'true' : 'false');
    });

    paintStartingBagButtons(d.hero_class);
    // Drop illegal leftover pick after class change / bad import
    if (
      d.starting_bag_id &&
      !isLegalStartingBag(d.hero_class, d.starting_bag_id)
    ) {
      state.patchMeta({ starting_bag_id: null });
      return;
    }
    host.querySelectorAll('[data-starting-bag]').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const on = el.dataset.startingBag === d.starting_bag_id;
      el.classList.toggle('is-on', on);
      el.setAttribute('aria-checked', on ? 'true' : 'false');
    });

    const hasHistory = Boolean(d.history?.rounds?.length);
    host.querySelectorAll('.cr-tag[data-tag]').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const tag = el.dataset.tag;
      const on = tag === 'op' ? !!d.is_op : tag === d.build_tag;
      el.classList.toggle('is-on', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (tag === 'real') {
        el.disabled = !hasHistory;
        el.title = hasHistory
          ? 'Published with attached run history'
          : 'Load a run from History to mark Real';
        el.classList.toggle('is-disabled', !hasHistory);
      }
    });

    host.querySelectorAll('[data-rank]').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const on = el.dataset.rank === d.rank;
      el.classList.toggle('is-on', on);
      el.setAttribute('aria-checked', on ? 'true' : 'false');
    });

    drops.paintRoute();
  }

  /** @param {Event} e */
  function onInput(e) {
    const t = e.target;
    if (t instanceof HTMLTextAreaElement) {
      if (t.dataset.field === 'notes') state.patchMeta({ notes: t.value });
      return;
    }
    if (!(t instanceof HTMLInputElement)) return;
    if (t.dataset.field === 'title') state.patchMeta({ title: t.value });
    if (t.dataset.field === 'youtube_url') {
      const raw = t.value.trim();
      state.patchMeta({ youtube_url: raw || null });
    }
  }

  /** @param {MouseEvent} e */
  function onClick(e) {
    const t = e.target instanceof Element ? e.target : null;

    const classBtn = t?.closest?.('[data-hero-class]');
    if (classBtn instanceof HTMLElement && host.contains(classBtn)) {
      const hero = classBtn.dataset.heroClass;
      if (hero) {
        const cur = state.getDraft().hero_class;
        if (hero !== cur) {
          state.patchMeta({ hero_class: hero, starting_bag_id: null });
        }
      }
      return;
    }

    const bagBtn = t?.closest?.('[data-starting-bag]');
    if (bagBtn instanceof HTMLElement && host.contains(bagBtn)) {
      const bagId = bagBtn.dataset.startingBag || '';
      const d = state.getDraft();
      if (!isLegalStartingBag(d.hero_class, bagId)) return;
      if (d.starting_bag_id === bagId) return;
      state.patchMeta({ starting_bag_id: bagId });
      tryAutoPlaceStartingBag({ state, itemsById, itemId: bagId });
      return;
    }

    const routeSlot = t?.closest?.('[data-route]');
    if (routeSlot instanceof HTMLElement && host.contains(routeSlot)) {
      drops.handleRouteClick(routeSlot);
      return;
    }

    const infoBtn = t?.closest?.('[data-op-info]');
    if (infoBtn instanceof HTMLElement && host.contains(infoBtn)) {
      opInfo.open();
      return;
    }

    const tagBtn = t?.closest?.('.cr-tag[data-tag]');
    if (tagBtn instanceof HTMLElement && host.contains(tagBtn)) {
      const tag = tagBtn.dataset.tag;
      const d = state.getDraft();
      const hasHistory = Boolean(d.history?.rounds?.length);
      if (tag === 'op') {
        const next = !d.is_op;
        state.patchMeta({
          is_op: next,
          ...(next && d.build_tag === 'theory' ? { build_tag: null } : {}),
        });
        return;
      }
      if (tag !== 'theory' && tag !== 'feasible' && tag !== 'real') return;
      if (tag === 'real' && !hasHistory) return;
      // With history attached, stay on Real (Theory/Feasible would desync meaning)
      if (hasHistory && (tag === 'theory' || tag === 'feasible')) return;
      const nextTag = d.build_tag === tag ? null : tag;
      if (hasHistory && nextTag == null) return;
      state.patchMeta({
        build_tag: nextTag,
        ...(nextTag === 'theory' && d.is_op ? { is_op: false } : {}),
      });
      return;
    }

    const rankBtn = t?.closest?.('[data-rank]');
    if (rankBtn instanceof HTMLElement && host.contains(rankBtn)) {
      const rank = rankBtn.dataset.rank || null;
      const cur = state.getDraft().rank;
      state.patchMeta({ rank: cur === rank ? null : rank });
      return;
    }

    const listItem = t?.closest?.('.build-info__list-item');
    if (listItem instanceof HTMLElement && listItem.dataset.key) {
      state.setSelectedKey(listItem.dataset.key);
      return;
    }

    const tierBox = t?.closest?.('.build-info__tier[data-priority]');
    if (tierBox instanceof HTMLElement && host.contains(tierBox)) {
      drops.handleTierClick(tierBox);
    }
  }

  host.addEventListener('input', onInput);
  host.addEventListener('click', onClick);

  const unsub = state.subscribe(() => {
    syncGoldFromBoard();
    syncForm();
  });
  syncGoldFromBoard();
  syncForm();

  void skillItems(opts.items);

  return {
    tryAssignSkill: drops.tryAssignSkill,
    getDropTarget: drops.getDropTarget,
    isOverBuildPanel: drops.isOverBuildPanel,
    updateDropHover: drops.updateDropHover,
    clearDropHover: drops.clearDropHover,
    tryCommitDrop: drops.tryCommitDrop,
    destroy() {
      unsub();
      opInfo.destroy();
      host.replaceChildren();
    },
  };
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
